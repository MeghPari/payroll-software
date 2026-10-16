"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterSelect } from "@/components/shared/filter-select";
import { Skeleton } from "@/components/ui/skeleton";
import { getEmployeeAttendanceMonth } from "@/services/attendance.service";
import { monthKey as monthKeyFromLabel } from '@/domain/dates';
import { payrollMonths,useAppStore } from "@/store/app-store";
import {Button} from '@/components/ui/button';
import type { AttendanceSummary, DailyAttendanceRecord, Employee } from "@/types";
import { CalendarCheck, CalendarX, Clock3, UserCheck } from "lucide-react";
import { format } from "date-fns";

interface MonthData {
  monthKey: string;
  summary: AttendanceSummary;
  records: DailyAttendanceRecord[];
}

export function AttendancePanel({ employee }: { employee: Employee }) {
  const month=useAppStore(state=>state.month),setMonth=useAppStore(state=>state.setMonth);
  return <EmployeeAttendanceMonth key={employee.id+'/'+month} employee={employee} month={month} setMonth={setMonth}/>;
}
function EmployeeAttendanceMonth({employee,month,setMonth}:{employee:Employee;month:string;setMonth:(month:string)=>void}){
  const [error,setError]=useState(''),[revision,setRevision]=useState(0);
  const [data, setData] = useState<MonthData | null>(null);
  const monthKey = monthKeyFromLabel(month);
  const loading = !error&&(!data || data.monthKey !== monthKey);
  const summary = loading ? undefined : data?.summary;
  const records = loading ? [] : data?.records??[];

  useEffect(() => {
    let active=true;
    getEmployeeAttendanceMonth(employee,monthKey).then(data=>{if(active){setData(data);setError('');}}).catch(error=>{if(active)setError(error instanceof Error?error.message:'Unable to load attendance.');});
    return()=>{active=false;};
  }, [employee,monthKey,revision]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Monthly Attendance Summary</h3>
        <FilterSelect value={month} onChange={setMonth} options={payrollMonths} placeholder="Month" className="w-44 bg-white" />
      </div>

      {error&&<div role="alert" className="rounded-lg border p-4 text-sm"><p>{error}</p><Button variant="outline" className="mt-2" onClick={()=>setRevision(value=>value+1)}>Retry attendance</Button></div>}
      {error?null:loading || !summary ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={UserCheck} tone="green" label="Present Days" value={String(summary.present)} />
          <StatCard icon={CalendarCheck} tone="blue" label="Payable Days" value={String(summary.payableDays)} />
          <StatCard icon={CalendarX} tone="red" label="LOP Days" value={String(summary.lopDays)} />
          <StatCard icon={Clock3} tone="amber" label="Paid / Unpaid Leave" value={`${summary.paidLeave} / ${summary.unpaidLeave}`} />
        </div>
      )}

      <SectionCard title="Daily Attendance" subtitle={month} noPadding>
        {loading ? (
          <div className="p-4">
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            {!records.length&&<p className="p-4 text-sm text-muted-foreground">No attendance recorded for this employee and month.</p>}
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Check-In</th>
                  <th className="px-4 py-2.5">Check-Out</th>
                  <th className="px-4 py-2.5">Work Hours</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{format(new Date(r.date), "dd MMM yyyy (EEE)")}</td>
                    <td className="px-4 py-2.5">{r.checkIn || "—"}</td>
                    <td className="px-4 py-2.5">{r.checkOut || "—"}</td>
                    <td className="px-4 py-2.5">{r.workHours ? `${r.workHours}h` : "—"}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.remarks || (r.changeReason ? `Edited: ${r.changeReason}` : "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
