import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Settings</h2>
        <p className="text-sm text-slate-500">
          Manage your agency profile, integrations, branding, and billing.
        </p>
      </div>
      <SettingsNav />
      <div className="max-w-2xl">{children}</div>
    </div>
  );
}
