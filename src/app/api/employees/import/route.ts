import { z } from 'zod';
import { employeeInput } from '@/server/employee-handlers';
import { tenant } from '@/server/auth';
import { body,databaseError,endpoint,result } from '@/server/http';
export const POST=endpoint(async request=>{
 const {client,companyId,user}=await tenant(request,'employees.write');
 const {rows}=await body(request,z.object({rows:z.array(employeeInput).min(1).max(1000)}).strict());
 const response=await client.rpc('import_employees',{c:companyId,rows_json:rows});databaseError(response.error);
 return result({id:response.data,fileName:'Employee CSV import',kind:'Employee',uploadedBy:user.email??user.id,uploadedOn:new Date().toISOString(),totalRows:rows.length,validRows:rows.length,errorRows:0,status:'Completed'},201);
});
