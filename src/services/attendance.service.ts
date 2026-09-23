import { attendanceRecords, attendanceSummary, CURRENT_PAYROLL_MONTH_KEY } from "@/data/mock/attendance";
import { leaveRequests as mockLeaveRequests, leaveBalances, uploadHistory } from "@/data/mock/leaves";
import { mockDelay } from "@/lib/async";
import { attendanceStatuses, attendanceSummaryFor, today, useOperations } from "@/store/operations-store";
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
  DailyAttendanceRecord,
  ImportRowResult,
  ImportRowStatus,
  LeaveRequest,
  LeaveRequestStatus,
  UploadRecord,
} from "@/types";

const leaveStore: LeaveRequest[] = [...mockLeaveRequests];

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getAttendance(month: string = CURRENT_PAYROLL_MONTH_KEY): Promise<AttendanceRecord[]> {
  return mockDelay(attendanceRecords.filter((r) => r.month === month));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getAttendanceSummary() {
  return mockDelay(attendanceSummary);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getLeaveRequests(): Promise<LeaveRequest[]> {
  return mockDelay([...leaveStore]);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function updateLeaveRequestStatus(id: string, status: LeaveRequestStatus): Promise<LeaveRequest | undefined> {
  const index = leaveStore.findIndex((r) => r.id === id);
  if (index === -1) return mockDelay(undefined);
  leaveStore[index] = { ...leaveStore[index], status };
  return mockDelay(leaveStore[index]);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getLeaveBalances() {
  return mockDelay(leaveBalances);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getUploadHistory() {
  return mockDelay(uploadHistory);
}

// ---------------------------------------------------------------------------
// Daily attendance (Today's Attendance / Attendance Register)
// ---------------------------------------------------------------------------

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getDailyAttendance(date: string = today()): Promise<DailyAttendanceRecord[]> {
  return mockDelay(useOperations.getState().attendance.filter((a) => a.date === date));
}

export interface TodayAttendanceCounts {
  total: number;
  present: number;
  absent: number;
  onLeave: number;
  halfDay: number;
  weeklyOff: number;
  late: number;
  missingPunch: number;
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getTodayAttendanceSummary(date: string = today()): Promise<TodayAttendanceCounts> {
  const records = useOperations.getState().attendance.filter((a) => a.date === date);
  const total = useOperations.getState().employees.length;
  const present = records.filter((r) => r.status === "Present" || r.status === "Work From Home").length;
  const absent = records.filter((r) => r.status === "Absent").length;
  const onLeave = records.filter((r) => r.status === "Paid Leave" || r.status === "Unpaid Leave").length;
  const halfDay = records.filter((r) => r.status === "Half Day").length;
  const weeklyOff = records.filter((r) => r.status === "Weekly Off" || r.status === "Holiday").length;
  const missingPunch = records.filter((r) => r.status === "Missing Punch").length;
  const late = records.filter((r) => r.status === "Present" && lateMinutes(r.checkIn) > 0).length;
  return mockDelay({ total, present, absent, onLeave, halfDay, weeklyOff, late, missingPunch });
}

export function lateMinutes(checkIn: string): number {
  if (!checkIn) return 0;
  const [h, m] = checkIn.split(":").map(Number);
  const minutes = h * 60 + m;
  const shiftStart = 9 * 60 + 30;
  return Math.max(0, minutes - shiftStart);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function updateAttendance(record: DailyAttendanceRecord, reason: string): Promise<DailyAttendanceRecord> {
  useOperations.getState().upsertAttendance(record, reason);
  return mockDelay(record, 700);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getAttendanceChangeHistory(employeeId?: string) {
  const entries = useOperations.getState().audit.filter((a) => a.action === "Attendance Modified" && (!employeeId || a.employeeId === employeeId));
  return mockDelay(entries);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function finalizeAttendance(month: string): Promise<void> {
  useOperations.getState().finalizeAttendance(month);
  return mockDelay(undefined, 1000);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function isAttendanceFinalized(month: string): Promise<boolean> {
  return mockDelay(useOperations.getState().finalizedMonths.includes(month));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function calculateAttendanceSummary(employeeId: string, month: string): Promise<AttendanceSummary> {
  return mockDelay(attendanceSummaryFor(employeeId, month));
}

export interface MonthlyRegisterRow {
  employeeId: string;
  summary: AttendanceSummary;
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getMonthlyAttendanceRegister(month: string): Promise<MonthlyRegisterRow[]> {
  const employees = useOperations.getState().employees;
  return mockDelay(employees.map((e) => ({ employeeId: e.id, summary: attendanceSummaryFor(e.id, month) })));
}

// ---------------------------------------------------------------------------
// Bulk attendance upload
// ---------------------------------------------------------------------------

export const ATTENDANCE_IMPORT_COLUMNS = [
  "Employee ID",
  "Employee Name",
  "Date",
  "Shift",
  "Check-In",
  "Check-Out",
  "Work Hours",
  "Attendance Status",
  "Leave Type",
  "Overtime",
  "Remarks",
] as const;

export interface AttendanceImportRow {
  employeeId: string;
  date: string;
  shift: string;
  checkIn: string;
  checkOut: string;
  workHours: string;
  status: string;
  leaveType: string;
  overtime: string;
  remarks: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// TODO: Replace mock implementation with REST/GraphQL API.
export async function validateAttendanceImport(rows: AttendanceImportRow[]): Promise<ImportRowResult<AttendanceImportRow>[]> {
  const state = useOperations.getState();
  const seen = new Set<string>();

  const results = rows.map((row, index): ImportRowResult<AttendanceImportRow> => {
    const issues: string[] = [];
    let status: ImportRowStatus = "Valid";
    const employee = state.employees.find((e) => e.employeeCode === row.employeeId || e.id === row.employeeId);

    if (!row.employeeId.trim()) {
      issues.push("Missing Employee ID.");
      status = "Error";
    } else if (!employee) {
      issues.push("Unknown Employee.");
      status = "Error";
    }

    if (!DATE_RE.test(row.date)) {
      issues.push("Invalid Date.");
      status = "Error";
    } else if (row.date > today()) {
      issues.push("Future Date.");
      status = "Error";
    }

    if (row.checkIn && !TIME_RE.test(row.checkIn)) issues.push("Invalid Time (Check-In).");
    if (row.checkOut && !TIME_RE.test(row.checkOut)) issues.push("Invalid Time (Check-Out).");

    if (row.status && !attendanceStatuses.includes(row.status as AttendanceStatus)) {
      issues.push("Incorrect Leave Code.");
      status = status === "Error" ? status : "Warning";
    }

    const key = `${row.employeeId}-${row.date}`;
    if (seen.has(key)) {
      issues.push("Duplicate Attendance.");
      status = "Duplicate";
    }
    seen.add(key);

    if (status === "Valid" && issues.length > 0) status = "Warning";

    return { row: index + 1, data: row, status, issues };
  });

  return mockDelay(results, 900);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function uploadAttendance(rows: AttendanceImportRow[], month: string): Promise<UploadRecord> {
  const state = useOperations.getState();
  const records: DailyAttendanceRecord[] = rows
    .map((row) => {
      const employee = state.employees.find((e) => e.employeeCode === row.employeeId || e.id === row.employeeId);
      if (!employee || !DATE_RE.test(row.date)) return undefined;
      const record: DailyAttendanceRecord = {
        id: `${employee.id}-${row.date}`,
        employeeId: employee.id,
        date: row.date,
        shift: row.shift || "09:30 – 18:30",
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        workHours: Number(row.workHours) || 0,
        status: (attendanceStatuses.includes(row.status as AttendanceStatus) ? row.status : "Present") as AttendanceStatus,
        leaveType: row.leaveType,
        overtime: Number(row.overtime) || 0,
        remarks: row.remarks,
        source: "Bulk Upload",
      };
      return record;
    })
    .filter((r): r is DailyAttendanceRecord => !!r);

  const record = state.bulkUploadAttendance(records);
  void month;
  return mockDelay(record, 1200);
}
