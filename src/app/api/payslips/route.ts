import { z } from 'zod';import { tenant } from '@/server/auth';import { body,databaseError,endpoint,result } from '@/server/http';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request);const params=new URL(request.url).searchParams;
 const month=params.has('month')?z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/).parse(params.get('month')):null,employeeId=params.has('employeeId')?z.string().uuid().parse(params.get('employeeId')):null,rows=[];
 for(let offset=0;;offset+=500){
  let query=client.from('payslips').select('id,employee_id,month,status,generated_at,published_at,content').eq('company_id',companyId).order('month',{ascending:false}).order('employee_id').order('id').range(offset,offset+499);
  if(month)query=query.eq('month',month);if(employeeId)query=query.eq('employee_id',employeeId);
  const response=await query;databaseError(response.error);rows.push(...(response.data??[]));if((response.data?.length??0)<500)break;
 }
 return result(rows);
});
export const POST=endpoint(async request=>{
 const p=await body(request,z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/),action:z.enum(['generate','publish'])}).strict());
 const{client,companyId}=await tenant(request,p.action==='generate'?'payroll.run':'payroll.approve');
 const response=await client.rpc(p.action==='generate'?'generate_payslips':'publish_payslips',{c:companyId,m:p.month});databaseError(response.error);return result({count:response.data});
});
