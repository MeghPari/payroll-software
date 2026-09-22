"use client";

import { useEffect, useMemo, useState } from "react";
import type { Column } from "@/components/shared/data-table";
import {
  Users,
  Wallet,
  MinusCircle,
  HandCoins,
  Landmark,
  Download,
  Send,
  RefreshCcw,
  PlayCircle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { AlertCard } from "@/components/shared/alert-card";
import { PayrollStepper } from "@/components/shared/payroll-stepper";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { getPayroll, approvePayroll } from "@/services/payroll.service";
import { formatINR } from "@/utils/format";
import type { PayrollEmployeeRow, PayrollRun } from "@/types";
import { toast } from "sonner";

export default function PayrollRunPage() {
  const [payroll, setPayroll] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [processConfirmOpen, setProcessConfirmOpen] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    getPayroll().then((data) => {
      setPayroll(data);
      setLoading(false);
    });
  }, []);

  const critical = payroll?.alerts.filter((a) => a.severity === "critical") ?? [];
  const warnings = payroll?.alerts.filter((a) => a.severity === "warning") ?? [];

  const columns: Column<PayrollEmployeeRow>[] = useMemo(
    () => [
      { accessorKey: "employeeCode", header: "Employee ID" },
      {
        id: "employeeName",
        header: "Employee Name",
        accessorFn: (row) => row.employeeName,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <EmployeeAvatar name={row.original.employeeName} size="sm" />
            <span className="font-medium text-foreground">{row.original.employeeName}</span>
          </div>
        ),
      },
      { accessorKey: "department", header: "Department" },
      { accessorKey: "grossSalary", header: "Gross Salary", cell: ({ getValue }) => formatINR(getValue<number>()) },
      { accessorKey: "pf", header: "PF", cell: ({ getValue }) => formatINR(getValue<number>()) },
      { accessorKey: "esi", header: "ESI", cell: ({ getValue }) => formatINR(getValue<number>()) },
      { accessorKey: "pt", header: "PT", cell: ({ getValue }) => formatINR(getValue<number>()) },
      { accessorKey: "tds", header: "TDS", cell: ({ getValue }) => formatINR(getValue<number>()) },
      { accessorKey: "otherDeductions", header: "Other Deductions", cell: ({ getValue }) => formatINR(getValue<number>()) },
      { accessorKey: "netPay", header: "Net Pay", cell: ({ getValue }) => <span className="font-semibold text-foreground">{formatINR(getValue<number>())}</span> },
      { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    ],
    []
  );

  async function handleRecalculate() {
    setRecalculating(true);
    await new Promise((r) => setTimeout(r, 1200));
    setRecalculating(false);
    toast.success("Payroll data recalculated", { description: "All figures are up to date." });
  }

  async function handleProcess() {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1600));
    setProcessing(false);
    setProcessConfirmOpen(false);
    toast.success("Payroll processed successfully", { description: `${payroll?.totalEmployees} employees processed for ${payroll?.month}.` });
  }

  async function handleApprove() {
    setApproving(true);
    const updated = await approvePayroll();
    setPayroll(updated);
    setApproving(false);
    setApproveConfirmOpen(false);
    toast.success("Payroll approved and locked", { description: "Payslips can now be generated." });
  }

  return (
    <div>
      <PageHeader
        title="Payroll Run"
        subtitle="Review payroll for the selected month and process employee salaries."
        actions={
          <>
            <Button variant="outline" className="gap-1.5" disabled={!payroll}>
              <Download className="h-4 w-4" /> Download Preview
            </Button>
            <Button variant="outline" className="gap-1.5" disabled={!payroll}>
              <Send className="h-4 w-4" /> Send Preview
            </Button>
          </>
        }
      />

      <SectionCard className="mb-5">
        {loading || !payroll ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        ) : (
          <PayrollStepper steps={payroll.steps} />
        )}
      </SectionCard>

      {loading || !payroll ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CardGridSkeleton count={2} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <AlertCard
            tone="critical"
            title="Critical Alerts"
            count={critical.length}
            items={critical.map((a) => a.message)}
            viewHref="/compliance"
          />
          <AlertCard
            tone="warning"
            title="Warnings"
            count={warnings.length}
            items={warnings.map((a) => a.message)}
            viewHref="/compliance"
          />
          <AlertCard
            tone="success"
            title="Validation Status"
            description={payroll.validationPassed ? "All critical validations passed. You can preview payroll." : "Validation issues need attention."}
            viewHref="/compliance"
          />
        </div>
      )}

      {loading || !payroll ? (
        <div className="mt-5">
          <CardGridSkeleton count={5} />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={Users} tone="blue" label="Total Employees" value={String(payroll.totalEmployees)} />
          <StatCard icon={Wallet} tone="green" label="Gross Pay" value={formatINR(payroll.grossPay)} />
          <StatCard icon={MinusCircle} tone="red" label="Total Deductions" value={formatINR(payroll.totalDeductions)} />
          <StatCard icon={HandCoins} tone="purple" label="Net Payable" value={formatINR(payroll.netPayable)} />
          <StatCard icon={Landmark} tone="cyan" label="Employer Contribution" value={formatINR(payroll.employerContribution)} />
        </div>
      )}

      <SectionCard
        className="mt-5"
        title="Payroll Review"
        subtitle={payroll ? `${payroll.totalEmployees} employees · ${payroll.month}` : undefined}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRecalculate} disabled={recalculating || !payroll}>
            {recalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            {recalculating ? "Recalculating..." : "Recalculate Data"}
          </Button>
        }
        noPadding
      >
        <DataTable columns={columns} data={payroll?.rows ?? []} loading={loading} pageSize={10} />
      </SectionCard>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          size="lg"
          className="gap-1.5"
          onClick={() => setProcessConfirmOpen(true)}
          disabled={!payroll || payroll.status === "approved"}
        >
          <PlayCircle className="h-4 w-4" /> Process Payroll
        </Button>
        <Button
          size="lg"
          className="gap-1.5"
          onClick={() => setApproveConfirmOpen(true)}
          disabled={!payroll || payroll.status === "approved"}
        >
          <ShieldCheck className="h-4 w-4" /> {payroll?.status === "approved" ? "Payroll Approved" : "Approve Payroll"}
        </Button>
      </div>

      <ConfirmDialog
        open={processConfirmOpen}
        onOpenChange={setProcessConfirmOpen}
        title={`Process payroll for ${payroll?.month}?`}
        description={`This will calculate final salaries for ${payroll?.totalEmployees} employees based on current attendance and deductions. This action can be re-run before approval.`}
        confirmLabel="Process Payroll"
        loading={processing}
        onConfirm={handleProcess}
      />
      <ConfirmDialog
        open={approveConfirmOpen}
        onOpenChange={setApproveConfirmOpen}
        title="Approve and lock payroll?"
        description={`Once approved, payroll for ${payroll?.month} will be locked for editing and payslips can be generated. This action cannot be undone.`}
        confirmLabel="Approve & Lock"
        destructive
        loading={approving}
        onConfirm={handleApprove}
      />
    </div>
  );
}
