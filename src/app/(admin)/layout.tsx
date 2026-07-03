import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { ToastProvider } from "@/components/ui/toast";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminEmail = await requireAdmin();

  const admin = createAdminClient();
  const { count } = await admin
    .from("snapshot_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <ToastProvider>
      <AdminShell adminEmail={adminEmail} pendingSnapshots={count ?? 0}>
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
