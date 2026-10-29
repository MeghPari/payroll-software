import 'server-only';
export interface EmailDelivery {status:'Sent'|'Failed'|'Unconfirmed';providerId:string|null;errorCode:string|null}
export async function sendPayslipEmail(input:{attemptId:string;recipient:string;employeeName:string;companyName:string;month:string;pdf:Uint8Array}):Promise<EmailDelivery>{
 const key=process.env.RESEND_API_KEY,from=process.env.PAYSLIP_FROM_EMAIL;
 if(!key||!from)return{status:'Failed',providerId:null,errorCode:'EMAIL_PROVIDER_NOT_CONFIGURED'};
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`payflow-payslip/${input.attemptId}`},signal:AbortSignal.timeout(10000),body:JSON.stringify({
   from,to:[input.recipient],subject:`${input.companyName} - Payslip ${input.month.slice(0,7)}`,
   text:`Hello ${input.employeeName},\n\nYour payslip for ${input.month.slice(0,7)} is attached. Please contact your payroll administrator with any questions.\n\n${input.companyName}`,
   attachments:[{filename:`payslip-${input.month.slice(0,7)}.pdf`,content:Buffer.from(input.pdf).toString('base64')}],
  })});
  if(!response.ok)return{status:response.status>=500||response.status===409?'Unconfirmed':'Failed',providerId:null,errorCode:response.status===429?'EMAIL_RATE_LIMITED':response.status>=500||response.status===409?'EMAIL_UNCONFIRMED':'EMAIL_PROVIDER_REJECTED'};
  const payload=await response.json();if(typeof payload.id!=='string')return{status:'Unconfirmed',providerId:null,errorCode:'EMAIL_UNCONFIRMED'};
  return{status:'Sent',providerId:payload.id,errorCode:null};
 }catch{return{status:'Unconfirmed',providerId:null,errorCode:'EMAIL_UNCONFIRMED'};}
}
