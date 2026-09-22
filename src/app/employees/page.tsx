"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Column } from "@/components/shared/data-table";
import { Users, UserCheck, CalendarClock, UserPlus2, Plus, SlidersHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { FilterBar } from "@/components/shared/filter-bar";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { DataTable } from "@/components/shared/data-table";
import { TableActionMenu } from "@/components/shared/table-action-menu";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { EmployeeDetailDrawer } from "@/components/employees/employee-detail-drawer";
import { AddEmployeeDialog } from "@/components/employees/add-employee-dialog";
import { getEmployees } from "@/services/employee.service";
import { departments, workLocations } from "@/data/mock/employees";
import type { Employee, EmployeeStatus } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";

const statusOptions: (EmployeeStatus | "All")[] = ["All", "Active", "On Leave", "Notice Period", "Inactive"];

export default function EmployeesPage() {
  return (
    <Suspense fallback={null}>
      <EmployeesPageContent />
    </Suspense>
  );
}

function EmployeesPageContent() {
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [location, setLocation] = useState("All");
  const [status, setStatus] = useState("All");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(() => searchParams.get("add") === "1");

  useEffect(() => {
    getEmployees().then((data) => {
      setEmployees(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (search) {
        const q = search.toLowerCase();
        if (!e.fullName.toLowerCase().includes(q) && !e.employeeCode.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (department !== "All" && e.department !== department) return false;
      if (location !== "All" && e.workLocation !== location) return false;
      if (status !== "All" && e.status !== status) return false;
      return true;
    });
  }, [employees, search, department, location, status]);

  const kpis = useMemo(() => {
    const active = employees.filter((e) => e.status === "Active").length;
    const onLeave = employees.filter((e) => e.status === "On Leave").length;
    const joiningSoon = employees.filter((e) => new Date(e.joiningDate) > new Date("2026-04-01")).length;
    return { total: employees.length, active, onLeave, joiningSoon };
  }, [employees]);

  function openDrawer(employee: Employee) {
    setSelectedEmployee(employee);
    setDrawerOpen(true);
  }

  const columns: Column<Employee>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => row.fullName,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={row.original.fullName} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: "employeeCode", header: "Employee ID" },
    { accessorKey: "department", header: "Department" },
    { accessorKey: "designation", header: "Designation" },
    {
      accessorKey: "joiningDate",
      header: "Joining Date",
      cell: ({ getValue }) => format(new Date(getValue<string>()), "dd MMM yyyy"),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <TableActionMenu
          actions={[
            { label: "View Profile", icon: <Eye className="h-4 w-4" />, onClick: () => openDrawer(row.original) },
            { label: "Edit Employee", icon: <Pencil className="h-4 w-4" />, onClick: () => toast.info("Edit employee — coming soon") },
            {
              label: "Remove Employee",
              icon: <Trash2 className="h-4 w-4" />,
              destructive: true,
              onClick: () => toast.error(`${row.original.fullName} removal requires confirmation`),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage your organization's employees and their details."
        actions={
          <Button className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        }
      />

      {loading ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} tone="blue" label="Total Employees" value={String(kpis.total)} />
          <StatCard icon={UserCheck} tone="green" label="Active Employees" value={String(kpis.active)} helperText={`${((kpis.active / kpis.total) * 100 || 0).toFixed(1)}% of total`} />
          <StatCard icon={CalendarClock} tone="amber" label="On Leave" value={String(kpis.onLeave)} />
          <StatCard icon={UserPlus2} tone="purple" label="Joining Soon" value={String(kpis.joiningSoon)} />
        </div>
      )}

      <SectionCard className="mt-5" noPadding>
        <div className="border-b border-border p-4">
          <FilterBar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name, ID, email..." className="w-full sm:w-64" />
            <FilterSelect value={department} onChange={setDepartment} options={["All", ...departments]} placeholder="Department" ariaLabel="Filter by department" />
            <FilterSelect value={location} onChange={setLocation} options={["All", ...workLocations]} placeholder="Location" ariaLabel="Filter by location" />
            <FilterSelect value={status} onChange={setStatus} options={statusOptions} placeholder="Status" ariaLabel="Filter by status" />
            <Button variant="outline" className="gap-1.5">
              <SlidersHorizontal className="h-4 w-4" /> More Filters
            </Button>
            {(search || department !== "All" || location !== "All" || status !== "All") && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  setSearch("");
                  setDepartment("All");
                  setLocation("All");
                  setStatus("All");
                }}
              >
                Clear
              </Button>
            )}
          </FilterBar>
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} onRowClick={openDrawer} />
      </SectionCard>

      <EmployeeDetailDrawer employee={selectedEmployee} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <AddEmployeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(emp) => setEmployees((prev) => [emp, ...prev])}
      />
    </div>
  );
}
