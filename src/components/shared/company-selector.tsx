"use client";

import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { companies, useAppStore } from "@/store/app-store";

export function CompanySelector() {
  const companyId = useAppStore((s) => s.companyId);
  const setCompanyId = useAppStore((s) => s.setCompanyId);
  const active = companies.find((c) => c.id === companyId) ?? companies[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 transition-colors max-w-[220px]">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{active.name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {companies.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => setCompanyId(c.id)}>
            {c.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
