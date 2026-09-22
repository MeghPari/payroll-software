export type AttendanceRowStatus = "Present" | "Partial Day" | "On Leave" | "Absent";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  month: string; // e.g. "2026-05"
  presentDays: number;
  paidLeave: number;
  unpaidLeave: number;
  overtimeHours: number;
  lopDays: number;
  finalPayableDays: number;
  status: AttendanceRowStatus;
}

export type LeaveType = "Casual Leave" | "Sick Leave" | "Earned Leave" | "Maternity Leave" | "Unpaid Leave";

export type LeaveRequestStatus = "Pending" | "Approved" | "Rejected";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  appliedOn: string;
  status: LeaveRequestStatus;
}

export interface LeaveBalance {
  employeeId: string;
  casualLeave: { total: number; used: number };
  sickLeave: { total: number; used: number };
  earnedLeave: { total: number; used: number };
}

export interface UploadHistoryRecord {
  id: string;
  fileName: string;
  uploadedBy: string;
  uploadedOn: string;
  recordsProcessed: number;
  status: "Completed" | "Failed" | "Processing";
}
