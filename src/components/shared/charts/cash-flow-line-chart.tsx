"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/utils/format";
import { useMounted } from "@/hooks/use-mounted";
import { Skeleton } from "@/components/ui/skeleton";

interface CashFlowLineChartProps {
  data: { month: string; inflow: number; outflow: number }[];
}

export function CashFlowLineChart({ data }: CashFlowLineChartProps) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton className="h-full w-full" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#E5EAF0" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B7280" }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "#6B7280" }}
          tickFormatter={(v) => `${(v / 10000000).toFixed(1)}Cr`}
          width={44}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, borderColor: "#E5EAF0", fontSize: 12 }}
          formatter={(value, name) => [formatINR(Number(value)), name === "inflow" ? "Cash Inflow" : "Cash Outflow"]}
        />
        <Legend
          formatter={(value) => (value === "inflow" ? "Cash Inflow" : "Cash Outflow")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Line type="monotone" dataKey="inflow" stroke="#22A06B" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
        <Line type="monotone" dataKey="outflow" stroke="#1769E0" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
