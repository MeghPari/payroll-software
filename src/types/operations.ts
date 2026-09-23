import type { EmployeeStatus } from "./employee";

// ---------------------------------------------------------------------------
// Employment
// ---------------------------------------------------------------------------

export type EmploymentStatus = EmployeeStatus;

export type ExitType = "Resignation" | "Termination" | "Retirement" | "Contract Completed" | "Absconding" | "Other";
export type SettlementStatus = "Not Started" | "In Progress" | "Completed";

export interface ExitRecord {
  employeeId: string;
  effectiveDate: string;
  reason: string;
  remarks: string;
  lastWorkingDate: string;
  exitType: ExitType;
  settlementStatus: SettlementStatus;
}

export interface StatusChangeRecord {
  id: string;
  employeeId: string;
  previousStatus: EmploymentStatus;
  newStatus: EmploymentStatus;
  effectiveDate: string;
  reason: string;
  remarks: string;
  changedBy: string;
  changedOn: string;
}

// ---------------------------------------------------------------------------
// KYC & statutory
// ---------------------------------------------------------------------------

export type VerificationStatus = "Verified" | "Pending Verification" | "Rejected" | "Not Provided";

export type KYCDocumentName = "PAN Card" | "Aadhaar" | "Cancelled Cheque" | "Bank Proof" | "Offer Letter" | "Other Document";

export interface KYCDocument {
  name: KYCDocumentName;
  fileName: string;
  status: VerificationStatus;
  uploadedOn?: string;
}

export type TaxRegime = "Old Regime" | "New Regime";
export type DeclarationStatus = "Pending" | "Submitted" | "Verified";

export interface EmployeeStatutoryProfile {
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  tdsApplicable: boolean;
  taxRegime: TaxRegime;
  declarationStatus: DeclarationStatus;
  /** True when applicability was changed from the category default by an admin override. */
  overridden?: boolean;
}

export interface EmployeeKYC extends EmployeeStatutoryProfile {
  employeeId: string;
  panStatus: VerificationStatus;
  aadhaarStatus: VerificationStatus;
  bankStatus: VerificationStatus;
  documents: KYCDocument[];
}

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

export interface SalaryProfile {
  employeeId: string;
  effectiveFrom: string;
  structure: string;
  basic: number;
  hra: number;
  special: number;
  conveyance: number;
  other: number;
  bonus: number;
  variable: number;
  loan: number;
  advance: number;
  otherDeduction: number;
  employerOther: number;
  remarks?: string;
}

export interface SalaryRevision {
  id: string;
  employeeId: string;
  previousGross: number;
  revisedGross: number;
  effectiveFrom: string;
  revisionPercent: number;
  changedBy: string;
  changedOn: string;
  profile: SalaryProfile;
}

export interface SalaryHold {
  id: string;
  employeeId: string;
  month: string;
  reason: string;
  remarks: string;
  heldBy: string;
  heldOn: string;
  releasedBy?: string;
  releasedOn?: string;
  releaseRemarks?: string;
  status: "Held" | "Released";
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export type AttendanceStatus =
  | "Present"
  | "Absent"
  | "Paid Leave"
  | "Unpaid Leave"
  | "Half Day"
  | "Weekly Off"
  | "Holiday"
  | "Work From Home"
  | "Missing Punch";

export interface DailyAttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  shift: string;
  checkIn: string;
  checkOut: string;
  workHours: number;
  status: AttendanceStatus;
  leaveType: string;
  overtime: number;
  remarks: string;
  source: string;
  modifiedBy?: string;
  modifiedOn?: string;
  changeReason?: string;
}

export interface AttendanceSummary {
  payrollDays: number;
  present: number;
  paidLeave: number;
  unpaidLeave: number;
  absent: number;
  halfDays: number;
  weeklyOff: number;
  holidays: number;
  missing: number;
  payableDays: number;
  lopDays: number;
}

// ---------------------------------------------------------------------------
// Statutory / payroll configuration
// ---------------------------------------------------------------------------

export interface StatePayrollConfiguration {
  state: string;
  professionalTax: number;
}

export type TDSMode = "Automatic Tax Calculation" | "Fixed Percentage" | "Fixed Amount" | "No TDS";
export type ProrationMethod = "Calendar Days" | "Working Days" | "Fixed 30 Days" | "Actual Days in Month" | "Custom Payroll Days";
export type LopRounding = "Exact" | "Round" | "Ceil";

export interface StatutoryConfiguration {
  employeePF: number;
  employerPF: number;
  pfLimit: number;
  epsApplicable: boolean;
  allowPFOverride: boolean;
  employeeESI: number;
  employerESI: number;
  esiLimit: number;
  allowESIOverride: boolean;
  tdsMode: TDSMode;
  tdsValue: number;
  proration: ProrationMethod;
  customDays: number;
  weeklyOffPaid: boolean;
  holidayPaid: boolean;
  paidLeaveIncluded: boolean;
  halfDayFactor: number;
  rounding: LopRounding;
  states: StatePayrollConfiguration[];
}

// ---------------------------------------------------------------------------
// Payroll calculation & validation
// ---------------------------------------------------------------------------

export type PayrollEligibility = "Eligible" | "Salary Hold" | "Exited" | "No Pay" | "Pending KYC" | "Pending Bank Verification" | "Attendance Pending";

export type PayrollCalculationStatus = "Ready" | "Salary Hold" | "Attendance Issue" | "KYC Issue" | "Bank Details Missing" | "Error";

export interface PayrollCalculation {
  employeeId: string;
  month: string;
  salary: SalaryProfile;
  attendance: AttendanceSummary;
  grossEarnings: number;
  basic: number;
  hra: number;
  allowances: number;
  variablePay: number;
  lopDeduction: number;
  adjustedGross: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  otherDeductions: number;
  totalDeductions: number;
  netPayable: number;
  employerPF: number;
  employerESI: number;
  employerOther: number;
  totalEmployerCost: number;
  eligibility: PayrollEligibility;
  status: PayrollCalculationStatus;
}

export type ValidationSeverity = "Passed" | "Warning" | "Blocking Error";

export interface PayrollValidationIssue {
  employeeId: string;
  check: string;
  severity: ValidationSeverity;
  message: string;
}

export type PayrollPeriodStatus = "Draft" | "Processing" | "Processed" | "Approved" | "Locked";

export interface PayrollPeriod {
  month: string;
  status: PayrollPeriodStatus;
  attendanceFinalized: boolean;
  validated: boolean;
  approved: boolean;
  published: boolean;
  disbursed: boolean;
  posted: boolean;
  lockedBy?: string;
  lockedOn?: string;
}

export type PayrollExceptionType =
  | "Missing Bank Details"
  | "Missing PAN"
  | "Duplicate UAN"
  | "No Salary Assigned"
  | "Attendance Missing"
  | "Negative Net Pay"
  | "Salary on Hold"
  | "Exited During Month";

export interface PayrollException {
  employeeId: string;
  type: PayrollExceptionType;
  detail: string;
}

// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------

export type ImportRowStatus = "Valid" | "Warning" | "Error" | "Duplicate";

export interface ImportRowResult<TRow> {
  row: number;
  data: TRow;
  status: ImportRowStatus;
  issues: string[];
}

export type UploadKind = "Employee" | "Salary" | "Attendance";

export interface UploadRecord {
  id: string;
  kind: UploadKind;
  fileName: string;
  uploadedBy: string;
  uploadedOn: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  status: "Completed" | "Completed with errors" | "Failed";
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditRecord {
  id: string;
  date: string;
  user: string;
  action: string;
  employeeId?: string;
  employeeName?: string;
  previous: string;
  next: string;
  remarks: string;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type Role = "Super Admin" | "HR Admin" | "Payroll Admin" | "Finance" | "Manager" | "Employee";
