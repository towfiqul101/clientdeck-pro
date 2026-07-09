"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export interface MonthlyDeletion {
  label: string;
  deletions: number;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#1a1a2e]/95 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-white">{payload[0].value} deletions</p>
    </div>
  );
}

export function DeletionsChart({ data }: { data: MonthlyDeletion[] }) {
  const hasData = data.some((d) => d.deletions > 0);

  if (!hasData) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-500">
        No deletions recorded yet — they&apos;ll chart here as rounds resolve.
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="deletionsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#94a3b8" }}
          />
          <YAxis hide />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar
            dataKey="deletions"
            fill="url(#deletionsGradient)"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
