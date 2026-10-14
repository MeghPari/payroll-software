import { z } from 'zod';
import { tenant } from '@/server/auth';
import { body,databaseError,endpoint,result } from '@/server/http';
export const POST=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'employees.write');
 const input=await body(request,z.object({ids:z.array(z.string().uuid()).min(1).max(1000),field:z.enum(['department','workLocation','state','pfApplicable','esiApplicable']),value:z.union([z.string().min(1).max(160),z.boolean()])}).strict());
 const response=await client.rpc('bulk_update_employees',{c:companyId,employee_ids:input.ids,field_name:input.field,field_value:input.value});databaseError(response.error);
 return result({updated:true});
});
