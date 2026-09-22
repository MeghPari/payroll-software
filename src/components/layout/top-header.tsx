"use client";

import { useState } from "react";
import { Menu, Plus, Search, UserPlus, PlayCircle, FileText, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompanySelector } from "@/components/shared/company-selector";
import { MonthPicker } from "@/components/shared/month-picker";
import { NotificationDropdown } from "@/components/shared/notification-dropdown";
import { UserMenu } from "@/components/shared/user-menu";
import { useAppStore } from "@/store/app-store";
import { useRouter } from "next/navigation";

export function TopHeader() {
  const setMobileOpen = useAppStore((s) => s.setMobileSidebarOpen);
  const [search, setSearch] = useState("");
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/95 backdrop-blur px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden items-center gap-2.5 md:flex">
        <CompanySelector />
        <MonthPicker />
      </div>

      <div className="relative mx-auto flex-1 max-w-md hidden sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employees, invoices, reports..."
          aria-label="Global search"
          className="h-9 w-full rounded-lg border border-border bg-muted/40 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:bg-white transition-colors"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" className="hidden sm:inline-flex gap-1.5" />}>
            <Plus className="h-4 w-4" /> Quick Action
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onClick={() => router.push("/employees?add=1")}>
              <UserPlus className="h-4 w-4" /> Add Employee
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/payroll")}>
              <PlayCircle className="h-4 w-4" /> Run Payroll
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/sales-invoices?create=1")}>
              <ReceiptText className="h-4 w-4" /> Create Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/payslips")}>
              <FileText className="h-4 w-4" /> Publish Payslips
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <NotificationDropdown />
        <UserMenu />
      </div>
    </header>
  );
}
