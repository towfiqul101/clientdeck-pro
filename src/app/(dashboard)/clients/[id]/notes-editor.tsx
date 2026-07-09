"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/field";
import { updateClientNotes } from "../actions";
import { Check, Loader2 } from "lucide-react";

export function NotesEditor({
  clientId,
  initialNotes,
}: {
  clientId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const savedRef = useRef(initialNotes);

  // Debounced autosave whenever notes settle and differ from last saved value.
  useEffect(() => {
    if (notes === savedRef.current) return;
    setStatus("saving");
    const t = setTimeout(async () => {
      const result = await updateClientNotes(clientId, notes);
      if (result.success) {
        savedRef.current = notes;
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1500);
      } else {
        setStatus("idle");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [notes, clientId]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="notes" className="text-sm font-medium text-slate-300">
          Notes
        </label>
        {status === "saving" && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        )}
        {status === "saved" && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
      </div>
      <Textarea
        id="notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        placeholder="Add internal notes about this client…"
      />
    </div>
  );
}
