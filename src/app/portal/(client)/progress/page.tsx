import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  RoundTimeline,
  type TimelineRound,
  type TimelineResultItem,
} from "@/components/portal/round-timeline";
import {
  ScoreLineChart,
  type ScorePoint,
} from "@/components/portal/score-line-chart";
import type {
  Bureau,
  DisputeResult,
  RoundStatus,
  ScoreHistory,
} from "@/types";
import { TrendingUp } from "lucide-react";

interface DisputeRow {
  round_id: string;
  result: DisputeResult;
  bureau: Bureau;
  negative_item: { creditor_name: string; negative_type: string } | null;
}
interface RoundRow {
  id: string;
  round_number: number;
  status: RoundStatus;
  date_sent: string | null;
  date_responses_received: string | null;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export default async function PortalProgressPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal?expired=true");

  const { client } = session;
  const supabase = createAdminClient();

  const [roundsRes, disputesRes, historyRes] = await Promise.all([
    supabase
      .from("dispute_rounds")
      .select("id, round_number, status, date_sent, date_responses_received")
      .eq("client_id", client.id)
      .order("round_number", { ascending: false }),
    supabase
      .from("disputes")
      .select(
        "round_id, result, bureau, negative_item:negative_items(creditor_name, negative_type)"
      )
      .eq("client_id", client.id),
    supabase
      .from("score_history")
      .select("*")
      .eq("client_id", client.id)
      .order("recorded_at", { ascending: true }),
  ]);

  const roundRows = (roundsRes.data ?? []) as RoundRow[];
  const disputeRows = (disputesRes.data ?? []) as unknown as DisputeRow[];
  const history = (historyRes.data ?? []) as ScoreHistory[];

  // Group disputes per round → per (creditor + result) with bureau list.
  const byRound = new Map<string, DisputeRow[]>();
  for (const d of disputeRows) {
    const arr = byRound.get(d.round_id) ?? [];
    arr.push(d);
    byRound.set(d.round_id, arr);
  }

  // Per-round average score change from history snapshots.
  const changeByRound = new Map<number, number>();
  for (let i = 1; i < history.length; i++) {
    const cur = history[i];
    const prev = history[i - 1];
    if (cur.round_number === null) continue;
    const deltas: number[] = [];
    if (cur.score_eq != null && prev.score_eq != null)
      deltas.push(cur.score_eq - prev.score_eq);
    if (cur.score_exp != null && prev.score_exp != null)
      deltas.push(cur.score_exp - prev.score_exp);
    if (cur.score_tu != null && prev.score_tu != null)
      deltas.push(cur.score_tu - prev.score_tu);
    const a = avg(deltas);
    if (a !== null) changeByRound.set(cur.round_number, a);
  }

  const timeline: TimelineRound[] = roundRows.map((round) => {
    const disputes = byRound.get(round.id) ?? [];
    const groups = new Map<string, TimelineResultItem>();
    for (const d of disputes) {
      const creditor = d.negative_item?.creditor_name ?? "Account";
      const negativeType = d.negative_item?.negative_type ?? "other";
      const key = `${creditor}||${d.result}`;
      const existing = groups.get(key);
      if (existing) {
        if (!existing.bureaus.includes(d.bureau)) existing.bureaus.push(d.bureau);
      } else {
        groups.set(key, {
          creditor,
          negativeType,
          result: d.result,
          bureaus: [d.bureau],
        });
      }
    }
    // Show resolved results first (deleted/updated), then others.
    const order: Record<DisputeResult, number> = {
      deleted: 0,
      updated: 1,
      verified: 2,
      no_response: 3,
      in_progress: 4,
      pending: 5,
    };
    const results = [...groups.values()].sort(
      (a, b) => order[a.result] - order[b.result]
    );
    return {
      id: round.id,
      round_number: round.round_number,
      status: round.status,
      date_sent: round.date_sent,
      date_responses_received: round.date_responses_received,
      results,
      scoreChange: changeByRound.get(round.round_number) ?? null,
    };
  });

  // Score chart points.
  const chartPoints: ScorePoint[] = history.map((h) => ({
    label: new Date(h.recorded_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    Equifax: h.score_eq,
    Experian: h.score_exp,
    TransUnion: h.score_tu,
  }));

  // Overall stats.
  const itemsRemoved = client.total_items_deleted;
  const increases: number[] = [];
  if (client.score_eq_current != null && client.score_eq_start != null)
    increases.push(client.score_eq_current - client.score_eq_start);
  if (client.score_exp_current != null && client.score_exp_start != null)
    increases.push(client.score_exp_current - client.score_exp_start);
  if (client.score_tu_current != null && client.score_tu_start != null)
    increases.push(client.score_tu_current - client.score_tu_start);
  const avgIncrease = avg(increases) ?? 0;
  const nowMs = new Date().getTime();
  const monthsInProgram = Math.max(
    0,
    Math.floor(
      (nowMs - new Date(client.service_start_date).getTime()) /
        (30 * 24 * 60 * 60 * 1000)
    )
  );
  const roundsCompleted = roundRows.filter(
    (r) => r.status === "complete"
  ).length;

  const stats = [
    { label: "Items removed", value: itemsRemoved },
    {
      label: "Avg score change",
      value: `${avgIncrease > 0 ? "+" : ""}${avgIncrease}`,
    },
    { label: "Months in program", value: monthsInProgram },
    { label: "Rounds completed", value: roundsCompleted },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Your progress</h1>

      {/* Overall stats */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/10 bg-[#1a1a2e] p-4 shadow-sm"
          >
            <p className="text-2xl font-bold text-slate-100">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Score chart */}
      <div className="rounded-xl border border-white/10 bg-[#1a1a2e] p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-100">
            Score history
          </h2>
        </div>
        <ScoreLineChart data={chartPoints} />
      </div>

      {/* Timeline */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-100">
          Round history
        </h2>
        {timeline.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-[#1a1a2e] p-6 text-center text-sm text-slate-500">
            Your dispute rounds will appear here once your specialist starts
            working on your case.
          </p>
        ) : (
          <RoundTimeline rounds={timeline} />
        )}
      </div>
    </div>
  );
}
