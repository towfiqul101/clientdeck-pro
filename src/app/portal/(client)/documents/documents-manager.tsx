"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils/helpers";
import {
  portalUploadDocument,
  portalDeleteDocument,
  portalGetDocumentUrl,
} from "./actions";
import type { Document, DocumentCategory } from "@/types";
import { UploadCloud, File as FileIcon, Download, Trash2, Loader2 } from "lucide-react";

const CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "id_document", label: "ID Document" },
  { value: "proof_of_address", label: "Proof of Address" },
  { value: "credit_report", label: "Credit Report" },
  { value: "other", label: "Other" },
];

function categoryLabel(cat: DocumentCategory | null) {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? "Document";
}
function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocRow({
  doc,
  ownUpload,
  onDownload,
  onDelete,
  busy,
}: {
  doc: Document;
  ownUpload: boolean;
  onDownload: (d: Document) => void;
  onDelete: (d: Document) => void;
  busy: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100">
        <FileIcon className="h-4 w-4 text-gray-500" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">
            {doc.name}
          </p>
          {ownUpload && (
            <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              Your Upload
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {categoryLabel(doc.category)} · {formatBytes(doc.file_size)} ·{" "}
          {formatDate(doc.created_at)}
        </p>
      </div>
      <button
        onClick={() => onDownload(doc)}
        disabled={busy}
        className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
        aria-label="Download"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </button>
      {ownUpload && (
        <button
          onClick={() => onDelete(doc)}
          className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

export function PortalDocumentsManager({
  staffDocs,
  clientDocs,
}: {
  staffDocs: Document[];
  clientDocs: Document[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<DocumentCategory>("id_document");
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("category", category);
      fd.set("file", file);
      const res = await portalUploadDocument(fd);
      if (!res.success) {
        toast(res.error ?? "Upload failed.", "error");
      }
    }
    setUploading(false);
    toast("Upload complete.", "success");
    router.refresh();
  }

  async function download(doc: Document) {
    setBusyId(doc.id);
    const { url, error } = await portalGetDocumentUrl(doc.storage_path);
    setBusyId(null);
    if (url) window.open(url, "_blank");
    else toast(error ?? "Could not open document.", "error");
  }

  async function remove(doc: Document) {
    if (!confirm(`Delete ${doc.name}? This can't be undone.`)) return;
    setBusyId(doc.id);
    const res = await portalDeleteDocument(doc.id);
    setBusyId(null);
    if (res.success) {
      toast("Deleted.", "success");
      router.refresh();
    } else {
      toast(res.error ?? "Could not delete.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Documents</h1>

      {/* Upload */}
      <div className="space-y-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DocumentCategory)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white text-center",
            "active:bg-gray-50"
          )}
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--brand)" }} />
          ) : (
            <UploadCloud className="h-7 w-7" style={{ color: "var(--brand)" }} />
          )}
          <span className="text-sm font-semibold text-gray-800">
            {uploading ? "Uploading…" : "Tap to upload a document"}
          </span>
          <span className="text-xs text-gray-400">
            Uploaded as “{categoryLabel(category)}” · up to 15 MB
          </span>
        </button>
      </div>

      {/* Your uploads */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Your uploads
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {clientDocs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              You haven&apos;t uploaded anything yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {clientDocs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  ownUpload
                  onDownload={download}
                  onDelete={remove}
                  busy={busyId === doc.id}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Shared by specialist */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Shared by your specialist
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {staffDocs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              No shared documents yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {staffDocs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  ownUpload={false}
                  onDownload={download}
                  onDelete={remove}
                  busy={busyId === doc.id}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
