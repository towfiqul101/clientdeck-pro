import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { EmailChangeForm } from "./email-change-form";
import { MfaSection } from "./mfa-section";

/**
 * Personal account settings — the signed-in team member's OWN login, not
 * agency config. Everything here talks to Supabase Auth from the browser
 * client (email change, MFA), with team_members/agencies kept in sync
 * lazily by getSessionContext().
 */
export default async function AccountSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Login email"
          description="Changing it requires confirmation from BOTH your current and your new address (secure email change)."
        />
        <div className="px-5 py-4">
          <EmailChangeForm
            currentEmail={session.teamMember.email}
            isOwner={session.teamMember.role === "owner"}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Two-factor authentication"
          description="Protect your account with a 6-digit code from an authenticator app."
        />
        <div className="px-5 py-4">
          <MfaSection />
        </div>
      </Card>
    </div>
  );
}
