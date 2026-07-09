import { Logo } from "@/components/ui/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#13131f] px-4 py-12">
      <div className="mb-8">
        <Logo variant="light" />
      </div>
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#1a1a2e] p-8 shadow-sm">
        {children}
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        Practice management software for credit professionals.
      </p>
    </div>
  );
}
