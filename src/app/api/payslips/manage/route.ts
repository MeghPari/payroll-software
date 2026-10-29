import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError,body,databaseError,endpoint,result } from '@/server/http';
export const POST=endpoint(async request=>{
 const p=await body(request,z.object({action:z.enum(['generate','regenerate','publish']),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/),ids:z.array(z.string().uuid()).min(1).max(100)}).strict());
 const{client,companyId}=await tenant(request,p.action==='publish'?'payroll.approve':'payroll.run');
 const response=p.action==='publish'?await client.rpc('payslip_module_publish',{c:companyId,slip_ids:p.ids}):await client.rpc('payslip_module_generate',{c:companyId,m:p.month,employee_ids:p.ids,regenerate:p.action==='regenerate'});
 if(response.error?.code==='23514')throw new ApiError(422,'PAYSLIP_NOT_READY','Generation requires a locked payroll batch with complete saved salary and attendance details. Published payslips are preserved.');
 databaseError(response.error);return result({count:response.data});
});
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'payslips.read');
 const id=z.string().uuid().parse(new URL(request.url).searchParams.get('id'));
 const slip=await client.from('payslips').select('id').eq('company_id',companyId).eq('id',id).maybeSingle();databaseError(slip.error);if(!slip.data)throw new ApiError(404,'NOT_FOUND','Payslip not found.');
 const [emails,revisions]=await Promise.all([
  client.from('payslip_email_attempts').select('id,recipient,status,created_at,completed_at,provider_id,error_code').eq('company_id',companyId).eq('payslip_id',id).order('created_at',{ascending:false}).limit(100),
  client.from('payslip_revisions').select('id,generated_at,archived_at,run_version,status').eq('company_id',companyId).eq('payslip_id',id).order('archived_at',{ascending:false}).limit(100),
 ]);databaseError(emails.error);databaseError(revisions.error);return result({emails:emails.data??[],revisions:revisions.data??[]});
});
