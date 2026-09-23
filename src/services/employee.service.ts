import { mockDelay } from "@/lib/async";
import { useOperations, checkDuplicateUAN as checkDuplicateUANInStore } from "@/store/operations-store";
import type { Employee, EmployeeFilters, EmploymentStatus, ExitRecord, ImportRowResult, ImportRowStatus, UploadRecord } from "@/types";

function pad(n: number, len = 4): string {
  return String(n).padStart(len, "0");
}

function nextEmployeeId(): { id: string; employeeCode: string } {
  const count = useOperations.getState().employees.length;
  const n = count + 1;
  return { id: `emp-imported-${Date.now()}-${n}`, employeeCode: `EMP${pad(n)}` };
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getEmployees(filters: EmployeeFilters = {}): Promise<Employee[]> {
  let results = [...useOperations.getState().employees];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (e) => e.fullName.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
    );
  }
  if (filters.department && filters.department !== "All") results = results.filter((e) => e.department === filters.department);
  if (filters.designation && filters.designation !== "All") results = results.filter((e) => e.designation === filters.designation);
  if (filters.location && filters.location !== "All") results = results.filter((e) => e.workLocation === filters.location);
  if (filters.state && filters.state !== "All") results = results.filter((e) => e.state === filters.state);
  if (filters.status && filters.status !== "All") results = results.filter((e) => e.status === filters.status);
  if (filters.category && filters.category !== "All") results = results.filter((e) => (e.category ?? "Permanent") === filters.category);

  return mockDelay(results);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getEmployeeById(id: string): Promise<Employee | undefined> {
  return mockDelay(useOperations.getState().employees.find((e) => e.id === id));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function createEmployee(data: Omit<Employee, "id" | "employeeCode" | "fullName">): Promise<Employee> {
  const { id, employeeCode } = nextEmployeeId();
  const newEmployee: Employee = { ...data, id, employeeCode, fullName: `${data.firstName} ${data.lastName}` };
  useOperations.getState().addEmployee(newEmployee);
  return mockDelay(newEmployee, 700);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function updateEmployee(id: string, data: Partial<Employee>): Promise<Employee | undefined> {
  useOperations.getState().updateEmployeeRecord(id, data);
  return mockDelay(useOperations.getState().employees.find((e) => e.id === id));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function deleteEmployee(id: string): Promise<boolean> {
  const exists = useOperations.getState().employees.some((e) => e.id === id);
  if (!exists) return mockDelay(false);
  useOperations.getState().removeEmployee(id);
  return mockDelay(true);
}

// ---------------------------------------------------------------------------
// UAN duplicate validation — kept as a small service wrapper so a real
// backend endpoint (e.g. GET /employees/uan-check) can replace it cleanly.
// ---------------------------------------------------------------------------

// TODO: Replace mock implementation with REST/GraphQL API.
export async function checkDuplicateUAN(uan: string, excludeEmployeeId?: string): Promise<Employee | undefined> {
  return mockDelay(checkDuplicateUANInStore(uan, excludeEmployeeId), 300);
}

// ---------------------------------------------------------------------------
// Employee status lifecycle
// ---------------------------------------------------------------------------

export interface StatusChangePayload {
  status: EmploymentStatus;
  effectiveDate: string;
  reason: string;
  remarks: string;
  exit?: ExitRecord;
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function updateEmployeeStatus(employeeId: string, payload: StatusChangePayload): Promise<void> {
  useOperations.getState().updateEmployeeStatus(employeeId, payload);
  return mockDelay(undefined, 700);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getStatusHistory(employeeId: string) {
  return mockDelay(useOperations.getState().statusHistory.filter((s) => s.employeeId === employeeId));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getExitRecord(employeeId: string) {
  return mockDelay(useOperations.getState().exits[employeeId]);
}

// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------

export const EMPLOYEE_IMPORT_COLUMNS = [
  "Employee ID",
  "Employee Name",
  "First Name",
  "Last Name",
  "Date of Birth",
  "Gender",
  "Personal Email",
  "Official Email",
  "Mobile Number",
  "Emergency Contact",
  "Date of Joining",
  "Employment Type",
  "Department",
  "Designation",
  "Work Location",
  "State",
  "Reporting Manager",
  "PAN",
  "Aadhaar Number",
  "UAN",
  "ESIC Number",
  "Bank Name",
  "Account Number",
  "IFSC Code",
  "Basic Salary",
  "Gross Salary",
  "CTC",
  "PF Applicable",
  "ESI Applicable",
  "Professional Tax Applicable",
  "TDS Applicable",
  "Employee Status",
] as const;

export interface EmployeeImportRow {
  employeeId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  personalEmail: string;
  officialEmail: string;
  mobile: string;
  dateOfJoining: string;
  employmentType: string;
  department: string;
  designation: string;
  workLocation: string;
  state: string;
  pan: string;
  aadhaar: string;
  uan: string;
  ctc: string;
  status: string;
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function validateEmployeeImport(rows: EmployeeImportRow[]): Promise<ImportRowResult<EmployeeImportRow>[]> {
  const seenIds = new Set<string>();
  const seenUans = new Set<string>();
  const existingIds = new Set(useOperations.getState().employees.map((e) => e.employeeCode));

  const results = rows.map((row, index): ImportRowResult<EmployeeImportRow> => {
    const issues: string[] = [];
    let status: ImportRowStatus = "Valid";

    if (!row.employeeId.trim()) issues.push("Employee ID is required.");
    if (!row.firstName.trim() || !row.lastName.trim()) issues.push("First and last name are required.");
    if (!row.officialEmail.includes("@")) issues.push("Official email looks invalid.");
    if (!/^\d{10}$/.test(row.mobile.replace(/\D/g, ""))) issues.push("Mobile number should be 10 digits.");
    if (row.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(row.pan.toUpperCase())) issues.push("PAN format looks invalid.");
    if (!row.ctc || Number.isNaN(Number(row.ctc))) issues.push("CTC must be a number.");

    if (existingIds.has(row.employeeId) || seenIds.has(row.employeeId)) {
      issues.push(`Employee ID ${row.employeeId} already exists.`);
      status = "Duplicate";
    }
    if (row.uan) {
      const uanTaken = checkDuplicateUANInStore(row.uan) || seenUans.has(row.uan);
      if (uanTaken) {
        issues.push(`UAN ${row.uan} already belongs to another employee.`);
        status = "Duplicate";
      }
      seenUans.add(row.uan);
    }
    seenIds.add(row.employeeId);

    if (status !== "Duplicate") {
      if (issues.length > 0) status = issues.some((i) => i.includes("required") || i.includes("must be")) ? "Error" : "Warning";
    }

    return { row: index + 1, data: row, status, issues };
  });

  return mockDelay(results, 900);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function bulkImportEmployees(rows: EmployeeImportRow[]): Promise<UploadRecord> {
  const state = useOperations.getState();
  const employees: Employee[] = rows.map((row) => {
    const { id, employeeCode } = nextEmployeeId();
    return {
      id,
      employeeCode: row.employeeId || employeeCode,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: `${row.firstName} ${row.lastName}`,
      email: row.officialEmail,
      personalEmail: row.personalEmail || row.officialEmail,
      phone: row.mobile,
      department: (row.department as Employee["department"]) || "Operations",
      designation: row.designation || "Employee",
      status: (row.status as Employee["status"]) || "Active",
      joiningDate: row.dateOfJoining || new Date().toISOString().slice(0, 10),
      dateOfBirth: row.dateOfBirth || "1995-01-01",
      gender: (row.gender as Employee["gender"]) || "Male",
      bloodGroup: "O+",
      maritalStatus: "Single",
      address: "",
      city: row.workLocation || "",
      state: row.state || "Karnataka",
      pincode: "",
      emergencyContact: { name: "", relation: "", phone: "" },
      workLocation: row.workLocation || "",
      nationality: "Indian",
      languages: ["English"],
      bankDetails: { accountHolderName: `${row.firstName} ${row.lastName}`, accountNumber: "", ifscCode: "", bankName: "", branch: "" },
      statutory: { pan: row.pan || "", aadhaar: row.aadhaar || "", uan: row.uan || undefined },
      salaryStructureId: "ss-1",
      ctc: Number(row.ctc) || 600000,
      employmentType: (row.employmentType as Employee["employmentType"]) || "Full-time",
      category: "Permanent",
    };
  });

  const record = state.bulkImportEmployees(employees);
  return mockDelay(record, 1200);
}

// ---------------------------------------------------------------------------
// Bulk actions (multi-select toolbar on the Employees table)
// ---------------------------------------------------------------------------

// TODO: Replace mock implementation with REST/GraphQL API.
export async function bulkAssignSalaryStructure(employeeIds: string[], salaryStructureId: string): Promise<void> {
  useOperations.getState().bulkAssign(employeeIds, { salaryStructureId }, "Bulk Assign Salary Structure");
  return mockDelay(undefined, 700);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function bulkSetDepartment(employeeIds: string[], department: Employee["department"]): Promise<void> {
  useOperations.getState().bulkAssign(employeeIds, { department }, "Bulk Change Department");
  return mockDelay(undefined, 700);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function bulkSetWorkLocation(employeeIds: string[], workLocation: string): Promise<void> {
  useOperations.getState().bulkAssign(employeeIds, { workLocation }, "Bulk Set Work Location");
  return mockDelay(undefined, 700);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function bulkSetState(employeeIds: string[], state: string): Promise<void> {
  useOperations.getState().bulkAssign(employeeIds, { state }, "Bulk Update State");
  return mockDelay(undefined, 700);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function bulkSetStatutoryApplicability(employeeIds: string[], field: "pfApplicable" | "esiApplicable", value: boolean): Promise<void> {
  const ops = useOperations.getState();
  employeeIds.forEach((id) => ops.updateKYC(id, { [field]: value, overridden: true }));
  ops.addAudit({ action: `Bulk ${field === "pfApplicable" ? "PF" : "ESI"} ${value ? "Enabled" : "Disabled"}`, previous: "", next: `${employeeIds.length} employees`, remarks: "" });
  return mockDelay(undefined, 700);
}
