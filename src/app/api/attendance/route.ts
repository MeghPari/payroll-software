import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError,body,databaseError,endpoint,result } from '@/server/http';
import { attendanceInput } from '@/domain/attendance-input';
export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request);
 const params=new URL(request.url).searchParams;
 const page=z.coerce.number().int().min(1).parse(params.get('page')??1);
 let query=client.from('attendance_records').select('*',{count:'exact'}).eq('company_id',companyId).order('date').order('employee_id').range((page-1)*1000,page*1000-1);
 if(params.has('date'))query=query.eq('date',z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(params.get('date')));
 if(params.has('month')){const m=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(params.get('month'));const date=new Date(`${m}-01T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()+1);query=query.gte('date',`${m}-01`).lt('date',date.toISOString().slice(0,10));}
 if(params.has('employeeId'))query=query.eq('employee_id',z.string().uuid().parse(params.get('employeeId')));
 const response=await query;databaseError(response.error);return result({items:response.data,total:response.count});
});
export const POST=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'attendance.write');
 const input=await body(request,attendanceInput);
 const response=await client.rpc('save_attendance',{c:companyId,rows_json:input.rows,reason_text:input.reason,allow_update:input.allowUpdate});
 if(response.error?.code==='23505')throw new ApiError(409,'ATTENDANCE_EXISTS','Attendance is already recorded for this employee and date. Refresh the register and use Edit to make a correction.');
 if(response.error?.code==='23514'&&response.error.message==='Attendance finalized')throw new ApiError(409,'ATTENDANCE_LOCKED','This month is finalized. An authorized user must reopen it with a correction reason before editing attendance.');
 if(response.error?.code==='22023'&&response.error.message==='Employee/date invalid')throw new ApiError(422,'EMPLOYMENT_DATE_INVALID','Choose a date within the employee’s employment period, from joining date through last working date.');
 databaseError(response.error);return result({saved:response.data});
});
