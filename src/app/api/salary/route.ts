import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError,databaseError,endpoint,result } from '@/server/http';
export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'salary.read');
 const params=new URL(request.url).searchParams;
 const employeeId=params.has('employeeId')?z.string().uuid().parse(params.get('employeeId')):null,rows=[];
 for(let offset=0;;offset+=500){
  let query=client.from('employee_salary_assignments').select('id,employee_id,structure_id,effective_from,remarks,created_by,created_at,salary_structures(name),employee_salary_component_values(component_code,amount_minor)').eq('company_id',companyId).not('master_source_id','is',null).order('effective_from',{ascending:false}).order('id').range(offset,offset+499);
  if(employeeId)query=query.eq('employee_id',employeeId);
  const response=await query;databaseError(response.error);rows.push(...(response.data??[]));if((response.data?.length??0)<500)break;
 }
 return result(rows);
});
export const POST=endpoint(async request=>{await tenant(request,'salary.write');throw new ApiError(410,'EMPLOYEE_DATABASE_REQUIRED','Upload Employee Database to change salary components with a reviewed effective date.');});
