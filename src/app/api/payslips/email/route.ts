import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError,body,databaseError,endpoint,result } from '@/server/http';
import { payslipPdf,type PayslipContent } from '@/server/payslip-pdf';
import { sendPayslipEmail } from '@/server/payslip-email';
export const maxDuration=60;
export const POST=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'payroll.approve');
 const p=await body(request,z.object({ids:z.array(z.string().uuid()).min(1).max(5),requestKey:z.string().uuid()}).strict());
 if(!process.env.RESEND_API_KEY||!process.env.PAYSLIP_FROM_EMAIL)throw new ApiError(503,'EMAIL_PROVIDER_NOT_CONFIGURED','Configure RESEND_API_KEY and PAYSLIP_FROM_EMAIL to send payslips.');
 const results:{id:string;status:string;message?:string}[]=[];
 for(const id of [...new Set(p.ids)]){
  const slip=await client.from('payslips').select('id,status,content,generated_at').eq('company_id',companyId).eq('id',id).maybeSingle();databaseError(slip.error);
  if(!slip.data||slip.data.status!=='Published'){results.push({id,status:'Failed',message:'Publish this payslip before emailing.'});continue;}
  let pdf:Uint8Array;
  try{pdf=await payslipPdf(slip.data.content as PayslipContent,id,slip.data.status,slip.data.generated_at);}catch{results.push({id,status:'Failed',message:'Saved payslip PDF could not be rendered.'});continue;}
  const claimed=await client.rpc('payslip_email_claim',{c:companyId,slip:id,request_key:p.requestKey});
  if(claimed.error){if(['23514','22023'].includes(claimed.error.code)){results.push({id,status:'Skipped',message:'Check the employee work email and existing email history. Payslip may already have been sent.'});continue;}databaseError(claimed.error);}
  const attempt=claimed.data;
  if(!attempt.acquired){results.push({id,status:attempt.status,message:'This request was already recorded. Check email history.'});continue;}
  const content=slip.data.content as PayslipContent;
  const sent=await sendPayslipEmail({attemptId:attempt.id,recipient:attempt.recipient,employeeName:content.employeeName,companyName:content.companyName,month:content.month,pdf});
  const completed=await client.rpc('payslip_email_complete',{c:companyId,attempt:attempt.id,outcome:sent.status,provider_reference:sent.providerId,failure_code:sent.errorCode});
  databaseError(completed.error);results.push({id,status:sent.status});
  // Stay below the default provider request rate, including fast rejections.
  if(p.ids.length>1)await new Promise(resolve=>setTimeout(resolve,600));
 }
 return result({results});
});
