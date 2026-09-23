"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  CalendarX,
  Clock3,
  AlertCircle,
  CalendarOff,
  Download,
  UploadCloud,
  Check,
  X,
  Pencil,
  UserPlus2,
  Lock,
  LockOpen,
  FileSpreadsheet,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { FilterBar } from "@/components/shared/filter-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { DataTable } from "@/components/shared/data-table";
import type { Column } from "@/components/shared/data-table";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/filter-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkEditAttendanceDialog } from "@/components/attendance/mark-edit-attendance-dialog";
import { BulkUploadAttendanceDialog } from "@/components/attendance/bulk-upload-attendance-dialog";
import {
  getDailyAttendance,
  getLeaveBalances,
  getLeaveRequests,
  getMonthlyAttendanceRegister,
  getTodayAttendanceSummary,
  getUploadHistory,
  isAttendanceFinalized,
  finalizeAttendance,
  lateMinutes,
  updateLeaveRequestStatus,
  type MonthlyRegisterRow,
  type TodayAttendanceCounts,
} from "@/services/attendance.service";
import { getEmployees } from "@/services/employee.service";
import { departments } from "@/data/mock/employees";
import { today, monthKeyFromLabel, indianStates, useOperations } from "@/store/operations-store";
import { payrollMonths } from "@/store/app-store";
import { CURRENT_PAYROLL_MONTH } from "@/data/mock/attendance";
import { downloadCSV } from "@/lib/csv";
import { ATTENDANCE_IMPORT_COLUMNS } from "@/services/attendance.service";
import type { DailyAttendanceRecord, Employee, LeaveRequest, UploadRecord } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AttendancePage() {
  const [tab, setTab] = useState("today");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmployees().then((data) => {
      setEmployees(data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader title="Attendance & Leave" subtitle="Track daily attendance, manage leave requests and process monthly registers." />

      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList variant="line" className="flex-wrap h-auto">
          <TabsTrigger value="today">Today&apos;s Attendance</TabsTrigger>
          <TabsTrigger value="register">Attendance Register</TabsTrigger>
          <TabsTrigger value="leave-requests">Leave Requests</TabsTrigger>
          <TabsTrigger value="leave-balance">Leave Balance</TabsTrigger>
          <TabsTrigger value="upload">Upload Attendance</TabsTrigger>
          <TabsTrigger value="upload-history">Upload History</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          <TodayAttendanceTab employees={employees} loading={loading} />
        </TabsContent>
        <TabsContent value="register" className="mt-4">
          <AttendanceRegisterTab employees={employees} loading={loading} />
        </TabsContent>
        <TabsContent value="leave-requests" className="mt-4">
          <LeaveRequestsTab employees={employees} />
        </TabsContent>
        <TabsContent value="leave-balance" className="mt-4">
          <LeaveBalanceTab employees={employees} />
        </TabsContent>
        <TabsContent value="upload" className="mt-4">
          <UploadAttendanceTab />
        </TabsContent>
        <TabsContent value="upload-history" className="mt-4">
          <UploadHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Today's Attendance
// ---------------------------------------------------------------------------

function TodayAttendanceTab({ employees, loading: employeesLoading }: { employees: Employee[]; loading: boolean }) {
  const [date, setDate] = useState(today());
  const [counts, setCounts] = useState<TodayAttendanceCounts | null>(null);
  const [records, setRecords] = useState<DailyAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [markOpen, setMarkOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<DailyAttendanceRecord | null>(null);
  const [editEmployeeId, setEditEmployeeId] = useState<string | undefined>(undefined);

  function refresh() {
    setLoading(true);
    Promise.all([getTodayAttendanceSummary(date), getDailyAttendance(date)]).then(([c, r]) => {
      setCounts(c);
      setRecords(r);
      setLoading(false);
    });
  }

  useEffect(() => {
    // Re-fetches (and resets the loading flag) whenever the selected date changes.
    // `refresh` is intentionally omitted below — it's redefined every render and
    // only needs to run when `date` changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const rows = useMemo(() => {
    return records
      .map((r) => ({ record: r, employee: employeeMap.get(r.employeeId) }))
      .filter((row): row is { record: DailyAttendanceRecord; employee: Employee } => !!row.employee)
      .filter(({ record, employee }) => {
        if (statusFilter !== "All" && record.status !== statusFilter) return false;
        if (departmentFilter !== "All" && employee.department !== departmentFilter) return false;
        if (stateFilter !== "All" && employee.state !== stateFilter) return false;
        return true;
      });
  }, [records, employeeMap, statusFilter, departmentFilter, stateFilter]);

  const columns: Column<(typeof rows)[number]>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => row.employee.fullName,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={row.original.employee.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.employee.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.employee.employeeCode}</p>
          </div>
        </div>
      ),
    },
    { id: "department", header: "Department", accessorFn: (row) => row.employee.department },
    { id: "shift", header: "Shift", accessorFn: (row) => row.record.shift },
    { id: "checkIn", header: "Check-In", accessorFn: (row) => row.record.checkIn, cell: ({ row }) => row.original.record.checkIn || "—" },
    { id: "checkOut", header: "Check-Out", accessorFn: (row) => row.record.checkOut, cell: ({ row }) => row.original.record.checkOut || "—" },
    {
      id: "workHours",
      header: "Working Hours",
      accessorFn: (row) => row.record.workHours,
      cell: ({ row }) => (row.original.record.workHours ? `${Math.floor(row.original.record.workHours)}h ${Math.round((row.original.record.workHours % 1) * 60)}m` : "—"),
    },
    { id: "status", header: "Status", accessorFn: (row) => row.record.status, cell: ({ row }) => <StatusBadge status={row.original.record.status} /> },
    {
      id: "lateBy",
      header: "Late By",
      accessorFn: (row) => lateMinutes(row.record.checkIn),
      cell: ({ row }) => {
        const late = lateMinutes(row.original.record.checkIn);
        return late > 0 ? <span className="text-warning">{late} min late</span> : "—";
      },
    },
    { id: "source", header: "Attendance Source", accessorFn: (row) => row.record.source },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-primary"
          onClick={(e) => {
            e.stopPropagation();
            setEditRecord(row.original.record);
            setEditEmployeeId(row.original.employee.id);
          }}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      ),
    },
  ];

  const loadingAll = loading || employeesLoading;

  return (
    <div className="space-y-5">
      {loadingAll || !counts ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={Users} tone="blue" label="Total Employees" value={String(counts.total)} />
          <StatCard icon={CheckCircle2} tone="green" label="Present" value={String(counts.present)} />
          <StatCard icon={XCircle} tone="red" label="Absent" value={String(counts.absent)} />
          <StatCard icon={CalendarCheck} tone="purple" label="On Leave" value={String(counts.onLeave)} />
          <StatCard icon={CalendarOff} tone="amber" label="Half Day" value={String(counts.halfDay)} />
          <StatCard icon={CalendarX} tone="slate" label="Weekly Off / Holiday" value={String(counts.weeklyOff)} />
          <StatCard icon={Clock3} tone="amber" label="Late Arrival" value={String(counts.late)} />
          <StatCard icon={AlertCircle} tone="red" label="Missing Punch" value={String(counts.missingPunch)} />
        </div>
      )}

      <SectionCard
        title="Today's Attendance Register"
        subtitle={format(new Date(date), "dd MMM yyyy (EEEE)")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="w-40" />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMarkOpen(true)}>
              <UserPlus2 className="h-3.5 w-3.5" /> Mark Attendance
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                downloadCSV(
                  `attendance_${date}.csv`,
                  ["Employee ID", "Employee Name", "Department", "Status", "Check-In", "Check-Out", "Working Hours"],
                  rows.map(({ record, employee }) => [employee.employeeCode, employee.fullName, employee.department, record.status, record.checkIn, record.checkOut, record.workHours])
                )
              }
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        }
        noPadding
      >
        <div className="border-b border-border p-4">
          <FilterBar>
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={["All", "Present", "Absent", "Paid Leave", "Unpaid Leave", "Half Day", "Weekly Off", "Holiday", "Work From Home", "Missing Punch"]} placeholder="Status" />
            <FilterSelect value={departmentFilter} onChange={setDepartmentFilter} options={["All", ...departments]} placeholder="Department" />
            <FilterSelect value={stateFilter} onChange={setStateFilter} options={["All", ...indianStates]} placeholder="State" />
          </FilterBar>
        </div>
        <DataTable columns={columns} data={rows} loading={loadingAll} pageSize={10} emptyTitle="No attendance records" emptyDescription="No records match the selected filters for this date." />
      </SectionCard>

      <MarkEditAttendanceDialog
        open={markOpen}
        onOpenChange={setMarkOpen}
        employees={employees}
        date={date}
        onDone={refresh}
      />
      <MarkEditAttendanceDialog
        open={!!editRecord}
        onOpenChange={(o) => {
          if (!o) {
            setEditRecord(null);
            setEditEmployeeId(undefined);
          }
        }}
        employees={employees}
        date={date}
        fixedEmployeeId={editEmployeeId}
        existingRecord={editRecord ?? undefined}
        onDone={refresh}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attendance Register (monthly)
// ---------------------------------------------------------------------------

function AttendanceRegisterTab({ employees, loading: employeesLoading }: { employees: Employee[]; loading: boolean }) {
  const [month, setMonth] = useState(CURRENT_PAYROLL_MONTH);
  const [rows, setRows] = useState<MonthlyRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalized, setFinalized] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const monthKey = monthKeyFromLabel(month);
  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  function refresh() {
    setLoading(true);
    Promise.all([getMonthlyAttendanceRegister(monthKey), isAttendanceFinalized(monthKey)]).then(([r, f]) => {
      setRows(r);
      setFinalized(f);
      setLoading(false);
    });
  }

  useEffect(() => {
    // Re-fetches (and resets the loading flag) whenever the selected month changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await finalizeAttendance(monthKey);
      toast.success(`Attendance finalized for ${month}`, { description: "Attendance is now locked for payroll processing." });
      refresh();
    } finally {
      setFinalizing(false);
      setConfirmOpen(false);
    }
  }

  const loadingAll = loading || employeesLoading;

  const columns: Column<MonthlyRegisterRow & { employee?: Employee }>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => row.employee?.fullName,
      cell: ({ row }) =>
        row.original.employee ? (
          <div className="flex items-center gap-3">
            <EmployeeAvatar name={row.original.employee.fullName} size="sm" />
            <span className="font-medium text-foreground">{row.original.employee.fullName}</span>
          </div>
        ) : (
          "—"
        ),
    },
    { id: "present", header: "Present", accessorFn: (row) => row.summary.present },
    { id: "absent", header: "Absent", accessorFn: (row) => row.summary.absent },
    { id: "paidLeave", header: "Paid Leave", accessorFn: (row) => row.summary.paidLeave },
    { id: "unpaidLeave", header: "Unpaid Leave", accessorFn: (row) => row.summary.unpaidLeave },
    { id: "halfDays", header: "Half Days", accessorFn: (row) => row.summary.halfDays },
    { id: "weeklyOff", header: "Weekly Off", accessorFn: (row) => row.summary.weeklyOff },
    { id: "holidays", header: "Holidays", accessorFn: (row) => row.summary.holidays },
    { id: "payableDays", header: "Payable Days", accessorFn: (row) => row.summary.payableDays, cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.summary.payableDays}</span> },
    { id: "lopDays", header: "LOP Days", accessorFn: (row) => row.summary.lopDays, cell: ({ row }) => (row.original.summary.lopDays > 0 ? <span className="text-danger">{row.original.summary.lopDays}</span> : "0") },
  ];

  const data = rows.map((r) => ({ ...r, employee: employeeMap.get(r.employeeId) })).filter((r) => r.employee);

  return (
    <div className="space-y-4">
      <div
        className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
          finalized ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {finalized ? <Lock className="h-4.5 w-4.5 text-success" /> : <LockOpen className="h-4.5 w-4.5 text-warning" />}
          <div>
            <p className={`text-sm font-semibold ${finalized ? "text-success" : "text-warning"}`}>
              {finalized ? "Attendance Locked for Payroll" : "Attendance is open for edits"}
            </p>
            <p className="text-xs text-foreground/70">
              {finalized ? `Attendance for ${month} has been finalized and is ready for payroll processing.` : `Finalize attendance once all records for ${month} have been reviewed.`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={finalized ? "outline" : "default"}
          className="gap-1.5"
          onClick={() => (finalized ? toast.info("Unlocking attendance requires Payroll Admin approval.") : setConfirmOpen(true))}
        >
          {finalized ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {finalized ? "Unlock (Admin)" : "Finalize Attendance"}
        </Button>
      </div>

      <SectionCard
        title="Monthly Attendance Register"
        subtitle={month}
        actions={<FilterSelect value={month} onChange={setMonth} options={payrollMonths} className="w-44 bg-white" />}
        noPadding
      >
        <DataTable columns={columns} data={data} loading={loadingAll} pageSize={10} />
      </SectionCard>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Finalize attendance for ${month}?`}
        description="Once finalized, attendance records for this month will be locked and used directly for payroll calculation. Further edits will require an admin override."
        confirmLabel="Finalize Attendance"
        loading={finalizing}
        onConfirm={handleFinalize}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leave Requests
// ---------------------------------------------------------------------------

function LeaveRequestsTab({ employees }: { employees: Employee[] }) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  function refresh() {
    getLeaveRequests().then((data) => {
      setLeaves(data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAction(id: string, status: "Approved" | "Rejected") {
    const updated = await updateLeaveRequestStatus(id, status);
    if (updated) {
      setLeaves((prev) => prev.map((l) => (l.id === id ? updated : l)));
      toast[status === "Approved" ? "success" : "error"](`Leave request ${status.toLowerCase()}`);
    }
  }

  const pending = leaves.filter((l) => l.status === "Pending");

  return (
    <SectionCard title="Leave Requests (Open)" noPadding>
      {!loading && pending.length === 0 ? (
        <EmptyState title="No pending leave requests" description="All leave requests have been reviewed." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Leave Type</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Applied On</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pending.map((leave) => {
                const emp = employeeMap.get(leave.employeeId);
                return (
                  <tr key={leave.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar name={emp?.fullName ?? "?"} size="sm" />
                        <div>
                          <p className="font-medium text-foreground">{emp?.fullName}</p>
                          <p className="text-xs text-muted-foreground">{emp?.designation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={leave.leaveType} tone="info" />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{format(new Date(leave.from), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{format(new Date(leave.to), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3">{leave.days}</td>
                    <td className="px-4 py-3 max-w-[180px] truncate">{leave.reason}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{format(new Date(leave.appliedOn), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="gap-1 text-success border-emerald-200 hover:bg-emerald-50" onClick={() => handleAction(leave.id, "Approved")}>
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-danger border-rose-200 hover:bg-rose-50" onClick={() => handleAction(leave.id, "Rejected")}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Leave Balance
// ---------------------------------------------------------------------------

function LeaveBalanceTab({ employees }: { employees: Employee[] }) {
  const [balances, setBalances] = useState<Awaited<ReturnType<typeof getLeaveBalances>>>([]);
  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  useEffect(() => {
    getLeaveBalances().then(setBalances);
  }, []);

  return (
    <SectionCard title="Leave Balance" subtitle="As on today" noPadding>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Casual Leave</th>
              <th className="px-4 py-3">Sick Leave</th>
              <th className="px-4 py-3">Earned Leave</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {balances.slice(0, 15).map((bal) => {
              const emp = employeeMap.get(bal.employeeId);
              return (
                <tr key={bal.employeeId} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <EmployeeAvatar name={emp?.fullName ?? "?"} size="sm" />
                      <p className="font-medium text-foreground">{emp?.fullName}</p>
                    </div>
                  </td>
                  <BalanceCell used={bal.casualLeave.used} total={bal.casualLeave.total} />
                  <BalanceCell used={bal.sickLeave.used} total={bal.sickLeave.total} />
                  <BalanceCell used={bal.earnedLeave.used} total={bal.earnedLeave.total} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function BalanceCell({ used, total }: { used: number; total: number }) {
  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${(used / total) * 100}%` }} />
        </div>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {used}/{total}
        </span>
      </div>
    </td>
  );
}

// ---------------------------------------------------------------------------
// Upload Attendance
// ---------------------------------------------------------------------------

function UploadAttendanceTab() {
  const [open, setOpen] = useState(false);

  return (
    <SectionCard>
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-primary">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Upload an attendance sheet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Select the payroll month, upload a CSV/XLS/XLSX attendance file, validate the records, and import them into the attendance register.
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => downloadCSV("attendance_import_template.csv", ATTENDANCE_IMPORT_COLUMNS, [])}
          >
            <Download className="h-4 w-4" /> Download Attendance Template
          </Button>
          <Button className="gap-1.5" onClick={() => setOpen(true)}>
            <UploadCloud className="h-4 w-4" /> Upload Attendance
          </Button>
        </div>
      </div>
      <BulkUploadAttendanceDialog open={open} onOpenChange={setOpen} onImported={() => toast.success("Attendance imported — check Today's Attendance / Register tabs.")} />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Upload History
// ---------------------------------------------------------------------------

function UploadHistoryTab() {
  const [recent] = useState<UploadRecord[]>(() => useOperations.getState().uploads.filter((u) => u.kind === "Attendance"));
  const [legacy, setLegacy] = useState<Awaited<ReturnType<typeof getUploadHistory>>>([]);

  useEffect(() => {
    getUploadHistory().then(setLegacy);
  }, []);

  return (
    <div className="space-y-4">
      <SectionCard title="Recent Attendance Uploads" noPadding>
        {recent.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No uploads yet" description="Attendance files uploaded this session will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">File Name</th>
                  <th className="px-4 py-2.5">Uploaded By</th>
                  <th className="px-4 py-2.5">Uploaded On</th>
                  <th className="px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5">Valid</th>
                  <th className="px-4 py-2.5">Errors</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{u.fileName}</td>
                    <td className="px-4 py-2.5">{u.uploadedBy}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.uploadedOn}</td>
                    <td className="px-4 py-2.5">{u.totalRows}</td>
                    <td className="px-4 py-2.5 text-success">{u.validRows}</td>
                    <td className="px-4 py-2.5 text-danger">{u.errorRows}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={u.status} tone={u.status === "Completed" ? "success" : "warning"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Previous Uploads" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">File Name</th>
                <th className="px-4 py-3">Uploaded By</th>
                <th className="px-4 py-3">Uploaded On</th>
                <th className="px-4 py-3">Records Processed</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {legacy.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{u.fileName}</td>
                  <td className="px-4 py-3">{u.uploadedBy}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{u.uploadedOn}</td>
                  <td className="px-4 py-3">{u.recordsProcessed}</td>
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
