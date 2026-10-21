import { tenant } from '@/server/auth';
import { ApiError,databaseError,endpoint,result } from '@/server/http';
export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'salary.read');
 const response=await client.from('salary_structures').select('id,name,status,created_at,version,salary_structure_components(component_code,calculation_type,value_minor,salary_components(name,kind))').eq('company_id',companyId).order('name');databaseError(response.error);
 return result(response.data);
});
export const POST=endpoint(async request=>{await tenant(request,'salary.write');throw new ApiError(410,'EMPLOYEE_DATABASE_REQUIRED','Upload Employee Database to provide employee-specific salary components.');});
