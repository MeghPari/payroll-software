import { z } from 'zod';
import { tenant } from '@/server/auth';
import { databaseError,endpoint,result } from '@/server/http';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request);
 const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/).parse(new URL(request.url).searchParams.get('month'));
 const response=await client.rpc('payslip_module_dashboard',{c:companyId,m:month});databaseError(response.error);
 return result({...response.data,emailConfigured:!!process.env.RESEND_API_KEY&&!!process.env.PAYSLIP_FROM_EMAIL});
});
