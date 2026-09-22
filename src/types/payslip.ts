export type PayslipStatus = "Paid" | "Published" | "Failed" | "Pending" | "Generated";

export interface PayslipEarningLine {
  name: string;
  amount: number;
}

export interface Payslip {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  month: string;
  netPayable: number;
  grossSalary: number;
  totalDeductions: number;
  status: PayslipStatus;
  publishedOn?: string;
  earnings: PayslipEarningLine[];
  deductions: PayslipEarningLine[];
}
