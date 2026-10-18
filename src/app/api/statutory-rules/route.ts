import { z } from 'zod';
import { tenant } from '@/server/auth';
import { body,databaseError,endpoint,result } from '@/server/http';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'settings.write');
 const response=await client.from('company_statutory_settings').select('*').eq('company_id',companyId).order('effective_from',{ascending:false}).limit(1000);databaseError(response.error);return result(response.data);
});
export const POST=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'settings.write');
 const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/),minor=z.number().int().nonnegative().max(9000000000000);
 const p=await body(request,z.object({code:z.enum(['pf','esi','pt','tds']),state:z.string().max(100),effectiveFrom:date,effectiveTo:date,wageComponents:z.array(z.enum(['basic','da','hra','special','conveyance','other','bonus','variable','overtime','arrears','reimbursement'])).min(1).max(11),employeeBasisPoints:z.number().int().min(0).max(10000),employerBasisPoints:z.number().int().min(0).max(10000),wageCapMinor:minor.nullable(),fixedMinor:minor,verificationReference:z.string().trim().min(1).max(1000)}).strict());
 const response=await client.rpc('save_statutory_rule',{c:companyId,p});databaseError(response.error);return result({id:response.data},201);
});
