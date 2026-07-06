import { sendEmail, escapeHtml } from "./index";

export async function sendStaffInviteEmail(params: {
  inviteeName: string;
  inviteeEmail: string;
  agencyName: string;
  inviterName: string;
  inviteLink: string;
}): Promise<boolean> {
  const html = `
    <h2>You've been invited!</h2>
    <p>${escapeHtml(params.inviterName)} has invited you to join <strong>${escapeHtml(params.agencyName)}</strong> on ClientDeck Pro.</p>
    <p><a href="${escapeHtml(params.inviteLink)}" style="background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Accept Invitation →</a></p>
    <p>This link expires in 24 hours.</p>
    <p>ClientDeck Pro is a dispute management platform for credit professionals.</p>
  `;
  const text = `You've been invited!\n\n${params.inviterName} has invited you to join ${params.agencyName} on ClientDeck Pro.\n\nAccept your invitation: ${params.inviteLink}\n\nThis link expires in 24 hours.`;
  return sendEmail({
    to: params.inviteeEmail,
    subject: `${params.agencyName} invited you to ClientDeck Pro`,
    html,
    text,
  });
}

export async function sendPortalLinkEmail(params: {
  clientEmail: string;
  clientFirstName: string;
  agencyName: string;
  portalUrl: string;
  agencyPhone?: string;
}): Promise<boolean> {
  const phoneLine = params.agencyPhone ? `<p>Questions? Call us: ${escapeHtml(params.agencyPhone)}</p>` : "";
  const html = `
    <h2>Hi ${escapeHtml(params.clientFirstName)}!</h2>
    <p>Your personal credit repair portal is ready. View your progress, upload documents, and track your journey.</p>
    <p><a href="${escapeHtml(params.portalUrl)}" style="background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">View My Portal →</a></p>
    <p>This link is personal to you — don't share it.</p>
    ${phoneLine}
    <p>— ${escapeHtml(params.agencyName)} Team</p>
  `;
  const text = `Hi ${params.clientFirstName}!\n\nYour personal credit repair portal is ready: ${params.portalUrl}\n\nThis link is personal to you — don't share it.${params.agencyPhone ? `\n\nQuestions? Call us: ${params.agencyPhone}` : ""}\n\n— ${params.agencyName} Team`;
  return sendEmail({
    to: params.clientEmail,
    subject: `Your ${params.agencyName} credit repair portal is ready`,
    html,
    text,
  });
}

export async function sendStaffDocUploadAlert(params: {
  staffEmail: string;
  staffName: string;
  clientName: string;
  documentName: string;
  documentCategory: string;
  clientDashboardUrl: string;
}): Promise<boolean> {
  const html = `
    <h3>Document uploaded by client</h3>
    <p><strong>${escapeHtml(params.clientName)}</strong> just uploaded a document to their portal:</p>
    <ul>
      <li>File: ${escapeHtml(params.documentName)}</li>
      <li>Category: ${escapeHtml(params.documentCategory)}</li>
    </ul>
    <p><a href="${escapeHtml(params.clientDashboardUrl)}">View in ClientDeck Pro →</a></p>
  `;
  const text = `${params.clientName} uploaded a document to their portal.\n\nFile: ${params.documentName}\nCategory: ${params.documentCategory}\n\nView in ClientDeck Pro: ${params.clientDashboardUrl}`;
  return sendEmail({
    to: params.staffEmail,
    subject: `${params.clientName} uploaded a document`,
    html,
    text,
  });
}

export async function sendStaffFirstLoginAlert(params: {
  staffEmail: string;
  clientName: string;
  clientDashboardUrl: string;
}): Promise<boolean> {
  const html = `
    <p><strong>${escapeHtml(params.clientName)}</strong> just logged into their credit repair portal for the first time.</p>
    <p>This is a great time to reach out and check in!</p>
    <p><a href="${escapeHtml(params.clientDashboardUrl)}">View Client →</a></p>
  `;
  const text = `${params.clientName} just logged into their credit repair portal for the first time.\n\nThis is a great time to reach out and check in!\n\nView client: ${params.clientDashboardUrl}`;
  return sendEmail({
    to: params.staffEmail,
    subject: `${params.clientName} just viewed their portal for the first time`,
    html,
    text,
  });
}
