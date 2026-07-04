import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClientsFilters } from "./clients-filters";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  cn,
  formatDate,
  formatPhone,
} from "@/lib/utils/helpers";
import type { Client } from "@/types";
import { Users, Plus, UserPlus } from "lucide-react";

const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

function param(sp: SearchParams, key: string): string {
  const v = sp[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function SignatureDot({ status }: { status: Client["signature_status"] }) {
  if (status === "not_required") return null;
  const signed = status === "signed";
  return (
    <span
      title={signed ? "Agreement signed" : "Signature pending"}
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        signed ? "bg-green-500" : "bg-amber-500"
      )}
    />
  );
}

function ScoreCell({ value }: { value: number | null }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.5rem] justify-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums",
        value ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-300"
      )}
    >
      {value ?? "—"}
    </span>
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = param(sp, "q").replace(/[,()%]/g, "");
  const status = param(sp, "status");
  const payment = param(sp, "payment");
  const sort = param(sp, "sort") || "name";
  const page = Math.max(1, parseInt(param(sp, "page") || "1", 10) || 1);

  const supabase = await createServerSupabaseClient();
  let query = supabase.from("clients").select("*", { count: "exact" });

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
    );
  }
  if (status) query = query.eq("status", status);
  if (payment) query = query.eq("payment_status", payment);

  switch (sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "score_high":
      query = query.order("score_eq_current", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "score_low":
      query = query.order("score_eq_current", {
        ascending: true,
        nullsFirst: false,
      });
      break;
    default:
      query = query
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });
  }

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data, count } = await query;
  const clients = (data ?? []) as Client[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (payment) params.set("payment", payment);
    if (sort) params.set("sort", sort);
    params.set("page", String(p));
    return `/clients?${params.toString()}`;
  };

  const hasFilters = Boolean(q || status || payment);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Clients</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {total}
          </span>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Link>
      </div>

      <ClientsFilters />

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {clients.length === 0 ? (
          <EmptyState
            icon={hasFilters ? Users : UserPlus}
            title={hasFilters ? "No matching clients" : "No clients yet"}
            description={
              hasFilters
                ? "Try adjusting your search or filters."
                : "Add your first client to get started."
            }
            action={
              !hasFilters && (
                <Link
                  href="/clients/new"
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Client
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Scores (EQ / EXP / TU)</th>
                  <th className="px-4 py-3">Round</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="group cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${c.id}`}
                        className="block"
                        // Stretch the link across the row visually.
                      >
                        <p className="flex items-center gap-1.5 font-medium text-gray-900 group-hover:text-blue-600">
                          {c.first_name} {c.last_name}
                          <SignatureDot status={c.signature_status} />
                        </p>
                        <p className="text-xs text-gray-500">
                          {c.email || "No email"}
                          {c.phone ? ` · ${formatPhone(c.phone)}` : ""}
                        </p>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="block">
                        <Badge status={c.status} />
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${c.id}`}
                        className="flex items-center gap-1"
                      >
                        <ScoreCell value={c.score_eq_current} />
                        <ScoreCell value={c.score_exp_current} />
                        <ScoreCell value={c.score_tu_current} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <Link href={`/clients/${c.id}`} className="block">
                        {c.current_round > 0 ? `Round ${c.current_round}` : "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <Link href={`/clients/${c.id}`} className="block">
                        <span className="font-medium text-green-600">
                          {c.total_items_deleted}
                        </span>{" "}
                        / {c.total_items_current}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="block">
                        <Badge status={c.payment_status} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <Link href={`/clients/${c.id}`} className="block">
                        {formatDate(c.created_at)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} · {total} clients
          </p>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={buildPageUrl(p)}
                className={cn(
                  "min-w-[2rem] rounded-md px-2.5 py-1.5 text-center text-sm font-medium transition-colors",
                  p === page
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {p}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
