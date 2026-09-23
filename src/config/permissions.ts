import type { Role } from "@/types/operations";

/**
 * Centralized permission definitions for the six payroll-system roles.
 * Backend authorization is not implemented yet — this exists so a real
 * authorization layer can be wired in later without touching UI components,
 * and so the frontend can demonstrate role-appropriate navigation/visibility.
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
