import { mockDelay } from "@/lib/async";
import { grossOf, useOperations, activeHoldFor } from "@/store/operations-store";
import type { ImportRowResult, ImportRowStatus, SalaryHold, SalaryProfile, SalaryRevision, UploadRecord } from "@/types";

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getSalaryProfile(employeeId: string): Promise<SalaryProfile | undefined> {
  return mockDelay(useOperations.getState().salaries[employeeId]);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function updateSalaryProfile(employeeId: string, profile: SalaryProfile): Promise<SalaryProfile> {
  useOperations.getState().updateSalaryProfile(employeeId, profile);
  return mockDelay(profile, 800);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getSalaryRevisions(employeeId?: string): Promise<SalaryRevision[]> {
  const all = useOperations.getState().revisions;
  return mockDelay(employeeId ? all.filter((r) => r.employeeId === employeeId) : all);
}

// ---------------------------------------------------------------------------
// Salary hold / release
// ---------------------------------------------------------------------------

// TODO: Replace mock implementation with REST/GraphQL API.
export async function holdSalary(employeeId: string, month: string, reason: string, remarks: string): Promise<void> {
  useOperations.getState().holdSalary(employeeId, month, reason, remarks);
  return mockDelay(undefined, 700);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function releaseSalary(employeeId: string, month: string, remarks: string): Promise<void> {
  useOperations.getState().releaseSalary(employeeId, month, remarks);
  return mockDelay(undefined, 700);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getSalaryHoldHistory(employeeId?: string): Promise<SalaryHold[]> {
  const all = useOperations.getState().holds;
  return mockDelay(employeeId ? all.filter((h) => h.employeeId === employeeId) : all);
}

export function getActiveSalaryHold(employeeId: string, month: string): SalaryHold | undefined {
  return activeHoldFor(employeeId, month);
}

// ---------------------------------------------------------------------------
// Bulk salary upload
// ---------------------------------------------------------------------------

export const SALARY_IMPORT_COLUMNS = [
  "Employee ID",
  "Employee Name",
  "Effective From",
  "Salary Structure",
  "Basic",
  "HRA",
  "Special Allowance",
  "Other Allowance",
  "Gross Salary",
  "Variable Pay",
  "PF Applicable",
  "ESI Applicable",
  "Professional Tax",
  "TDS",
  "Remarks",
] as const;

export interface SalaryImportRow {
  employeeId: string;
  effectiveFrom: string;
  structure: string;
  basic: string;
  hra: string;
  special: string;
  other: string;
  grossSalary: string;
  variable: string;
  remarks: string;
  /** Populated by validateSalaryImport for display in the preview table. */
  employeeName?: string;
  oldGross?: number;
  newGross?: number;
  difference?: number;
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function validateSalaryImport(rows: SalaryImportRow[]): Promise<ImportRowResult<SalaryImportRow>[]> {
  const state = useOperations.getState();
  const seen = new Set<string>();

  const results = rows.map((row, index): ImportRowResult<SalaryImportRow> => {
    const issues: string[] = [];
    let status: ImportRowStatus = "Valid";
    const employee = state.employees.find((e) => e.employeeCode === row.employeeId || e.id === row.employeeId);

    if (!employee) {
      issues.push(`Employee ${row.employeeId} not found.`);
      status = "Error";
    }
    if (seen.has(row.employeeId)) {
      issues.push("Duplicate record for this employee in the file.");
      status = "Duplicate";
    }
    seen.add(row.employeeId);

    const newGross = Number(row.grossSalary) || Number(row.basic) + Number(row.hra) + Number(row.special) + Number(row.other);
    if (!newGross || Number.isNaN(newGross)) {
      issues.push("Incorrect or missing salary amount.");
      status = status === "Error" ? status : "Error";
    }
    if (!row.effectiveFrom) {
      issues.push("Effective date is missing.");
      status = status === "Error" || status === "Duplicate" ? status : "Warning";
    }

    const oldGross = employee ? grossOf(state.salaries[employee.id]) : 0;

    return {
      row: index + 1,
      status,
      issues,
      data: {
        ...row,
        employeeName: employee?.fullName ?? "Unknown",
        oldGross,
        newGross: newGross || 0,
        difference: (newGross || 0) - oldGross,
      },
    };
  });

  return mockDelay(results, 900);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function bulkUpdateSalary(rows: SalaryImportRow[]): Promise<UploadRecord> {
  const state = useOperations.getState();
  const updates = rows
    .map((row) => {
      const employee = state.employees.find((e) => e.employeeCode === row.employeeId || e.id === row.employeeId);
      if (!employee) return undefined;
      const basic = Number(row.basic) || Math.round((Number(row.grossSalary) || 0) * 0.5);
      const hra = Number(row.hra) || Math.round((Number(row.grossSalary) || 0) * 0.2);
      const special = Number(row.special) || Math.max(0, (Number(row.grossSalary) || 0) - basic - hra);
      const profile: SalaryProfile = {
        ...state.salaries[employee.id],
        employeeId: employee.id,
        effectiveFrom: row.effectiveFrom || new Date().toISOString().slice(0, 10),
        structure: row.structure || state.salaries[employee.id]?.structure || "SVS Employee Structure",
        basic,
        hra,
        special,
        other: Number(row.other) || 0,
        variable: Number(row.variable) || 0,
        remarks: row.remarks,
      };
      return { employeeId: employee.id, profile };
    })
    .filter((u): u is { employeeId: string; profile: SalaryProfile } => !!u);

  const record = state.bulkUpdateSalary(updates);
  return mockDelay(record, 1200);
}

