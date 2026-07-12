"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/helpers";

/**
 * Wraps horizontally-scrollable content (wide tables, kanban rows) and fades
 * its own edges via mask-image when there's more content off-screen — a
 * visual hint that the container scrolls, without hardcoding a background
 * color (so it works in both light and dark theme).
 */
export function ScrollFadeX({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 4);
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const maskStops = [
    showLeftFade ? "transparent 0, black 24px" : "black 0",
    showRightFade ? "black calc(100% - 24px), transparent 100%" : "black 100%",
  ].join(", ");
  const maskImage = `linear-gradient(to right, ${maskStops})`;

  return (
    <div
      ref={ref}
      onScroll={update}
      className={cn("overflow-x-auto", className)}
      style={{ WebkitMaskImage: maskImage, maskImage }}
    >
      {children}
    </div>
  );
}
