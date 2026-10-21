import {attendanceRowInput} from '@/domain/attendance-input';
import{z}from 'zod';import{tenant}from '@/server/auth';import{ApiError,body,databaseError,endpoint,result}from '@/server/http';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'attendance.read');const response=await client.from('attendance_import_batches').select('id,actor_id,row_count,created_at').eq('company_id',companyId).order('created_at',{ascending:false}).limit(100);databaseError(response.error);
 return result(response.data?.map(row=>({id:row.id,fileName:'Spreadsheet attendance import',uploadedBy:row.actor_id,uploadedOn:row.created_at,recordsProcessed:row.row_count,status:'Completed'})));
});
export const POST=endpoint(async request=>{
 const{client,companyId,user}=await tenant(request,'attendance.write');const p=await body(request,z.object({reason:z.string().min(1).max(1000),rows:z.array(attendanceRowInput).min(1).max(1000)}).strict(),1_000_000);
 const response=await client.rpc('import_attendance',{c:companyId,rows_json:p.rows,reason_text:p.reason});if(response.error?.code==='23514'&&response.error.message==='Attendance finalized')throw new ApiError(409,'ATTENDANCE_LOCKED','This attendance month is finalized. Reopen it through attendance review before importing.');
 if(response.error?.code==='22023'&&response.error.message==='Employee/date invalid'){
  const ids=[...new Set(p.rows.map(row=>row.employeeId).filter(id=>z.string().uuid().safeParse(id).success))];
  for(let offset=0;offset<ids.length;offset+=100){
   const employees=await client.from('employees').select('id,employee_code,joining_date,exit_date').eq('company_id',companyId).in('id',ids.slice(offset,offset+100));databaseError(employees.error);
   const bounds=new Map((employees.data??[]).map(employee=>[employee.id,employee]));
   for(const row of p.rows){const employee=bounds.get(row.employeeId);if(!employee)continue;
    if(row.date<employee.joining_date)throw new ApiError(422,'EMPLOYMENT_DATE_INVALID',employee.employee_code+': '+row.date+' is before joining date '+employee.joining_date+'. Upload only employment dates or use separate test employees.');
    if(employee.exit_date&&row.date>employee.exit_date)throw new ApiError(422,'EMPLOYMENT_DATE_INVALID',employee.employee_code+': '+row.date+' is after leaving date '+employee.exit_date+'. Upload only employment dates.');
   }
  }
  throw new ApiError(422,'EMPLOYMENT_DATE_INVALID','An employee is unavailable or an attendance date is outside employment. Refresh the employee list and validate the file again.');
 }
 if(response.error?.code==='22023'&&response.error.message==='Attendance precedes the new employee joining date')throw new ApiError(422,'EMPLOYMENT_DATE_INVALID','Attendance is before a new employee joining date. Correct the file or the joining date supplied in upload settings.');
 if(response.error?.code==='23505')throw new ApiError(409,'CONFLICT','Attendance already exists for an employee/date. Refresh the register and use Edit to correct it. The import was not saved.');
 databaseError(response.error);
 return result({id:response.data,kind:'Attendance',fileName:'CSV attendance import',uploadedBy:user.id,uploadedOn:new Date().toISOString(),totalRows:p.rows.length,validRows:p.rows.length,errorRows:0,status:'Completed'},201);
});
