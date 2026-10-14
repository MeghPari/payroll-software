'use client';
import { useEffect,useState } from 'react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getEmployeeMonthAttendance } from '@/services/attendance.service';
import { employmentDates } from '@/domain/attendance-completeness';
import { companyToday,monthLabel } from '@/domain/dates';
import type { Employee,DailyAttendanceRecord } from '@/types';
import { MarkEditAttendanceDialog } from './mark-edit-attendance-dialog';
import { permitted } from '@/lib/tenant-api';
export function MonthlyAttendanceEditor({employee,month,finalized,onClose,onSaved}:{employee:Employee;month:string;finalized:boolean;onClose:()=>void;onSaved:()=>void}){
 const[records,setRecords]=useState<DailyAttendanceRecord[]|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[selected,setSelected]=useState<string|null>(null);
 useEffect(()=>{let active=true;getEmployeeMonthAttendance(employee.id,month).then(rows=>{if(active){setRecords(rows);setError('');}}).catch(error=>{if(active)setError(error instanceof Error?error.message:'Unable to load attendance.');});return()=>{active=false;};},[employee.id,month,revision]);
 const dates=employmentDates(month,employee.joiningDate,employee.exitDate??null),byDate=new Map(records?.map(record=>[record.date,record])),today=companyToday();
 const missing=records?dates.filter(date=>date<=today&&(!byDate.has(date)||byDate.get(date)?.status==='Missing Punch')).length:0;
 return <><Dialog open onOpenChange={open=>!open&&!selected&&onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{employee.fullName} · {monthLabel(month)}</DialogTitle><DialogDescription>{finalized?'Attendance is finalized. Reopen the month with a reason to edit.':'Select a date to mark attendance or correct its status. Future dates are shown as upcoming.'}</DialogDescription></DialogHeader>{error?<p role="alert">{error}</p>:records===null?<p role="status">Loading attendance dates...</p>:<><p className="text-sm">{missing?`${missing} date(s) need attention through today.`:'No missing dates through today.'} Review the full employment month before finalizing.</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">{dates.map(date=>{const record=byDate.get(date),future=date>today,needsReview=!future&&(!record||record.status==='Missing Punch');return <button key={date} type="button" disabled={finalized||future||!permitted('attendance.write')} onClick={()=>setSelected(date)} aria-label={`${date}: ${record?.status??(future?'Upcoming':'Not recorded')}`} className={`min-h-20 rounded-lg border p-2 text-left text-xs disabled:cursor-default ${needsReview?'border-amber-300 bg-amber-50':future?'bg-muted text-muted-foreground':'bg-green-50'}`}><span className="block text-base font-semibold">{Number(date.slice(8))}</span><span className="mt-1 block">{record?.status??(future?'Upcoming':'Not recorded')}</span></button>;})}</div></>}<Button variant="outline" onClick={onClose}>Close</Button></DialogContent></Dialog>{selected&&<MarkEditAttendanceDialog open onOpenChange={open=>!open&&setSelected(null)} employees={[employee]} date={selected} fixedEmployeeId={employee.id} existingRecord={byDate.get(selected)} onDone={()=>{setRevision(n=>n+1);onSaved();}}/>}</>;
}
