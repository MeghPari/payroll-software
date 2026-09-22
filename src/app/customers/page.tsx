"use client";

import { useEffect, useState } from "react";
import type { Column } from "@/components/shared/data-table";
import { Plus, Users2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { getCustomers } from "@/services/accounting.service";
import { formatINR } from "@/utils/format";
import type { Customer } from "@/types";
import { toast } from "sonner";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getCustomers().then((data) => {
      setCustomers(data);
      setLoading(false);
    });
  }, []);

  const filtered = customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);

  const columns: Column<Customer>[] = [
    { accessorKey: "name", header: "Customer", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "gstin", header: "GSTIN" },
    {
      accessorKey: "outstandingBalance",
      header: "Outstanding Balance",
      cell: ({ getValue }) => {
        const v = getValue<number>();
        return <span className={v > 0 ? "font-medium text-danger" : "text-muted-foreground"}>{formatINR(v)}</span>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage customer accounts and outstanding receivables."
        actions={
          <Button className="gap-1.5" onClick={() => toast.info("Add Customer — coming soon")}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users2} tone="blue" label="Total Customers" value={String(customers.length)} />
        <StatCard icon={Users2} tone="red" label="Outstanding Receivables" value={formatINR(totalOutstanding)} />
        <StatCard icon={Users2} tone="green" label="Customers with Zero Balance" value={String(customers.filter((c) => c.outstandingBalance === 0).length)} />
      </div>
      <SectionCard noPadding>
        <div className="border-b border-border p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search customers..." className="w-full sm:w-64" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} pageSize={10} />
      </SectionCard>
    </div>
  );
}
