import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError,body,databaseError,endpoint } from '@/server/http';
import { payslipPdf,type PayslipContent } from '@/server/payslip-pdf';
import { payslipZip } from '@/server/payslip-zip';
export const maxDuration=60;
export const POST=endpoint(async request=>{
 const{client,companyId}=await tenant(request);
 const p=await body(request,z.object({ids:z.array(z.string().uuid()).min(1).max(25)}).strict()),ids=[...new Set(p.ids)];
 const response=await client.from('payslips').select('id,status,content,generated_at').eq('company_id',companyId).in('id',ids);databaseError(response.error);
 if(response.data?.length!==ids.length)throw new ApiError(404,'NOT_FOUND','Some selected payslips are unavailable. Refresh and retry.');
 const files:{name:string;bytes:Uint8Array}[]=[];let size=0;
 for(const slip of response.data){
  const content=slip.content as PayslipContent,bytes=await payslipPdf(content,slip.id,slip.status,slip.generated_at);size+=bytes.length;
  if(size>32*1024*1024)throw new ApiError(413,'ZIP_TOO_LARGE','Download fewer payslips at a time.');
  files.push({name:`payslip-${content.employeeCode}-${content.month.slice(0,7)}-${slip.id}.pdf`,bytes});
  const audit=await client.rpc('record_private_download',{c:companyId,kind:'payslip',r:slip.id});databaseError(audit.error);
 }
 return new Response(payslipZip(files) as BodyInit,{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="payslips.zip"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'}});
});
