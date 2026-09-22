import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertCardTone = "critical" | "warning" | "success";

const toneStyles: Record<AlertCardTone, { border: string; bg: string; icon: ReactNode; iconColor: string; title: string }> = {
  critical: {
    border: "border-rose-200",
    bg: "bg-rose-50",
    icon: <OctagonAlert className="h-4.5 w-4.5" />,
    iconColor: "text-danger",
    title: "text-danger",
  },
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    icon: <AlertTriangle className="h-4.5 w-4.5" />,
    iconColor: "text-warning",
    title: "text-warning",
  },
  success: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    icon: <CheckCircle2 className="h-4.5 w-4.5" />,
    iconColor: "text-success",
    title: "text-success",
  },
};

interface AlertCardProps {
  tone: AlertCardTone;
  title: string;
  count?: number;
  items?: string[];
  description?: string;
  viewHref?: string;
  className?: string;
}

export function AlertCard({ tone, title, count, items, description, viewHref, className }: AlertCardProps) {
  const s = toneStyles[tone];
  return (
    <div className={cn("rounded-xl border p-4", s.border, s.bg, className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={s.iconColor}>{s.icon}</span>
          <h3 className={cn("text-sm font-semibold", s.title)}>{title}</h3>
        </div>
        {count !== undefined && (
          <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white", tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-danger")}>
            {count}
          </span>
        )}
      </div>
      {description && <p className="mt-1.5 text-xs text-foreground/80">{description}</p>}
      {items && items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current" />
              {item}
            </li>
          ))}
        </ul>
      )}
      {viewHref && (
        <Link href={viewHref} className={cn("mt-2.5 inline-block text-xs font-medium hover:underline", s.title)}>
          View Details →
        </Link>
      )}
    </div>
  );
}
