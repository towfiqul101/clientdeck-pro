"use client";

import { Input, Select } from "@/components/ui/field";
import { BUREAUS, ACCOUNT_TYPES, NEGATIVE_TYPES } from "@/lib/constants";
import type { NewItemInput } from "./actions";
import { Trash2 } from "lucide-react";

export function blankDraft(bureau: NewItemInput["bureau"] = "equifax"): NewItemInput {
  return {
    bureau,
    creditor_name: "",
    account_number_last4: "",
    account_type: "",
    negative_type: "collection",
    balance: "",
    date_opened: "",
    date_of_first_delinquency: "",
  };
}

interface DraftRowProps {
  draft: NewItemInput;
  onChange: (patch: Partial<NewItemInput>) => void;
  onRemove?: () => void;
  layout: "grid" | "stacked";
}

/** One editable negative-item row, used by both the modal and the quick-add grid. */
export function ItemDraftRow({
  draft,
  onChange,
  onRemove,
  layout,
}: DraftRowProps) {
  if (layout === "grid") {
    return (
      <tr className="align-top">
        <td className="p-1">
          <Select
            aria-label="Bureau"
            value={draft.bureau}
            onChange={(e) =>
              onChange({ bureau: e.target.value as NewItemInput["bureau"] })
            }
            options={BUREAUS}
            className="min-w-[7rem]"
          />
        </td>
        <td className="p-1">
          <Input
            aria-label="Creditor"
            value={draft.creditor_name}
            onChange={(e) => onChange({ creditor_name: e.target.value })}
            placeholder="Creditor"
            className="min-w-[10rem]"
          />
        </td>
        <td className="p-1">
          <Input
            aria-label="Acct last 4"
            value={draft.account_number_last4}
            onChange={(e) =>
              onChange({
                account_number_last4: e.target.value.replace(/\D/g, "").slice(0, 4),
              })
            }
            placeholder="1234"
            className="w-20"
          />
        </td>
        <td className="p-1">
          <Select
            aria-label="Account type"
            value={draft.account_type}
            onChange={(e) =>
              onChange({
                account_type: e.target.value as NewItemInput["account_type"],
              })
            }
            options={ACCOUNT_TYPES}
            placeholder="Type"
            className="min-w-[8rem]"
          />
        </td>
        <td className="p-1">
          <Select
            aria-label="Negative type"
            value={draft.negative_type}
            onChange={(e) =>
              onChange({
                negative_type: e.target.value as NewItemInput["negative_type"],
              })
            }
            options={NEGATIVE_TYPES}
            className="min-w-[9rem]"
          />
        </td>
        <td className="p-1">
          <Input
            aria-label="Balance"
            type="number"
            value={draft.balance}
            onChange={(e) => onChange({ balance: e.target.value })}
            placeholder="0.00"
            className="w-24"
          />
        </td>
        <td className="p-1">
          <Input
            aria-label="Date opened"
            type="date"
            value={draft.date_opened}
            onChange={(e) => onChange({ date_opened: e.target.value })}
            className="min-w-[8rem]"
          />
        </td>
        <td className="p-1">
          <Input
            aria-label="First delinquency"
            type="date"
            value={draft.date_of_first_delinquency}
            onChange={(e) =>
              onChange({ date_of_first_delinquency: e.target.value })
            }
            className="min-w-[8rem]"
          />
        </td>
        <td className="p-1">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
              aria-label="Remove row"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </td>
      </tr>
    );
  }

  // Stacked (modal) layout
  return (
    <div className="relative grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
          aria-label="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">Bureau</span>
        <Select
          value={draft.bureau}
          onChange={(e) =>
            onChange({ bureau: e.target.value as NewItemInput["bureau"] })
          }
          options={BUREAUS}
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">Creditor</span>
        <Input
          value={draft.creditor_name}
          onChange={(e) => onChange({ creditor_name: e.target.value })}
          placeholder="e.g. Capital One"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          Account last 4
        </span>
        <Input
          value={draft.account_number_last4}
          onChange={(e) =>
            onChange({
              account_number_last4: e.target.value.replace(/\D/g, "").slice(0, 4),
            })
          }
          placeholder="1234"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          Account type
        </span>
        <Select
          value={draft.account_type}
          onChange={(e) =>
            onChange({
              account_type: e.target.value as NewItemInput["account_type"],
            })
          }
          options={ACCOUNT_TYPES}
          placeholder="Select type"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          Negative type
        </span>
        <Select
          value={draft.negative_type}
          onChange={(e) =>
            onChange({
              negative_type: e.target.value as NewItemInput["negative_type"],
            })
          }
          options={NEGATIVE_TYPES}
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">Balance</span>
        <Input
          type="number"
          value={draft.balance}
          onChange={(e) => onChange({ balance: e.target.value })}
          placeholder="0.00"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">Date opened</span>
        <Input
          type="date"
          value={draft.date_opened}
          onChange={(e) => onChange({ date_opened: e.target.value })}
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          First delinquency
        </span>
        <Input
          type="date"
          value={draft.date_of_first_delinquency}
          onChange={(e) =>
            onChange({ date_of_first_delinquency: e.target.value })
          }
        />
      </label>
    </div>
  );
}
