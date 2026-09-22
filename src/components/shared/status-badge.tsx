import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "purple" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-success ring-1 ring-inset ring-emerald-200",
  warning: "bg-amber-50 text-warning ring-1 ring-inset ring-amber-200",
  danger: "bg-rose-50 text-danger ring-1 ring-inset ring-rose-200",
  info: "bg-blue-50 text-primary ring-1 ring-inset ring-blue-200",
  purple: "bg-violet-50 text-purple ring-1 ring-inset ring-violet-200",
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
};

const STATUS_TONE_MAP: Record<string, StatusTone> = {
  Active: "success",
  Present: "success",
  Paid: "success",
  Completed: "success",
  Approved: "success",
  Ready: "success",
  Valid: "success",
  Published: "info",
  Processing: "info",
  Generating: "info",
  Generated: "info",
  Draft: "neutral",
  Inactive: "neutral",
  Pending: "warning",
  "On Leave": "warning",
  "Notice Period": "warning",
  "Partial Day": "warning",
  Partial: "warning",
  Warning: "warning",
  Exception: "danger",
  Failed: "danger",
  Rejected: "danger",
  Due: "danger",
  Overdue: "danger",
  Absent: "danger",
};

interface StatusBadgeProps {
  status: string;
  tone?: StatusTone;
  className?: string;
}

export function StatusBadge({ status, tone, className }: StatusBadgeProps) {
  const resolvedTone = tone ?? STATUS_TONE_MAP[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[resolvedTone],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
