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
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <Tooltip
            cursor={{ fill: "#f8fafc" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 13,
            }}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
          />
          <Bar
            dataKey="deletions"
            fill="#2563eb"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
