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
import { getVouchers } from "@/services/accounting.service";
import { formatINR } from "@/utils/format";
import type { Voucher } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";

export default function JournalEntriesPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");

  useEffect(() => {
    getVouchers().then((data) => {
      setVouchers(data);
      setLoading(false);
    });
  }, []);

  const filtered = vouchers.filter((v) => {
    if (type !== "All" && v.type !== type) return false;
    if (search && !v.voucherNumber.toLowerCase().includes(search.toLowerCase()) && !v.narration.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columns: Column<Voucher>[] = [
    { accessorKey: "voucherNumber", header: "Voucher #", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
    { accessorKey: "type", header: "Type", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} tone="info" /> },
    { accessorKey: "narration", header: "Narration" },
    { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => formatINR(getValue<number>()) },
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => format(new Date(getValue<string>()), "dd MMM yyyy") },
  ];

  return (
    <div>
      <PageHeader
        title="Journal Entries"
        subtitle="Record and review journal, payment, receipt and contra vouchers."
        actions={
          <Button className="gap-1.5" onClick={() => toast.info("New Voucher — coming soon")}>
            <Plus className="h-4 w-4" /> New Voucher
          </Button>
        }
      />
      <SectionCard noPadding>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search vouchers..." className="w-full sm:w-64" />
          <FilterSelect value={type} onChange={setType} options={["All", "Journal", "Payment", "Receipt", "Contra"]} placeholder="Type" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} pageSize={10} />
      </SectionCard>
    </div>
  );
}
