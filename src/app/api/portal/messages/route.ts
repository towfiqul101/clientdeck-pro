import { NextResponse } from "next/server";
import { after } from "next/server";
import { getPortalSession } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findOrCreateConversation,
  getConversationMessages,
  getGHLLocationPhone,
  sendConversationMessage,
} from "@/lib/ghl/api";
import { escapeHtml } from "@/lib/email/index";
import { resolveAssignedStaffEmail } from "@/lib/team/staff-contact";
import { sendStaffMessageAlert } from "@/lib/email/templates";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";

export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 1600;

async function logSendAttempt(
  agencyId: string,
  clientId: string,
  channel: "SMS" | "Email",
  ok: boolean,
  error?: string
) {
  const admin = createAdminClient();
  await admin.from("activity_log").insert({
    agency_id: agencyId,
    client_id: clientId,
    actor_type: "client",
    actor_id: clientId,
    action: ok ? "Message sent" : "Message send failed",
    description: ok
      ? `Client sent a ${channel} message.`
      : `Client's ${channel} message failed to send: ${error ?? "unknown error"}`,
    metadata: { channel, error: error ?? null },
  });
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`portal-msg-auth:${ip}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session expired." }, { status: 401 });
  }
  const { client, agency } = session;

  if (!client.ghl_contact_id) {
    return NextResponse.json({ ok: true, messages: [], conversationId: null, unlinked: true });
  }
  if (!agency.ghl_api_key || !agency.ghl_location_id) {
    return NextResponse.json({ ok: true, messages: [], conversationId: null, unconfigured: true });
  }

  const opts = { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id };
  const admin = createAdminClient();

  try {
    const conversationId = await findOrCreateConversation(client.ghl_contact_id, opts);
    if (!conversationId) {
      return NextResponse.json(
        { ok: false, error: "Could not reach GoHighLevel conversations." },
        { status: 502 }
      );
    }

    const messages = await getConversationMessages(conversationId, 50, opts);
    const messageIds = messages.map((m) => m.id);

    let originMap = new Map<string, string>();
    if (messageIds.length > 0) {
      const { data: origins } = await admin
        .from("message_origins")
        .select("message_id, origin")
        .in("message_id", messageIds);
      originMap = new Map((origins ?? []).map((o) => [o.message_id, o.origin]));
    }

    const merged = messages
      .map((m) => ({
        ...m,
        // GHL's own `direction` marks everything the location sends as
        // "outbound" regardless of whether staff or a client (via our portal)
        // sent it — only a genuine "inbound" reply can be confidently
        // attributed without an origin record. Matches the agency route's
        // fallback so both views agree absent a recorded origin.
        origin: originMap.get(m.id) ?? (m.direction === "inbound" ? "client" : "staff"),
      }))
      // GHL returns messages newest-first; render like a normal chat thread,
      // oldest at top, newest at the bottom.
      .sort(
        (a, b) =>
          new Date(a.dateAdded ?? 0).getTime() - new Date(b.dateAdded ?? 0).getTime()
      );

    return NextResponse.json({ ok: true, messages: merged, conversationId });
  } catch (e) {
    console.error("[portal/messages] GET failed:", e);
    return NextResponse.json({ ok: false, error: "Failed to load messages." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`portal-msg-send:${ip}`, 15, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many messages. Try again in a minute." }, { status: 429 });
  }

  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session expired." }, { status: 401 });
  }
  const { client, agency } = session;

  let body: { type?: string; message?: string; subject?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const { type } = body;
  const message = (body.message ?? "").trim();
  const subject = (body.subject ?? "").trim();

  if (type !== "SMS" && type !== "Email") {
    return NextResponse.json({ ok: false, error: "Invalid message type." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ ok: false, error: "Message is required." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }
  if (type === "Email" && !subject) {
    return NextResponse.json({ ok: false, error: "Subject is required for email." }, { status: 400 });
  }
  if (!client.ghl_contact_id) {
    return NextResponse.json({ ok: false, error: "Messaging isn't available for this account yet." }, { status: 400 });
  }
  if (!agency.ghl_api_key || !agency.ghl_location_id) {
    return NextResponse.json({ ok: false, error: "Messaging isn't configured yet." }, { status: 400 });
  }
  if (type === "SMS" && !client.phone) {
    return NextResponse.json({ ok: false, error: "No phone number on file." }, { status: 400 });
  }
  if (type === "Email" && !client.email) {
    return NextResponse.json({ ok: false, error: "No email on file." }, { status: 400 });
  }

  const opts = { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id };

  try {
    const conversationId = await findOrCreateConversation(client.ghl_contact_id, opts);
    if (!conversationId) throw new Error("Could not reach GoHighLevel conversations.");

    let sendResult: unknown;
    if (type === "SMS") {
      const fromNumber = await getGHLLocationPhone(opts);
      sendResult = await sendConversationMessage(
        { type: "SMS", conversationId, contactId: client.ghl_contact_id, message, fromNumber },
        opts
      );
    } else {
      sendResult = await sendConversationMessage(
        {
          type: "Email",
          conversationId,
          contactId: client.ghl_contact_id,
          subject,
          html: `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
          emailFrom: agency.owner_email,
          emailReplyTo: agency.owner_email,
        },
        opts
      );
    }

    const r = (sendResult ?? {}) as {
      threadId?: string;
      messageId?: string;
      message?: { id?: string };
      id?: string;
    };
    // See the matching comment in api/ghl/messages/route.ts — Email's list
    // item id matches `threadId`, not `messageId`/`emailMessageId`.
    const messageId = r.threadId ?? r.messageId ?? r.message?.id ?? r.id ?? null;

    const admin = createAdminClient();
    if (messageId) {
      await admin.from("message_origins").insert({
        message_id: messageId,
        agency_id: agency.id,
        client_id: client.id,
        origin: "client",
      });
    }

    await logSendAttempt(agency.id, client.id, type, true);

    // Non-blocking: notify whichever staff member is assigned to this
    // client (falls back to the agency owner) that a new message came in.
    const clientName = `${client.first_name} ${client.last_name}`;
    after(async () => {
      try {
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.roundtrackpro.com").replace(/\/$/, "");
        const staffEmail = await resolveAssignedStaffEmail(admin, client.assigned_to, agency.owner_email);
        await sendStaffMessageAlert({
          staffEmail,
          clientName,
          channel: type,
          preview: message.slice(0, 200),
          clientDashboardUrl: `${appUrl}/clients/${client.id}/messages`,
        });
      } catch (err) {
        console.error("[Email] Staff message alert failed:", err);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Send failed.";
    await logSendAttempt(agency.id, client.id, type, false, errorMessage);
    console.error("[portal/messages] POST failed:", e);
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 502 });
  }
}
