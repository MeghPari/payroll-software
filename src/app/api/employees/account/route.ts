import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError,body,databaseError,endpoint,result } from '@/server/http';
export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'users.manage');
 const id=z.string().uuid().parse(new URL(request.url).searchParams.get('employeeId'));
 const response=await client.from('employees').select('id,user_id,version').eq('company_id',companyId).eq('id',id).maybeSingle();databaseError(response.error);
 if(!response.data)throw new ApiError(404,'NOT_FOUND','Employee not found.');return result(response.data);
});
export const POST=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'users.manage');
 const input=await body(request,z.object({employeeId:z.string().uuid(),userId:z.string().uuid().nullable(),expectedVersion:z.number().int().positive(),reason:z.string().trim().min(1).max(1000)}).strict());
 const response=await client.rpc('link_employee_account',{c:companyId,e:input.employeeId,u:input.userId,expected_version:input.expectedVersion,reason_text:input.reason});databaseError(response.error);return result({saved:true});
});
