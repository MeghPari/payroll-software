import { attendanceRecords, attendanceSummary, CURRENT_PAYROLL_MONTH_KEY } from "@/data/mock/attendance";
import { leaveRequests as mockLeaveRequests, leaveBalances, uploadHistory } from "@/data/mock/leaves";
import { mockDelay } from "@/lib/async";
import type { AttendanceRecord, LeaveRequest, LeaveRequestStatus } from "@/types";

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
