"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/utils/format";
import { useMounted } from "@/hooks/use-mounted";
import { Skeleton } from "@/components/ui/skeleton";

interface PayrollBarChartProps {
  data: { month: string; value: number }[];
}

export function PayrollBarChart({ data }: PayrollBarChartProps) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton className="h-full w-full" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#E5EAF0" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "#6B7280" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "#6B7280" }}
          tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`}
          width={38}
        />
        <Tooltip
          cursor={{ fill: "#F1F5F9" }}
          contentStyle={{ borderRadius: 8, borderColor: "#E5EAF0", fontSize: 12 }}
          formatter={(value) => [formatINR(Number(value)), "Net Salary Payable"]}
        />
        <Bar dataKey="value" fill="#1769E0" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
