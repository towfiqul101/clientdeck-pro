import { NextResponse } from "next/server";
import { after } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  findOrCreateConversation,
  getConversationMessages,
  getGHLLocationPhone,
  sendConversationMessage,
} from "@/lib/ghl/api";
import { escapeHtml } from "@/lib/email/index";
import { sendPushToClient } from "@/lib/push/send";

export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 1600;

async function logSendAttempt(
  agencyId: string,
  clientId: string,
  actorId: string,
  channel: "SMS" | "Email",
  ok: boolean,
  error?: string
) {
  const supabase = await createServerSupabaseClient();
  await supabase.from("activity_log").insert({
    agency_id: agencyId,
    client_id: clientId,
    actor_type: "staff",
    actor_id: actorId,
    action: ok ? "Message sent" : "Message send failed",
    description: ok
      ? `${channel} message sent to client.`
      : `${channel} message failed to send: ${error ?? "unknown error"}`,
    metadata: { channel, error: error ?? null },
  });
}

export async function GET(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const clientId = new URL(req.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "Missing clientId." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, ghl_contact_id")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ ok: false, error: "Client not found." }, { status: 404 });
  }

  const { agency } = session;
  if (!client.ghl_contact_id) {
    return NextResponse.json({ ok: true, messages: [], conversationId: null, unlinked: true });
  }
  if (!agency.ghl_api_key || !agency.ghl_location_id) {
    return NextResponse.json({ ok: true, messages: [], conversationId: null, unconfigured: true });
  }

  const opts = { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id };

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
      const { data: origins } = await supabase
        .from("message_origins")
        .select("message_id, origin")
        .in("message_id", messageIds);
      originMap = new Map((origins ?? []).map((o) => [o.message_id, o.origin]));
    }

    const merged = messages
      .map((m) => ({
        ...m,
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
    console.error("[ghl/messages] GET failed:", e);
    return NextResponse.json({ ok: false, error: "Failed to load messages." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let body: { clientId?: string; type?: string; message?: string; subject?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const { clientId, type } = body;
  const message = (body.message ?? "").trim();
  const subject = (body.subject ?? "").trim();

  if (!clientId || (type !== "SMS" && type !== "Email")) {
    return NextResponse.json({ ok: false, error: "Missing clientId or type." }, { status: 400 });
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

  const supabase = await createServerSupabaseClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, ghl_contact_id, email, phone")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ ok: false, error: "Client not found." }, { status: 404 });
  }

  const { agency, userId } = session;
  if (!client.ghl_contact_id) {
    return NextResponse.json({ ok: false, error: "Client isn't linked to a GHL contact." }, { status: 400 });
  }
  if (!agency.ghl_api_key || !agency.ghl_location_id) {
    return NextResponse.json({ ok: false, error: "Connect GoHighLevel in Settings first." }, { status: 400 });
  }
  if (type === "SMS" && !client.phone) {
    return NextResponse.json({ ok: false, error: "Client has no phone number on file." }, { status: 400 });
  }
  if (type === "Email" && !client.email) {
    return NextResponse.json({ ok: false, error: "Client has no email on file." }, { status: 400 });
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
    // For Email, the conversation list's item `id` matches the send
    // response's `threadId`, NOT `messageId`/`emailMessageId` (confirmed by
    // sending a live test message and re-fetching the thread) — prefer it.
    // SMS sends have no `threadId`; `messageId` there matches the list id.
    const messageId = r.threadId ?? r.messageId ?? r.message?.id ?? r.id ?? null;
    if (messageId) {
      await supabase.from("message_origins").insert({
        message_id: messageId,
        agency_id: agency.id,
        client_id: client.id,
        origin: "staff",
      });
    }

    await logSendAttempt(agency.id, client.id, userId, type, true);

    // Non-blocking: let the client know via push that a new message came in.
    after(() =>
      sendPushToClient(client.id, {
        title: `New message from ${agency.name}`,
        body: message.slice(0, 120),
        url: "/portal/messages",
      }).catch((err) => console.error("[ghl/messages] push failed:", err))
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Send failed.";
    await logSendAttempt(agency.id, client.id, userId, type, false, errorMessage);
    console.error("[ghl/messages] POST failed:", e);
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 502 });
  }
}
