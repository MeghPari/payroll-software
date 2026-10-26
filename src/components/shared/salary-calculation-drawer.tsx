"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from '@/store/session-store';
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { PayrollSetupNotice } from '@/components/payroll/payroll-setup-notice';
import { Skeleton } from "@/components/ui/skeleton";
import { calculatePayrollPreview } from "@/services/payroll.service";
import { formatINR } from "@/utils/format";
import type { Employee, PayrollCalculation } from "@/types";

interface SalaryCalculationDrawerProps {
  employee: Employee | null;
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedCalculation?: PayrollCalculation;
}

function Row({ label, value, emphasis, negative }: { label: string; value: string; emphasis?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={emphasis ? "text-sm font-semibold text-foreground" : negative ? "text-sm text-danger" : "text-sm font-medium text-foreground"}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-0.5 rounded-lg border border-border bg-muted/20 p-3">{children}</div>
    </section>
  );
}

export function SalaryCalculationDrawer({ employee, month, open, onOpenChange, savedCalculation }: SalaryCalculationDrawerProps) {
  const companyId=useSessionStore(state=>state.companyId);
  const [preview, setPreview] = useState<{key:string;calc?:PayrollCalculation;error?:string} | null>(null);
  const key=`${companyId}/${employee?.id}/${month}`;
  const loading=!savedCalculation&&preview?.key!==key;
  const calc=savedCalculation??(preview?.key===key?preview.calc:undefined);

  useEffect(() => {
    if (!open || !employee || savedCalculation) return;
    let cancelled=false;
    calculatePayrollPreview(employee.id, month).then(calc=>{if(!cancelled)setPreview({key,calc,error:calc?undefined:'No payroll calculation is saved for this employee and month. Calculate payroll first.'});}).catch(error=>{if(!cancelled)setPreview({key,error:error instanceof Error?error.message:'Unable to load the payroll calculation.'});});
    return()=>{cancelled=true;};
  }, [open, employee, month, key, savedCalculation]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        {employee && (
          <>
            <div className="border-b border-border p-5 pr-12">
              <div className="flex items-center gap-3">
                <EmployeeAvatar name={employee.fullName} size="lg" />
                <div className="min-w-0">
                  <SheetTitle className="truncate text-base font-semibold text-foreground">{employee.fullName}</SheetTitle>
                  <p className="truncate text-sm text-muted-foreground">
                    {employee.employeeCode} · {employee.designation}
                  </p>
                  {calc && (
                    <div className="mt-1.5">
                      <StatusBadge status={calc.status} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5">
              {!loading && preview?.error ? <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">{preview.error}</p> : loading || !calc ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <>
                  <PayrollSetupNotice warnings={calc.setupWarnings??[]}/>
                  <Section title="A. Salary Profile">
                    <Row label="Gross Before Attendance Reductions" value={formatINR(calc.grossEarnings)} />
                    <Row label="Structure" value={calc.salary.structure} />
                    <Row label="Effective From" value={calc.salary.effectiveFrom} />
                    {calc.salary.structure==='Salary source unavailable'&&<p role="status" className="text-sm text-amber-800">This saved calculation has no salary-source details. Captured earnings, deductions and net pay are retained. Review the source before approval; use Edit / recalculate this batch to rebuild an unpublished calculation.</p>}
                  </Section>

                  <Section title="B. Attendance Summary">
                    {calc.attendance.proration&&<><Row label="Proration" value={calc.attendance.proration}/><Row label="Month Basis Days" value={String(calc.attendance.prorationDays)}/></>}
                    <Row label="Employment Calendar Days" value={String(calc.attendance.payrollDays)} />
                    <Row label="Present Days" value={String(calc.attendance.present)} />
                    <Row label="Paid Leave" value={String(calc.attendance.paidLeave)} />
                    <Row label="Unpaid Leave" value={String(calc.attendance.unpaidLeave)} />
                    <Row label="Absent" value={String(calc.attendance.absent)} />
                    <Row label="Half Day" value={String(calc.attendance.halfDays)} />
                    <Row label="Weekly Off" value={String(calc.attendance.weeklyOff)} />
                    <Row label="Holiday" value={String(calc.attendance.holidays)} />
                    <Separator className="my-1.5" />
                    <Row label="Payable Days" value={String(calc.attendance.payableDays)} emphasis />
                    <Row label="LOP Days" value={String(calc.attendance.lopDays)} negative={calc.attendance.lopDays > 0} />
                  </Section>

                  <Section title="C. Earnings">
                    {Object.entries(calc.earningsBreakdown??{}).map(([code,value])=><Row key={code} label={({basic:'Basic',da:'Dearness Allowance',sunday:'Sunday Amount',incentive:'Incentive (excluding Sunday / OT)',uniformAdvance:'Uniform Advance Recovery',vehicleDamage:'Vehicle Damage Recovery',recovery:'Prior-month Recovery',hra:'HRA',special:'Special Allowance',conveyance:'Conveyance',other:'Other Allowances',bonus:'Bonus',variable:'Variable Pay',overtime:'Overtime',arrears:'Arrears',reimbursement:'Reimbursement'}as Record<string,string>)[code]??code} value={formatINR(value)}/>)}
                  </Section>

                  <Section title="D. Attendance Adjustment">
                    <Row label="Original Gross" value={formatINR(calc.grossEarnings)} />
                    <Row label="LOP Deduction" value={`- ${formatINR(calc.lopDeduction)}`} negative={calc.lopDeduction > 0} />
                    <Separator className="my-1.5" />
                    <Row label="Adjusted Gross" value={formatINR(calc.adjustedGross)} emphasis />
                  </Section>

                  <Section title="E. Statutory Deductions">
                    <Row label="PF" value={`- ${formatINR(calc.pf)}`} negative={calc.pf > 0} />
                    <Row label="ESI" value={`- ${formatINR(calc.esi)}`} negative={calc.esi > 0} />
                    <Row label="Professional Tax" value={`- ${formatINR(calc.pt)}`} negative={calc.pt > 0} />
                    <Row label="TDS" value={`- ${formatINR(calc.tds)}`} negative={calc.tds > 0} />
                  </Section>

                  <Section title="F. Other Deductions">
                    <Row label="Loan" value={`- ${formatINR(calc.salary.loan)}`} negative={calc.salary.loan > 0} />
                    <Row label="Advance" value={`- ${formatINR(calc.salary.advance)}`} negative={calc.salary.advance > 0} />
                    <Row label="Other" value={`- ${formatINR(calc.deductionBreakdown?.otherDeduction??calc.salary.otherDeduction)}`} negative={calc.salary.otherDeduction > 0} />
                  </Section>

                  <Section title="G. Employer Contributions">
                    <Row label="Employer PF" value={formatINR(calc.employerPF)} />
                    <Row label="Employer ESI" value={formatINR(calc.employerESI)} />
                  </Section>

                  <Section title="H. Final Calculation">
                    <Row label="Gross (Adjusted)" value={formatINR(calc.adjustedGross)} />
                    <Row label="Total Deductions" value={`- ${formatINR(calc.totalDeductions)}`} negative />
                    <Separator className="my-1.5" />
                    <Row label="Net Payable" value={formatINR(calc.netPayable)} emphasis />
                    <Row label="Total Employer Cost" value={formatINR(calc.totalEmployerCost)} />
                  </Section>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
