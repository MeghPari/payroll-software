import { z } from 'zod';import { tenant } from '@/server/auth';import { ApiError,databaseError,endpoint } from '@/server/http';import { payslipPdf,type PayslipContent } from '@/server/payslip-pdf';
import {employeeSetupWarnings} from '@/domain/payroll-setup';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request);const id=z.string().uuid().parse(new URL(request.url).searchParams.get('id'));
 const response=await client.from('payslips').select('id,status,content,generated_at,employee_id').eq('company_id',companyId).eq('id',id).maybeSingle();databaseError(response.error);
 if(!response.data)throw new ApiError(404,'NOT_FOUND','Payslip not found.');
 const content={...response.data.content,setupWarnings:employeeSetupWarnings(response.data.content?.setupWarnings,response.data.employee_id)} as PayslipContent;
 let pdf:Uint8Array;try{pdf=await payslipPdf(content,id,response.data.status,response.data.generated_at);}catch(error){if(error instanceof Error&&error.message==='PAYSLIP_FONT_UNSUPPORTED')throw new ApiError(422,'FONT_UNSUPPORTED','This payslip needs an additional font for its employee or company name.');throw error;}
 const audit=await client.rpc('record_private_download',{c:companyId,kind:'payslip',r:id});databaseError(audit.error);
 return new Response(new Uint8Array(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="payslip-${id}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'}});
});
