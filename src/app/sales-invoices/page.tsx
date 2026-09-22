"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Column } from "@/components/shared/data-table";
import { Plus, ReceiptText, Wallet, Clock, AlertOctagon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { getSalesInvoices } from "@/services/accounting.service";
import { formatINR } from "@/utils/format";
import type { Invoice } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";

export default function SalesInvoicesPage() {
  return (
    <Suspense fallback={null}>
      <SalesInvoicesContent />
    </Suspense>
  );
}

function SalesInvoicesContent() {
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (searchParams.get("create") === "1") toast.info("Create Invoice — form coming soon");
  }, [searchParams]);

  useEffect(() => {
    getSalesInvoices().then((data) => {
      setInvoices(data);
      setLoading(false);
    });
  }, []);

  const filtered = invoices.filter((i) => i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || i.customer.toLowerCase().includes(search.toLowerCase()));
  const totalPaid = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + i.amount, 0);
  const totalDue = invoices.filter((i) => i.status === "Due" || i.status === "Partial").reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter((i) => i.status === "Overdue").reduce((s, i) => s + i.amount, 0);

  const columns: Column<Invoice>[] = [
    { accessorKey: "invoiceNumber", header: "Invoice #", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
    { accessorKey: "customer", header: "Customer" },
    { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => formatINR(getValue<number>()) },
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => format(new Date(getValue<string>()), "dd MMM yyyy") },
    { accessorKey: "dueDate", header: "Due Date", cell: ({ getValue }) => format(new Date(getValue<string>()), "dd MMM yyyy") },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Sales Invoices"
        subtitle="Create and track customer invoices and payments."
        actions={
          <Button className="gap-1.5" onClick={() => toast.info("Create Invoice — form coming soon")}>
            <Plus className="h-4 w-4" /> Create Invoice
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ReceiptText} tone="blue" label="Total Invoices" value={String(invoices.length)} />
        <StatCard icon={Wallet} tone="green" label="Paid" value={formatINR(totalPaid)} />
        <StatCard icon={Clock} tone="amber" label="Due" value={formatINR(totalDue)} />
        <StatCard icon={AlertOctagon} tone="red" label="Overdue" value={formatINR(totalOverdue)} />
      </div>
      <SectionCard noPadding>
        <div className="border-b border-border p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoices..." className="w-full sm:w-64" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} pageSize={10} />
      </SectionCard>
    </div>
  );
}
