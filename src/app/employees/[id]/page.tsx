"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban, PlayCircle, RefreshCcw } from "lucide-react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangeStatusDialog } from "@/components/employees/change-status-dialog";
import { SalaryHoldDialog, ReleaseSalaryDialog } from "@/components/employees/salary-hold-dialog";
import { getEmployeeById } from "@/services/employee.service";
import { getEmployeeKYC } from "@/services/kyc.service";
import { getSalaryProfile } from "@/services/salary.service";
import { getActiveSalaryHold } from "@/services/salary.service";
import { CURRENT_PAYROLL_MONTH } from "@/data/mock/attendance";
import type { Employee, EmployeeKYC, SalaryHold, SalaryProfile } from "@/types";
import { OverviewPanel } from "./overview-panel";
import { EmploymentPanel } from "./employment-panel";
import { SalaryPanel } from "./salary-panel";
import { AttendancePanel } from "./attendance-panel";
import { KYCPanel } from "./kyc-panel";
import { DocumentsPanel } from "./documents-panel";
import { PayrollHistoryPanel } from "./payroll-history-panel";

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const employeeId = params.id;

  const [employee, setEmployee] = useState<Employee | null | undefined>(undefined);
  const [kyc, setKyc] = useState<EmployeeKYC | undefined>(undefined);
  const [salary, setSalary] = useState<SalaryProfile | undefined>(undefined);
  const [hold, setHold] = useState<SalaryHold | undefined>(undefined);
  const [statusOpen, setStatusOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);

  const load = useCallback(async () => {
    const emp = await getEmployeeById(employeeId);
    setEmployee(emp ?? null);
    if (emp) {
      const [k, s] = await Promise.all([getEmployeeKYC(emp.id), getSalaryProfile(emp.id)]);
      setKyc(k);
      setSalary(s);
      setHold(getActiveSalaryHold(emp.id, CURRENT_PAYROLL_MONTH));
    }
  }, [employeeId]);

  useEffect(() => {
    // `load` performs its first setState call after an `await`, so this isn't
    // a synchronous set-state-in-effect — it's the standard data-fetch-on-mount
    // pattern, reused here (instead of inlined) so dialogs can also call it via `onChanged`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (employee === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Employee not found.</p>
        <Link href="/employees" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
          Back to Employees
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3 gap-1.5 text-muted-foreground" onClick={() => router.push("/employees")}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Employees
      </Button>

      <div className="mb-5 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        {!employee ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <EmployeeAvatar name={employee.fullName} size="lg" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold text-foreground">{employee.fullName}</h1>
                  <StatusBadge status={employee.status} />
                  {hold && <StatusBadge status="SALARY ON HOLD" />}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {employee.employeeCode} · {employee.designation} · {employee.department}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setStatusOpen(true)}>
                <RefreshCcw className="h-3.5 w-3.5" /> Change Status
              </Button>
              {hold ? (
                <Button variant="outline" size="sm" className="gap-1.5 text-success border-emerald-200 hover:bg-emerald-50" onClick={() => setReleaseOpen(true)}>
                  <PlayCircle className="h-3.5 w-3.5" /> Release Salary
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="gap-1.5 text-danger border-rose-200 hover:bg-rose-50" onClick={() => setHoldOpen(true)}>
                  <Ban className="h-3.5 w-3.5" /> Hold Salary
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="salary">Salary</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="kyc">KYC &amp; Statutory</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">Payroll History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {employee && <OverviewPanel employee={employee} />}
        </TabsContent>
        <TabsContent value="employment" className="mt-4">
          {employee && <EmploymentPanel employee={employee} onChanged={load} />}
        </TabsContent>
        <TabsContent value="salary" className="mt-4">
          {employee && <SalaryPanel employee={employee} salary={salary} onChanged={load} />}
        </TabsContent>
        <TabsContent value="attendance" className="mt-4">
          {employee && <AttendancePanel employee={employee} />}
        </TabsContent>
        <TabsContent value="kyc" className="mt-4">
          {employee && kyc && <KYCPanel employee={employee} kyc={kyc} onChanged={load} />}
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          {employee && kyc && <DocumentsPanel employee={employee} kyc={kyc} onChanged={load} />}
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          {employee && <PayrollHistoryPanel employee={employee} />}
        </TabsContent>
      </Tabs>

      {employee && (
        <>
          <ChangeStatusDialog employee={employee} open={statusOpen} onOpenChange={setStatusOpen} onChanged={load} />
          <SalaryHoldDialog
            employeeId={employee.id}
            employeeName={employee.fullName}
            defaultMonth={CURRENT_PAYROLL_MONTH}
            open={holdOpen}
            onOpenChange={setHoldOpen}
            onDone={load}
          />
          {hold && (
            <ReleaseSalaryDialog
              employeeId={employee.id}
              employeeName={employee.fullName}
              month={hold.month}
              open={releaseOpen}
              onOpenChange={setReleaseOpen}
              onDone={load}
            />
          )}
        </>
      )}
    </div>
  );
}
