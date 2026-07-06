import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addGHLTag, removeGHLTag, updateGHLContactFields } from "@/lib/ghl/api";
import type { Agency, Client } from "@/types";

export type GHLNotificationType =
  | "round_sent"
  | "deletion_win"
  | "round_results_in"
  | "payment_failed"
  | "goal_achieved"
  | "portal_link"
  | "staff_new_client"
  | "staff_round_overdue"
  | "staff_next_round_ready"
  | "monthly_progress";

/** GHL contact tags that fire each event's agency-built workflow. Removed 5s after being added so they can refire next time. */
export const NOTIFICATION_TAGS: Record<GHLNotificationType, string> = {
  round_sent: "cdp-round-sent",
  deletion_win: "cdp-deletion-win",
  round_results_in: "cdp-round-complete",
  goal_achieved: "cdp-goal-achieved",
  payment_failed: "cdp-payment-failed",
  portal_link: "cdp-portal-sent",
  staff_new_client: "cdp-staff-new-client",
  staff_round_overdue: "cdp-staff-overdue",
  staff_next_round_ready: "cdp-next-round-ready",
  monthly_progress: "cdp-monthly-update",
};

/** Columns every notify* helper needs off a `clients` row. Select this whenever a call site needs to notify. */
export const NOTIFIABLE_CLIENT_COLUMNS =
  "id, first_name, last_name, email, phone, ghl_contact_id, ghl_opportunity_id, portal_token, monthly_fee, total_items_deleted, total_items_start, service_start_date, score_eq_current, score_exp_current, score_tu_current, score_eq_start, score_exp_start, score_tu_start";

export type NotifiableClient = Pick<
  Client,
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "ghl_contact_id"
  | "ghl_opportunity_id"
  | "portal_token"
  | "monthly_fee"
  | "total_items_deleted"
  | "total_items_start"
  | "service_start_date"
  | "score_eq_current"
  | "score_exp_current"
  | "score_tu_current"
  | "score_eq_start"
  | "score_exp_start"
  | "score_tu_start"
>;

export interface GHLNotificationPayload {
  contactId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  data: Record<string, string | number | boolean>;
}

interface NotificationLogIds {
  agencyId: string;
  clientId: string | null;
}

/**
 * Fires a notification by tagging the client's GHL contact (which fires the
 * agency's own workflow) and syncing relevant custom fields, falling back to
 * Resend email, falling back to a log-only no-op. Never throws — callers can
 * fire-and-forget or await without try/catch.
 */
export async function sendGHLNotification(
  agency: Agency,
  type: GHLNotificationType,
  payload: GHLNotificationPayload,
  logging: NotificationLogIds
): Promise<{ success: boolean; method: "ghl_tag" | "resend" | "none" }> {
  let result: { success: boolean; method: "ghl_tag" | "resend" | "none" } = {
    success: false,
    method: "none",
  };

  const hasGhl = Boolean(agency.ghl_api_key && agency.ghl_location_id && payload.contactId);

  if (hasGhl) {
    try {
      const opts = { apiKey: agency.ghl_api_key!, locationId: agency.ghl_location_id! };
      const tag = NOTIFICATION_TAGS[type];
      const fields = buildNotificationFields(type, payload.data);

      if (Object.keys(fields).length > 0) {
        await updateGHLContactFields(payload.contactId, fields, opts);
      }
      await addGHLTag(payload.contactId, [tag], opts);

      // Remove the tag shortly after so the same workflow can refire next
      // time this event happens for this contact. Never blocks the caller.
      // Uses after() (not a bare setTimeout) so Vercel keeps the function
      // alive until this completes instead of possibly freezing/recycling
      // it once the response is sent.
      after(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await removeGHLTag(payload.contactId, [tag], opts).catch((err) => {
          console.error(`[GHL Notification] Tag removal failed for ${type}:`, err);
        });
      });

      result = { success: true, method: "ghl_tag" };
    } catch (err) {
      console.error(`[GHL Notification] ${type} tag/field update failed:`, err);
    }
  }

  if (result.method === "none" && process.env.RESEND_API_KEY && payload.email) {
    try {
      const sent = await sendResendFallback(type, payload, agency);
      if (sent) {
        result = { success: true, method: "resend" };
      }
    } catch (err) {
      console.error(`[Resend Fallback] ${type} failed:`, err);
    }
  }

  if (result.method === "none") {
    console.log(`[Notification] ${type} for ${payload.firstName} — no notification method configured`);
    return result;
  }

  try {
    const admin = createAdminClient();
    await admin.from("activity_log").insert({
      agency_id: logging.agencyId,
      client_id: logging.clientId,
      actor_type: "system",
      action: "notification_sent",
      description: `${type} notification sent via ${result.method}`,
      metadata: {
        notification_type: type,
        method: result.method,
        contact_id: payload.contactId,
      },
    });
  } catch (err) {
    console.error(`[Notification] Failed to log ${type} to activity_log:`, err);
  }

  return result;
}

/**
 * Maps each notification's payload data onto the GHL custom-field keys a
 * workflow can read via merge tags. Staff alerts fire on the OWNER's own GHL
 * contact (not the client's) — writing client-specific data there would
 * clobber the owner's own field values, so those three are tag-only.
 */
function buildNotificationFields(
  type: GHLNotificationType,
  data: GHLNotificationPayload["data"]
): Record<string, string | number> {
  switch (type) {
    case "round_sent":
      return {
        dispute_round_current: Number(data.round_number),
        cdp_items_disputed: Number(data.items_disputed),
        next_dispute_date: String(data.response_deadline),
        clientdeck_portal_link: String(data.portal_link),
      };
    case "deletion_win":
      return {
        cdp_deletions_this_round: Number(data.deletions_this_round),
        items_deleted_total: Number(data.total_deletions),
        cdp_deleted_items_list: String(data.deleted_items_list),
        credit_score_eq_current: Number(data.score_eq),
        credit_score_exp_current: Number(data.score_exp),
        credit_score_tu_current: Number(data.score_tu),
        clientdeck_portal_link: String(data.portal_link),
      };
    case "round_results_in":
      return {
        dispute_round_current: Number(data.round_number),
        items_deleted_total: Number(data.total_deletions),
        total_negative_items: Number(data.total_items_disputed),
        clientdeck_portal_link: String(data.portal_link),
      };
    case "goal_achieved":
      return {
        items_deleted_total: Number(data.total_deletions),
        cdp_score_improvement: Number(data.score_improvement),
        credit_score_eq_current: Number(data.final_score_eq),
        credit_score_exp_current: Number(data.final_score_exp),
        credit_score_tu_current: Number(data.final_score_tu),
        clientdeck_portal_link: String(data.portal_link),
        cdp_google_review_link: String(data.review_link ?? ""),
      };
    case "payment_failed":
      return {
        cdp_monthly_fee: Number(data.monthly_fee),
        clientdeck_portal_link: String(data.portal_link),
        cdp_agency_phone: String(data.agency_phone ?? ""),
      };
    case "portal_link":
      return { clientdeck_portal_link: String(data.portal_link) };
    case "monthly_progress":
      return {
        credit_score_eq_current: Number(data.score_eq),
        credit_score_exp_current: Number(data.score_exp),
        credit_score_tu_current: Number(data.score_tu),
        items_deleted_total: Number(data.total_deletions),
        total_negative_items: Number(data.total_items),
        dispute_round_current: Number(data.current_round),
        clientdeck_portal_link: String(data.portal_link),
      };
    case "staff_new_client":
    case "staff_round_overdue":
    case "staff_next_round_ready":
      return {};
    default:
      return {};
  }
}

async function sendResendFallback(
  type: GHLNotificationType,
  payload: GHLNotificationPayload,
  agency: Agency
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !payload.email) return false;

  const templates: Partial<Record<GHLNotificationType, { subject: string; body: string }>> = {
    round_sent: {
      subject: `Your Round ${payload.data.round_number} dispute letters have been sent`,
      body: `Hi ${payload.firstName},\n\nYour Round ${payload.data.round_number} dispute letters have been sent to all three credit bureaus. Bureaus have up to 35 days to respond.\n\nView your progress: ${payload.data.portal_link}\n\n${agency.name} Team`,
    },
    deletion_win: {
      subject: `Great news — ${payload.data.deletions_this_round} item(s) deleted from your credit report`,
      body: `Hi ${payload.firstName},\n\nGreat news! ${payload.data.deletions_this_round} item(s) have been deleted from your credit report this round.\n\nTotal items deleted so far: ${payload.data.total_deletions}\n\nView your full progress: ${payload.data.portal_link}\n\n${agency.name} Team`,
    },
    goal_achieved: {
      subject: `Congratulations ${payload.firstName} — you've achieved your credit goal`,
      body: `Hi ${payload.firstName},\n\nCongratulations! You've achieved your credit goal.\n\nTotal items removed: ${payload.data.total_deletions}\nScore improvement: +${payload.data.score_improvement} points\n\nIt's been an honor working with you.\n\n${agency.name} Team`,
    },
    payment_failed: {
      subject: `Action required: payment failed for your credit repair service`,
      body: `Hi ${payload.firstName},\n\nYour payment of $${payload.data.monthly_fee}/month didn't go through. Please update your payment method to keep your service active: ${payload.data.portal_link}\n\nContact us: ${payload.data.agency_phone}\n\n${agency.name} Team`,
    },
  };

  const template = templates[type];
  if (!template) return false;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${agency.name} <noreply@clientdeckpro.com>`,
      to: payload.email,
      subject: template.subject,
      text: template.body,
    }),
    signal: AbortSignal.timeout(8000),
  });
  return true;
}

function portalLinkFor(client: NotifiableClient): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.clientdeckpro.com";
  return `${base}/portal?token=${client.portal_token}`;
}

function dashboardLinkFor(clientId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.clientdeckpro.com";
  return `${base}/clients/${clientId}`;
}

function monthsSince(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

export interface RoundSentSummary {
  round_number: number;
  total_items_disputed: number;
  response_deadline: string;
}

export async function notifyRoundSent(agency: Agency, client: NotifiableClient, round: RoundSentSummary) {
  return sendGHLNotification(
    agency,
    "round_sent",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        round_number: round.round_number,
        items_disputed: round.total_items_disputed,
        response_deadline: round.response_deadline,
        portal_link: portalLinkFor(client),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyDeletionWin(
  agency: Agency,
  client: NotifiableClient,
  deletionsThisRound: number,
  totalDeletions: number,
  deletedItemNames: string[]
) {
  return sendGHLNotification(
    agency,
    "deletion_win",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        deletions_this_round: deletionsThisRound,
        total_deletions: totalDeletions,
        deleted_items_list: deletedItemNames.join(", "),
        score_eq: client.score_eq_current ?? 0,
        score_exp: client.score_exp_current ?? 0,
        score_tu: client.score_tu_current ?? 0,
        portal_link: portalLinkFor(client),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export interface RoundResultsSummary {
  round_number: number;
  total_items_disputed: number;
  total_deletions: number;
  total_verified: number;
  total_no_response: number;
}

export async function notifyRoundResults(agency: Agency, client: NotifiableClient, round: RoundResultsSummary) {
  return sendGHLNotification(
    agency,
    "round_results_in",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        round_number: round.round_number,
        total_deletions: round.total_deletions,
        total_verified: round.total_verified,
        total_no_response: round.total_no_response,
        total_items_disputed: round.total_items_disputed,
        has_wins: round.total_deletions > 0,
        portal_link: portalLinkFor(client),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyGoalAchieved(agency: Agency, client: NotifiableClient) {
  const scoreImprovement = Math.round(
    (
      ((client.score_eq_current ?? 0) - (client.score_eq_start ?? 0)) +
      ((client.score_exp_current ?? 0) - (client.score_exp_start ?? 0)) +
      ((client.score_tu_current ?? 0) - (client.score_tu_start ?? 0))
    ) / 3
  );

  return sendGHLNotification(
    agency,
    "goal_achieved",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        total_deletions: client.total_items_deleted,
        score_improvement: scoreImprovement,
        final_score_eq: client.score_eq_current ?? 0,
        final_score_exp: client.score_exp_current ?? 0,
        final_score_tu: client.score_tu_current ?? 0,
        months_in_program: monthsSince(client.service_start_date),
        portal_link: portalLinkFor(client),
        review_link: agency.settings?.google_review_link ?? "",
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyPaymentFailed(agency: Agency, client: NotifiableClient) {
  return sendGHLNotification(
    agency,
    "payment_failed",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        monthly_fee: client.monthly_fee,
        portal_link: portalLinkFor(client),
        agency_phone: agency.phone ?? "",
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyPortalLink(agency: Agency, client: NotifiableClient) {
  return sendGHLNotification(
    agency,
    "portal_link",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        portal_link: portalLinkFor(client),
        agency_name: agency.name,
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyStaffNewClient(agency: Agency, client: NotifiableClient) {
  const ownerContactId = agency.settings?.owner_ghl_contact_id;
  if (!ownerContactId) return { success: false, method: "none" as const };

  return sendGHLNotification(
    agency,
    "staff_new_client",
    {
      contactId: ownerContactId,
      firstName: "Team",
      lastName: agency.name,
      data: {
        client_name: `${client.first_name} ${client.last_name}`,
        client_email: client.email ?? "",
        client_phone: client.phone ?? "",
        dashboard_link: dashboardLinkFor(client.id),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyStaffRoundOverdue(
  agency: Agency,
  client: NotifiableClient,
  roundNumber: number,
  daysOverdue: number
) {
  const ownerContactId = agency.settings?.owner_ghl_contact_id;
  if (!ownerContactId) return { success: false, method: "none" as const };

  return sendGHLNotification(
    agency,
    "staff_round_overdue",
    {
      contactId: ownerContactId,
      firstName: "Team",
      lastName: agency.name,
      data: {
        client_name: `${client.first_name} ${client.last_name}`,
        round_number: roundNumber,
        days_overdue: daysOverdue,
        dashboard_link: dashboardLinkFor(client.id),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export interface MonthlyProgressSummary {
  scoreEq: number | null;
  scoreExp: number | null;
  scoreTu: number | null;
  totalDeletions: number;
  totalItems: number;
  currentRound: number;
  monthsInProgram: number;
}

export async function notifyMonthlyProgress(
  agency: Agency,
  client: NotifiableClient,
  summary: MonthlyProgressSummary
) {
  return sendGHLNotification(
    agency,
    "monthly_progress",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        score_eq: summary.scoreEq ?? 0,
        score_exp: summary.scoreExp ?? 0,
        score_tu: summary.scoreTu ?? 0,
        total_deletions: summary.totalDeletions,
        total_items: summary.totalItems,
        current_round: summary.currentRound,
        months_in_program: summary.monthsInProgram,
        portal_link: portalLinkFor(client),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}
