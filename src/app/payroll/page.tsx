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
  Lock,
  LockOpen,
  CheckCircle2,
  AlertTriangle,
  OctagonAlert,
  ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { PayrollStepper } from "@/components/shared/payroll-stepper";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { SalaryCalculationDrawer } from "@/components/shared/salary-calculation-drawer";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/shared/filter-select";
import {
  getPayrollExceptionCounts,
  getPayrollEligibilityCounts,
  getPayrollPeriod,
  getPayrollReview,
  validatePayrollMonth,
  approvePayrollPeriod,
  lockPayrollPeriod,
  unlockPayrollPeriod,
  type PayrollValidationSummary,
} from "@/services/payroll.service";
import { finalizeAttendance, isAttendanceFinalized } from "@/services/attendance.service";
import { getEmployees } from "@/services/employee.service";
import { monthKeyFromLabel } from "@/store/operations-store";
import { payrollMonths } from "@/store/app-store";
import { CURRENT_PAYROLL_MONTH } from "@/data/mock/attendance";
import { formatINR } from "@/utils/format";
import type { Employee, PayrollCalculation, PayrollExceptionType, PayrollPeriod, PayrollStep, PayrollValidationIssue } from "@/types";
import { toast } from "sonner";

const STEP_LABELS = [
  "Employee Data",
  "Attendance Upload",
  "Attendance Validation",
  "Attendance Finalization",
  "Salary Calculation",
  "Statutory Deductions",
  "Payroll Review",
  "Approval",
  "Payslips",
  "Disbursement",
  "Accounting Entries",
] as const;

function buildSteps(period: PayrollPeriod | null, hasAttendance: boolean): PayrollStep[] {
  const finalized = !!period?.attendanceFinalized;
  const approved = !!period?.approved;
  const locked = period?.status === "Locked";

  const statusFor = (index: number): PayrollStep["status"] => {
    if (index === 0) return "completed";
    if (index === 1) return hasAttendance ? "completed" : "in-progress";
    if (index === 2) return hasAttendance ? (finalized ? "completed" : "in-progress") : "pending";
    if (index === 3) return finalized ? "completed" : hasAttendance ? "in-progress" : "pending";
    if (index === 4 || index === 5) return finalized ? "completed" : "pending";
    if (index === 6) return finalized ? (approved ? "completed" : "in-progress") : "pending";
    if (index === 7) return approved ? "completed" : "pending";
    if (index >= 8) return locked ? "completed" : "pending";
    return "pending";
  };

  return STEP_LABELS.map((label, i) => ({ id: i + 1, label, status: statusFor(i) }));
}

const SEVERITY_ICON = { Passed: CheckCircle2, Warning: AlertTriangle, "Blocking Error": OctagonAlert } as const;

export default function PayrollRunPage() {
  const [month, setMonth] = useState(CURRENT_PAYROLL_MONTH);
  const monthKey = monthKeyFromLabel(month);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<PayrollCalculation[]>([]);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [eligibility, setEligibility] = useState<Record<string, number>>({});
  const [exceptions, setExceptions] = useState<Record<PayrollExceptionType, number>>({} as Record<PayrollExceptionType, number>);
  const [validation, setValidation] = useState<PayrollValidationSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [finalizeConfirm, setFinalizeConfirm] = useState(false);
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [lockConfirm, setLockConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [issuesExpanded, setIssuesExpanded] = useState(false);
  const [drawerEmployee, setDrawerEmployee] = useState<Employee | null>(null);

  function refresh() {
    setLoading(true);
    Promise.all([
      getEmployees(),
      getPayrollReview(monthKey),
      getPayrollPeriod(monthKey),
      isAttendanceFinalized(monthKey),
      getPayrollEligibilityCounts(monthKey),
      getPayrollExceptionCounts(monthKey),
    ]).then(([emp, review, per, fin, elig, exc]) => {
      setEmployees(emp);
      setRows(review);
      setPeriod(per);
      setFinalized(fin);
      setEligibility(elig);
      setExceptions(exc);
      setLoading(false);
    });
  }

  useEffect(() => {
    // Re-fetches everything whenever the selected payroll month changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const totals = useMemo(
    () => ({
      grossPay: rows.reduce((s, r) => s + r.grossEarnings, 0),
      deductions: rows.reduce((s, r) => s + r.totalDeductions, 0),
      netPayable: rows.filter((r) => r.status !== "Salary Hold").reduce((s, r) => s + r.netPayable, 0),
      employerCost: rows.reduce((s, r) => s + r.employerPF + r.employerESI, 0),
    }),
    [rows]
  );

  async function handleFinalizeAttendance() {
    setBusy("finalize");
    try {
      await finalizeAttendance(monthKey);
      toast.success(`Attendance finalized for ${month}`);
      refresh();
    } finally {
      setBusy(null);
      setFinalizeConfirm(false);
    }
  }

  async function handleValidate() {
    setValidating(true);
    try {
      const summary = await validatePayrollMonth(monthKey);
      setValidation(summary);
      if (summary.blockingErrors > 0) {
        toast.error(`Validation found ${summary.blockingErrors} blocking error(s)`);
      } else {
        toast.success("Validation passed", { description: `${summary.passed} checks passed, ${summary.warnings} warning(s).` });
      }
      refresh();
    } finally {
      setValidating(false);
    }
  }

  async function handleApprove() {
    setBusy("approve");
    try {
      await approvePayrollPeriod(monthKey);
      toast.success(`Payroll approved for ${month}`);
      refresh();
    } finally {
      setBusy(null);
      setApproveConfirm(false);
    }
  }

  async function handleLock() {
    setBusy("lock");
    try {
      await lockPayrollPeriod(monthKey);
      toast.success(`Payroll locked for ${month}`, { description: "Payslips and disbursement can now proceed." });
      refresh();
    } finally {
      setBusy(null);
      setLockConfirm(false);
    }
  }

  async function handleUnlock() {
    await unlockPayrollPeriod(monthKey);
    toast.info("Payroll unlocked for editing");
    refresh();
  }

  const isLocked = period?.status === "Locked";
  const nonPassedIssues = (validation?.issues ?? []).filter((i) => i.severity !== "Passed");

  const columns: Column<PayrollCalculation>[] = [
    {
      id: "employeeName",
      header: "Employee",
      accessorFn: (row) => employeeMap.get(row.employeeId)?.fullName ?? "",
      cell: ({ row }) => {
        const emp = employeeMap.get(row.original.employeeId);
        return (
          <div className="flex items-center gap-2.5">
            <EmployeeAvatar name={emp?.fullName ?? "?"} size="sm" />
            <div>
              <p className="font-medium text-foreground">{emp?.fullName}</p>
              <p className="text-xs text-muted-foreground">{emp?.employeeCode}</p>
            </div>
          </div>
        );
      },
    },
    { id: "gross", header: "Monthly Gross", accessorFn: (row) => row.grossEarnings, cell: ({ row }) => formatINR(row.original.grossEarnings) },
    { id: "payrollDays", header: "Payroll Days", accessorFn: (row) => row.attendance.payrollDays },
    { id: "present", header: "Present", accessorFn: (row) => row.attendance.present },
    { id: "paidLeave", header: "Paid Leave", accessorFn: (row) => row.attendance.paidLeave },
    { id: "unpaidLeave", header: "Unpaid Leave", accessorFn: (row) => row.attendance.unpaidLeave },
    { id: "absent", header: "Absent", accessorFn: (row) => row.attendance.absent },
    { id: "lopDays", header: "LOP Days", accessorFn: (row) => row.attendance.lopDays, cell: ({ row }) => (row.original.attendance.lopDays > 0 ? <span className="text-danger">{row.original.attendance.lopDays}</span> : "0") },
    { id: "payableDays", header: "Payable Days", accessorFn: (row) => row.attendance.payableDays },
    { id: "attendanceDeduction", header: "Attendance Deduction", accessorFn: (row) => row.lopDeduction, cell: ({ row }) => (row.original.lopDeduction > 0 ? `- ${formatINR(row.original.lopDeduction)}` : "—") },
    { id: "adjustedGross", header: "Adjusted Gross", accessorFn: (row) => row.adjustedGross, cell: ({ row }) => formatINR(row.original.adjustedGross) },
    { id: "pf", header: "PF", accessorFn: (row) => row.pf, cell: ({ row }) => formatINR(row.original.pf) },
    { id: "esi", header: "ESI", accessorFn: (row) => row.esi, cell: ({ row }) => formatINR(row.original.esi) },
    { id: "tds", header: "TDS", accessorFn: (row) => row.tds, cell: ({ row }) => formatINR(row.original.tds) },
    { id: "other", header: "Other Deductions", accessorFn: (row) => row.otherDeductions, cell: ({ row }) => formatINR(row.original.otherDeductions) },
    { id: "net", header: "Net Pay", accessorFn: (row) => row.netPayable, cell: ({ row }) => <span className="font-semibold text-foreground">{formatINR(row.original.netPayable)}</span> },
    { id: "status", header: "Payroll Status", accessorFn: (row) => row.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Payroll Run"
        subtitle="Review attendance-adjusted payroll for the selected month and process employee salaries."
        actions={
          <>
            <FilterSelect value={month} onChange={setMonth} options={payrollMonths} className="w-40 bg-white" />
            <Button variant="outline" className="gap-1.5" disabled={rows.length === 0}>
              <Download className="h-4 w-4" /> Download Preview
            </Button>
            <Button variant="outline" className="gap-1.5" disabled={rows.length === 0}>
              <Send className="h-4 w-4" /> Send Preview
            </Button>
          </>
        }
      />

      {isLocked && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4.5 w-4.5 text-danger" />
            <div>
              <p className="text-sm font-semibold text-danger">This payroll period is locked.</p>
              <p className="text-xs text-foreground/70">
                Locked by {period?.lockedBy} on {period?.lockedOn}. Unlocking requires Payroll Admin permission.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleUnlock}>
            <LockOpen className="h-3.5 w-3.5" /> Unlock
          </Button>
        </div>
      )}

      <SectionCard className="mb-5">
        {loading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : <PayrollStepper steps={buildSteps(period, rows.some((r) => r.attendance.present > 0 || r.attendance.absent > 0))} />}
      </SectionCard>

      <SectionCard
        className="mb-5"
        title="Attendance Finalization"
        subtitle={finalized ? `Attendance for ${month} is finalized and locked for payroll.` : `Finalize attendance for ${month} before running payroll validation.`}
        actions={
          finalized ? (
            <StatusBadge status="Attendance Locked for Payroll" tone="success" />
          ) : (
            <Button size="sm" className="gap-1.5" onClick={() => setFinalizeConfirm(true)} disabled={busy === "finalize"}>
              <Lock className="h-3.5 w-3.5" /> Finalize Attendance
            </Button>
          )
        }
      />

      <SectionCard className="mb-5" title="Payroll Validation" subtitle="Run the validation engine before processing payroll." actions={
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleValidate} disabled={validating}>
          {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {validating ? "Validating..." : "Run Validation"}
        </Button>
      }>
        {!validation ? (
          <p className="text-sm text-muted-foreground">Run validation to check employee status, attendance, KYC, bank details and UAN uniqueness before processing payroll.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{validation.totalChecked}</span> Employees Checked ·{" "}
              <span className="font-semibold text-success">{validation.passed}</span> Passed ·{" "}
              <span className="font-semibold text-warning">{validation.warnings}</span> Warnings ·{" "}
              <span className="font-semibold text-danger">{validation.blockingErrors}</span> Blocking Errors
            </p>
            {nonPassedIssues.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  onClick={() => setIssuesExpanded((v) => !v)}
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${issuesExpanded ? "rotate-180" : ""}`} />
                  {issuesExpanded ? "Hide" : "View"} {nonPassedIssues.length} issue(s)
                </button>
                {issuesExpanded && (
                  <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/50 text-left text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Employee</th>
                          <th className="px-3 py-2">Check</th>
                          <th className="px-3 py-2">Severity</th>
                          <th className="px-3 py-2">Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {nonPassedIssues.map((issue: PayrollValidationIssue, i) => {
                          const Icon = SEVERITY_ICON[issue.severity];
                          return (
                            <tr key={i}>
                              <td className="px-3 py-2">{employeeMap.get(issue.employeeId)?.fullName ?? issue.employeeId}</td>
                              <td className="px-3 py-2">{issue.check}</td>
                              <td className="px-3 py-2">
                                <span className={`flex items-center gap-1 ${issue.severity === "Blocking Error" ? "text-danger" : "text-warning"}`}>
                                  <Icon className="h-3 w-3" /> {issue.severity}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{issue.message}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {loading ? (
        <div className="mb-5">
          <CardGridSkeleton count={5} />
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={Users} tone="blue" label="Total Employees" value={String(employees.length)} />
          <StatCard icon={Wallet} tone="green" label="Gross Pay" value={formatINR(totals.grossPay)} />
          <StatCard icon={MinusCircle} tone="red" label="Total Deductions" value={formatINR(totals.deductions)} />
          <StatCard icon={HandCoins} tone="purple" label="Net Payable" value={formatINR(totals.netPayable)} />
          <StatCard icon={Landmark} tone="cyan" label="Employer Contribution" value={formatINR(totals.employerCost)} />
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Payroll Eligibility">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(eligibility).map(([key, count]) => (
              <div key={key} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">{key}</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">{count}</p>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Payroll Exception Center" subtitle="Issues that may block or affect this payroll run">
          {Object.keys(exceptions).length === 0 ? (
            <p className="text-sm text-muted-foreground">No exceptions detected for {month}.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(exceptions).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <span className="text-xs text-foreground">{type}</span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-white">{count}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Payroll Review"
        subtitle={`${employees.length} employees · ${month} · Click a row for the full calculation breakdown`}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh} disabled={loading}>
            <RefreshCcw className="h-3.5 w-3.5" /> Recalculate Data
          </Button>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} loading={loading} pageSize={10} onRowClick={(row) => setDrawerEmployee(employeeMap.get(row.employeeId) ?? null)} />
      </SectionCard>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" className="gap-1.5" disabled={isLocked || !!period?.approved} onClick={() => setApproveConfirm(true)}>
          <PlayCircle className="h-4 w-4" /> Approve Payroll
        </Button>
        <Button size="lg" className="gap-1.5" disabled={isLocked || !period?.approved} onClick={() => setLockConfirm(true)}>
          <ShieldCheck className="h-4 w-4" /> {isLocked ? "Payroll Locked" : "Approve & Lock"}
        </Button>
      </div>

      <ConfirmDialog
        open={finalizeConfirm}
        onOpenChange={setFinalizeConfirm}
        title={`Finalize attendance for ${month}?`}
        description="This locks attendance records for the month and makes them the basis for payroll calculation. Further edits will require an admin override."
        confirmLabel="Finalize Attendance"
        loading={busy === "finalize"}
        onConfirm={handleFinalizeAttendance}
      />
      <ConfirmDialog
        open={approveConfirm}
        onOpenChange={setApproveConfirm}
        title={`Approve payroll for ${month}?`}
        description={`This confirms payroll figures for ${employees.length} employees are ready for final lock and disbursement.`}
        confirmLabel="Approve Payroll"
        loading={busy === "approve"}
        onConfirm={handleApprove}
      />
      <ConfirmDialog
        open={lockConfirm}
        onOpenChange={setLockConfirm}
        title="Approve and lock payroll?"
        description={`Once locked, payroll for ${month} cannot be edited without an explicit unlock. Payslips and disbursement can proceed after this.`}
        confirmLabel="Approve & Lock"
        destructive
        loading={busy === "lock"}
        onConfirm={handleLock}
      />

      <SalaryCalculationDrawer employee={drawerEmployee} month={monthKey} open={!!drawerEmployee} onOpenChange={(o) => !o && setDrawerEmployee(null)} />
    </div>
  );
}
