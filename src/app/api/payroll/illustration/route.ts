import {z} from 'zod';
import {tenant} from '@/server/auth';
import {ApiError,databaseError,endpoint,result} from '@/server/http';
import {payrollIllustration,type IllustrationEmployee,type IllustrationSalary,type IllustrationAttendance} from '@/domain/payroll-illustration';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'payroll.run');
 for(const permission_code of ['salary.read','attendance.read']){const permission=await client.rpc('has_permission',{c:companyId,permission_code});databaseError(permission.error);if(permission.data!==true)throw new ApiError(403,'FORBIDDEN','Salary and attendance read access are required for this preview.');}
 const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(new URL(request.url).searchParams.get('month'));
 const end=new Date(month+'-01T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);const until=end.toISOString().slice(0,10);
 const employees:IllustrationEmployee[]=[],salaries:IllustrationSalary[]=[],attendance:IllustrationAttendance[]=[],held:string[]=[];
 await Promise.all([
  (async()=>{for(let offset=0;;offset+=500){const page=await client.from('employees').select('id,employee_code,first_name,last_name,joining_date,exit_date,status').eq('company_id',companyId).lt('joining_date',until).order('id').range(offset,offset+499);databaseError(page.error);employees.push(...page.data??[]);if((page.data?.length??0)<500)break;}})(),
  (async()=>{for(let offset=0;;offset+=500){const page=await client.from('employee_salary_assignments').select('employee_id,effective_from,employee_salary_component_values(component_code,amount_minor)').eq('company_id',companyId).order('id').range(offset,offset+499);databaseError(page.error);salaries.push(...page.data??[]);if((page.data?.length??0)<500)break;}})(),
  (async()=>{for(let offset=0;;offset+=500){const page=await client.from('attendance_records').select('employee_id,date,status').eq('company_id',companyId).gte('date',month+'-01').lt('date',until).order('id').range(offset,offset+499);databaseError(page.error);attendance.push(...page.data??[]);if((page.data?.length??0)<500)break;}})(),
  (async()=>{for(let offset=0;;offset+=500){const page=await client.from('salary_holds').select('employee_id').eq('company_id',companyId).eq('month',month+'-01').is('released_at',null).order('id').range(offset,offset+499);databaseError(page.error);held.push(...(page.data??[]).map(row=>row.employee_id));if((page.data?.length??0)<500)break;}})()
 ]);
 return result({mode:'illustration',basis:'Calendar days; half-up rounding',persisted:false,netCalculated:false,rows:payrollIllustration(month,employees,salaries,attendance,held)});
});
