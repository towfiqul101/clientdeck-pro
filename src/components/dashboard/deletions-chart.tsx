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
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-[var(--shadow-elevated)]">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{payload[0].value} deletions</p>
    </div>
  );
}

export function DeletionsChart({ data }: { data: MonthlyDeletion[] }) {
  const hasData = data.some((d) => d.deletions > 0);

  if (!hasData) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-gray-400">
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
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#9ca3af" }}
          />
          <YAxis hide />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f3f4f6" }} />
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
