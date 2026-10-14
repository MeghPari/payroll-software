"use client";

import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSessionStore } from "@/store/session-store";

export function CompanySelector() {
  const companyId = useSessionStore((s) => s.companyId);
  const setCompanyId = useSessionStore((s) => s.selectCompany);
  const session = useSessionStore((s) => s.session);
  const companies = (session?.memberships ?? []).map(m => m.companies);
  const active = companies.find((c) => c.id === companyId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 transition-colors max-w-[220px]">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{active?.name ?? "Select company"}</span>
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
