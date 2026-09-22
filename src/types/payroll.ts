export type SalaryComponentType = "Earning" | "Deduction";

export type CalculationType = "Percentage of Basic" | "Percentage of Gross" | "Fixed Amount" | "As per IT Slab" | "As per record";

export interface SalaryComponent {
  id: string;
  name: string;
  type: SalaryComponentType;
  calculationType: CalculationType;
  value: number | null; // percentage or fixed amount; null when computed (e.g. TDS/Loan)
}

export type SalaryStructureStatus = "Active" | "Draft" | "Archived";

export interface SalaryStructure {
  id: string;
  name: string;
  status: SalaryStructureStatus;
  frequency: "Monthly" | "Weekly" | "Bi-Weekly";
  createdOn: string;
  employeeCount: number;
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
}

export type PayrollStatus =
  | "draft"
  | "validating"
  | "ready"
  | "processing"
  | "approved"
  | "completed"
  | "failed";

export type PayrollStepStatus = "completed" | "in-progress" | "pending";

export interface PayrollStep {
  id: number;
  label: string;
  status: PayrollStepStatus;
}

export type PayrollRowStatus = "Ready" | "Exception" | "Pending";

export interface PayrollEmployeeRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  grossSalary: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  otherDeductions: number;
  netPay: number;
  status: PayrollRowStatus;
}

export interface PayrollAlert {
  id: string;
  severity: "critical" | "warning";
  message: string;
}

export interface PayrollRun {
  id: string;
  month: string; // "May 2026"
  status: PayrollStatus;
  steps: PayrollStep[];
  alerts: PayrollAlert[];
  totalEmployees: number;
  grossPay: number;
  totalDeductions: number;
  netPayable: number;
  employerContribution: number;
  rows: PayrollEmployeeRow[];
  validationPassed: boolean;
}
