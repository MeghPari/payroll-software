"use client";

import { useEffect, useMemo, useState } from "react";
import type { Column } from "@/components/shared/data-table";
import { Send, CheckCircle2, Clock, XCircle, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { getPayslips } from "@/services/payslip.service";
import { formatINR } from "@/utils/format";
import type { Payslip } from "@/types";
import { toast } from "sonner";

export default function DisbursementPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [disbursing, setDisbursing] = useState(false);

  useEffect(() => {
    getPayslips().then((data) => {
      setPayslips(data);
      setLoading(false);
    });
  }, []);

  const disbursementStatus = useMemo(
    () =>
      payslips.map((p) => ({
        ...p,
        disbursementStatus: p.status === "Failed" ? "Failed" : p.status === "Pending" || p.status === "Generated" ? "Pending" : "Completed",
      })),
    [payslips]
  );

  const completed = disbursementStatus.filter((p) => p.disbursementStatus === "Completed").length;
  const pending = disbursementStatus.filter((p) => p.disbursementStatus === "Pending").length;
  const failed = disbursementStatus.filter((p) => p.disbursementStatus === "Failed").length;
  const totalAmount = payslips.reduce((sum, p) => sum + p.netPayable, 0);

  async function handleDisburse() {
    setDisbursing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setDisbursing(false);
    setDisburseOpen(false);
    toast.success(`Disbursement initiated for ${pending} employees`);
  }

  const columns: Column<(typeof disbursementStatus)[number]>[] = [
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
    { accessorKey: "netPayable", header: "Amount", cell: ({ getValue }) => formatINR(getValue<number>()) },
    { accessorKey: "disbursementStatus", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Disbursement"
        subtitle="Track salary disbursement status across employee bank accounts."
        actions={
          <>
            <Button variant="outline" className="gap-1.5">
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button className="gap-1.5" onClick={() => setDisburseOpen(true)} disabled={pending === 0}>
              <Send className="h-4 w-4" /> Disburse Pending
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Send} tone="blue" label="Total Disbursement" value={formatINR(totalAmount)} />
        <StatCard icon={CheckCircle2} tone="green" label="Completed" value={String(completed)} />
        <StatCard icon={Clock} tone="amber" label="Pending" value={String(pending)} />
        <StatCard icon={XCircle} tone="red" label="Failed" value={String(failed)} />
      </div>

      <SectionCard title="Disbursement Status" className="mt-5" noPadding>
        <DataTable columns={columns} data={disbursementStatus} loading={loading} pageSize={10} />
      </SectionCard>

      <ConfirmDialog
        open={disburseOpen}
        onOpenChange={setDisburseOpen}
        title={`Disburse salary to ${pending} employees?`}
        description="This will initiate bank transfers for all pending employees. This action cannot be undone."
        confirmLabel="Disburse Now"
        destructive
        loading={disbursing}
        onConfirm={handleDisburse}
      />
    </div>
  );
}
