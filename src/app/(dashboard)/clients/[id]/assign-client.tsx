"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { assignClient } from "./assign-actions";
import { Loader2 } from "lucide-react";

interface AssignClientProps {
  clientId: string;
  assignedTo: string | null;
  members: { id: string; name: string }[];
}

/** Inline "assigned to" dropdown — reassigns immediately on change. */
export function AssignClient({ clientId, assignedTo, members }: AssignClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(assignedTo ?? "");
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value || null;
    const previous = value;
    setValue(next ?? "");
    startTransition(async () => {
      const result = await assignClient(clientId, next);
      if (result.success) {
        toast(next ? "Client reassigned." : "Client unassigned.", "success");
        router.refresh();
      } else {
        setValue(previous);
        toast(result.error ?? "Could not update assignment.", "error");
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={value}
        onChange={handleChange}
        disabled={isPending}
        placeholder="Unassigned"
        options={members.map((m) => ({ value: m.id, label: m.name }))}
        className="w-auto py-1.5 pr-7 text-xs"
      />
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
    </div>
  );
}
