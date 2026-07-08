"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils/helpers";
import { uploadDocument, deleteDocument, getDocumentUrl } from "./actions";
import type { Document, DocumentCategory } from "@/types";
import {
  UploadCloud,
  File as FileIcon,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";

const CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "id_document", label: "ID Document" },
  { value: "proof_of_address", label: "Proof of Address" },
  { value: "credit_report", label: "Credit Report" },
  { value: "dispute_letter", label: "Dispute Letter" },
  { value: "bureau_response", label: "Bureau Response" },
  { value: "agreement", label: "Agreement" },
  { value: "other", label: "Other" },
];

function categoryLabel(cat: DocumentCategory | null) {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? "Other";
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsManager({
  clientId,
  documents,
}: {
  clientId: string;
  documents: Document[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<DocumentCategory>("other");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("category", category);
    fd.set("file", file);
    const result = await uploadDocument(fd);
    setUploading(false);
    if (result.success) {
      toast(`Uploaded ${file.name}.`, "success");
      router.refresh();
    } else {
      toast(result.error ?? "Upload failed.", "error");
    }
  }

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    // Upload sequentially to keep it simple.
    Array.from(files).forEach((f) => upload(f));
  }

  async function handleDownload(doc: Document) {
    setBusyId(doc.id);
    const { url, error } = await getDocumentUrl(doc.storage_path);
    setBusyId(null);
    if (url) window.open(url, "_blank");
    else toast(error ?? "Could not open document.", "error");
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    const result = await deleteDocument(clientId, deleting.id);
    setBusyId(null);
    if (result.success) {
      toast("Document deleted.", "success");
      setDeleting(null);
      router.refresh();
    } else {
      toast(result.error ?? "Could not delete.", "error");
    }
  }

  return (
    <div className="space-y-5">
      {/* Upload area */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 bg-gray-50 hover:border-gray-400"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          ) : (
            <UploadCloud className="h-6 w-6 text-gray-400" />
          )}
          <p className="mt-2 text-sm font-medium text-gray-700">
            {uploading ? "Uploading…" : "Drag & drop files here, or click to browse"}
          </p>
          <p className="text-xs text-gray-400">
            Uploaded as “{categoryLabel(category)}”. Up to 15 MB each.
          </p>
        </div>
      </div>

      {/* Documents list */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {documents.length === 0 ? (
          <EmptyState
            icon={FileIcon}
            title="No documents yet"
            description="Upload IDs, proof of address, credit reports, and bureau responses here."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100">
                  <FileIcon className="h-4 w-4 text-gray-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {doc.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {categoryLabel(doc.category)} · {formatBytes(doc.file_size)}{" "}
                    · {formatDate(doc.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleDownload(doc)}
                  disabled={busyId === doc.id}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-40"
                  aria-label="Download"
                >
                  {busyId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => setDeleting(doc)}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete document?"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busyId === deleting?.id}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Permanently delete{" "}
          <span className="font-medium text-gray-900">{deleting?.name}</span>?
          This removes the file from storage and cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
