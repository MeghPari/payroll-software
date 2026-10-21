import {hasDaComponent,compatibleSalaryAmounts} from '@/server/salary-template-compat';
import{z}from 'zod';import{tenant}from '@/server/auth';import{body,databaseError,endpoint,result}from '@/server/http';
export const POST=endpoint(async request=>{
 const{client,companyId,user}=await tenant(request,'salary.write');const p=await body(request,z.object({rows:z.array(z.object({employeeId:z.string().uuid(),structureId:z.string().uuid(),effectiveFrom:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),amounts:z.record(z.number().int().nonnegative().max(9000000000000)),remarks:z.string().max(1000)}).strict()).min(1).max(1000)}).strict());
 const available=await hasDaComponent(client);const rows=p.rows.map(row=>({...row,amounts:compatibleSalaryAmounts(row.amounts,available)}));
 const response=await client.rpc('import_salary',{c:companyId,rows_json:rows});databaseError(response.error);return result({id:response.data,kind:'Salary',fileName:'Salary CSV import',uploadedBy:user.id,uploadedOn:new Date().toISOString(),totalRows:p.rows.length,validRows:p.rows.length,errorRows:0,status:'Completed'},201);
});
