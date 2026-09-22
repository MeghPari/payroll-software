"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { payrollMonths, useAppStore } from "@/store/app-store";

export function MonthPicker() {
  const month = useAppStore((s) => s.month);
  const setMonth = useAppStore((s) => s.setMonth);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 transition-colors">
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="whitespace-nowrap">{month}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {payrollMonths.map((m) => (
          <DropdownMenuItem key={m} onClick={() => setMonth(m)}>
            {m}
            {m === "May 2026" && <span className="ml-1.5 text-xs text-muted-foreground">(current)</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
