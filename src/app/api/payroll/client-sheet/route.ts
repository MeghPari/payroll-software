import {z} from 'zod';import {tenant} from '@/server/auth';import {ApiError,databaseError,endpoint,result} from '@/server/http';
import {allRows} from '@/server/paging';import {escapeCSV} from '@/domain/csv';
import {CLIENT_SALARY_COLUMNS} from '@/domain/client-template-columns';
import {clientSalaryValues,type ClientCostReview,type ClientSheetIdentity} from '@/domain/client-salary-sheet';
import type {PayrollSnapshot} from '@/services/payroll-run.service';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'payroll.run');
 for(const permission_code of ['salary.read','employees.sensitive']){const access=await client.rpc('has_permission',{c:companyId,permission_code});databaseError(access.error);if(access.data!==true)throw new ApiError(403,'FORBIDDEN','The client salary sheet contains private employee and bank details.');}
 const params=new URL(request.url).searchParams,month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(params.get('month'))+'-01';
 const run=await client.from('payroll_runs').select('id,status,version').eq('company_id',companyId).eq('month',month).order('batch_number',{ascending:false}).limit(1).maybeSingle();databaseError(run.error);
 if(!run.data)return result({run:null,rows:[]});
 const monthRuns=await client.from('payroll_runs').select('id,version').eq('company_id',companyId).eq('month',month);databaseError(monthRuns.error);
 const snapshots=await allRows((first,last)=>client.from('payroll_run_employees').select('*').eq('company_id',companyId).in('run_id',(monthRuns.data??[]).map(row=>row.id)).order('employee_id').range(first,last)) as PayrollSnapshot[];
 const ids=snapshots.map(row=>row.employee_id);const identities:ClientSheetIdentity[]=[],costs:ClientCostReview[]=[];
 for(let offset=0;offset<ids.length;offset+=100){const selected=ids.slice(offset,offset+100);const responses=await Promise.all([
  client.from('employees').select('id,employee_code,first_name,last_name,joining_date,work_location,state,counter_code,counter_name,departments(name),designations(name)').eq('company_id',companyId).in('id',selected),
  client.from('employee_private_details').select('employee_id,date_of_birth').eq('company_id',companyId).in('employee_id',selected),
  client.from('employee_bank_details').select('employee_id,account_number,ifsc_code').eq('company_id',companyId).in('employee_id',selected),
  client.from('employee_statutory_details').select('employee_id,uan').eq('company_id',companyId).in('employee_id',selected),
  client.from('payroll_client_costs').select('employee_id,amounts,payroll_version,version,review_note').eq('company_id',companyId).eq('month',month).in('employee_id',selected)
 ]);for(const response of responses)databaseError(response.error);
 const personal=new Map((responses[1].data??[]).map(row=>[row.employee_id,row])),banks=new Map((responses[2].data??[]).map(row=>[row.employee_id,row])),statutory=new Map((responses[3].data??[]).map(row=>[row.employee_id,row]));
 for(const employee of responses[0].data??[])identities.push({...employee,dateOfBirth:personal.get(employee.id)?.date_of_birth??'',accountNumber:banks.get(employee.id)?.account_number??'',ifscCode:banks.get(employee.id)?.ifsc_code??'',uan:statutory.get(employee.id)?.uan??''} as unknown as ClientSheetIdentity);
 costs.push(...responses[4].data??[]);
 }
 const employees=new Map(identities.map(row=>[row.id,row])),reviews=new Map(costs.map(row=>[row.employee_id,row]));
 const rows=snapshots.map(snapshot=>{const employee=employees.get(snapshot.employee_id);if(!employee)throw new ApiError(409,'EMPLOYEE_CHANGED','Refresh the employee records before exporting.');return{payrollVersion:monthRuns.data?.find(r=>r.id===snapshot.run_id)?.version??run.data!.version,employerEsiMinor:Number(snapshot.snapshot.employer.esi??0),grossMinor:Number(snapshot.gross_minor),employeeId:snapshot.employee_id,employeeName:snapshot.snapshot.employeeName,values:clientSalaryValues(snapshot,employee,reviews.get(snapshot.employee_id),monthRuns.data?.find(r=>r.id===snapshot.run_id)?.version??run.data!.version),cost:reviews.get(snapshot.employee_id)??null};});
 if(params.get('export')==='csv'){
  const audit=await client.rpc('audit_client_sheet_export',{c:companyId,m:month});databaseError(audit.error);
  return new Response('\uFEFF'+[CLIENT_SALARY_COLUMNS,...rows.map(row=>row.values)].map(row=>row.map(escapeCSV).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="Salary_Structure-${month.slice(0,7)}.csv"`,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
 }
 return result({run:run.data,rows});
});
