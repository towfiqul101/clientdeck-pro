import Image from "next/image";
import { cn } from "@/lib/utils/helpers";

/**
 * RoundTrack Pro logo image components.
 *
 * Asset naming convention is by background: `*-dark.png` is the light-ink
 * wordmark meant to sit on a dark surface, `*-light.png` is the dark-ink
 * wordmark for a light surface. Intrinsic dimensions are passed to next/image
 * (sidebar 1983×793, wordmark 1774×887) and display size is driven by the
 * `h-* w-auto` className so the aspect ratio is preserved. The source PNGs are
 * cropped tight to the glyph (sidebar 1873×459, wordmark 1763×470) — keep the
 * width/height below in sync with the actual files or `w-auto` will distort.
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
      width={1873}
      height={459}
      priority
      className={cn("h-11 w-auto", className)}
    />
  );
}

/**
 * Theme-aware wordmark. Picks the asset matching the surface passed via `theme`:
 * light → light-surface (dark-ink) wordmark, dark → dark-surface (light-ink)
 * wordmark. Used in the toggleable `.app-content` header (theme from context)
 * and on the permanently-dark marketing shell (theme="dark").
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
      width={1763}
      height={470}
      className={cn("h-8 w-auto", className)}
    />
  );
}
