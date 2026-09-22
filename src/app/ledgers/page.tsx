"use client";

import { useEffect, useState } from "react";
import type { Column } from "@/components/shared/data-table";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { getLedgers } from "@/services/accounting.service";
import { formatINR } from "@/utils/format";
import type { AccountType, Ledger } from "@/types";
import { toast } from "sonner";

const typeTone: Record<AccountType, "info" | "danger" | "success" | "warning" | "purple"> = {
  Asset: "info",
  Liability: "danger",
  Income: "success",
  Expense: "warning",
  Equity: "purple",
};

export default function LedgersPage() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");

  useEffect(() => {
    getLedgers().then((data) => {
      setLedgers(data);
      setLoading(false);
    });
  }, []);

  const filtered = ledgers.filter((l) => {
    if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.code.includes(search)) return false;
    if (type !== "All" && l.type !== type) return false;
    return true;
  });

  const columns: Column<Ledger>[] = [
    { accessorKey: "name", header: "Ledger Name", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
    { accessorKey: "code", header: "Code" },
    { accessorKey: "type", header: "Type", cell: ({ getValue }) => <StatusBadge status={getValue<AccountType>()} tone={typeTone[getValue<AccountType>()]} /> },
    { accessorKey: "balance", header: "Balance (₹)", cell: ({ getValue }) => formatINR(getValue<number>(), { showSymbol: false }) },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Ledgers"
        subtitle="View and manage all general ledger accounts."
        actions={
          <Button className="gap-1.5" onClick={() => toast.info("Add Ledger — coming soon")}>
            <Plus className="h-4 w-4" /> Add Ledger
          </Button>
        }
      />
      <SectionCard noPadding>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search ledgers..." className="w-full sm:w-64" />
          <FilterSelect value={type} onChange={setType} options={["All", "Asset", "Liability", "Income", "Expense", "Equity"]} placeholder="Type" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} pageSize={12} />
      </SectionCard>
    </div>
  );
}
