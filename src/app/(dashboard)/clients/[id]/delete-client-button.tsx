"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { deleteClient } from "../actions";

/**
 * Owner/admin-only permanent delete. Requires typing the client's full name to
 * confirm (mirrors the admin agency "Danger Zone"). On success, redirects to
 * the client list.
 */
export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const matches = confirmText.trim() === clientName;

  function handleClose() {
    if (deleting) return;
    setOpen(false);
    setConfirmText("");
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteClient(clientId, confirmText);
    if (result.success) {
      toast("Client deleted.", "success");
      router.push("/clients");
      return;
    }
    setDeleting(false);
    toast(result.error ?? "Could not delete client.", "error");
  }

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        title="Delete client"
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
              disabled={!matches || deleting}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <p style={{ color: "var(--overlay-text)" }}>
            This permanently removes <span className="font-semibold">{clientName}</span> and
            all of their negative items, dispute rounds, letters, documents, and score
            history. <span className="font-semibold">This cannot be undone.</span>
          </p>
          <p style={{ color: "var(--overlay-text-muted)" }}>
            Your GoHighLevel contact and Google Drive files are not affected.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--overlay-text-muted)" }}>
              Type <span className="font-semibold">{clientName}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={clientName}
              autoFocus
              className="w-full rounded-md border border-red-500/40 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
