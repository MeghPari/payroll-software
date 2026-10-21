import {z} from 'zod';
import {tenant} from '@/server/auth';
import {body,databaseError,endpoint,result} from '@/server/http';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'payroll.run');
 const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(new URL(request.url).searchParams.get('month'));
 const response=await client.rpc('payroll_master_reconciliation',{c:companyId,m:month+'-01'});databaseError(response.error);return result(response.data);
});

export const POST=endpoint(async request=>{const{client,companyId}=await tenant(request,'payroll.run');const input=await body(request,z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),reason:z.string().trim().min(1).max(1000)}).strict());const response=await client.rpc('reconcile_saved_master_attendance',{c:companyId,m:input.month+'-01',reason_text:input.reason});databaseError(response.error);return result({matchedRows:response.data});});
