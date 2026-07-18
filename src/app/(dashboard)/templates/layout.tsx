import { TemplatesNav } from "./templates-nav";

export default function TemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Templates</h2>
        <p className="text-sm text-slate-500">
          Manage letter templates and the standard dispute reasons and
          instructions used to generate them.
        </p>
      </div>
      <TemplatesNav />
      {children}
    </div>
  );
}
