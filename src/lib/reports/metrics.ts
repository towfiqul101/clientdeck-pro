import type { Bureau, NegativeType } from "@/types";

export interface BureauStat {
  bureau: Bureau;
  totalDisputed: number;
  totalDeleted: number;
  successRate: number; // 0-100, one decimal
}

export function bureauBreakdown(
  rows: { bureau: Bureau; result: string }[]
): BureauStat[] {
  const bureaus: Bureau[] = ["equifax", "experian", "transunion"];
  return bureaus.map((bureau) => {
    const forBureau = rows.filter((r) => r.bureau === bureau && r.result !== "pending");
    const totalDisputed = forBureau.length;
    const totalDeleted = forBureau.filter((r) => r.result === "deleted").length;
    const successRate =
      totalDisputed > 0 ? Math.round((totalDeleted / totalDisputed) * 1000) / 10 : 0;
    return { bureau, totalDisputed, totalDeleted, successRate };
  });
}

export interface TypeStat {
  type: NegativeType;
  count: number;
  pct: number; // 0-100 rounded
}

export function typeBreakdown(
  items: { negative_type: NegativeType }[]
): TypeStat[] {
  const total = items.length;
  const counts = new Map<NegativeType, number>();
  for (const i of items) counts.set(i.negative_type, (counts.get(i.negative_type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

export interface ClientMetrics {
  retentionRate: number; // 0-100
  cancelled: number;
  totalClients: number;
  avgScoreIncrease: number | null;
}

export function clientMetrics(input: {
  clients: { status: string; score_eq_start: number | null; score_eq_current: number | null }[];
}): ClientMetrics {
  const { clients } = input;
  const totalClients = clients.length;
  const cancelled = clients.filter((c) => c.status === "cancelled").length;
  const retentionRate =
    totalClients > 0 ? Math.round(((totalClients - cancelled) / totalClients) * 100) : 100;

  const deltas = clients
    .map((c) =>
      c.score_eq_start != null && c.score_eq_current != null
        ? c.score_eq_current - c.score_eq_start
        : null
    )
    .filter((d): d is number => d != null);
  const avgScoreIncrease =
    deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : null;

  return { retentionRate, cancelled, totalClients, avgScoreIncrease };
}

export interface ScoreDistributionBucket {
  bucket: string;
  count: number;
  pct: number;
}

const SCORE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "300-499", min: 300, max: 499 },
  { label: "500-579", min: 500, max: 579 },
  { label: "580-669", min: 580, max: 669 },
  { label: "670-739", min: 670, max: 739 },
  { label: "740+", min: 740, max: Infinity },
];

/** Buckets active clients' current Equifax score into 5 FICO-ish ranges. */
export function scoreDistribution(clients: { score_eq_current: number | null }[]): ScoreDistributionBucket[] {
  const scored = clients.filter((c) => c.score_eq_current !== null) as { score_eq_current: number }[];
  const total = scored.length;
  return SCORE_BUCKETS.map((b) => {
    const count = scored.filter((c) => c.score_eq_current >= b.min && c.score_eq_current <= b.max).length;
    return { bucket: b.label, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
  });
}
