import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError,body,databaseError,endpoint,result } from '@/server/http';
import { missingAttendanceDates } from '@/domain/attendance-completeness';
import { companyToday } from '@/domain/dates';
export const GET=endpoint(async request=>{
 const importScope=new URL(request.url).searchParams.get('importScope')==='true';const {client,companyId}=await tenant(request,importScope?'attendance.write':undefined);const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(new URL(request.url).searchParams.get('month'));
 if(importScope){const scope=await client.rpc('attendance_import_scope',{c:companyId,m:month+'-01'});databaseError(scope.error);return result(scope.data);}
 const response=await client.from('attendance_periods').select('month,finalized_at,finalized_by,version').eq('company_id',companyId).eq('month',`${month}-01`).maybeSingle();databaseError(response.error);return result(response.data);
});
export const POST=endpoint(async request=>{
 const {client,companyId}=await tenant(request);const input=await body(request,z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),reopen:z.boolean().default(false),reason:z.string().max(1000).default('')}).strict());
 const response=await client.rpc('finalize_attendance',{c:companyId,m:`${input.month}-01`,reopen:input.reopen,reason_text:input.reason});
 // Translate only this known business error; never expose arbitrary database messages.
 if(response.error?.code==='23514'&&response.error.message==='Complete every employment day before finalization'){
  const end=new Date(`${input.month}-01T00:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1);
  // Diagnose the same employment window used by the database, without changing records.
  for(let offset=0;;offset+=500){
   const employees=await client.from('employees').select('id,employee_code,joining_date,exit_date,status').eq('company_id',companyId).not('status','in','(Inactive,Salary Hold)').lte('joining_date',new Date(end.getTime()-86400000).toISOString().slice(0,10)).order('id').range(offset,offset+499);
   databaseError(employees.error);
   for(const employee of employees.data??[]){
    if(employee.exit_date&&employee.exit_date<`${input.month}-01`)continue;
    const attendance=await client.from('attendance_records').select('date,status').eq('company_id',companyId).eq('employee_id',employee.id).gte('date',`${input.month}-01`).lt('date',end.toISOString().slice(0,10));
    databaseError(attendance.error);
    const missing=missingAttendanceDates(input.month,employee.joining_date,employee.exit_date,attendance.data??[]);
    if(missing.length){
     const upcoming=missing.filter(date=>date>companyToday()).length;
     throw new ApiError(422,'ATTENDANCE_INCOMPLETE',`${employee.employee_code}: ${missing.length} incomplete attendance date(s). ${upcoming?`${upcoming} are upcoming dates. `:''}First dates: ${missing.slice(0,3).join(', ')}${missing.length>3?'…':''}. Open Attendance → Monthly review → View dates. Record actual statuses for the full employment month before finalizing.`);
    }
   }
   if((employees.data?.length??0)<500)break;
  }
  throw new ApiError(422,'ATTENDANCE_INCOMPLETE',`Attendance for ${input.month} is incomplete. Record a status for every date from each employee's joining date through their last working date or month end, including weekly offs and holidays. Resolve any Missing Punch entries, then finalize again.`);
 }
 if(response.error?.code==='23514'&&response.error.message==='Unlock payroll with an audited reason before reopening attendance'){
  throw new ApiError(422,'PAYROLL_LOCKED','Unlock the approved or locked payroll with a correction reason before reopening attendance.');
 }
 databaseError(response.error);return result({updated:true});
});
