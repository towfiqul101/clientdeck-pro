"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import type { SnapshotRequestStatus } from "@/types";
import { updateSnapshotRequestStatus, sendSnapshot } from "./request-actions";

const btn =
  "rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40";

export function StatusButtons({
  id,
  status,
}: {
  id: string;
  status: SnapshotRequestStatus;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (res.success) {
        toast(ok, "success");
        router.refresh();
      } else {
        toast(res.error ?? "Failed.", "error");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        disabled={pending || status === "sent"}
        onClick={() => run(() => sendSnapshot(id), "Snapshot sent.")}
        className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >
        Send Snapshot
      </button>
      <button
        disabled={pending || status === "installed"}
        onClick={() => run(() => updateSnapshotRequestStatus(id, "installed"), "Marked installed.")}
        className={btn}
      >
        Mark Installed
      </button>
      {status !== "pending" && (
        <button
          disabled={pending}
          onClick={() => run(() => updateSnapshotRequestStatus(id, "pending"), "Reset to pending.")}
          className={btn}
        >
          Reset
        </button>
      )}
    </div>
  );
}
