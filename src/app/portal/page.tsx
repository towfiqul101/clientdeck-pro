import { Unlink } from "lucide-react";

export default async function PortalEntryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const expired = sp.expired === "true";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f0f1a] px-6 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a2e] p-8 shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
          <Unlink className="h-7 w-7 text-slate-500" />
        </span>
        <h1 className="mt-5 text-lg font-semibold text-slate-100">
          {expired ? "This link has expired" : "Invalid link"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {expired
            ? "Your secure portal link is no longer valid. Contact your credit specialist to get a fresh link sent to your phone."
            : "This portal link isn't valid. Please use the most recent link your credit specialist sent you."}
        </p>
      </div>
      <p className="mt-6 text-xs text-slate-500">Secure client portal</p>
    </div>
  );
}
