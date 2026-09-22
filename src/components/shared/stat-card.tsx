import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "blue" | "green" | "amber" | "red" | "purple" | "cyan" | "slate";

const toneClasses: Record<StatTone, string> = {
  blue: "bg-blue-50 text-primary",
  green: "bg-emerald-50 text-success",
  amber: "bg-amber-50 text-warning",
  red: "bg-rose-50 text-danger",
  purple: "bg-violet-50 text-purple",
  cyan: "bg-cyan-50 text-cyan",
  slate: "bg-slate-100 text-slate-600",
};

interface StatCardProps {
  icon: LucideIcon;
  tone?: StatTone;
  label: string;
  value: string;
  helperText?: string;
  changeLabel?: string;
  changeDirection?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({
  icon: Icon,
  tone = "blue",
  label,
  value,
  helperText,
  changeLabel,
  changeDirection,
  className,
}: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-tight text-foreground">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneClasses[tone])}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>
      {(helperText || changeLabel) && (
        <div className="mt-2.5 flex items-center gap-1 text-xs">
          {changeLabel && changeDirection && changeDirection !== "neutral" && (
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                changeDirection === "up" ? "text-success" : "text-danger"
              )}
            >
              {changeDirection === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {changeLabel}
            </span>
          )}
          {helperText && <span className="text-muted-foreground">{helperText}</span>}
        </div>
      )}
    </div>
  );
}
