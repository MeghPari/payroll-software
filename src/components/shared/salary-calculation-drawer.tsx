"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { calculatePayrollPreview } from "@/services/payroll.service";
import { formatINR } from "@/utils/format";
import type { Employee, PayrollCalculation } from "@/types";

interface SalaryCalculationDrawerProps {
  employee: Employee | null;
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function SalaryCalculationDrawer({ employee, month, open, onOpenChange }: SalaryCalculationDrawerProps) {
  const [calc, setCalc] = useState<PayrollCalculation | undefined>(undefined);
  const loading = !calc || calc.employeeId !== employee?.id || calc.month !== month;

  useEffect(() => {
    if (!open || !employee) return;
    calculatePayrollPreview(employee.id, month).then(setCalc);
  }, [open, employee, month]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        {employee && (
          <>
            <div className="border-b border-border p-5 pr-12">
              <div className="flex items-center gap-3">
                <EmployeeAvatar name={employee.fullName} size="lg" />
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">{employee.fullName}</h2>
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
              {loading || !calc ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <>
                  <Section title="A. Salary Profile">
                    <Row label="Monthly Gross" value={formatINR(calc.grossEarnings)} />
                    <Row label="Annual CTC" value={formatINR(calc.grossEarnings * 12)} />
                    <Row label="Structure" value={calc.salary.structure} />
                    <Row label="Effective From" value={calc.salary.effectiveFrom} />
                  </Section>

                  <Section title="B. Attendance Summary">
                    <Row label="Payroll Days" value={String(calc.attendance.payrollDays)} />
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
                    <Row label="Basic" value={formatINR(calc.basic)} />
                    <Row label="HRA" value={formatINR(calc.hra)} />
                    <Row label="Allowances" value={formatINR(calc.allowances)} />
                    <Row label="Variable Pay" value={formatINR(calc.variablePay)} />
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
                    <Row label="Other" value={`- ${formatINR(calc.salary.otherDeduction)}`} negative={calc.salary.otherDeduction > 0} />
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
