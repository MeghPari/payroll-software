import type { Role } from "@/types/operations";

/**
 * Display labels for the six roles. Runtime permissions come from the verified
 * session; API authorization and database RLS/RPC permissions enforce access.
 */
export const roles: Role[] = ["Super Admin", "HR Admin", "Payroll Admin", "Finance", "Manager", "Employee"];

export const permissions: Record<Role, readonly string[]> = {
  "Super Admin": [
    "Employee Management",
    "Attendance",
    "Leave",
    "Salary",
    "Payroll",
    "Approve Payroll",
    "Unlock Payroll",
    "Payslips",
    "Disbursement",
    "Accounting",
    "Reports",
    "Settings",
  ],
  "HR Admin": ["Employee Management", "Attendance", "Leave"],
  "Payroll Admin": ["Salary", "Payroll", "Approve Payroll", "Payslips"],
  Finance: ["Disbursement", "Accounting", "Reports"],
  Manager: ["Team Attendance", "Leave Approvals"],
  Employee: ["Own Profile", "Own Payslip", "Own Attendance", "Own Leave"],
};

export function can(role: Role, permission: string): boolean {
  return permissions[role].includes(permission);
}
