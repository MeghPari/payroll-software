"use client";

import { useEffect, useMemo, useState } from "react";
import type { Column } from "@/components/shared/data-table";
import { Users, CheckCircle2, CalendarCheck, CalendarX, Ban, Download, Check, X, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { FilterBar } from "@/components/shared/filter-bar";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { DataTable } from "@/components/shared/data-table";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { getAttendance, getAttendanceSummary, getLeaveBalances, getLeaveRequests, getUploadHistory, updateLeaveRequestStatus } from "@/services/attendance.service";
import { getEmployeeById } from "@/data/mock/employees";
import type { AttendanceRecord, LeaveRequest } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AttendancePage() {
  const [tab, setTab] = useState("attendance");
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getAttendanceSummary>> | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<Awaited<ReturnType<typeof getLeaveBalances>>>([]);
  const [uploads, setUploads] = useState<Awaited<ReturnType<typeof getUploadHistory>>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([getAttendance(), getAttendanceSummary(), getLeaveRequests(), getLeaveBalances(), getUploadHistory()]).then(
      ([att, sum, lv, bal, up]) => {
        setAttendance(att);
        setSummary(sum);
        setLeaves(lv);
        setBalances(bal);
        setUploads(up);
        setLoading(false);
      }
    );
  }, []);

  const filteredAttendance = useMemo(() => {
    if (!search) return attendance;
    const q = search.toLowerCase();
    return attendance.filter((r) => getEmployeeById(r.employeeId)?.fullName.toLowerCase().includes(q));
  }, [attendance, search]);

  async function handleLeaveAction(id: string, status: "Approved" | "Rejected") {
    const updated = await updateLeaveRequestStatus(id, status);
    if (updated) {
      setLeaves((prev) => prev.map((l) => (l.id === id ? updated : l)));
      toast[status === "Approved" ? "success" : "error"](`Leave request ${status.toLowerCase()}`);
    }
  }

  const attendanceColumns: Column<AttendanceRecord>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => getEmployeeById(row.employeeId)?.fullName ?? "",
      cell: ({ row }) => {
        const emp = getEmployeeById(row.original.employeeId);
        return (
          <div className="flex items-center gap-3">
            <EmployeeAvatar name={emp?.fullName ?? "?"} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{emp?.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{emp?.designation}</p>
            </div>
          </div>
        );
      },
    },
    { accessorKey: "presentDays", header: "Present Days" },
    { accessorKey: "paidLeave", header: "Paid Leave" },
    { accessorKey: "unpaidLeave", header: "Unpaid Leave" },
    { accessorKey: "overtimeHours", header: "Overtime (Hrs)" },
    { accessorKey: "lopDays", header: "LOP Days" },
    { accessorKey: "finalPayableDays", header: "Final Payable Days" },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Attendance & Leave"
        subtitle="Track attendance, manage leave requests and view balances."
        actions={
          <Button variant="outline" className="gap-1.5">
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      {loading || !summary ? (
        <CardGridSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={Users} tone="blue" label="Total Employees" value={String(summary.totalEmployees)} />
          <StatCard icon={CheckCircle2} tone="green" label="Present Days" value={String(summary.presentDays)} helperText="This month" />
          <StatCard icon={CalendarCheck} tone="purple" label="Paid Leave" value={String(summary.paidLeave)} helperText="This month" />
          <StatCard icon={CalendarX} tone="amber" label="Unpaid Leave" value={String(summary.unpaidLeave)} helperText="This month" />
          <StatCard icon={Ban} tone="red" label="LOP Days" value={String(summary.lopDays)} helperText="This month" />
        </div>
      )}

      <div className="mt-5">
        <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
          <TabsList variant="line">
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="leave-requests">Leave Requests</TabsTrigger>
            <TabsTrigger value="leave-balance">Leave Balance</TabsTrigger>
            <TabsTrigger value="upload-history">Upload History</TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="mt-4">
            <SectionCard title="Attendance Summary" subtitle="May 2026" noPadding>
              <div className="border-b border-border p-4">
                <FilterBar>
                  <SearchInput value={search} onChange={setSearch} placeholder="Search employee..." className="w-full sm:w-64" />
                </FilterBar>
              </div>
              <DataTable columns={attendanceColumns} data={filteredAttendance} loading={loading} pageSize={8} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="leave-requests" className="mt-4">
            <SectionCard title="Leave Requests (Open)" noPadding>
              {leaves.filter((l) => l.status === "Pending").length === 0 ? (
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
                      {leaves
                        .filter((l) => l.status === "Pending")
                        .map((leave) => {
                          const emp = getEmployeeById(leave.employeeId);
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
                                  <Button size="sm" variant="outline" className="gap-1 text-success border-emerald-200 hover:bg-emerald-50" onClick={() => handleLeaveAction(leave.id, "Approved")}>
                                    <Check className="h-3.5 w-3.5" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" className="gap-1 text-danger border-rose-200 hover:bg-rose-50" onClick={() => handleLeaveAction(leave.id, "Rejected")}>
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
          </TabsContent>

          <TabsContent value="leave-balance" className="mt-4">
            <SectionCard title="Leave Balance" subtitle="As on 31 May 2026" noPadding>
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
                    {balances.slice(0, 10).map((bal) => {
                      const emp = getEmployeeById(bal.employeeId);
                      return (
                        <tr key={bal.employeeId} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <EmployeeAvatar name={emp?.fullName ?? "?"} size="sm" />
                              <p className="font-medium text-foreground">{emp?.fullName}</p>
                            </div>
                          </td>
                          <LeaveBalanceCell used={bal.casualLeave.used} total={bal.casualLeave.total} />
                          <LeaveBalanceCell used={bal.sickLeave.used} total={bal.sickLeave.total} />
                          <LeaveBalanceCell used={bal.earnedLeave.used} total={bal.earnedLeave.total} />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="upload-history" className="mt-4">
            <SectionCard
              title="Upload History"
              subtitle="Biometric and attendance file imports"
              actions={
                <Button size="sm" className="gap-1.5">
                  <UploadCloud className="h-4 w-4" /> Upload File
                </Button>
              }
              noPadding
            >
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
                    {uploads.map((u) => (
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LeaveBalanceCell({ used, total }: { used: number; total: number }) {
  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <Progress value={(used / total) * 100} className="h-1.5 w-20" />
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {used}/{total}
        </span>
      </div>
    </td>
  );
}
