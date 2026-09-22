"use client";

import { useEffect, useMemo, useState } from "react";
import type { Column } from "@/components/shared/data-table";
import { Users, Wallet, Send, TrendingUp, FileDown, FileText, Mail, BellRing, RotateCcw, HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { FilterBar } from "@/components/shared/filter-bar";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { DataTable } from "@/components/shared/data-table";
import { DonutChart } from "@/components/shared/charts/donut-chart";
import { QuickActionsCard } from "@/components/shared/quick-actions-card";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { getPayslips, publishPayslips, reprocessFailedPayslips } from "@/services/payslip.service";
import { departments } from "@/data/mock/employees";
import { formatINR } from "@/utils/format";
import type { Payslip, PayslipStatus } from "@/types";
import { toast } from "sonner";

const statusColors: Record<PayslipStatus, string> = {
  Paid: "#22A06B",
  Published: "#1769E0",
  Pending: "#D99823",
  Failed: "#DC4C64",
  Generated: "#7C5CFC",
};

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("All");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    getPayslips().then((data) => {
      setPayslips(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return payslips.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.employeeName.toLowerCase().includes(q) && !p.employeeCode.toLowerCase().includes(q)) return false;
      }
      if (department !== "All" && p.department !== department) return false;
      if (status !== "All" && p.status !== status) return false;
      return true;
    });
  }, [payslips, search, department, status]);

  const totalNetPayable = payslips.reduce((sum, p) => sum + p.netPayable, 0);
  const publishedCount = payslips.filter((p) => p.status === "Published" || p.status === "Paid").length;
  const successRate = payslips.length ? ((payslips.filter((p) => p.status !== "Failed").length / payslips.length) * 100).toFixed(1) : "0";

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    payslips.forEach((p) => (counts[p.status] = (counts[p.status] ?? 0) + 1));
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: statusColors[name as PayslipStatus] ?? "#94A3B8" }));
  }, [payslips]);

  async function handlePublishAll() {
    setPublishing(true);
    const pendingIds = payslips.filter((p) => p.status === "Pending" || p.status === "Generated").map((p) => p.id);
    await publishPayslips(pendingIds);
    const refreshed = await getPayslips();
    setPayslips(refreshed);
    setPublishing(false);
    setPublishOpen(false);
    toast.success(`Payslips published to ${pendingIds.length} employees`);
  }

  async function handleReprocess() {
    const count = await reprocessFailedPayslips();
    const refreshed = await getPayslips();
    setPayslips(refreshed);
    toast.success(count > 0 ? `${count} failed payslips reprocessed` : "No failed payslips to reprocess");
  }

  const columns: Column<Payslip>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => row.employeeName,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={row.original.employeeName} size="sm" />
          <span className="font-medium text-foreground">{row.original.employeeName}</span>
        </div>
      ),
    },
    { accessorKey: "employeeCode", header: "Employee ID" },
    { accessorKey: "department", header: "Department" },
    { accessorKey: "netPayable", header: "Net Payable", cell: ({ getValue }) => formatINR(getValue<number>()) },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    {
      id: "pdf",
      header: "PDF",
      enableSorting: false,
      cell: () => (
        <Button variant="ghost" size="icon-sm" aria-label="Download payslip PDF" onClick={(e) => { e.stopPropagation(); toast.info("Downloading payslip PDF..."); }}>
          <FileText className="h-4 w-4 text-danger" />
        </Button>
      ),
    },
    {
      accessorKey: "publishedOn",
      header: "Published On",
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue<string>() ?? "—"}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Payslips" subtitle="Generate, publish and track employee payslips." breadcrumb="Payroll › Payslips" />

      {loading ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} tone="blue" label="Total Employees" value={String(payslips.length)} />
          <StatCard icon={Wallet} tone="green" label="Total Net Payable" value={formatINR(totalNetPayable)} />
          <StatCard icon={Send} tone="purple" label="Published to App" value={String(publishedCount)} helperText={`${((publishedCount / payslips.length) * 100 || 0).toFixed(0)}% of employees`} />
          <StatCard icon={TrendingUp} tone="cyan" label="Payment Success Rate" value={`${successRate}%`} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <SectionCard noPadding>
          <div className="border-b border-border p-4">
            <FilterBar>
              <SearchInput value={search} onChange={setSearch} placeholder="Search by employee name or ID..." className="w-full sm:w-64" />
              <FilterSelect value={department} onChange={setDepartment} options={["All", ...departments]} placeholder="Department" ariaLabel="Filter by department" />
              <FilterSelect value={status} onChange={setStatus} options={["All", "Paid", "Published", "Generated", "Pending", "Failed"]} placeholder="Status" ariaLabel="Filter by status" />
            </FilterBar>
          </div>
          <DataTable columns={columns} data={filtered} loading={loading} pageSize={10} emptyTitle="No payslips found" />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Payslip Status">
            {loading ? (
              <div className="h-48 animate-pulse rounded-lg bg-muted" />
            ) : (
              <div className="h-48">
                <DonutChart
                  data={statusBreakdown}
                  centerLabel="Total"
                  centerValue={String(payslips.length)}
                  formatTooltip={(v) => String(v)}
                />
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {statusBreakdown.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="ml-auto font-medium text-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <QuickActionsCard
            actions={[
              { icon: FileDown, label: "Bulk Download Payslips", description: "Download payslips as PDF (ZIP)", onClick: () => toast.info("Preparing ZIP download...") },
              { icon: Send, label: "Publish Payslips", description: "Publish payslips to employee app", onClick: () => setPublishOpen(true) },
              { icon: Mail, label: "Send Payslips by Email", description: "Email payslips to employees", onClick: () => toast.info("Queued payslip emails") },
              { icon: BellRing, label: "Notify Employees", description: "Send in-app notification", onClick: () => toast.success("Employees notified") },
              { icon: RotateCcw, label: "Reprocess Failed", description: "Retry failed payslip generation", onClick: handleReprocess },
            ]}
          />

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-2.5">
              <HelpCircle className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Need help?</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Learn how payslip generation works.</p>
                <button className="mt-1.5 text-xs font-medium text-primary hover:underline">View Help Article →</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={`Publish payslips to ${payslips.filter((p) => p.status === "Pending" || p.status === "Generated").length} employees?`}
        description="Published payslips become visible to employees in the mobile app immediately."
        confirmLabel="Publish Payslips"
        loading={publishing}
        onConfirm={handlePublishAll}
      />
    </div>
  );
}
