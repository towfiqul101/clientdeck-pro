"use client";

import { useEffect, useRef, useState } from "react";
import { updateMemberGhlContactId } from "./actions";
import { Check, Loader2 } from "lucide-react";

export function MemberGhlContactField({
  memberId,
  initialValue,
  canEdit,
}: {
  memberId: string;
  initialValue: string;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const savedRef = useRef(initialValue);

  useEffect(() => {
    if (value === savedRef.current) return;
    setStatus("saving");
    const t = setTimeout(async () => {
      const result = await updateMemberGhlContactId(memberId, value);
      if (result.success) {
        savedRef.current = value;
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1500);
      } else {
        setStatus("idle");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [value, memberId]);

  if (!canEdit) {
    return (
      <span className="truncate text-xs text-slate-500">
        {initialValue || "No GHL contact id"}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="GHL contact id"
        className="w-40 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {status === "saving" && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-slate-500" />}
      {status === "saved" && <Check className="h-3 w-3 shrink-0 text-green-400" />}
    </div>
  );
}
