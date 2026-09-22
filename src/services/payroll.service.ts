import { payrollRun as mockPayrollRun, payrollCostHistory } from "@/data/mock/payroll";
import { salaryStructures as mockStructures } from "@/data/mock/salaryStructures";
import { mockDelay } from "@/lib/async";
import type { PayrollRun, PayrollStepStatus, SalaryStructure } from "@/types";

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
