import { redirect } from "next/navigation";
import { getSessionContext, isMfaChallengeRequired } from "@/lib/auth/session";
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
  // session, either (a) MFA is enrolled but this session hasn't passed the
  // challenge yet — send them to it — or (b) the user is authenticated but has
  // no active team_member/agency; redirecting to /login would loop against
  // middleware, so sign them out instead.
  if (!session) {
    if (await isMfaChallengeRequired()) {
      redirect("/auth/mfa");
    }
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
