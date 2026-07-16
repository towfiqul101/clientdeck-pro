import { createAdminClient } from "@/lib/supabase/admin";
import { RecipientsForm } from "./recipients-form";

// Cross-agency service-role reads — never prerender (matches the (admin) layout).
export const dynamic = "force-dynamic";

/**
 * Super-admin settings. Auth comes from the (admin) layout's requireAdmin();
 * currently hosts the admin-notification email recipients (migration 037).
 */
export default async function AdminSettingsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_notification_recipients")
    .select("id, email, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Super-admin panel configuration.
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h3 className="font-medium text-slate-100">Notification recipients</h3>
          <p className="mt-1 text-sm text-slate-500">
            Up to 3 email addresses that receive admin notifications (new
            signups, limit overages, trial endings, security events). The bell
            in the header shows them regardless.
          </p>
        </div>
        <div className="px-5 py-4">
          <RecipientsForm initial={data ?? []} />
        </div>
      </div>
    </div>
  );
}
