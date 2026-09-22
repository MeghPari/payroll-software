import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PayrollStep } from "@/types";

export function PayrollStepper({ steps }: { steps: PayrollStep[] }) {
  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex min-w-max items-start gap-0">
        {steps.map((step, idx) => (
          <li key={step.id} className="flex items-start">
            <div className="flex flex-col items-center gap-1.5 px-2 w-[108px]">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  step.status === "completed" && "bg-primary text-white",
                  step.status === "in-progress" && "bg-primary/15 text-primary ring-2 ring-primary",
                  step.status === "pending" && "bg-muted text-muted-foreground"
                )}
              >
                {step.status === "completed" ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <p
                className={cn(
                  "text-center text-[11.5px] font-medium leading-tight",
                  step.status === "pending" ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {step.label}
              </p>
              <span
                className={cn(
                  "text-[10px] font-medium capitalize",
                  step.status === "completed" && "text-success",
                  step.status === "in-progress" && "text-primary",
                  step.status === "pending" && "text-muted-foreground"
                )}
              >
                {step.status === "in-progress" ? "In Progress" : step.status}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn("mt-4.5 h-0.5 w-8 shrink-0", step.status === "completed" ? "bg-primary" : "bg-border")} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
