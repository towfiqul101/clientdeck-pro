"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  cn,
  formatCurrency,
  getNegativeTypeLabel,
  suggestLetterType,
} from "@/lib/utils/helpers";
import { BUREAUS, LETTER_TYPES, BUREAU_STYLES } from "@/lib/constants";
import { createRound, type RoundItemSelection } from "../actions";
import type { Bureau, DisputeResult, LetterType, NegativeItem } from "@/types";
import { FileWarning, Layers, Sparkles } from "lucide-react";

export interface BuilderItem extends NegativeItem {
  previous_result: DisputeResult | null;
  previous_round: number | null;
}

interface RoundBuilderProps {
  clientId: string;
  roundNumber: number;
  items: BuilderItem[];
}

export function RoundBuilder({
  clientId,
  roundNumber,
  items,
}: RoundBuilderProps) {
  const router = useRouter();
  const { toast } = useToast();

  const defaultType = (item: BuilderItem): LetterType =>
    suggestLetterType(
      roundNumber,
      item.previous_result ?? undefined
    ) as LetterType;

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [letterTypes, setLetterTypes] = useState<Record<string, LetterType>>(
    () => Object.fromEntries(items.map((i) => [i.id, defaultType(i)]))
  );
  const [submitting, setSubmitting] = useState(false);

  const groups = useMemo(
    () =>
      BUREAUS.map((b) => ({
        bureau: b.value as Bureau,
        label: b.label,
        items: items.filter((i) => i.bureau === b.value),
      })).filter((g) => g.items.length > 0),
    [items]
  );

  const selectedItems = items.filter((i) => selected[i.id]);
  const selectedCount = selectedItems.length;
  const bureauCount = new Set(selectedItems.map((i) => i.bureau)).size;

  const allSelected = selectedCount === items.length && items.length > 0;

  function toggleItem(id: string, value: boolean) {
    setSelected((prev) => ({ ...prev, [id]: value }));
  }

  function toggleGroup(bureau: Bureau, value: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      items
        .filter((i) => i.bureau === bureau)
        .forEach((i) => (next[i.id] = value));
      return next;
    });
  }

  function toggleAll(value: boolean) {
    setSelected(
      value ? Object.fromEntries(items.map((i) => [i.id, true])) : {}
    );
  }

  async function handleCreate() {
    if (selectedCount === 0) {
      toast("Select at least one item to dispute.", "error");
      return;
    }
    setSubmitting(true);
    const selections: RoundItemSelection[] = selectedItems.map((i) => ({
      negativeItemId: i.id,
      bureau: i.bureau,
      letterType: letterTypes[i.id],
    }));
    const result = await createRound(clientId, selections);
    if (result.success) {
      toast(`Round ${roundNumber} created.`, "success");
      router.push(`/clients/${clientId}/rounds/${result.roundId}`);
    } else {
      toast(result.error, "error");
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <EmptyState
          icon={FileWarning}
          title="No items available to dispute"
          description="All items are already deleted, or this client has no negative items yet. Add items before starting a round."
          action={
            <Button
              variant="secondary"
              onClick={() => router.push(`/clients/${clientId}/items`)}
            >
              Manage items
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Round number banner */}
      <div className="flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-lg font-semibold text-white">
          {roundNumber}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Round {roundNumber}</h3>
          <p className="text-sm text-gray-600">
            Select the items to dispute this round. The round number is assigned
            automatically.
          </p>
        </div>
      </div>

      {/* Global select all */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => toggleAll(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Select all ({items.length})
        </label>
        <p className="text-sm text-gray-500">
          Round {roundNumber} suggestion:{" "}
          <span className="font-medium text-gray-700">
            {roundNumber === 1
              ? "Initial Dispute for all items"
              : "Method of Verification / Escalation based on prior results"}
          </span>
        </p>
      </div>

      {/* Item groups */}
      <div className="space-y-5">
        {groups.map((group) => {
          const style = BUREAU_STYLES[group.bureau];
          const groupSelected = group.items.every((i) => selected[i.id]);
          return (
            <div
              key={group.bureau}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <div
                className={cn(
                  "flex items-center justify-between border-b px-5 py-3",
                  style.bg,
                  style.border
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} />
                  <span className={cn("text-sm font-semibold", style.text)}>
                    {group.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({group.items.length})
                  </span>
                </span>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                  <input
                    type="checkbox"
                    checked={groupSelected}
                    onChange={(e) =>
                      toggleGroup(group.bureau, e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Select all
                </label>
              </div>

              <ul className="divide-y divide-gray-100">
                {group.items.map((item) => {
                  const isSelected = !!selected[item.id];
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center",
                        isSelected && "bg-blue-50/40"
                      )}
                    >
                      <label className="flex flex-1 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            toggleItem(item.id, e.target.checked)
                          }
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {item.creditor_name}
                            </span>
                            <Badge status={item.dispute_status} />
                            {item.previous_result === "verified" &&
                              item.previous_round && (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                  Previously Verified — Round{" "}
                                  {item.previous_round}
                                </span>
                              )}
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-500">
                            {getNegativeTypeLabel(item.negative_type)}
                            {item.balance != null
                              ? ` · ${formatCurrency(item.balance)}`
                              : ""}
                          </span>
                        </span>
                      </label>

                      {isSelected && (
                        <div className="sm:w-56">
                          <Select
                            aria-label="Letter type"
                            value={letterTypes[item.id]}
                            onChange={(e) =>
                              setLetterTypes((prev) => ({
                                ...prev,
                                [item.id]: e.target.value as LetterType,
                              }))
                            }
                            options={LETTER_TYPES}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Sticky review / submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur md:pl-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-gray-400" />
            <span className="text-gray-700">
              {selectedCount === 0 ? (
                "No items selected"
              ) : (
                <>
                  <span className="font-semibold text-gray-900">
                    Round {roundNumber}
                  </span>{" "}
                  — {selectedCount} item{selectedCount === 1 ? "" : "s"} across{" "}
                  {bureauCount} bureau{bureauCount === 1 ? "" : "s"}
                </>
              )}
            </span>
          </div>
          <Button
            onClick={handleCreate}
            loading={submitting}
            disabled={selectedCount === 0}
          >
            <Sparkles className="h-4 w-4" />
            Create Round &amp; Generate Letters
          </Button>
        </div>
      </div>
    </div>
  );
}
