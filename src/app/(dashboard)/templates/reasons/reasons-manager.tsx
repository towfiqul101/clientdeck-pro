"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  createDisputeReason,
  deleteDisputeReason,
  createDisputeInstruction,
  deleteDisputeInstruction,
} from "./actions";
import type { DisputeReason, DisputeInstruction } from "@/types";

function OptionList({
  title,
  items,
  onAdd,
  onDelete,
}: {
  title: string;
  items: (DisputeReason | DisputeInstruction)[];
  onAdd: (label: string) => Promise<{ success: boolean; error?: string }>;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [newLabel, setNewLabel] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleAdd() {
    if (!newLabel.trim()) return;
    start(async () => {
      const res = await onAdd(newLabel);
      if (res.success) {
        setNewLabel("");
        router.refresh();
      } else {
        toast(res.error ?? "Could not add.", "error");
      }
    });
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    const res = await onDelete(id);
    setBusyId(null);
    if (res.success) {
      router.refresh();
    } else {
      toast(res.error ?? "Could not delete.", "error");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="divide-y divide-white/[0.06] rounded-lg border border-white/10">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-slate-200">
              {item.label}
              {item.is_system && (
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                  System
                </span>
              )}
            </span>
            {!item.is_system && (
              <button
                disabled={busyId === item.id}
                onClick={() => handleDelete(item.id)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={`Add custom ${title.toLowerCase().replace(/s$/, "")}…`}
          className="flex-1"
        />
        <Button size="sm" onClick={handleAdd} loading={pending}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
    </div>
  );
}

export function ReasonsManager({
  reasons,
  instructions,
}: {
  reasons: DisputeReason[];
  instructions: DisputeInstruction[];
}) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <OptionList
        title="Reasons"
        items={reasons}
        onAdd={createDisputeReason}
        onDelete={deleteDisputeReason}
      />
      <OptionList
        title="Instructions"
        items={instructions}
        onAdd={createDisputeInstruction}
        onDelete={deleteDisputeInstruction}
      />
    </div>
  );
}
