import { redirect } from "next/navigation";
import Image from "next/image";
import type { CSSProperties } from "react";
import { getPortalSession } from "@/lib/portal/session";
import { PortalNav } from "@/components/portal/portal-nav";
import { PushSubscribeBanner } from "@/components/portal/push-subscribe-banner";
import { ToastProvider } from "@/components/ui/toast";

export default async function PortalClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPortalSession();
  if (!session) redirect("/portal?expired=true");

  const { agency } = session;
  const brand = agency.brand_color || "#2563EB";
  const showPoweredBy = agency.settings?.portal_branding_visible !== false;

  return (
    <ToastProvider>
      <div
        className="min-h-screen bg-[#0f0f1a]"
        style={{ ["--brand" as keyof CSSProperties]: brand } as CSSProperties}
      >
        {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#1a1a2e]">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          {agency.logo_url ? (
            <Image
              src={agency.logo_url}
              alt={agency.name}
              width={120}
              height={32}
              className="h-8 w-auto max-w-[120px] object-contain"
              unoptimized
            />
          ) : (
            <span
              className="text-lg font-semibold"
              style={{ color: "var(--brand)" }}
            >
              {agency.name}
            </span>
          )}
        </div>
      </header>

      {/* Content (bottom padding clears the fixed nav) */}
      <main className="mx-auto max-w-lg px-4 pb-28 pt-5">
        <PushSubscribeBanner />
        {children}
      </main>

      {showPoweredBy && (
        <p className="pb-20 text-center text-xs text-slate-500">
          Powered by RoundTrack Pro
        </p>
      )}

        <PortalNav />
      </div>
    </ToastProvider>
  );
}
