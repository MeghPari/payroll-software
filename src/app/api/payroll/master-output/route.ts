import {z} from 'zod';
import {tenant} from '@/server/auth';
import {ApiError,databaseError,endpoint,result} from '@/server/http';
import {allRows} from '@/server/paging';
import {MASTER_PAYROLL_COLUMNS,masterPayrollValues} from '@/domain/master-payroll-output';
import {escapeCSV} from '@/domain/csv';
import type {PayrollSnapshot} from '@/services/payroll-run.service';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'payroll.run');
 const access=await client.rpc('has_permission',{c:companyId,permission_code:'salary.read'});databaseError(access.error);if(!access.data)throw new ApiError(403,'FORBIDDEN','Salary read access required.');
 const params=new URL(request.url).searchParams,month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(params.get('month'));
 const run=await client.from('payroll_runs').select('id,status,version').eq('company_id',companyId).eq('month',month+'-01').maybeSingle();databaseError(run.error);
 const snapshots=run.data?await allRows((first,last)=>client.from('payroll_run_employees').select('*').eq('company_id',companyId).eq('run_id',run.data!.id).order('employee_id').range(first,last)) as PayrollSnapshot[]:[];
 const rows=snapshots.map(row=>masterPayrollValues(row,month));
 if(params.get('export')==='csv')return new Response('\uFEFF'+[MASTER_PAYROLL_COLUMNS,...rows].map(row=>row.map(escapeCSV).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="Payroll-${month}.csv"`,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
 return result({run:run.data,columns:MASTER_PAYROLL_COLUMNS,rows});
});
