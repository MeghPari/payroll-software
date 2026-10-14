import { z } from 'zod';
import { tenant } from '@/server/auth';
import { body,databaseError,endpoint,result } from '@/server/http';
export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'salary.read');
 const response=await client.from('salary_structures').select('id,name,status,created_at,version,salary_structure_components(component_code,calculation_type,value_minor,salary_components(name,kind))').eq('company_id',companyId).order('name');databaseError(response.error);
 return result(response.data);
});
export const POST=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'salary.write');
 const input=await body(request,z.object({id:z.string().uuid().optional(),expectedVersion:z.number().int().positive().optional(),name:z.string().trim().min(1).max(160),status:z.enum(['Active','Draft','Archived']),components:z.array(z.object({code:z.enum(['basic','hra','special','conveyance','other','bonus','variable','loan','advance','otherDeduction','employerOther']),calculationType:z.literal('As per record'),valueMinor:z.number().int().nonnegative().max(9000000000000).nullable()}).strict()).min(1).max(20)}).strict());
 const response=await client.rpc('save_salary_structure',{c:companyId,p:{name:input.name,status:input.status,components:input.components},e:input.id??null,expected_version:input.expectedVersion??null});databaseError(response.error);return result({id:response.data},input.id?200:201);
});
