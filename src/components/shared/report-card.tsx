import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StatTone } from "./stat-card";

const toneClasses: Record<StatTone, string> = {
  blue: "bg-blue-50 text-primary",
  green: "bg-emerald-50 text-success",
  amber: "bg-amber-50 text-warning",
  red: "bg-rose-50 text-danger",
  purple: "bg-violet-50 text-purple",
  cyan: "bg-cyan-50 text-cyan",
  slate: "bg-slate-100 text-slate-600",
};

interface ReportCardProps {
  icon: LucideIcon;
  tone: StatTone;
  title: string;
  description: string;
  onView: () => void;
}

export function ReportCard({ icon: Icon, tone, title, description, onView }: ReportCardProps) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className={`flex h-11 w-11 items-center justify-center rounded-full ${toneClasses[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3.5 text-[15px] font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      <Button variant="outline" size="sm" className="mt-4 w-fit" onClick={onView}>
        View Report
      </Button>
    </div>
  );
}
