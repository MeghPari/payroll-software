import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickAction {
  icon: LucideIcon;
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
}

export function QuickActionsCard({ actions, title = "Quick Actions" }: { actions: QuickAction[]; title?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-1">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-50 disabled:pointer-events-none"
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{action.label}</span>
                {action.description && (
                  <span className="block truncate text-xs text-muted-foreground">{action.description}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
