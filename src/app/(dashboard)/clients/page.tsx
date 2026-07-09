import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClientsFilters } from "./clients-filters";
import { ClientCardsView } from "./client-cards-view";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  cn,
  formatDate,
  formatPhone,
  getInitials,
  scoreChange,
} from "@/lib/utils/helpers";
import type { Client } from "@/types";
import { Users, Plus, UserPlus, ArrowUp, Eye, Pencil } from "lucide-react";

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
        value ? "bg-white/[0.06] text-slate-200" : "bg-white/[0.03] text-slate-600"
      )}
    >
      {value ?? "—"}
    </span>
  );
}

function ScoreCellWithChange({
  start,
  current,
}: {
  start: number | null;
  current: number | null;
}) {
  const change = scoreChange(start, current);
  return (
    <span className="flex items-center gap-0.5">
      <ScoreCell value={current} />
      {change.direction === "up" && (
        <ArrowUp className="h-3 w-3 text-emerald-400" />
      )}
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
  const assigned = param(sp, "assigned");
  const sort = param(sp, "sort") || "name";
  const view = param(sp, "view");
  const page = Math.max(1, parseInt(param(sp, "page") || "1", 10) || 1);

  const supabase = await createServerSupabaseClient();

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  const members = teamMembers ?? [];
  const memberNames = new Map(members.map((m) => [m.id, m.name]));

  let query = supabase.from("clients").select("*", { count: "exact" });

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
    );
  }
  if (status) query = query.eq("status", status);
  if (payment) query = query.eq("payment_status", payment);
  if (assigned === "unassigned") query = query.is("assigned_to", null);
  else if (assigned) query = query.eq("assigned_to", assigned);

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
    if (assigned) params.set("assigned", assigned);
    if (sort) params.set("sort", sort);
    if (view) params.set("view", view);
    params.set("page", String(p));
    return `/clients?${params.toString()}`;
  };

  const hasFilters = Boolean(q || status || payment || assigned);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">Clients</h2>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-sm font-medium text-slate-400 ring-1 ring-white/10">
            {total}
          </span>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2 text-sm font-medium text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] transition-all hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(139,92,246,0.4)]"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Link>
      </div>

      <ClientsFilters members={members} />

      {/* Client list */}
      {clients.length === 0 ? (
        <div className="glass-panel overflow-hidden">
          <EmptyState
            icon={hasFilters ? Users : UserPlus}
            title={hasFilters ? "No matching clients" : "No clients yet"}
            description={
              hasFilters
                ? "Try adjusting your search or filters."
                : "Add your first client to start tracking dispute rounds and letters."
            }
            action={
              !hasFilters && (
                <Link
                  href="/clients/new"
                  className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2 text-sm font-medium text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] hover:-translate-y-px"
                >
                  <Plus className="h-4 w-4" />
                  Add Client
                </Link>
              )
            }
          />
        </div>
      ) : view === "cards" ? (
        <ClientCardsView clients={clients} />
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-sm">
              <thead className="sticky top-0 z-10 bg-white/[0.03] text-left text-xs font-medium uppercase tracking-wide text-slate-500 backdrop-blur-xl">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Scores (EQ / EXP / TU)</th>
                  <th className="px-4 py-3">Round</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="group border-b border-white/[0.05] transition-colors duration-150 last:border-b-0 hover:bg-white/[0.03] cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${c.id}`}
                        className="flex items-center gap-3"
                        // Stretch the link across the row visually.
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-medium text-violet-300">
                          {getInitials(c.first_name, c.last_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium text-slate-100 group-hover:text-violet-300">
                            {c.first_name} {c.last_name}
                            <SignatureDot status={c.signature_status} />
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {c.email || "No email"}
                            {c.phone ? ` · ${formatPhone(c.phone)}` : ""}
                          </p>
                        </div>
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
                        className="flex items-center gap-1.5"
                      >
                        <ScoreCellWithChange
                          start={c.score_eq_start}
                          current={c.score_eq_current}
                        />
                        <ScoreCellWithChange
                          start={c.score_exp_start}
                          current={c.score_exp_current}
                        />
                        <ScoreCellWithChange
                          start={c.score_tu_start}
                          current={c.score_tu_current}
                        />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <Link href={`/clients/${c.id}`} className="block">
                        {c.current_round > 0 ? `Round ${c.current_round}` : "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <Link href={`/clients/${c.id}`} className="block">
                        <span className="font-medium text-emerald-400">
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
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="block">
                        <span
                          className={cn(
                            "text-sm",
                            c.assigned_to ? "text-slate-300" : "text-slate-500"
                          )}
                        >
                          {c.assigned_to
                            ? (memberNames.get(c.assigned_to) ?? "Unknown")
                            : "Unassigned"}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <Link href={`/clients/${c.id}`} className="block">
                        {formatDate(c.created_at)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <Link
                          href={`/clients/${c.id}`}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                          aria-label="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/clients/${c.id}/edit`}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
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
                    ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30"
                    : "text-slate-400 hover:bg-white/5"
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
