import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme/theme-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();

  // Middleware sends signed-out users to /login. If we get here with no usable
  // session, the user is authenticated but has no active team_member/agency —
  // redirecting to /login would loop against middleware, so sign them out first.
  if (!session) {
    redirect("/signout");
  }

  const { teamMember, agency } = session;

  return (
    <ThemeProvider>
      {/* Set the theme class before paint to avoid a flash of the wrong theme. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <ToastProvider>
        <DashboardShell
          agencyName={agency.name}
          agencyPlan={agency.plan}
          userName={teamMember.name}
          userEmail={teamMember.email}
        >
          {children}
        </DashboardShell>
      </ToastProvider>
    </ThemeProvider>
  );
}
