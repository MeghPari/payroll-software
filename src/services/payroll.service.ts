import { payrollRun as mockPayrollRun, payrollCostHistory } from "@/data/mock/payroll";
import { salaryStructures as mockStructures } from "@/data/mock/salaryStructures";
import { mockDelay } from "@/lib/async";
import {
  calculatePayrollForMonth,
  calculatePayrollRow,
  payrollExceptionCountsForMonth,
  payrollExceptionsForMonth,
  useOperations,
  validatePayrollForMonth,
} from "@/store/operations-store";
import type {
  PayrollCalculation,
  PayrollEligibility,
  PayrollException,
  PayrollExceptionType,
  PayrollPeriod,
  PayrollRun,
  PayrollStepStatus,
  PayrollValidationIssue,
  SalaryStructure,
} from "@/types";

const runState: PayrollRun = { ...mockPayrollRun, steps: mockPayrollRun.steps.map((s) => ({ ...s })) };
const structureStore: SalaryStructure[] = [...mockStructures];

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getPayroll(month: string = runState.month): Promise<PayrollRun> {
  return mockDelay({ ...runState, month });
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function validatePayroll(): Promise<{ passed: boolean; alerts: PayrollRun["alerts"] }> {
  return mockDelay({ passed: runState.validationPassed, alerts: runState.alerts }, 900);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function calculatePayroll(): Promise<PayrollRun> {
  return mockDelay({ ...runState }, 1200);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function approvePayroll(): Promise<PayrollRun> {
  runState.status = "approved";
  runState.steps = runState.steps.map((s) =>
    s.id <= 7 ? { ...s, status: "completed" as PayrollStepStatus } : s
  );
  return mockDelay({ ...runState }, 1400);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function setStepStatus(stepId: number, status: PayrollStepStatus): Promise<PayrollRun> {
  runState.steps = runState.steps.map((s) => (s.id === stepId ? { ...s, status } : s));
  return mockDelay({ ...runState });
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getPayrollCostHistory() {
  return mockDelay(payrollCostHistory);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getSalaryStructures(): Promise<SalaryStructure[]> {
  return mockDelay([...structureStore]);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getSalaryStructureById(id: string): Promise<SalaryStructure | undefined> {
  return mockDelay(structureStore.find((s) => s.id === id));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function updateSalaryStructure(id: string, data: Partial<SalaryStructure>): Promise<SalaryStructure | undefined> {
  const index = structureStore.findIndex((s) => s.id === id);
  if (index === -1) return mockDelay(undefined);
  structureStore[index] = { ...structureStore[index], ...data };
  return mockDelay(structureStore[index]);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function createSalaryStructure(data: Omit<SalaryStructure, "id" | "employeeCount">): Promise<SalaryStructure> {
  const newStructure: SalaryStructure = { ...data, id: `ss-${structureStore.length + 1}`, employeeCount: 0 };
  structureStore.push(newStructure);
  return mockDelay(newStructure);
}

// ---------------------------------------------------------------------------
// Attendance-integrated payroll engine (Payroll Run, section 17–23)
// ---------------------------------------------------------------------------

// TODO: Replace mock implementation with REST/GraphQL API.
export async function calculatePayrollPreview(employeeId: string, month: string): Promise<PayrollCalculation | undefined> {
  return mockDelay(calculatePayrollRow(employeeId, month));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getPayrollReview(month: string): Promise<PayrollCalculation[]> {
  return mockDelay(calculatePayrollForMonth(month), 1000);
}

export interface PayrollValidationSummary {
  issues: PayrollValidationIssue[];
  totalChecked: number;
  passed: number;
  warnings: number;
  blockingErrors: number;
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function validatePayrollMonth(month: string): Promise<PayrollValidationSummary> {
  const issues = validatePayrollForMonth(month);
  const totalChecked = useOperations.getState().employees.length;
  const warnings = issues.filter((i) => i.severity === "Warning").length;
  const blockingErrors = issues.filter((i) => i.severity === "Blocking Error").length;
  const passed = issues.filter((i) => i.severity === "Passed").length;
  useOperations.getState().validatePeriod(month);
  return mockDelay({ issues, totalChecked, passed, warnings, blockingErrors }, 1100);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getPayrollExceptions(month: string): Promise<PayrollException[]> {
  return mockDelay(payrollExceptionsForMonth(month));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getPayrollExceptionCounts(month: string): Promise<Record<PayrollExceptionType, number>> {
  return mockDelay(payrollExceptionCountsForMonth(month));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getPayrollEligibilityCounts(month: string): Promise<Record<PayrollEligibility, number>> {
  const rows = calculatePayrollForMonth(month);
  const counts = {} as Record<PayrollEligibility, number>;
  rows.forEach((r) => {
    counts[r.eligibility] = (counts[r.eligibility] ?? 0) + 1;
  });
  return mockDelay(counts);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getPayrollPeriod(month: string): Promise<PayrollPeriod> {
  return mockDelay(useOperations.getState().ensurePeriod(month));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function approvePayrollPeriod(month: string): Promise<PayrollPeriod> {
  useOperations.getState().approvePeriod(month);
  return mockDelay(useOperations.getState().periods[month], 1400);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function lockPayrollPeriod(month: string): Promise<PayrollPeriod> {
  useOperations.getState().lockPeriod(month);
  return mockDelay(useOperations.getState().periods[month], 900);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function unlockPayrollPeriod(month: string): Promise<PayrollPeriod> {
  useOperations.getState().unlockPeriod(month);
  return mockDelay(useOperations.getState().periods[month], 500);
}
