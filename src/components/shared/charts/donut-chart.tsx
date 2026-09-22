"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatINR } from "@/utils/format";
import { useMounted } from "@/hooks/use-mounted";
import { Skeleton } from "@/components/ui/skeleton";

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  centerLabel?: string;
  centerValue?: string;
  formatTooltip?: (value: number) => string;
}

export function DonutChart({ data, centerLabel, centerValue, formatTooltip }: DonutChartProps) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton className="h-full w-full" />;

  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            strokeWidth={0}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 8, borderColor: "#E5EAF0", fontSize: 12 }}
            formatter={(value, name) => [formatTooltip ? formatTooltip(Number(value)) : formatINR(Number(value)), name]}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="text-lg font-semibold text-foreground">{centerValue}</span>}
          {centerLabel && <span className="text-[11px] text-muted-foreground">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function DonutLegend({ data, formatValue }: { data: DonutDatum[]; formatValue?: (value: number) => string }) {
  return (
    <div className="mt-4 space-y-2">
      {data.map((d) => (
        <div key={d.name} className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.name}
          </span>
          <span className="font-medium text-muted-foreground">{formatValue ? formatValue(d.value) : d.value}</span>
        </div>
      ))}
    </div>
  );
}
