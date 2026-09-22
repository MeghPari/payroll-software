import type { PayrollAlert, PayrollEmployeeRow, PayrollRun, PayrollStep } from "@/types";
import { employees } from "./employees";
import { CURRENT_PAYROLL_MONTH } from "./attendance";

function computeRow(emp: (typeof employees)[number], index: number): PayrollEmployeeRow {
  const grossSalary = Math.round(emp.ctc / 12);
  const basic = Math.round(grossSalary * 0.4);
  const pf = Math.round(basic * 0.12);
  const esi = grossSalary <= 175000 ? Math.round(grossSalary * 0.0075) : 0;
  const pt = 200;
  const tds = grossSalary > 100000 ? Math.round(grossSalary * 0.05) : 0;
  const otherDeductions = index % 9 === 0 ? 1500 : 0;
  const netPay = grossSalary - pf - esi - pt - tds - otherDeductions;
  const status: PayrollEmployeeRow["status"] =
    index % 23 === 5 ? "Exception" : index % 17 === 3 ? "Pending" : "Ready";
  return {
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    employeeName: emp.fullName,
    department: emp.department,
    grossSalary,
    pf,
    esi,
    pt,
    tds,
    otherDeductions,
    netPay,
    status,
  };
}

export const payrollRows: PayrollEmployeeRow[] = employees.map(computeRow);

const steps: PayrollStep[] = [
  { id: 1, label: "Select Payroll Month", status: "completed" },
  { id: 2, label: "Validate Data", status: "completed" },
  { id: 3, label: "Fetch Attendance & Leave", status: "completed" },
  { id: 4, label: "Calculate Salary", status: "completed" },
  { id: 5, label: "Review Deductions", status: "completed" },
  { id: 6, label: "Preview Payroll", status: "in-progress" },
  { id: 7, label: "Approve & Lock", status: "pending" },
  { id: 8, label: "Generate Payslips", status: "pending" },
  { id: 9, label: "Create Accounting Entries", status: "pending" },
];

const alerts: PayrollAlert[] = [
  { id: "al-1", severity: "critical", message: "3 employees have missing bank details" },
  { id: "al-2", severity: "critical", message: "1 employee has negative leave balance" },
  { id: "al-3", severity: "warning", message: "5 employees have overtime not approved" },
  { id: "al-4", severity: "warning", message: "2 employees have salary revisions pending" },
];

const grossPay = payrollRows.reduce((sum, r) => sum + r.grossSalary, 0);
const totalDeductions = payrollRows.reduce((sum, r) => sum + r.pf + r.esi + r.pt + r.tds + r.otherDeductions, 0);
const netPayable = grossPay - totalDeductions;
const employerContribution = payrollRows.reduce((sum, r) => sum + r.pf + r.esi, 0);

export const payrollRun: PayrollRun = {
  id: "pr-2026-05",
  month: CURRENT_PAYROLL_MONTH,
  status: "ready",
  steps,
  alerts,
  totalEmployees: employees.length,
  grossPay,
  totalDeductions,
  netPayable,
  employerContribution,
  rows: payrollRows,
  validationPassed: true,
};

export const payrollCostHistory = [
  { month: "Dec 2025", value: 4210000 },
  { month: "Jan 2026", value: 4380000 },
  { month: "Feb 2026", value: 4560000 },
  { month: "Mar 2026", value: 4690000 },
  { month: "Apr 2026", value: 5040000 },
  { month: "May 2026", value: netPayable },
];
