import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { isGoogleConfigured } from "@/lib/google-drive/auth";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/helpers";
import { DocumentsPanel } from "./documents-panel";
import {
  FolderOpen,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  oauth: "Google sign-in was cancelled or failed. Please try again.",
  session: "Your session didn't match. Please sign in and reconnect.",
  exchange: "Could not complete the Google connection. Please try again.",
  not_configured:
    "Google Drive isn't set up on this deployment yet (missing GOOGLE_CLIENT_ID).",
};

export default async function DocumentsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;
  const { connected, error } = await searchParams;
  const configured = isGoogleConfigured();
  const isConnected = Boolean(
    agency.google_drive_enabled && agency.google_drive_refresh_token
  );
  const folderUrl = agency.google_drive_root_folder_id
    ? `https://drive.google.com/drive/folders/${agency.google_drive_root_folder_id}`
    : "https://drive.google.com/drive/my-drive";

  return (
    <div className="space-y-4">
      {connected && (
        <div className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Google Drive connected successfully.</span>
        </div>
      )}
      {error && ERROR_MESSAGES[error] && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{ERROR_MESSAGES[error]}</span>
        </div>
      )}

      {!isConnected ? (
        <Card>
          <div className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-blue-400" />
              <h3 className="text-base font-semibold text-slate-100">
                Google Drive Integration
              </h3>
            </div>
            <p className="text-sm text-slate-500">
              Automatically save all client documents to your Google Drive —
              organized by client name.
            </p>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                What gets saved
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
                {[
                  "Onboarding documents (ID, reports, agreement)",
                  "Dispute letters (PDF) after each round",
                  "Bureau response uploads",
                  "Client-uploaded portal documents",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Folder structure
              </p>
              <pre className="mt-2 whitespace-pre text-xs text-slate-400">{`ClientDeck Pro /
  {Client Name} /
    Onboarding / ...
    Round_1 / ...
    Bureau_Responses / ...`}</pre>
            </div>

            {configured ? (
              <a
                href="/api/google-drive/connect"
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <FolderOpen className="h-4 w-4" />
                Connect Google Drive
              </a>
            ) : (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                Google Drive isn&apos;t configured on this deployment yet. Add{" "}
                <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>{" "}
                to enable it.
              </div>
            )}
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <h3 className="text-base font-semibold text-slate-100">
                  Google Drive Connected
                </h3>
              </div>
              <dl className="space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="text-slate-500">Connected as:</dt>
                  <dd className="font-medium text-slate-100">
                    {agency.google_drive_email ?? "—"}
                  </dd>
                </div>
                {agency.google_drive_connected_at && (
                  <div className="flex gap-2">
                    <dt className="text-slate-500">Connected:</dt>
                    <dd className="font-medium text-slate-100">
                      {formatDate(agency.google_drive_connected_at)}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={folderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-[#1a1a2e] px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.03]"
                >
                  Open ClientDeck Pro Folder
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <form action="/api/google-drive/disconnect" method="POST">
                  <button
                    type="submit"
                    className="rounded-md border border-red-300 bg-[#1a1a2e] px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
                  >
                    Disconnect
                  </button>
                </form>
              </div>
            </div>
          </Card>

          <DocumentsPanel />
        </>
      )}
    </div>
  );
}
