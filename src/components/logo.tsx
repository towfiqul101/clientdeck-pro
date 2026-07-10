import Image from "next/image";
import { cn } from "@/lib/utils/helpers";

/**
 * RoundTrack Pro logo image components.
 *
 * Asset naming convention is by background: `*-dark.png` is the light-ink
 * wordmark meant to sit on a dark surface, `*-light.png` is the dark-ink
 * wordmark for a light surface. Intrinsic dimensions are passed to next/image
 * (sidebar 1983×793, wordmark 1774×887) and display size is driven by the
 * `h-* w-auto` className so the aspect ratio is preserved.
 */

/**
 * Sidebar wordmark. The dashboard sidebar shell is permanently dark (see
 * `.app-content` scoping in globals.css), so this always uses the dark-surface
 * asset — no theme check needed.
 */
export function AppSidebarLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logos/logo-sidebar-dark.png"
      alt="RoundTrack Pro"
      width={1983}
      height={793}
      priority
      className={cn("h-8 w-auto", className)}
    />
  );
}

/**
 * Wordmark for the toggleable `.app-content` area. Picks the asset matching the
 * active background: light theme → light-surface (dark-ink) wordmark, dark
 * theme → dark-surface (light-ink) wordmark.
 */
export function AppContentLogo({
  theme,
  className,
}: {
  theme: "light" | "dark";
  className?: string;
}) {
  const src =
    theme === "light"
      ? "/logos/logo-wordmark-light.png"
      : "/logos/logo-wordmark-dark.png";
  return (
    <Image
      src={src}
      alt="RoundTrack Pro"
      width={1774}
      height={887}
      className={cn("h-7 w-auto", className)}
    />
  );
}
