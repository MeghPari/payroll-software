import type { AttendanceRecord, AttendanceRowStatus } from "@/types";
import { employees } from "./employees";

export const CURRENT_PAYROLL_MONTH = "May 2026";
export const CURRENT_PAYROLL_MONTH_KEY = "2026-05";

function statusFor(index: number): AttendanceRowStatus {
  if (index % 11 === 4) return "On Leave";
  if (index % 13 === 7) return "Partial Day";
  if (index % 17 === 2) return "Absent";
  return "Present";
}

export const attendanceRecords: AttendanceRecord[] = employees.map((emp, index) => {
  const presentDays = 26 - (index % 6);
  const paidLeave = index % 4 === 0 ? 2 : index % 3 === 0 ? 1 : 0;
  const unpaidLeave = index % 9 === 0 ? 2 : index % 6 === 0 ? 1 : 0;
  const overtimeHours = Number(((index % 8) * 0.75).toFixed(1));
  const lopDays = unpaidLeave > 0 ? Math.min(1, unpaidLeave) : 0;
  return {
    id: `att-${emp.id}`,
    employeeId: emp.id,
    month: CURRENT_PAYROLL_MONTH_KEY,
    presentDays,
    paidLeave,
    unpaidLeave,
    overtimeHours,
    lopDays,
    finalPayableDays: presentDays + paidLeave,
    status: statusFor(index),
  };
});

export const attendanceSummary = {
  totalEmployees: employees.length,
  presentDays: attendanceRecords.reduce((sum, r) => sum + r.presentDays, 0),
  paidLeave: attendanceRecords.reduce((sum, r) => sum + r.paidLeave, 0),
  unpaidLeave: attendanceRecords.reduce((sum, r) => sum + r.unpaidLeave, 0),
  lopDays: attendanceRecords.reduce((sum, r) => sum + r.lopDays, 0),
};
