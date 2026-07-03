"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import type { SnapshotRequestStatus } from "@/types";
import { updateSnapshotRequestStatus } from "./request-actions";

export function StatusButtons({
  id,
  status,
}: {
  id: string;
  status: SnapshotRequestStatus;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function set(next: SnapshotRequestStatus) {
    setBusy(true);
    const res = await updateSnapshotRequestStatus(id, next);
    setBusy(false);
    if (!res.success) toast(res.error ?? "Failed.", "error");
  }

  return (
    <div className="flex gap-2">
      <button
        disabled={busy || status === "sent"}
        onClick={() => set("sent")}
        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
      >
        Mark Sent
      </button>
      <button
        disabled={busy || status === "installed"}
        onClick={() => set("installed")}
        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
      >
        Mark Installed
      </button>
    </div>
  );
}
