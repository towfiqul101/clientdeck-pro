"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Sparkles, Search, Plus, Eye, Pencil, Copy, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/helpers";
import { LETTER_TYPES } from "@/lib/constants";
import { deleteTemplate, duplicateTemplate } from "./actions";
import { TemplateViewModal } from "./template-view-modal";
import type { LetterTemplate } from "@/types";

const LETTER_TYPE_LABEL = new Map(LETTER_TYPES.map((t) => [t.value, t.label]));
type Filter = "all" | "system" | "custom";

export function TemplatesList({ templates }: { templates: LetterTemplate[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<LetterTemplate | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (filter === "system" && !t.is_system) return false;
      if (filter === "custom" && t.is_system) return false;
      if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [templates, filter, query]);

  async function handleDuplicate(t: LetterTemplate) {
    setBusyId(t.id);
    const res = await duplicateTemplate(t.id);
    setBusyId(null);
    if (res.success) {
      toast(`Duplicated as "${t.name} (Copy)".`, "success");
      router.refresh();
      if (res.id) router.push(`/templates/${res.id}/edit`);
    } else {
      toast(res.error ?? "Could not duplicate.", "error");
    }
  }

  async function handleDelete(t: LetterTemplate) {
    if (!window.confirm(`Delete "${t.name}"? This can't be undone.`)) return;
    setBusyId(t.id);
    const res = await deleteTemplate(t.id);
    setBusyId(null);
    if (res.success) {
      toast("Template deleted.", "success");
      router.refresh();
    } else {
      toast(res.error ?? "Could not delete.", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#1a1a2e] p-1">
          {(["all", "system", "custom"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                filter === f ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/[0.03]"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className="w-56 rounded-md border border-white/10 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <Link
            href="/templates/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Template
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-[#1a1a2e] px-6 py-16 text-center">
          <FileText className="h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-500">No templates found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="flex flex-col rounded-lg border border-white/10 bg-[#1a1a2e] p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-100">{t.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-400">
                      {LETTER_TYPE_LABEL.get(t.letter_type) ?? t.letter_type}
                    </span>
                    {t.is_system ? (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                        System
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                        Custom
                      </span>
                    )}
                    {!t.is_active && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-500">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {t.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{t.description}</p>}
              <div className="mt-3 flex items-center gap-1 border-t border-white/[0.06] pt-3">
                <button
                  onClick={() => setViewing(t)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-white/[0.03]"
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
                {!t.is_system && (
                  <Link
                    href={`/templates/${t.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-white/[0.03]"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                )}
                <button
                  disabled={busyId === t.id}
                  onClick={() => handleDuplicate(t)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-white/[0.03] disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </button>
                {!t.is_system && (
                  <button
                    disabled={busyId === t.id}
                    onClick={() => handleDelete(t)}
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateViewModal template={viewing} onClose={() => setViewing(null)} onDuplicate={handleDuplicate} />
    </div>
  );
}
