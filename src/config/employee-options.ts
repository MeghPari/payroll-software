import type {EmploymentCategory} from '@/types/employee';
import type {EmploymentStatus,AttendanceStatus} from '@/types/operations';

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

