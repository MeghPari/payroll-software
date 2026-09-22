import type { Payslip, PayslipStatus } from "@/types";
import { employees } from "./employees";
import { payrollRows } from "./payroll";
import { CURRENT_PAYROLL_MONTH } from "./attendance";

function statusFor(index: number): PayslipStatus {
  if (index % 19 === 4) return "Failed";
  if (index % 11 === 6) return "Pending";
  if (index % 5 === 0) return "Published";
  if (index % 13 === 3) return "Generated";
  return "Paid";
}

export const payslips: Payslip[] = employees.map((emp, index) => {
  const row = payrollRows[index];
  const basic = Math.round(row.grossSalary * 0.4);
  const hra = Math.round(row.grossSalary * 0.2);
  const special = row.grossSalary - basic - hra;
  const status = statusFor(index);
  return {
    id: `payslip-${emp.id}`,
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    employeeName: emp.fullName,
    department: emp.department,
    month: CURRENT_PAYROLL_MONTH,
    netPayable: row.netPay,
    grossSalary: row.grossSalary,
    totalDeductions: row.pf + row.esi + row.pt + row.tds + row.otherDeductions,
    status,
    publishedOn: status === "Pending" ? undefined : "2026-05-25 11:02 AM",
    earnings: [
      { name: "Basic", amount: basic },
      { name: "HRA", amount: hra },
      { name: "Special Allowance", amount: special },
    ],
    deductions: [
      { name: "PF (Employee)", amount: row.pf },
      { name: "ESI (Employee)", amount: row.esi },
      { name: "Professional Tax", amount: row.pt },
      { name: "TDS", amount: row.tds },
      ...(row.otherDeductions ? [{ name: "Loan / Advance", amount: row.otherDeductions }] : []),
    ],
  };
});

export const payslipStatusBreakdown = payslips.reduce(
  (acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  },
  {} as Record<PayslipStatus, number>
);
