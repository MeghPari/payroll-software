import { employees } from "./employees";
import { payrollRun } from "./payroll";
import { attendanceSummary } from "./attendance";
import { gstSummary, cashBankHistory } from "./accounting";

export const dashboardKpis = {
  totalEmployees: employees.length,
  newThisMonth: 8,
  netSalaryPayable: payrollRun.netPayable,
  payrollStatus: "Completed" as const,
  payrollPeriod: "May 2026",
  pendingLeaves: 18,
  revenue: 16250000,
  expenses: 6840000,
  gstPayable: gstSummary.cgst + gstSummary.sgst + gstSummary.igst + gstSummary.cess,
  bankBalance: cashBankHistory[cashBankHistory.length - 1].bank + cashBankHistory[cashBankHistory.length - 1].cash,
};

export const payrollSummary = {
  grossSalary: payrollRun.grossPay,
  deductions: payrollRun.totalDeductions,
  netSalaryPayable: payrollRun.netPayable,
  disbursedToDate: payrollRun.netPayable,
  disbursementStatus: "Completed",
};

export const accountsSummary = {
  revenue: 16250000,
  expenses: 6840000,
  profitBeforeTax: 9410000,
  gstPayable: 975000,
  outstandingReceivables: 3285000,
  payablesToVendors: 1840000,
};

export const pendingActions = [
  { id: "pa-1", label: "Leave Requests", count: 6 },
  { id: "pa-2", label: "Attendance Exceptions", count: 12 },
  { id: "pa-3", label: "Payslips Not Viewed", count: 28 },
  { id: "pa-4", label: "Invoices Pending Approval", count: 9 },
  { id: "pa-5", label: "GST Returns Pending", count: 1 },
];

export { payrollCostHistory } from "./payroll";
export { cashFlowHistory, topExpenses } from "./accounting";
export const attendanceOverview = attendanceSummary;
