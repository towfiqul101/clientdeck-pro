"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn, formatCurrency } from "@/lib/utils/helpers";
import {
  BUREAUS,
  DISPUTE_STATUSES,
  NEGATIVE_TYPES,
  BUREAU_STYLES,
} from "@/lib/constants";
import { getNegativeTypeLabel, getBureauLabel } from "@/lib/utils/helpers";
import { addItems, updateItem, deleteItem, type NewItemInput } from "./actions";
import { ItemDraftRow, blankDraft } from "./item-draft-row";
import { CreditReportParser } from "./credit-report-parser";
import type { Bureau, DisputeStatus, NegativeItem } from "@/types";
import {
  Plus,
  Zap,
  Pencil,
  Trash2,
  ListTree,
  List,
  FileWarning,
  Bot,
  Check,
  Clock,
  X,
  type LucideIcon,
} from "lucide-react";

// Icons for the three dispute statuses the visual spec calls out; the rest
// (not_disputed, updated, pending) keep the plain Badge with no icon.
const STATUS_ICONS: Partial<Record<DisputeStatus, LucideIcon>> = {
  deleted: Check,
  in_dispute: Clock,
  verified: X,
};

interface ItemsManagerProps {
  clientId: string;
  items: NegativeItem[];
}

function itemToDraft(item: NegativeItem): NewItemInput {
  return {
    bureau: item.bureau,
    creditor_name: item.creditor_name,
    account_number_last4: item.account_number_last4 ?? "",
    account_type: item.account_type ?? "",
    negative_type: item.negative_type,
    balance: item.balance != null ? String(item.balance) : "",
    date_opened: item.date_opened ?? "",
    date_of_first_delinquency: item.date_of_first_delinquency ?? "",
  };
}

export function ItemsManager({ clientId, items }: ItemsManagerProps) {
  const router = useRouter();
  const { toast } = useToast();

  // View state
  const [bureauFilter, setBureauFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [grouped, setGrouped] = useState(false);

  // Add flows
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickDrafts, setQuickDrafts] = useState<NewItemInput[]>([blankDraft()]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDrafts, setModalDrafts] = useState<NewItemInput[]>([blankDraft()]);
  const [parserOpen, setParserOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit / delete
  const [editing, setEditing] = useState<{
    id: string;
    draft: NewItemInput;
    status: DisputeStatus;
  } | null>(null);
  const [deleting, setDeleting] = useState<NegativeItem | null>(null);

  const totals = useMemo(() => {
    const deleted = items.filter((i) => i.dispute_status === "deleted").length;
    const inDispute = items.filter(
      (i) => i.dispute_status === "in_dispute"
    ).length;
    const notDisputed = items.filter(
      (i) => i.dispute_status === "not_disputed"
    ).length;
    return { total: items.length, deleted, inDispute, notDisputed };
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (!bureauFilter || i.bureau === bureauFilter) &&
          (!statusFilter || i.dispute_status === statusFilter) &&
          (!typeFilter || i.negative_type === typeFilter)
      ),
    [items, bureauFilter, statusFilter, typeFilter]
  );

  async function handleSaveDrafts(
    drafts: NewItemInput[],
    reset: () => void,
    closeAfter: boolean
  ) {
    setSaving(true);
    const result = await addItems(clientId, drafts);
    setSaving(false);
    if (result.success) {
      const n = drafts.filter((d) => d.creditor_name.trim()).length;
      toast(`${n} item${n === 1 ? "" : "s"} added.`, "success");
      reset();
      if (closeAfter) setModalOpen(false);
      router.refresh();
    } else {
      toast(result.error ?? "Could not add items.", "error");
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    setSaving(true);
    const result = await updateItem(clientId, editing.id, {
      ...editing.draft,
      dispute_status: editing.status,
    });
    setSaving(false);
    if (result.success) {
      toast("Item updated.", "success");
      setEditing(null);
      router.refresh();
    } else {
      toast(result.error ?? "Could not update item.", "error");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    const result = await deleteItem(clientId, deleting.id);
    setSaving(false);
    if (result.success) {
      toast("Item deleted.", "success");
      setDeleting(null);
      router.refresh();
    } else {
      toast(result.error ?? "Could not delete item.", "error");
    }
  }

  const rows = grouped
    ? BUREAUS.map((b) => ({
        bureau: b.value as Bureau,
        label: b.label,
        items: filtered.filter((i) => i.bureau === b.value),
      })).filter((g) => g.items.length > 0)
    : null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by bureau"
            value={bureauFilter}
            onChange={(e) => setBureauFilter(e.target.value)}
            options={BUREAUS}
            placeholder="All bureaus"
            className="w-auto"
          />
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={DISPUTE_STATUSES}
            placeholder="All statuses"
            className="w-auto"
          />
          <Select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={NEGATIVE_TYPES}
            placeholder="All types"
            className="w-auto"
          />
          <button
            onClick={() => setGrouped((g) => !g)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            {grouped ? (
              <List className="h-4 w-4" />
            ) : (
              <ListTree className="h-4 w-4" />
            )}
            {grouped ? "Flat list" : "Group by bureau"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuickAdd((q) => !q)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium",
              quickAdd
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            )}
          >
            <Zap className="h-4 w-4" />
            Quick Add
          </button>
          <button
            onClick={() => setParserOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Bot className="h-4 w-4" />
            Parse Credit Report with AI
          </button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Items
          </Button>
        </div>
      </div>

      {/* Totals summary */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <span className="font-medium text-gray-900">
          {totals.total} item{totals.total === 1 ? "" : "s"} total
        </span>
        <span className="text-green-600">{totals.deleted} deleted</span>
        <span className="text-blue-600">{totals.inDispute} in dispute</span>
        <span className="text-gray-500">
          {totals.notDisputed} not yet disputed
        </span>
      </div>

      {/* Quick add grid */}
      {quickAdd && (
        <div className="overflow-x-auto rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <table className="min-w-full text-xs">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="px-1 py-1 font-medium">Bureau</th>
                <th className="px-1 py-1 font-medium">Creditor</th>
                <th className="px-1 py-1 font-medium">Acct</th>
                <th className="px-1 py-1 font-medium">Acct type</th>
                <th className="px-1 py-1 font-medium">Negative type</th>
                <th className="px-1 py-1 font-medium">Balance</th>
                <th className="px-1 py-1 font-medium">Opened</th>
                <th className="px-1 py-1 font-medium">1st delinq.</th>
                <th className="px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {quickDrafts.map((draft, idx) => (
                <ItemDraftRow
                  key={idx}
                  draft={draft}
                  layout="grid"
                  onChange={(patch) =>
                    setQuickDrafts((prev) =>
                      prev.map((d, i) => (i === idx ? { ...d, ...patch } : d))
                    )
                  }
                  onRemove={
                    quickDrafts.length > 1
                      ? () =>
                          setQuickDrafts((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                      : undefined
                  }
                />
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-between">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setQuickDrafts((prev) => [
                  ...prev,
                  blankDraft(prev[prev.length - 1]?.bureau),
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
            <Button
              size="sm"
              loading={saving}
              onClick={() =>
                handleSaveDrafts(
                  quickDrafts,
                  () => setQuickDrafts([blankDraft()]),
                  false
                )
              }
            >
              Save {quickDrafts.filter((d) => d.creditor_name.trim()).length}{" "}
              items
            </Button>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileWarning}
            title={items.length === 0 ? "No items yet" : "No matching items"}
            description={
              items.length === 0
                ? "Add the negative items from this client's credit reports to start disputing."
                : "Try clearing your filters."
            }
            action={
              items.length === 0 && (
                <Button onClick={() => setModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Items
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Bureau</th>
                  <th className="px-4 py-3">Creditor</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Round</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows
                  ? rows.map((group) => (
                      <GroupRows
                        key={group.bureau}
                        label={group.label}
                        bureau={group.bureau}
                        items={group.items}
                        onEdit={(item) =>
                          setEditing({
                            id: item.id,
                            draft: itemToDraft(item),
                            status: item.dispute_status,
                          })
                        }
                        onDelete={setDeleting}
                      />
                    ))
                  : filtered.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onEdit={() =>
                          setEditing({
                            id: item.id,
                            draft: itemToDraft(item),
                            status: item.dispute_status,
                          })
                        }
                        onDelete={() => setDeleting(item)}
                      />
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Items modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add negative items"
        description="Add one or more items, then save them all at once."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={() =>
                handleSaveDrafts(
                  modalDrafts,
                  () => setModalDrafts([blankDraft()]),
                  true
                )
              }
            >
              Save all
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {modalDrafts.map((draft, idx) => (
            <ItemDraftRow
              key={idx}
              draft={draft}
              layout="stacked"
              onChange={(patch) =>
                setModalDrafts((prev) =>
                  prev.map((d, i) => (i === idx ? { ...d, ...patch } : d))
                )
              }
              onRemove={
                modalDrafts.length > 1
                  ? () =>
                      setModalDrafts((prev) => prev.filter((_, i) => i !== idx))
                  : undefined
              }
            />
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              setModalDrafts((prev) => [
                ...prev,
                blankDraft(prev[prev.length - 1]?.bureau),
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add another
          </Button>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit item"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleUpdate}>
              Save changes
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <ItemDraftRow
              draft={editing.draft}
              layout="stacked"
              onChange={(patch) =>
                setEditing((e) =>
                  e ? { ...e, draft: { ...e.draft, ...patch } } : e
                )
              }
            />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Dispute status
              </span>
              <Select
                value={editing.status}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev
                      ? { ...prev, status: e.target.value as DisputeStatus }
                      : prev
                  )
                }
                options={DISPUTE_STATUSES}
              />
            </label>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete item?"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={saving} onClick={handleDelete}>
              Delete item
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          This permanently removes{" "}
          <span className="font-medium text-gray-900">
            {deleting?.creditor_name}
          </span>{" "}
          ({deleting && getBureauLabel(deleting.bureau)}). This cannot be undone.
        </p>
      </Modal>

      <CreditReportParser
        clientId={clientId}
        open={parserOpen}
        onClose={() => setParserOpen(false)}
      />
    </div>
  );
}

function ItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: NegativeItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const style = BUREAU_STYLES[item.bureau];
  const StatusIcon = STATUS_ICONS[item.dispute_status];
  return (
    <tr className={cn("border-l-4 hover:bg-gray-50", style.border)}>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", style.dot)} />
          <span className={cn("text-xs font-medium", style.text)}>
            {getBureauLabel(item.bureau)}
          </span>
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{item.creditor_name}</p>
        {item.account_number_last4 && (
          <p className="text-xs text-gray-400">
            ••••{item.account_number_last4}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600">
        {getNegativeTypeLabel(item.negative_type)}
      </td>
      <td className="px-4 py-3 text-gray-700">
        {item.balance != null ? formatCurrency(item.balance) : "—"}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1">
          {StatusIcon && <StatusIcon className="h-3 w-3" />}
          <Badge status={item.dispute_status} />
        </span>
      </td>
      <td className="px-4 py-3 text-gray-600">
        {item.round_disputed ? `R${item.round_disputed}` : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <button
            onClick={onEdit}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function GroupRows({
  label,
  bureau,
  items,
  onEdit,
  onDelete,
}: {
  label: string;
  bureau: Bureau;
  items: NegativeItem[];
  onEdit: (item: NegativeItem) => void;
  onDelete: (item: NegativeItem) => void;
}) {
  const style = BUREAU_STYLES[bureau];
  return (
    <>
      <tr className={cn("border-y", style.bg)}>
        <td
          colSpan={7}
          className={cn("px-4 py-1.5 text-xs font-semibold", style.text)}
        >
          {label} · {items.length}
        </td>
      </tr>
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item)}
        />
      ))}
    </>
  );
}
