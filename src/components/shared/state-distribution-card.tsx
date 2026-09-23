import { SectionCard } from "@/components/shared/section-card";
import { MapPin } from "lucide-react";

interface StateDistributionCardProps {
  employees: { state: string }[];
  topN?: number;
  className?: string;
}

export function StateDistributionCard({ employees, topN = 5, className }: StateDistributionCardProps) {
  const counts = new Map<string, number>();
  employees.forEach((e) => counts.set(e.state, (counts.get(e.state) ?? 0) + 1));
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, topN);
  const othersCount = sorted.slice(topN).reduce((sum, [, c]) => sum + c, 0);
  const rows = othersCount > 0 ? [...top, ["Others", othersCount] as [string, number]] : top;
  const max = Math.max(...rows.map(([, c]) => c), 1);

  return (
    <SectionCard title="Employees by State" subtitle="Workforce distribution across states" className={className}>
      <div className="space-y-3">
        {rows.map(([state, count]) => (
          <div key={state} className="flex items-center gap-3">
            <span className="flex w-28 shrink-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {state}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-semibold text-foreground">{count}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
