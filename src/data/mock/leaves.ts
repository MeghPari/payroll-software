import type { LeaveBalance, LeaveRequest, LeaveType, UploadHistoryRecord } from "@/types";
import { employees } from "./employees";

const leaveTypes: LeaveType[] = ["Casual Leave", "Sick Leave", "Earned Leave", "Maternity Leave", "Unpaid Leave"];
const reasons = [
  "Personal work",
  "Fever and cold",
  "Family function",
  "Medical appointment",
  "Travel plans",
  "Not feeling well",
  "Personal emergency",
  "Relocation",
];

export const leaveRequests: LeaveRequest[] = employees.slice(0, 8).map((emp, index) => {
  const from = new Date(2026, 5, 3 + index);
  const days = (index % 3) + 1;
  const to = new Date(from);
  to.setDate(to.getDate() + days - 1);
  return {
    id: `leave-${index + 1}`,
    employeeId: emp.id,
    leaveType: leaveTypes[index % leaveTypes.length],
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    days,
    reason: reasons[index % reasons.length],
    appliedOn: "2026-05-31",
    status: index < 2 ? "Pending" : index % 5 === 0 ? "Rejected" : "Pending",
  };
});

export const leaveBalances: LeaveBalance[] = employees.map((emp, index) => ({
  employeeId: emp.id,
  casualLeave: { total: 12, used: index % 7 },
  sickLeave: { total: 8, used: index % 4 },
  earnedLeave: { total: 15, used: index % 6 },
}));

export const uploadHistory: UploadHistoryRecord[] = [
  { id: "up-1", fileName: "attendance_may_2026.csv", uploadedBy: "Admin", uploadedOn: "2026-05-31 09:12 AM", recordsProcessed: 156, status: "Completed" },
  { id: "up-2", fileName: "attendance_april_2026.csv", uploadedBy: "Admin", uploadedOn: "2026-04-30 10:05 AM", recordsProcessed: 151, status: "Completed" },
  { id: "up-3", fileName: "biometric_export_mar.csv", uploadedBy: "Priya Sharma", uploadedOn: "2026-03-31 06:40 PM", recordsProcessed: 148, status: "Completed" },
  { id: "up-4", fileName: "attendance_correction.csv", uploadedBy: "Admin", uploadedOn: "2026-05-20 02:15 PM", recordsProcessed: 6, status: "Failed" },
];
