"use client";
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { PayrollBlockers } from '@/components/payroll/payroll-blockers';
import { PayrollSetupNotice } from '@/components/payroll/payroll-setup-notice';
import { PayrollComparison } from '@/components/payroll/payroll-comparison';
import { PayrollNavigation } from '@/components/payroll/payroll-navigation';
import { useAppStore } from '@/store/app-store';
import { getPayrollRun,payrollAction } from '@/services/payroll-run.service';
import { payrollReviewFromData,payrollPeriodFromData } from '@/services/payroll.service';

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
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/shared/filter-select";
import {
  validatePayrollMonth,
  type PayrollValidationSummary,
} from "@/services/payroll.service";

import { getEmployees } from "@/services/employee.service";
import { monthKey as monthKeyFromLabel } from '@/domain/dates';
import { useSessionStore } from '@/store/session-store';
import { permitted } from '@/lib/tenant-api';
import { downloadCSV } from '@/lib/csv';
import { payrollMonths } from "@/store/app-store";

import { formatINR } from "@/utils/format";
import type { Employee, PayrollCalculation, PayrollExceptionType, PayrollPeriod, PayrollStep, PayrollValidationIssue } from "@/types";
import { toast } from "sonner";

const ClientSalarySheet=dynamic(()=>import('@/components/payroll/client-salary-sheet').then(module=>module.ClientSalarySheet),{loading:()=> <p role="status">Loading client salary sheet...</p>});
const PayrollIllustration=dynamic(()=>import('@/components/payroll/payroll-illustration').then(module=>module.PayrollIllustration),{loading:()=> <p role="status" className="p-4 text-sm text-muted-foreground">Loading...</p>});
const PriorPayrollCorrections=dynamic(()=>import('@/components/payroll/prior-payroll-corrections').then(module=>module.PriorPayrollCorrections),{loading:()=> <p role="status" className="p-4 text-sm text-muted-foreground">Loading...</p>});
const AdjustmentsPanel=dynamic(()=>import('@/components/payroll/adjustments-panel').then(module=>module.AdjustmentsPanel),{loading:()=> <p role="status" className="p-4 text-sm text-muted-foreground">Loading...</p>});
const SalaryCalculationDrawer=dynamic(()=>import('@/components/shared/salary-calculation-drawer').then(module=>module.SalaryCalculationDrawer),{loading:()=> <p role="status" className="p-4 text-sm text-muted-foreground">Loading...</p>});

function buildSteps(period: PayrollPeriod | null): PayrollStep[] {
 const flags=[!!period?.attendanceFinalized||!!period?.validated,!!period?.validated,period?.status==='Locked',!!period?.disbursed];
 const active=flags.findIndex(value=>!value);
 return ['Attendance','Calculate salaries','Review & lock','Salary payments'].map((label,index)=>({id:index+1,label,status:flags[index]?'completed':index===active?'in-progress':'pending'}));
}

const SEVERITY_ICON = { Passed: CheckCircle2, Warning: AlertTriangle, "Blocking Error": OctagonAlert } as const;

export default function PayrollRunPage(){const id=useSessionStore(state=>state.companyId);return <PayrollRunPageTenantContent key={id}/>;}
function PayrollRunPageTenantContent(){const month=useAppStore(s=>s.month),setMonth=useAppStore(s=>s.setMonth);return <PayrollRunPagePeriodContent key={month} month={month} onMonthChange={setMonth}/>;}
function PayrollRunPagePeriodContent({month,onMonthChange}:{month:string;onMonthChange:(month:string)=>void}){
 const setMonth=onMonthChange;
  const companyId=useSessionStore(s=>s.companyId);

  const monthKey = monthKeyFromLabel(month);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<PayrollCalculation[]>([]);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [eligibility, setEligibility] = useState<Record<string, number>>({});
  const [exceptions, setExceptions] = useState<Record<PayrollExceptionType, number>>({} as Record<PayrollExceptionType, number>);
  const [illustration,setIllustration]=useState(false),[clientSheet,setClientSheet]=useState(false);
  const [validation, setValidation] = useState<PayrollValidationSummary | null>(null);
  const [loading, setLoading] = useState(true);


  const [approveTarget,setApproveTarget]=useState<{runId:string;version:number;count:number;batchNumber:number}|null>(null),[lockTarget,setLockTarget]=useState<typeof approveTarget>(null),[editTarget,setEditTarget]=useState<typeof approveTarget>(null);
  const [editConfirm,setEditConfirm]=useState(false),[editReason,setEditReason]=useState('');
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [lockConfirm, setLockConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [issuesExpanded, setIssuesExpanded] = useState(true);
  const [showDetails,setShowDetails]=useState(false),[showAdjustments,setShowAdjustments]=useState(false);
  const [drawerEmployee, setDrawerEmployee] = useState<Employee | null>(null);

  function refresh(reloadEmployees=true) {
    setLoading(true);
    return Promise.all([reloadEmployees?getEmployees():Promise.resolve(employees),getPayrollRun(monthKey)]).then(([emp,run]) => {
      const review=payrollReviewFromData({...run,snapshots:run.snapshots.filter(row=>row.run_id===run.run?.id)},monthKey),per=payrollPeriodFromData(run,monthKey);
      setEmployees(emp);setRows(review);setPeriod(per);setFinalized(run.attendanceFinalized);
      setEligibility({Calculated:review.length});
      setLoading(false);
    }).catch(error=>{setRows([]);setPeriod(null);setLoading(false);toast.error(error.message);});
  }

  useEffect(() => {
    // Re-fetches everything whenever the selected payroll month changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey,companyId]);

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const totals = useMemo(
    () => ({
      grossPay: rows.reduce((s, r) => s + r.adjustedGross, 0),
      deductions: rows.reduce((s, r) => s + r.totalDeductions, 0),
      netPayable: rows.filter((r) => r.status !== "Salary Hold").reduce((s, r) => s + r.netPayable, 0),
      employerCost: rows.reduce((s, r) => s + r.employerPF + r.employerESI + r.employerOther, 0),
    }),
    [rows]
  );

  async function handleCalculate() {
    setBusy('calculate');
    try{
      const checks=await validatePayrollMonth(monthKey);setValidation(checks);setIssuesExpanded(true);
      const counts={}as Record<PayrollExceptionType,number>;
      for(const issue of checks.issues.filter(issue=>issue.severity!=='Passed'))counts[issue.check as PayrollExceptionType]=(counts[issue.check as PayrollExceptionType]??0)+1;
      setExceptions(counts);
      if(checks.readyCount===0){const issue=checks.pendingReasons?.[0];const employee=employees.find(row=>row.id===issue?.employeeId);toast.info(issue?`${employee?.fullName??'Pending employee'}: ${issue.message}`:'No new employees are ready. Run Validation to review pending attendance and salary setup.');return;}
      if(checks.blockingErrors){const first=checks.issues.find(issue=>issue.severity==='Blocking Error');toast.error(first?.message??'Review the payroll issues shown below.');return;}
      await payrollAction(monthKey,'calculate');await refresh(false);toast.success('Ready employees calculated. Previously calculated salaries and payments are retained.');
    }
    catch(error){toast.error(error instanceof Error?error.message:'Calculation failed.');}
    finally{setBusy(null);}
  }
  async function handleValidate() {
    setValidating(true);
    try {
      const summary = await validatePayrollMonth(monthKey);
      setValidation(summary);
      const counts={}as Record<PayrollExceptionType,number>;
      for(const issue of summary.issues.filter(issue=>issue.severity!=='Passed'))counts[issue.check as PayrollExceptionType]=(counts[issue.check as PayrollExceptionType]??0)+1;
      setExceptions(counts);
      if (summary.blockingErrors > 0) {
        toast.error(`Validation found ${summary.blockingErrors} blocking error(s)`);
      } else {
        toast.success("Validation passed", { description: `${summary.passed} checks passed, ${summary.warnings} warning(s).` });
      }
      await refresh(false);
    } catch(error) {toast.error(error instanceof Error?error.message:"Payroll action failed.");} finally {
      setValidating(false);
    }
  }

  async function handleApprove() {
    if(!approveTarget)return;
    setBusy("approve");
    try {
      await payrollAction(monthKey,'approve',approveTarget.version,'',approveTarget.runId);
      toast.success(`Payroll approved for ${month}`);
      await refresh(false);
    } catch(error) {toast.error(error instanceof Error?error.message:"Payroll action failed.");} finally {
      setBusy(null);
      setApproveConfirm(false);
    }
  }

  async function handleLock() {
    if(!lockTarget)return;
    setBusy("lock");
    try {
      await payrollAction(monthKey,'lock',lockTarget.version,'',lockTarget.runId);
      toast.success(`Payroll locked for ${month}`, { description: "Payslips and disbursement can now proceed." });
      await refresh(false);
    } catch(error) {toast.error(error instanceof Error?error.message:"Payroll action failed.");} finally {
      setBusy(null);
      setLockConfirm(false);
    }
  }

  function requestEdit(){if(!period?.runId||!period.version||!rows.length)return;const target={runId:period.runId,version:period.version,count:rows.length,batchNumber:period.batchNumber??1};const reason=window.prompt('Reason for editing this payroll batch (at least 3 characters)');if(!reason?.trim())return;if(reason.trim().length<3){toast.error('Enter an edit reason of at least 3 characters.');return;}setEditTarget(target);setEditReason(reason.trim());setEditConfirm(true);}
  async function handleReopen(){if(!editTarget)return;setBusy('reopen');try{await payrollAction(monthKey,'reopen',editTarget.version,editReason,editTarget.runId);setEditConfirm(false);toast.success('Batch reopened. Update the employee salary or attendance, then calculate again.');await refresh(false);}catch(error){toast.error(error instanceof Error?error.message:'Unable to reopen payroll.');}finally{setBusy(null);}}

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
    { id: "adjustedGross", header: "Payable Earnings", accessorFn: (row) => row.adjustedGross, cell: ({ row }) => formatINR(row.original.adjustedGross) },
    { id: "pf", header: "PF", accessorFn: (row) => row.pf, cell: ({ row }) => formatINR(row.original.pf) },
    { id: "esi", header: "ESI", accessorFn: (row) => row.esi, cell: ({ row }) => formatINR(row.original.esi) },
    { id: "tds", header: "TDS", accessorFn: (row) => row.tds, cell: ({ row }) => formatINR(row.original.tds) },
    { id: "other", header: "Other Deductions", accessorFn: (row) => row.otherDeductions, cell: ({ row }) => formatINR(row.original.otherDeductions) },
    { id: "deductions", header: "Deductions", accessorFn: (row) => row.totalDeductions, cell: ({row})=>formatINR(row.original.totalDeductions) },
    { id: "net", header: "Net Pay", accessorFn: (row) => row.netPayable, cell: ({ row }) => <span className="font-semibold text-foreground">{formatINR(row.original.netPayable)}</span> },
    { id: "status", header: "Payroll Status", accessorFn: (row) => row.payrollStatus??row.status, cell: ({ row }) => <StatusBadge status={row.original.payrollStatus?`Batch ${row.original.payrollBatch}: ${row.original.payrollStatus}`:row.original.status} /> },
  ];

  return (
    <div>
      <PayrollNavigation/>
      <PageHeader
        title="Calculate Salaries"
        subtitle="Review attendance-adjusted payroll for the selected month and process employee salaries."
        actions={
          <>
            <FilterSelect value={month} onChange={setMonth} options={payrollMonths} className="w-40 bg-white" />
            <Button variant="outline" className="gap-1.5" disabled={illustration||rows.length === 0} onClick={()=>downloadCSV(`payroll-${monthKey}.csv`,["Employee ID","Gross earnings","Deductions","Net payable"],rows.map(row=>[row.employeeId,row.adjustedGross,row.totalDeductions,row.netPayable]))}>
              <Download className="h-4 w-4" /> Download Preview
            </Button>
            <Button variant="outline" className="gap-1.5" disabled title="Email delivery is awaiting integration">
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
              <p className="text-sm font-semibold text-danger">This payroll batch is locked.</p>
              <p className="text-xs text-foreground/70">
                {period?.lockedOn?`Locked on ${new Date(period.lockedOn).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}. `:''}Unlocking requires an authorized administrator and a correction reason.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!permitted("payroll.unlock")} onClick={requestEdit}>
            <LockOpen className="h-3.5 w-3.5" /> Edit this batch
          </Button>
        </div>
      )}

      <div className="mb-4"><Button variant="outline" disabled={!permitted('payroll.run')} onClick={()=>setIllustration(value=>!value)} aria-expanded={illustration}>{illustration?'Close earnings estimate':'Estimate base earnings'}</Button></div>
      {illustration&&<PayrollIllustration key={companyId+monthKey} month={month}/>}
      {!illustration&&<>
      {permitted('employees.sensitive')&&permitted('salary.read')&&<div className="mb-4"><Button variant="outline" onClick={()=>setClientSheet(value=>!value)} aria-expanded={clientSheet}>{clientSheet?'Hide client salary sheet':'Client salary sheet'}</Button></div>}
      {clientSheet&&<ClientSalarySheet key={monthKey+period?.version} month={monthKey}/>}
      <PayrollSetupNotice warnings={rows.flatMap(row=>row.setupWarnings??[])} showEmployeeLinks/>
      {rows.some(row=>row.salary.structure==='Salary source unavailable')&&<p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">Some saved salaries have missing source details. Their captured totals are shown below. Review these employees before approval; Edit / recalculate this batch can rebuild unpublished calculations from reviewed inputs.</p>}
      {rows.length>0&&<PayrollComparison month={monthKey} rows={rows} employees={employees}/>}
      {validation&&<PayrollBlockers issues={[...validation.issues,...(validation.pendingReasons??[])]} employees={employees} onReviewOvertime={()=>{setShowAdjustments(true);requestAnimationFrame(()=>document.getElementById('payroll-adjustments')?.scrollIntoView({behavior:'smooth'}));}}/>}
      <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-semibold">Calculate employees with complete monthly attendance</h2><p className="mt-2 text-sm">Employees with incomplete attendance remain pending. Run again when more employees are ready; earlier salaries and payments are retained. Approve and lock each batch before payment.</p><div className="mt-3 flex flex-wrap gap-2"><Button disabled={loading||!!busy||!permitted('payroll.run')} onClick={handleCalculate}>{busy==='calculate'?'Calculating...':'Calculate ready employees'}</Button><Link className="self-center text-sm font-semibold text-primary" href="/attendance">Review pending attendance</Link>{isLocked&&<Link className="self-center text-sm font-semibold text-primary" href="/disbursement">Salary payments</Link>}</div></section>
      <SectionCard className="mb-5">
        {loading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : <PayrollStepper steps={buildSteps(period)} />}
      </SectionCard>

      <SectionCard
        className="mb-5"
        title="Employee attendance readiness"
        subtitle={finalized ? `Attendance for ${month} is finalized and locked for payroll.` : `Whole-month finalization is optional. Each employee needs every employed date marked for ${month}.`}
        actions={
          finalized ? (
            <StatusBadge status="Attendance Locked for Payroll" tone="success" />
          ) : (
            <Link href="/attendance" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">Review attendance dates</Link>
          )
        }
      />

      <SectionCard className="mb-5" title="Payroll Validation" subtitle="Run the validation engine before processing payroll." actions={
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleValidate} disabled={validating||!permitted("payroll.run")}>
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
          <StatCard icon={Users} tone="blue" label="Employees in this batch" value={String(rows.length)} />
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
        <SectionCard title="Payroll Exception Center" subtitle="Setup issues for pending employees; warnings do not block saved batches">
          {Object.keys(exceptions).length === 0 ? (
            <p className="text-sm text-muted-foreground">{validation ? `No exceptions detected for ${month}.` : 'Run checks to review employee and attendance issues.'}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(exceptions).map(([type, count]) => (
                <div key={type} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${validation?.issues.some(issue=>issue.check===type&&issue.severity==='Blocking Error')?'border-rose-200 bg-rose-50':'border-amber-200 bg-amber-50'}`}>
                  <span className="text-xs text-foreground">{type}</span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-700 px-1.5 text-xs font-semibold text-white">{count}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Select an employee for earnings and deduction details.</p><Button variant="outline" size="sm" onClick={()=>setShowDetails(value=>!value)} aria-pressed={showDetails}>{showDetails?'Simple view':'Show all salary columns'}</Button></div>
      <SectionCard
        title="Employee salaries"
        subtitle={`${rows.length} calculated employees in batch ${period?.batchNumber??1} · ${month} · Click a row for the full calculation breakdown`}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCalculate} disabled={loading||!!busy||!permitted("payroll.run")}>
            <RefreshCcw className="h-3.5 w-3.5" /> Calculate ready employees
          </Button>
        }
        noPadding
      >
        <DataTable columns={showDetails?columns:columns.filter(column=>['employeeName','payableDays','lopDays','adjustedGross','deductions','net','status'].includes(column.id??''))} data={rows} loading={loading} emptyTitle="No calculated salaries yet" emptyDescription="Complete attendance for an employee, then calculate ready employees above." pageSize={10} onRowClick={(row) => setDrawerEmployee(employeeMap.get(row.employeeId) ?? null)} />
      </SectionCard>

      {rows.length>0&&!isLocked&&<div className="mt-4"><Button variant="outline" disabled={loading||!!busy||!permitted('payroll.unlock')} onClick={requestEdit}>Edit / recalculate this batch</Button></div>}
      <ConfirmDialog open={editConfirm} onOpenChange={open=>{if(!busy)setEditConfirm(open);}} title={`Edit batch ${editTarget?.batchNumber??1} for ${month}?`} description={`Reopen only the ${editTarget?.count??0} calculated employees shown here. Their calculated figures will be archived and cleared so salary or attendance can be corrected and recalculated. Attendance, salary setup, other employees and other batches are retained. Reason: ${editReason}`} confirmLabel="Reopen for editing" loading={busy==='reopen'} onConfirm={handleReopen}/>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" className="gap-1.5" disabled={loading||!!busy||!rows.length||isLocked || !!period?.approved||!period?.validated||!permitted("payroll.approve")} onClick={() => {if(!period?.runId||!period.version)return;setApproveTarget({runId:period.runId,version:period.version,count:rows.length,batchNumber:period.batchNumber??1});setApproveConfirm(true);}}>
          <PlayCircle className="h-4 w-4" /> Approve Payroll
        </Button>
        <Button size="lg" className="gap-1.5" disabled={loading||!!busy||!rows.length||isLocked || !period?.approved||!permitted("payroll.lock")} onClick={() => {if(!period?.runId||!period.version)return;setLockTarget({runId:period.runId,version:period.version,count:rows.length,batchNumber:period.batchNumber??1});setLockConfirm(true);}}>
          <ShieldCheck className="h-4 w-4" /> {isLocked ? "Payroll Locked" : "Lock approved payroll"}
        </Button>
      </div>

      <ConfirmDialog
        open={approveConfirm}
        onOpenChange={setApproveConfirm}
        title={`Approve batch ${approveTarget?.batchNumber??1} for ${month}?`}
        description={`Approve only the ${approveTarget?.count??0} calculated employees shown in batch ${approveTarget?.batchNumber??1}. Other employees and other batches are unaffected. Approval is followed by a separate lock step.`}
        confirmLabel="Approve Payroll"
        loading={busy === "approve"}
        onConfirm={handleApprove}
      />
      <ConfirmDialog
        open={lockConfirm}
        onOpenChange={setLockConfirm}
        title="Lock approved payroll?"
        description={`Lock only the ${lockTarget?.count??0} employees shown in batch ${lockTarget?.batchNumber??1} for ${month}. Other employees remain unaffected. Use Edit this batch for changes before publication, accounting or payments; protected history uses the correction workflow.`}
        confirmLabel="Lock payroll"
        destructive
        loading={busy === "lock"}
        onConfirm={handleLock}
      />

      <section id="payroll-adjustments" className="mt-5 rounded-xl border bg-card p-4"><Button variant="outline" onClick={()=>setShowAdjustments(value=>!value)} aria-expanded={showAdjustments}>{showAdjustments?'Hide':'Show'} overtime, bonuses & prior-month corrections</Button>{showAdjustments&&<div className="mt-4"><PriorPayrollCorrections key={"correction/"+companyId+monthKey} month={monthKey} employees={employees} protectedRun={!!period?.approved||period?.status==='Locked'} onSaved={refresh}/><AdjustmentsPanel key={companyId+monthKey} month={monthKey} employees={employees} protectedRun={!!period?.approved||period?.status==='Locked'} onSaved={refresh}/></div>}</section>
      {drawerEmployee&&<SalaryCalculationDrawer savedCalculation={rows.find(row=>row.employeeId===drawerEmployee?.id)} employee={drawerEmployee} month={monthKey} open={!!drawerEmployee} onOpenChange={(o) => !o && setDrawerEmployee(null)} />}
      </>}
    </div>
  );
}
