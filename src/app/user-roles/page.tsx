"use client";

import { useState } from "react";
import { Plus, ShieldCheck, UserCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roles as roleNames, permissions } from "@/config/permissions";
import { useOperations } from "@/store/operations-store";
import type { Role } from "@/types";
import { toast } from "sonner";

const roles = [
  { id: "role-1", name: "Admin", description: "Full access to all modules including settings and user management.", users: 2, permissions: ["Payroll", "HR", "Accounting", "Settings"] },
  { id: "role-2", name: "HR Manager", description: "Manage employees, attendance, leave and salary structures.", users: 4, permissions: ["Employees", "Attendance", "Salary Structures"] },
  { id: "role-3", name: "Finance Manager", description: "Full access to accounting, invoices and financial reports.", users: 3, permissions: ["Accounting", "Invoices", "Reports"] },
  { id: "role-4", name: "Payroll Executive", description: "Run payroll, generate payslips and view payroll reports.", users: 3, permissions: ["Payroll Run", "Payslips", "Payroll Reports"] },
  { id: "role-5", name: "Employee", description: "View own profile, payslips and apply for leave.", users: 144, permissions: ["My Profile", "My Payslips", "Leave"] },
];

const users = [
  { id: "u1", name: "Admin User", email: "admin@acme.com", role: "Admin", status: "Active" },
  { id: "u2", name: "Sanjana Rao", email: "sanjana.rao@acme.com", role: "HR Manager", status: "Active" },
  { id: "u3", name: "Ritu Agarwal", email: "ritu.agarwal@acme.com", role: "Finance Manager", status: "Active" },
  { id: "u4", name: "Tanvi Shah", email: "tanvi.shah@acme.com", role: "Payroll Executive", status: "Active" },
];

const allModules = Array.from(new Set(roleNames.flatMap((r) => permissions[r])));

export default function UserRolesPage() {
  const activeRole = useOperations((s) => s.role);
  const setRole = useOperations((s) => s.setRole);
  const [pendingRole, setPendingRole] = useState<Role>(activeRole);

  return (
    <div>
      <PageHeader
        title="User Roles"
        subtitle="Define roles and manage user access across the platform."
        actions={
          <Button className="gap-1.5" onClick={() => toast.info("Create Role — form coming soon")}>
            <Plus className="h-4 w-4" /> Create Role
          </Button>
        }
      />

      <SectionCard title="Active Demo Role" subtitle="Switches the role attributed to actions you take in this session (e.g. audit trail entries). No backend authorization is enforced yet." className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <UserCircle2 className="h-5 w-5 text-muted-foreground" />
          <Select value={pendingRole} onValueChange={(v) => v && setPendingRole(v as Role)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleNames.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={pendingRole === activeRole}
            onClick={() => {
              setRole(pendingRole);
              toast.success(`Active role switched to ${pendingRole}`);
            }}
          >
            Apply
          </Button>
          <span className="text-xs text-muted-foreground">
            Currently acting as <span className="font-medium text-foreground">{activeRole}</span>
          </span>
        </div>
      </SectionCard>

      <SectionCard title="Permission Matrix" subtitle="Centralized module access per role." className="mb-5" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Module</th>
                {roleNames.map((r) => (
                  <th key={r} className="px-3 py-2.5 text-center">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allModules.map((module) => (
                <tr key={module}>
                  <td className="px-4 py-2 text-muted-foreground">{module}</td>
                  {roleNames.map((r) => (
                    <td key={r} className="px-3 py-2 text-center">
                      {permissions[r].includes(module) ? <span className="text-success">●</span> : <span className="text-muted-foreground/30">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => (
          <SectionCard key={r.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-purple">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{r.name}</h3>
                  <p className="text-xs text-muted-foreground">{r.users} users</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{r.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.permissions.map((p) => (
                <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {p}
                </span>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>

      <SectionCard title="Users" subtitle="Assigned roles for platform users" className="mt-5" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <EmployeeAvatar name={u.name} size="sm" />
                      <div>
                        <p className="font-medium text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
