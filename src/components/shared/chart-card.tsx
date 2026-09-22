import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  viewHref?: string;
  viewLabel?: string;
  children: ReactNode;
  className?: string;
  legend?: ReactNode;
}

export function ChartCard({ title, subtitle, viewHref, viewLabel = "View Report", children, className, legend }: ChartCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {viewHref && (
          <Link href={viewHref} className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
            {viewLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="h-64 w-full">{children}</div>
      {legend}
    </div>
  );
}
