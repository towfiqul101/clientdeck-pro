"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "preparing", label: "Preparing" },
  { value: "letters_generated", label: "Letters generated" },
  { value: "sent", label: "Sent" },
  { value: "awaiting_response", label: "Awaiting response" },
  { value: "complete", label: "Complete" },
];

export function RoundsFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status) params.set("status", status);
    else params.delete("status");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={searchParams.get("status") ?? ""}
      onChange={(e) => update(e.target.value)}
      className="rounded-md border border-white/10 bg-[#1a1a2e] px-3 py-2 text-sm text-slate-300 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
