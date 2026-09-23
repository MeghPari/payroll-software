"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Column } from "@/components/shared/data-table";
import {
  Users,
  UserCheck,
  BellRing,
  Ban,
  UserX,
  Plus,
  Upload,
  SlidersHorizontal,
  Eye,
  Pencil,
  Trash2,
  ShieldAlert,
  Building2,
  MapPin,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
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
import { StateDistributionCard } from "@/components/shared/state-distribution-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeDetailDrawer } from "@/components/employees/employee-detail-drawer";
import { AddEmployeeDialog } from "@/components/employees/add-employee-dialog";
import { BulkUploadEmployeesDialog } from "@/components/employees/bulk-upload-employees-dialog";
import { BulkActionDialog } from "@/components/employees/bulk-action-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  bulkSetDepartment,
  bulkSetState,
  bulkSetStatutoryApplicability,
  bulkSetWorkLocation,
  getEmployees,
} from "@/services/employee.service";
import { departments, workLocations } from "@/data/mock/employees";
import { employmentStatuses, indianStates } from "@/store/operations-store";
import type { Employee, EmployeeStatus } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";

const statusOptions: (EmployeeStatus | "All")[] = ["All", ...employmentStatuses];

export default function EmployeesPage() {
  return (
    <Suspense fallback={null}>
      <EmployeesPageContent />
    </Suspense>
  );
}

function EmployeesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [location, setLocation] = useState("All");
  const [state, setState] = useState("All");
  const [status, setStatus] = useState(searchParams.get("status") ?? "All");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(() => searchParams.get("add") === "1");
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<null | "department" | "location" | "state">(null);
  const [pfConfirm, setPfConfirm] = useState<null | boolean>(null);
  const [esiConfirm, setEsiConfirm] = useState<null | boolean>(null);

  function refresh() {
    setLoading(true);
    getEmployees().then((data) => {
      setEmployees(data);
      setLoading(false);
    });
  }

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
      if (state !== "All" && e.state !== state) return false;
      if (status !== "All" && e.status !== status) return false;
      return true;
    });
  }, [employees, search, department, location, state, status]);

  const kpis = useMemo(() => {
    const count = (s: EmployeeStatus) => employees.filter((e) => e.status === s).length;
    return {
      total: employees.length,
      active: count("Active"),
      onNotice: count("On Notice"),
      salaryHold: count("Salary Hold"),
      exited: count("Exited"),
    };
  }, [employees]);

  function openDrawer(employee: Employee) {
    setSelectedEmployee(employee);
    setDrawerOpen(true);
  }

  async function applyBulk(kind: "department" | "location" | "state", value: string) {
    const ids = Array.from(selectedIds);
    if (kind === "department") await bulkSetDepartment(ids, value as Employee["department"]);
    if (kind === "location") await bulkSetWorkLocation(ids, value);
    if (kind === "state") await bulkSetState(ids, value);
    toast.success(`Updated ${ids.length} employee${ids.length === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
    refresh();
  }

  async function applyPFESI(field: "pfApplicable" | "esiApplicable", value: boolean) {
    const ids = Array.from(selectedIds);
    await bulkSetStatutoryApplicability(ids, field, value);
    toast.success(`${field === "pfApplicable" ? "PF" : "ESI"} ${value ? "enabled" : "disabled"} for ${ids.length} employee${ids.length === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
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
    { accessorKey: "state", header: "State" },
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
            { label: "View Profile", icon: <Eye className="h-4 w-4" />, onClick: () => router.push(`/employees/${row.original.id}`) },
            { label: "Quick View", icon: <Eye className="h-4 w-4" />, onClick: () => openDrawer(row.original) },
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
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => setBulkUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Bulk Upload
            </Button>
            <Button className="gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Employee
            </Button>
          </>
        }
      />

      {loading ? (
        <CardGridSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={Users} tone="blue" label="Total Employees" value={String(kpis.total)} />
          <StatCard icon={UserCheck} tone="green" label="Active Employees" value={String(kpis.active)} helperText={`${((kpis.active / kpis.total) * 100 || 0).toFixed(0)}% of total`} />
          <StatCard icon={BellRing} tone="amber" label="On Notice" value={String(kpis.onNotice)} />
          <StatCard icon={Ban} tone="red" label="Salary Hold" value={String(kpis.salaryHold)} />
          <StatCard icon={UserX} tone="slate" label="Exited" value={String(kpis.exited)} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StateDistributionCard employees={employees} className="lg:col-span-1" />

        <SectionCard title="Employment Category" subtitle="By worker type" className="lg:col-span-2">
          <CategoryBreakdown employees={employees} />
        </SectionCard>
      </div>

      <SectionCard className="mt-5" noPadding>
        <div className="border-b border-border p-4">
          <FilterBar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name, ID, email..." className="w-full sm:w-56" />
            <FilterSelect value={department} onChange={setDepartment} options={["All", ...departments]} placeholder="Department" ariaLabel="Filter by department" />
            <FilterSelect value={location} onChange={setLocation} options={["All", ...workLocations]} placeholder="Location" ariaLabel="Filter by location" />
            <FilterSelect value={state} onChange={setState} options={["All", ...indianStates]} placeholder="State" ariaLabel="Filter by state" />
            <FilterSelect value={status} onChange={setStatus} options={statusOptions} placeholder="Status" ariaLabel="Filter by status" />
            <Button variant="outline" className="gap-1.5">
              <SlidersHorizontal className="h-4 w-4" /> More Filters
            </Button>
            {(search || department !== "All" || location !== "All" || state !== "All" || status !== "All") && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  setSearch("");
                  setDepartment("All");
                  setLocation("All");
                  setState("All");
                  setStatus("All");
                }}
              >
                Clear
              </Button>
            )}
          </FilterBar>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/60 px-4 py-2.5">
            <span className="text-xs font-medium text-foreground">{selectedIds.size} selected</span>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
                <ShieldAlert className="h-3.5 w-3.5" /> Bulk Actions
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Employee Fields</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setBulkAction("department")}>
                  <Building2 className="h-4 w-4" /> Change Department
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBulkAction("location")}>
                  <MapPin className="h-4 w-4" /> Set Work Location
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBulkAction("state")}>
                  <MapPin className="h-4 w-4" /> Update State
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Statutory</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setPfConfirm(true)}>
                  <ToggleRight className="h-4 w-4" /> Enable PF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPfConfirm(false)}>
                  <ToggleLeft className="h-4 w-4" /> Disable PF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEsiConfirm(true)}>
                  <ToggleRight className="h-4 w-4" /> Enable ESI
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEsiConfirm(false)}>
                  <ToggleLeft className="h-4 w-4" /> Disable ESI
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </Button>
          </div>
        )}

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          onRowClick={openDrawer}
          getRowId={(e) => e.id}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </SectionCard>

      <EmployeeDetailDrawer employee={selectedEmployee} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => refresh()} />
      <BulkUploadEmployeesDialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen} onImported={refresh} />

      <BulkActionDialog
        open={bulkAction === "department"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        title="Change Department"
        description={`Update department for ${selectedIds.size} selected employee(s).`}
        fieldLabel="Department"
        type="select"
        options={departments}
        onApply={(v) => applyBulk("department", v)}
      />
      <BulkActionDialog
        open={bulkAction === "location"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        title="Set Work Location"
        description={`Update work location for ${selectedIds.size} selected employee(s).`}
        fieldLabel="Work Location"
        type="text"
        onApply={(v) => applyBulk("location", v)}
      />
      <BulkActionDialog
        open={bulkAction === "state"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        title="Update State"
        description={`Update state for ${selectedIds.size} selected employee(s).`}
        fieldLabel="State"
        type="select"
        options={indianStates}
        onApply={(v) => applyBulk("state", v)}
      />
      <ConfirmDialog
        open={pfConfirm !== null}
        onOpenChange={(o) => !o && setPfConfirm(null)}
        title={`${pfConfirm ? "Enable" : "Disable"} PF for ${selectedIds.size} employees?`}
        description="This overrides the category-based default and marks the change as an admin override."
        confirmLabel={pfConfirm ? "Enable PF" : "Disable PF"}
        onConfirm={async () => {
          await applyPFESI("pfApplicable", !!pfConfirm);
          setPfConfirm(null);
        }}
      />
      <ConfirmDialog
        open={esiConfirm !== null}
        onOpenChange={(o) => !o && setEsiConfirm(null)}
        title={`${esiConfirm ? "Enable" : "Disable"} ESI for ${selectedIds.size} employees?`}
        description="This overrides the category-based default and marks the change as an admin override."
        confirmLabel={esiConfirm ? "Enable ESI" : "Disable ESI"}
        onConfirm={async () => {
          await applyPFESI("esiApplicable", !!esiConfirm);
          setEsiConfirm(null);
        }}
      />
    </div>
  );
}

function CategoryBreakdown({ employees }: { employees: Employee[] }) {
  const categories = ["Permanent", "Contract", "Consultant", "Intern", "Temporary", "Rent Candidate", "Other"] as const;
  const counts = categories.map((c) => ({
    category: c,
    count: employees.filter((e) => (e.category ?? "Permanent") === c).length,
  })).filter((c) => c.count > 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {counts.map((c) => (
        <div key={c.category} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">{c.category}</p>
          <p className="mt-0.5 text-lg font-semibold text-foreground">{c.count}</p>
        </div>
      ))}
    </div>
  );
}
