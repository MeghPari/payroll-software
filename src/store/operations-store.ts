import { create } from "zustand";
import { employees as seedEmployees } from "@/data/mock/employees";
import { CURRENT_PAYROLL_MONTH_KEY } from "@/data/mock/attendance";
import type { Employee, EmploymentCategory } from "@/types/employee";
import type {
  AttendanceStatus,
  AttendanceSummary,
  AuditRecord,
  DailyAttendanceRecord,
  EmployeeKYC,
  EmploymentStatus,
  ExitRecord,
  PayrollCalculation,
  PayrollEligibility,
  PayrollException,
  PayrollExceptionType,
  PayrollPeriod,
  PayrollCalculationStatus,
  PayrollValidationIssue,
  Role,
  SalaryHold,
  SalaryProfile,
  SalaryRevision,
  StatusChangeRecord,
  StatutoryConfiguration,
  UploadRecord,
  ValidationSeverity,
} from "@/types/operations";

// ---------------------------------------------------------------------------
// Reference lists
// ---------------------------------------------------------------------------

export const indianStates = [
  "Delhi",
  "Haryana",
  "Punjab",
  "Rajasthan",
  "Uttar Pradesh",
  "Maharashtra",
  "Karnataka",
  "Tamil Nadu",
  "Gujarat",
  "West Bengal",
  "Telangana",
  "Kerala",
  "Madhya Pradesh",
];

export const employmentCategories: EmploymentCategory[] = ["Permanent", "Contract", "Consultant", "Intern", "Temporary", "Rent Candidate", "Other"];

export const employmentStatuses: EmploymentStatus[] = ["Active", "Probation", "On Notice", "On Leave", "Salary Hold", "Inactive", "Exited"];

export const attendanceStatuses: AttendanceStatus[] = [
  "Present",
  "Absent",
  "Paid Leave",
  "Unpaid Leave",
  "Half Day",
  "Weekly Off",
  "Holiday",
  "Work From Home",
  "Missing Punch",
];

/** Employee indices (0-based) seeded with a non-default employment category, for demo variety. */
const CATEGORY_OVERRIDES: Record<number, EmploymentCategory> = {
  8: "Contract", // Aditya Joshi
  17: "Contract", // Meera Bhatt
  21: "Rent Candidate", // Ishita Sen
  26: "Intern", // Farhan Ansari
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const today = todayISO;

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Converts a display label like "May 2026" (as used across payroll month pickers) to a "YYYY-MM" key. */
export function monthKeyFromLabel(label: string): string {
  const [name, year] = label.split(" ");
  const monthIndex = MONTH_NAMES.indexOf(name);
  if (monthIndex === -1 || !year) return CURRENT_PAYROLL_MONTH_KEY;
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/** Converts a "YYYY-MM" key back to a display label like "May 2026". */
export function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
}

function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function isWeekend(dateISO: string): boolean {
  return new Date(`${dateISO}T12:00:00`).getDay() === 0;
}

// ---------------------------------------------------------------------------
// Seed builders
// ---------------------------------------------------------------------------

function seedCategory(index: number): EmploymentCategory {
  return CATEGORY_OVERRIDES[index] ?? "Permanent";
}

function seedEmployeeList(): Employee[] {
  return seedEmployees.map((e, index) => ({ ...e, category: seedCategory(index) }));
}

function seedKYC(employee: Employee, index: number): EmployeeKYC {
  const category = employee.category ?? "Permanent";
  const rentCandidate = category === "Rent Candidate";
  const panMissing = index % 11 === 0;
  const aadhaarRejected = index % 9 === 0 && !panMissing;
  const bankPending = index % 13 === 0;

  return {
    employeeId: employee.id,
    panStatus: panMissing ? "Not Provided" : "Verified",
    aadhaarStatus: aadhaarRejected ? "Rejected" : "Verified",
    bankStatus: bankPending ? "Pending Verification" : "Verified",
    pfApplicable: !rentCandidate,
    esiApplicable: !rentCandidate,
    ptApplicable: true,
    tdsApplicable: true,
    taxRegime: index % 3 === 0 ? "Old Regime" : "New Regime",
    declarationStatus: index % 4 === 0 ? "Pending" : "Submitted",
    documents: [
      { name: "PAN Card", fileName: panMissing ? "" : `${employee.employeeCode}_pan.pdf`, status: panMissing ? "Not Provided" : "Verified" },
      { name: "Aadhaar", fileName: `${employee.employeeCode}_aadhaar.pdf`, status: aadhaarRejected ? "Rejected" : "Verified" },
      { name: "Cancelled Cheque", fileName: bankPending ? "" : `${employee.employeeCode}_cheque.pdf`, status: bankPending ? "Not Provided" : "Verified" },
      { name: "Bank Proof", fileName: bankPending ? "" : `${employee.employeeCode}_bank.pdf`, status: bankPending ? "Pending Verification" : "Verified" },
      { name: "Offer Letter", fileName: `${employee.employeeCode}_offer.pdf`, status: "Verified" },
    ],
  };
}

function seedSalaryProfile(employee: Employee): SalaryProfile {
  const gross = Math.round(employee.ctc / 12);
  const basic = Math.round(gross * 0.5);
  const hra = Math.round(gross * 0.2);
  const special = Math.max(0, gross - basic - hra);
  return {
    employeeId: employee.id,
    effectiveFrom: employee.joiningDate,
    structure: "SVS Employee Structure",
    basic,
    hra,
    special,
    conveyance: 0,
    other: 0,
    bonus: 0,
    variable: 0,
    loan: 0,
    advance: 0,
    otherDeduction: 0,
    employerOther: 0,
  };
}

function seedAttendanceForMonth(employees: Employee[], monthKey: string, throughDay?: number): DailyAttendanceRecord[] {
  const records: DailyAttendanceRecord[] = [];
  const lastDay = throughDay ?? daysInMonth(monthKey);
  employees.forEach((employee, index) => {
    for (let day = 1; day <= lastDay; day++) {
      const date = `${monthKey}-${String(day).padStart(2, "0")}`;
      let status: AttendanceStatus;
      let checkIn = "";
      let checkOut = "";
      let workHours = 0;
      let lateBy = 0;

      if (isWeekend(date)) {
        status = "Weekly Off";
      } else if (day === 15) {
        status = "Holiday";
      } else if (day === ((index % 24) + 2)) {
        status = "Unpaid Leave";
      } else if (day === ((index % 22) + 4)) {
        status = "Paid Leave";
      } else if (day === ((index % 19) + 6)) {
        status = "Absent";
      } else if (day === ((index % 17) + 8)) {
        status = "Half Day";
        checkIn = "09:45";
        checkOut = "14:10";
        workHours = 4.4;
      } else if (index % 7 === 3 && day === ((index % 15) + 3)) {
        status = "Work From Home";
        checkIn = "09:35";
        checkOut = "18:30";
        workHours = 8.9;
      } else if (index % 11 === 0 && date === todayISO()) {
        status = "Missing Punch";
        checkIn = "09:40";
      } else {
        status = "Present";
        lateBy = index % 6 === 0 ? 12 + (index % 20) : 0;
        checkIn = lateBy > 0 ? `09:${42 + (index % 10)}` : "09:2" + (index % 8);
        checkOut = "18:3" + (index % 6);
        workHours = 8 + ((index % 10) / 12);
      }

      records.push({
        id: `${employee.id}-${date}`,
        employeeId: employee.id,
        date,
        shift: "09:30 – 18:30",
        checkIn,
        checkOut,
        workHours: Number(workHours.toFixed(2)),
        status,
        leaveType: status === "Paid Leave" || status === "Unpaid Leave" ? status : "",
        overtime: index % 8 === 0 && status === "Present" ? 1.5 : 0,
        remarks: "",
        source: "Biometric",
      });
    }
  });
  return records;
}

function seedStatutoryConfig(): StatutoryConfiguration {
  return {
    employeePF: 12,
    employerPF: 12,
    pfLimit: 15000,
    epsApplicable: true,
    allowPFOverride: true,
    employeeESI: 0.75,
    employerESI: 3.25,
    esiLimit: 21000,
    allowESIOverride: true,
    tdsMode: "Fixed Percentage",
    tdsValue: 2,
    proration: "Calendar Days",
    customDays: 30,
    weeklyOffPaid: true,
    holidayPaid: true,
    paidLeaveIncluded: true,
    halfDayFactor: 0.5,
    rounding: "Round",
    states: indianStates.map((state) => ({
      state,
      professionalTax: ["Maharashtra", "Karnataka", "West Bengal", "Telangana", "Tamil Nadu", "Gujarat"].includes(state) ? 200 : 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface OperationsState {
  employees: Employee[];
  kyc: Record<string, EmployeeKYC>;
  salaries: Record<string, SalaryProfile>;
  revisions: SalaryRevision[];
  holds: SalaryHold[];
  attendance: DailyAttendanceRecord[];
  finalizedMonths: string[];
  periods: Record<string, PayrollPeriod>;
  statusHistory: StatusChangeRecord[];
  exits: Record<string, ExitRecord>;
  audit: AuditRecord[];
  uploads: UploadRecord[];
  role: Role;
  config: StatutoryConfiguration;

  setRole: (role: Role) => void;
  updateConfig: (patch: Partial<StatutoryConfiguration>) => void;
  updateStatePT: (state: string, professionalTax: number) => void;

  addEmployee: (employee: Employee) => void;
  updateEmployeeRecord: (id: string, patch: Partial<Employee>) => void;
  removeEmployee: (id: string) => void;
  bulkImportEmployees: (rows: Employee[]) => UploadRecord;

  updateEmployeeStatus: (employeeId: string, patch: { status: EmploymentStatus; effectiveDate: string; reason: string; remarks: string; exit?: ExitRecord }) => void;

  updateKYC: (employeeId: string, patch: Partial<EmployeeKYC>) => void;
  verifyDocument: (employeeId: string, docName: string) => void;
  uploadDocument: (employeeId: string, docName: string, fileName: string) => void;

  updateSalaryProfile: (employeeId: string, profile: SalaryProfile, changedBy?: string) => void;
  bulkUpdateSalary: (rows: { employeeId: string; profile: SalaryProfile }[]) => UploadRecord;
  holdSalary: (employeeId: string, month: string, reason: string, remarks: string) => void;
  releaseSalary: (employeeId: string, month: string, remarks: string) => void;

  upsertAttendance: (record: DailyAttendanceRecord, reason: string) => void;
  bulkUploadAttendance: (records: DailyAttendanceRecord[]) => UploadRecord;
  finalizeAttendance: (month: string) => void;
  unfinalizeAttendance: (month: string) => void;

  recordUpload: (record: UploadRecord) => void;
  addAudit: (entry: Omit<AuditRecord, "id" | "date" | "user">) => void;

  ensurePeriod: (month: string) => PayrollPeriod;
  validatePeriod: (month: string) => void;
  approvePeriod: (month: string) => void;
  lockPeriod: (month: string) => void;
  unlockPeriod: (month: string) => void;

  bulkAssign: (employeeIds: string[], patch: Partial<Employee>, label: string) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialEmployees = seedEmployeeList();
const initialAttendance = [
  ...seedAttendanceForMonth(initialEmployees, CURRENT_PAYROLL_MONTH_KEY),
  ...seedAttendanceForMonth(initialEmployees, todayISO().slice(0, 7), Number(todayISO().slice(8))),
];

export const useOperations = create<OperationsState>((set, get) => ({
  employees: initialEmployees,
  kyc: Object.fromEntries(initialEmployees.map((e, i) => [e.id, seedKYC(e, i)])),
  salaries: Object.fromEntries(initialEmployees.map((e) => [e.id, seedSalaryProfile(e)])),
  revisions: [],
  holds: [
    {
      id: "hold-seed-1",
      employeeId: initialEmployees[14].id,
      month: CURRENT_PAYROLL_MONTH_KEY,
      reason: "Pending documents",
      remarks: "Awaiting updated Form 16 before release.",
      heldBy: "Ritu Agarwal",
      heldOn: `${CURRENT_PAYROLL_MONTH_KEY}-24`,
      status: "Held",
    },
  ],
  attendance: initialAttendance,
  finalizedMonths: [],
  periods: {},
  statusHistory: [],
  exits: {},
  audit: [],
  uploads: [],
  role: "Super Admin",
  config: seedStatutoryConfig(),

  setRole: (role) => set({ role }),

  updateConfig: (patch) => {
    set((s) => ({ config: { ...s.config, ...patch } }));
    get().addAudit({ action: "Statutory Configuration Updated", previous: "", next: JSON.stringify(patch), remarks: "" });
  },

  updateStatePT: (state, professionalTax) => {
    set((s) => ({
      config: { ...s.config, states: s.config.states.map((sp) => (sp.state === state ? { ...sp, professionalTax } : sp)) },
    }));
  },

  addEmployee: (employee) => {
    set((s) => ({
      employees: [employee, ...s.employees],
      kyc: { ...s.kyc, [employee.id]: seedKYC(employee, s.employees.length) },
      salaries: { ...s.salaries, [employee.id]: seedSalaryProfile(employee) },
    }));
    get().addAudit({ action: "Employee Created", employeeId: employee.id, employeeName: employee.fullName, previous: "", next: employee.fullName, remarks: "" });
  },

  updateEmployeeRecord: (id, patch) => {
    set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  },

  removeEmployee: (id) => set((s) => ({ employees: s.employees.filter((e) => e.id !== id) })),

  bulkImportEmployees: (rows) => {
    set((s) => {
      const merged = [...s.employees];
      const kyc = { ...s.kyc };
      const salaries = { ...s.salaries };
      rows.forEach((row) => {
        merged.unshift(row);
        kyc[row.id] = seedKYC(row, merged.length);
        salaries[row.id] = seedSalaryProfile(row);
      });
      return { employees: merged, kyc, salaries };
    });
    const record: UploadRecord = {
      id: `up-emp-${Date.now()}`,
      kind: "Employee",
      fileName: "employee_bulk_import.xlsx",
      uploadedBy: get().role,
      uploadedOn: new Date().toLocaleString("en-IN"),
      totalRows: rows.length,
      validRows: rows.length,
      errorRows: 0,
      status: "Completed",
    };
    get().recordUpload(record);
    get().addAudit({ action: "Bulk Employee Import", previous: "", next: `${rows.length} employees imported`, remarks: "" });
    return record;
  },

  updateEmployeeStatus: (employeeId, patch) => {
    const employee = get().employees.find((e) => e.id === employeeId);
    if (!employee) return;
    const record: StatusChangeRecord = {
      id: `sc-${Date.now()}`,
      employeeId,
      previousStatus: employee.status as EmploymentStatus,
      newStatus: patch.status,
      effectiveDate: patch.effectiveDate,
      reason: patch.reason,
      remarks: patch.remarks,
      changedBy: get().role,
      changedOn: new Date().toLocaleString("en-IN"),
    };
    set((s) => ({
      employees: s.employees.map((e) => (e.id === employeeId ? { ...e, status: patch.status } : e)),
      statusHistory: [record, ...s.statusHistory],
      exits: patch.exit ? { ...s.exits, [employeeId]: patch.exit } : s.exits,
    }));
    get().addAudit({
      action: "Employee Status Changed",
      employeeId,
      employeeName: employee.fullName,
      previous: employee.status,
      next: patch.status,
      remarks: patch.remarks || patch.reason,
    });
  },

  updateKYC: (employeeId, patch) => {
    const before = get().kyc[employeeId];
    set((s) => ({ kyc: { ...s.kyc, [employeeId]: { ...s.kyc[employeeId], ...patch } } }));
    get().addAudit({ action: "KYC Updated", employeeId, previous: JSON.stringify(before), next: JSON.stringify(patch), remarks: "" });
  },

  verifyDocument: (employeeId, docName) => {
    set((s) => ({
      kyc: {
        ...s.kyc,
        [employeeId]: {
          ...s.kyc[employeeId],
          documents: s.kyc[employeeId].documents.map((d) => (d.name === docName ? { ...d, status: "Verified" as const } : d)),
        },
      },
    }));
  },

  uploadDocument: (employeeId, docName, fileName) => {
    set((s) => ({
      kyc: {
        ...s.kyc,
        [employeeId]: {
          ...s.kyc[employeeId],
          documents: s.kyc[employeeId].documents.map((d) =>
            d.name === docName ? { ...d, fileName, status: "Pending Verification" as const, uploadedOn: new Date().toLocaleDateString("en-IN") } : d
          ),
        },
      },
    }));
  },

  updateSalaryProfile: (employeeId, profile, changedBy) => {
    const employee = get().employees.find((e) => e.id === employeeId);
    const previous = get().salaries[employeeId];
    const previousGross = previous ? grossOf(previous) : 0;
    const revisedGross = grossOf(profile);
    if (previous && previousGross !== revisedGross) {
      const revision: SalaryRevision = {
        id: `rev-${Date.now()}`,
        employeeId,
        previousGross,
        revisedGross,
        effectiveFrom: profile.effectiveFrom,
        revisionPercent: previousGross ? Number((((revisedGross - previousGross) / previousGross) * 100).toFixed(1)) : 0,
        changedBy: changedBy ?? get().role,
        changedOn: new Date().toLocaleString("en-IN"),
        profile,
      };
      set((s) => ({ revisions: [revision, ...s.revisions] }));
    }
    set((s) => ({ salaries: { ...s.salaries, [employeeId]: profile } }));
    get().addAudit({
      action: "Salary Revised",
      employeeId,
      employeeName: employee?.fullName,
      previous: formatCompact(previousGross),
      next: formatCompact(revisedGross),
      remarks: profile.remarks ?? "",
    });
  },

  bulkUpdateSalary: (rows) => {
    rows.forEach(({ employeeId, profile }) => get().updateSalaryProfile(employeeId, profile, "Bulk Upload"));
    const record: UploadRecord = {
      id: `up-sal-${Date.now()}`,
      kind: "Salary",
      fileName: "salary_bulk_update.xlsx",
      uploadedBy: get().role,
      uploadedOn: new Date().toLocaleString("en-IN"),
      totalRows: rows.length,
      validRows: rows.length,
      errorRows: 0,
      status: "Completed",
    };
    get().recordUpload(record);
    return record;
  },

  holdSalary: (employeeId, month, reason, remarks) => {
    const employee = get().employees.find((e) => e.id === employeeId);
    const hold: SalaryHold = {
      id: `hold-${Date.now()}`,
      employeeId,
      month,
      reason,
      remarks,
      heldBy: get().role,
      heldOn: new Date().toLocaleString("en-IN"),
      status: "Held",
    };
    set((s) => ({ holds: [hold, ...s.holds] }));
    get().addAudit({ action: "Salary Put on Hold", employeeId, employeeName: employee?.fullName, previous: "Normal", next: `Held — ${reason}`, remarks });
  },

  releaseSalary: (employeeId, month, remarks) => {
    const employee = get().employees.find((e) => e.id === employeeId);
    set((s) => ({
      holds: s.holds.map((h) =>
        h.employeeId === employeeId && h.month === month && h.status === "Held"
          ? { ...h, status: "Released" as const, releasedBy: get().role, releasedOn: new Date().toLocaleString("en-IN"), releaseRemarks: remarks }
          : h
      ),
    }));
    get().addAudit({ action: "Salary Released", employeeId, employeeName: employee?.fullName, previous: "Held", next: "Released", remarks });
  },

  upsertAttendance: (record, reason) => {
    const stamped: DailyAttendanceRecord = {
      ...record,
      modifiedBy: get().role,
      modifiedOn: new Date().toLocaleString("en-IN"),
      changeReason: reason,
    };
    set((s) => {
      const idx = s.attendance.findIndex((a) => a.id === record.id);
      if (idx === -1) return { attendance: [...s.attendance, stamped] };
      const next = [...s.attendance];
      next[idx] = stamped;
      return { attendance: next };
    });
    const employee = get().employees.find((e) => e.id === record.employeeId);
    get().addAudit({
      action: "Attendance Modified",
      employeeId: record.employeeId,
      employeeName: employee?.fullName,
      previous: record.date,
      next: `${record.status}${record.checkIn ? ` · ${record.checkIn}-${record.checkOut}` : ""}`,
      remarks: reason,
    });
  },

  bulkUploadAttendance: (records) => {
    set((s) => {
      const byId = new Map(s.attendance.map((a) => [a.id, a]));
      records.forEach((r) => byId.set(r.id, r));
      return { attendance: Array.from(byId.values()) };
    });
    const record: UploadRecord = {
      id: `up-att-${Date.now()}`,
      kind: "Attendance",
      fileName: "attendance_bulk_upload.xlsx",
      uploadedBy: get().role,
      uploadedOn: new Date().toLocaleString("en-IN"),
      totalRows: records.length,
      validRows: records.length,
      errorRows: 0,
      status: "Completed",
    };
    get().recordUpload(record);
    return record;
  },

  finalizeAttendance: (month) => {
    set((s) => ({ finalizedMonths: Array.from(new Set([...s.finalizedMonths, month])) }));
    get().addAudit({ action: "Attendance Finalized", previous: "Open", next: "Locked", remarks: `Payroll month ${month}` });
  },

  unfinalizeAttendance: (month) => set((s) => ({ finalizedMonths: s.finalizedMonths.filter((m) => m !== month) })),

  recordUpload: (record) => set((s) => ({ uploads: [record, ...s.uploads] })),

  addAudit: (entry) =>
    set((s) => ({
      audit: [{ id: `audit-${Date.now()}-${Math.round(performance.now())}`, date: new Date().toLocaleString("en-IN"), user: s.role, ...entry }, ...s.audit],
    })),

  ensurePeriod: (month) => {
    const existing = get().periods[month];
    if (existing) return existing;
    const created: PayrollPeriod = {
      month,
      status: "Draft",
      attendanceFinalized: get().finalizedMonths.includes(month),
      validated: false,
      approved: false,
      published: false,
      disbursed: false,
      posted: false,
    };
    set((s) => ({ periods: { ...s.periods, [month]: created } }));
    return created;
  },

  validatePeriod: (month) => {
    get().ensurePeriod(month);
    set((s) => ({ periods: { ...s.periods, [month]: { ...s.periods[month], validated: true, status: "Processed" } } }));
  },

  approvePeriod: (month) => {
    get().ensurePeriod(month);
    set((s) => ({ periods: { ...s.periods, [month]: { ...s.periods[month], approved: true, status: "Approved" } } }));
    get().addAudit({ action: "Payroll Approved", previous: "Processed", next: "Approved", remarks: `Payroll month ${month}` });
  },

  lockPeriod: (month) => {
    set((s) => ({
      periods: { ...s.periods, [month]: { ...s.periods[month], status: "Locked", lockedBy: get().role, lockedOn: new Date().toLocaleString("en-IN") } },
    }));
    get().addAudit({ action: "Payroll Locked", previous: "Approved", next: "Locked", remarks: `Payroll month ${month}` });
  },

  unlockPeriod: (month) => {
    set((s) => ({ periods: { ...s.periods, [month]: { ...s.periods[month], status: "Approved" } } }));
    get().addAudit({ action: "Payroll Unlocked", previous: "Locked", next: "Approved", remarks: `Payroll month ${month}` });
  },

  bulkAssign: (employeeIds, patch, label) => {
    set((s) => ({ employees: s.employees.map((e) => (employeeIds.includes(e.id) ? { ...e, ...patch } : e)) }));
    get().addAudit({ action: label, previous: "", next: `${employeeIds.length} employees updated`, remarks: "" });
  },
}));

function formatCompact(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

// ---------------------------------------------------------------------------
// Pure calculation helpers (used by services; also usable directly by pages)
// ---------------------------------------------------------------------------

export function grossOf(p: SalaryProfile): number {
  return p.basic + p.hra + p.special + p.conveyance + p.other + p.bonus + p.variable;
}

export function attendanceSummaryFor(employeeId: string, month: string): AttendanceSummary {
  const { attendance, config } = useOperations.getState();
  const records = attendance.filter((a) => a.employeeId === employeeId && a.date.startsWith(month));
  const payrollDays = daysInMonth(month);

  const count = (status: AttendanceStatus) => records.filter((r) => r.status === status).length;
  const present = count("Present") + count("Work From Home");
  const paidLeave = count("Paid Leave");
  const unpaidLeave = count("Unpaid Leave");
  const absent = count("Absent");
  const halfDays = count("Half Day");
  const weeklyOff = count("Weekly Off");
  const holidays = count("Holiday");
  const missing = count("Missing Punch");

  const payableDays =
    present + paidLeave + halfDays * config.halfDayFactor + (config.weeklyOffPaid ? weeklyOff : 0) + (config.holidayPaid ? holidays : 0);
  const lopDays = unpaidLeave + absent + missing + halfDays * (1 - config.halfDayFactor);

  return { payrollDays, present, paidLeave, unpaidLeave, absent, halfDays, weeklyOff, holidays, missing, payableDays, lopDays };
}

function payrollDivisor(month: string): number {
  const { config } = useOperations.getState();
  switch (config.proration) {
    case "Fixed 30 Days":
      return 30;
    case "Custom Payroll Days":
      return config.customDays;
    case "Working Days":
      return daysInMonth(month) - useOperations.getState().attendance.filter((a) => a.date.startsWith(month) && a.status === "Weekly Off").length / 4;
    case "Calendar Days":
    case "Actual Days in Month":
    default:
      return daysInMonth(month);
  }
}

function roundLop(value: number, method: StatutoryConfiguration["rounding"]): number {
  if (method === "Ceil") return Math.ceil(value);
  return Math.round(value);
}

export function checkDuplicateUAN(uan: string, excludeEmployeeId?: string): Employee | undefined {
  if (!uan.trim()) return undefined;
  return useOperations.getState().employees.find((e) => e.id !== excludeEmployeeId && e.statutory.uan && e.statutory.uan.replace(/\s/g, "") === uan.replace(/\s/g, ""));
}

export function activeHoldFor(employeeId: string, month: string): SalaryHold | undefined {
  return useOperations.getState().holds.find((h) => h.employeeId === employeeId && h.month === month && h.status === "Held");
}

export function calculatePayrollRow(employeeId: string, month: string): PayrollCalculation | undefined {
  const state = useOperations.getState();
  const employee = state.employees.find((e) => e.id === employeeId);
  const salary = state.salaries[employeeId];
  const kyc = state.kyc[employeeId];
  if (!employee || !salary) return undefined;

  const attendance = attendanceSummaryFor(employeeId, month);
  const grossEarnings = grossOf(salary);
  const divisor = payrollDivisor(month) || 1;
  const perDay = grossEarnings / divisor;
  const lopDeduction = roundLop(perDay * attendance.lopDays, state.config.rounding);
  const adjustedGross = Math.max(0, grossEarnings - lopDeduction);

  const pfWageBase = Math.min(salary.basic, state.config.pfLimit);
  const pf = kyc?.pfApplicable ? Math.round((pfWageBase * state.config.employeePF) / 100) : 0;
  const employerPF = kyc?.pfApplicable ? Math.round((pfWageBase * state.config.employerPF) / 100) : 0;

  const esiEligible = kyc?.esiApplicable && adjustedGross <= state.config.esiLimit;
  const esi = esiEligible ? Math.round((adjustedGross * state.config.employeeESI) / 100) : 0;
  const employerESI = esiEligible ? Math.round((adjustedGross * state.config.employerESI) / 100) : 0;

  const stateConfig = state.config.states.find((s) => s.state === employee.state);
  const pt = kyc?.ptApplicable ? stateConfig?.professionalTax ?? 0 : 0;

  let tds = 0;
  if (kyc?.tdsApplicable) {
    if (state.config.tdsMode === "Fixed Amount") tds = state.config.tdsValue;
    else if (state.config.tdsMode === "Fixed Percentage") tds = Math.round((adjustedGross * state.config.tdsValue) / 100);
    // "Automatic Tax Calculation" intentionally left at 0 here — see comment below.
  }

  const otherDeductions = salary.loan + salary.advance + salary.otherDeduction;
  const totalDeductions = pf + esi + pt + tds + otherDeductions;
  const netPayable = adjustedGross - totalDeductions;
  const totalEmployerCost = adjustedGross + employerPF + employerESI + salary.employerOther;

  const hold = activeHoldFor(employeeId, month);
  const hasAttendance = state.attendance.some((a) => a.employeeId === employeeId && a.date.startsWith(month));

  let eligibility: PayrollEligibility = "Eligible";
  let status: PayrollCalculationStatus = "Ready";
  if (employee.status === "Exited") {
    eligibility = "Exited";
    status = "Error";
  } else if (hold) {
    eligibility = "Salary Hold";
    status = "Salary Hold";
  } else if (kyc && (kyc.panStatus === "Not Provided" || kyc.panStatus === "Rejected")) {
    eligibility = "Pending KYC";
    status = "KYC Issue";
  } else if (kyc && kyc.bankStatus !== "Verified") {
    eligibility = "Pending Bank Verification";
    status = "Bank Details Missing";
  } else if (!hasAttendance) {
    eligibility = "Attendance Pending";
    status = "Attendance Issue";
  } else if (netPayable < 0) {
    status = "Error";
  }

  return {
    employeeId,
    month,
    salary,
    attendance,
    grossEarnings,
    basic: salary.basic,
    hra: salary.hra,
    allowances: salary.special + salary.conveyance + salary.other,
    variablePay: salary.bonus + salary.variable,
    lopDeduction,
    adjustedGross,
    pf,
    esi,
    pt,
    tds,
    otherDeductions,
    totalDeductions,
    netPayable,
    employerPF,
    employerESI,
    employerOther: salary.employerOther,
    totalEmployerCost,
    eligibility,
    status,
  };
}

export function calculatePayrollForMonth(month: string): PayrollCalculation[] {
  const employees = useOperations.getState().employees;
  return employees.map((e) => calculatePayrollRow(e.id, month)).filter((r): r is PayrollCalculation => !!r);
}

export function validateEmployeeForPayroll(employeeId: string, month: string): PayrollValidationIssue[] {
  const state = useOperations.getState();
  const employee = state.employees.find((e) => e.id === employeeId);
  const kyc = state.kyc[employeeId];
  const salary = state.salaries[employeeId];
  if (!employee) return [];

  const issues: PayrollValidationIssue[] = [];
  const push = (check: string, severity: ValidationSeverity, message: string) => issues.push({ employeeId, check, severity, message });

  push("Employee Status", employee.status === "Exited" ? "Warning" : "Passed", employee.status === "Exited" ? "Employee has exited — confirm final settlement." : "Active employee.");
  push("Attendance Finalized", state.finalizedMonths.includes(month) ? "Passed" : "Blocking Error", state.finalizedMonths.includes(month) ? "Attendance finalized for this period." : "Attendance has not been finalized for this payroll month.");
  push("Salary Assigned", salary ? "Passed" : "Blocking Error", salary ? "Salary profile assigned." : "No salary profile assigned to this employee.");
  push("Salary Structure Assigned", salary?.structure ? "Passed" : "Warning", salary?.structure ? `Using ${salary.structure}.` : "No salary structure linked.");
  push("Bank Details Available", kyc?.bankStatus === "Verified" ? "Passed" : "Blocking Error", kyc?.bankStatus === "Verified" ? "Bank details verified." : "Bank details missing or unverified.");
  push("PAN Available", kyc && kyc.panStatus !== "Not Provided" ? "Passed" : "Warning", kyc && kyc.panStatus !== "Not Provided" ? `PAN status: ${kyc.panStatus}.` : "PAN not provided.");

  const duplicate = employee.statutory.uan ? checkDuplicateUAN(employee.statutory.uan, employee.id) : undefined;
  push("UAN Duplicate", duplicate ? "Blocking Error" : "Passed", duplicate ? `UAN already exists for ${duplicate.employeeCode} — ${duplicate.fullName}.` : "UAN is unique.");

  push("PF Configuration", "Passed", kyc?.pfApplicable ? "PF applicable." : "PF not applicable for this employee.");
  push("ESI Configuration", "Passed", kyc?.esiApplicable ? "ESI applicable." : "ESI not applicable for this employee.");
  push("KYC Completion", kyc && kyc.panStatus === "Verified" && kyc.aadhaarStatus === "Verified" ? "Passed" : "Warning", kyc && kyc.panStatus === "Verified" && kyc.aadhaarStatus === "Verified" ? "KYC complete." : "KYC verification incomplete.");

  const hold = activeHoldFor(employeeId, month);
  push("Salary Hold", hold ? "Warning" : "Passed", hold ? `Salary on hold — ${hold.reason}.` : "No active salary hold.");
  push("Exit Date", employee.status === "Exited" && state.exits[employeeId] ? "Warning" : "Passed", employee.status === "Exited" && state.exits[employeeId] ? `Last working date ${state.exits[employeeId].lastWorkingDate}.` : "N/A");

  return issues;
}

export function validatePayrollForMonth(month: string): PayrollValidationIssue[] {
  const employees = useOperations.getState().employees;
  return employees.flatMap((e) => validateEmployeeForPayroll(e.id, month));
}

export function payrollExceptionsForMonth(month: string): PayrollException[] {
  const state = useOperations.getState();
  const exceptions: PayrollException[] = [];
  state.employees.forEach((employee) => {
    const kyc = state.kyc[employee.id];
    const salary = state.salaries[employee.id];
    const row = calculatePayrollRow(employee.id, month);
    const push = (type: PayrollExceptionType, detail: string) => exceptions.push({ employeeId: employee.id, type, detail });

    if (kyc && kyc.bankStatus !== "Verified") push("Missing Bank Details", "Bank details not verified.");
    if (kyc && kyc.panStatus === "Not Provided") push("Missing PAN", "PAN not provided.");
    if (employee.statutory.uan && checkDuplicateUAN(employee.statutory.uan, employee.id)) push("Duplicate UAN", "UAN matches another employee.");
    if (!salary) push("No Salary Assigned", "No salary profile found.");
    if (!state.attendance.some((a) => a.employeeId === employee.id && a.date.startsWith(month))) push("Attendance Missing", "No attendance records for this month.");
    if (row && row.netPayable < 0) push("Negative Net Pay", "Deductions exceed gross earnings.");
    if (activeHoldFor(employee.id, month)) push("Salary on Hold", "Salary is currently on hold.");
    if (employee.status === "Exited" && state.exits[employee.id]?.effectiveDate.startsWith(month)) push("Exited During Month", "Employee exited during this payroll month.");
  });
  return exceptions;
}

export function payrollExceptionCountsForMonth(month: string): Record<PayrollExceptionType, number> {
  const exceptions = payrollExceptionsForMonth(month);
  const counts = {} as Record<PayrollExceptionType, number>;
  exceptions.forEach((e) => {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  });
  return counts;
}

/**
 * NOTE FOR BACKEND INTEGRATION:
 * Final statutory calculation (PF, ESI, Professional Tax, TDS) must ultimately
 * be provided by the payroll backend/configuration based on applicable Indian
 * labour law, wage limits, employee category, state and income-tax rules
 * (including slab-based/automatic TDS computation, which is intentionally
 * left at ₹0 here under "Automatic Tax Calculation" mode). Everything in this
 * file is a frontend approximation for demo purposes only.
 */
export const STATUTORY_CALCULATION_DISCLAIMER =
  "Final statutory calculation must be provided by the payroll backend/configuration based on applicable Indian laws, wage limits, employee category, state and tax rules.";
