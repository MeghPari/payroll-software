import {hasDaComponent,compatibleSalaryAmounts} from '@/server/salary-template-compat';
import { z } from 'zod';
import { tenant } from '@/server/auth';
import { body,databaseError,endpoint,result } from '@/server/http';
export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'salary.read');
 const params=new URL(request.url).searchParams;
 const employeeId=params.has('employeeId')?z.string().uuid().parse(params.get('employeeId')):null,rows=[];
 for(let offset=0;;offset+=500){
  let query=client.from('employee_salary_assignments').select('id,employee_id,structure_id,effective_from,remarks,created_by,created_at,salary_structures(name),employee_salary_component_values(component_code,amount_minor)').eq('company_id',companyId).order('effective_from',{ascending:false}).order('id').range(offset,offset+499);
  if(employeeId)query=query.eq('employee_id',employeeId);
  const response=await query;databaseError(response.error);rows.push(...(response.data??[]));if((response.data?.length??0)<500)break;
 }
 return result(rows);
});
export const POST=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'salary.write');
 const input=await body(request,z.object({employeeId:z.string().uuid(),structureId:z.string().uuid(),effectiveFrom:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),amounts:z.record(z.number().int().nonnegative().max(9000000000000)),remarks:z.string().max(1000).default('')}).strict());
 const amounts=compatibleSalaryAmounts(input.amounts,await hasDaComponent(client));
 const response=await client.rpc('assign_salary',{c:companyId,e:input.employeeId,s:input.structureId,effective:input.effectiveFrom,amounts,remarks_text:input.remarks});databaseError(response.error);return result({id:response.data},201);
});
