import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError,body,databaseError,endpoint,result } from '@/server/http';
import { financeError } from '@/server/finance-errors';
import { invoiceDate } from '@/domain/invoice-input';
import { manualInstructionExporter } from '@/domain/payment-instructions';
import type { DisbursementBatch } from '@/domain/disbursement';
const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/);
export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'disbursements.write');const params=new URL(request.url).searchParams;
 const m=month.parse(params.get('month')),exporting=params.get('export')==='csv';
 const response=await client.rpc('disbursement_batch',{c:companyId,m,include_bank_details:exporting});databaseError(response.error);
 if(!exporting)return result(response.data as DisbursementBatch|null);
 const batch=response.data as DisbursementBatch|null;if(!batch)throw new ApiError(422,'INSTRUCTIONS_NOT_PREPARED','Prepare payment instructions for this month before exporting.');
 let retry: {id:string;employeeId:string;amountMinor:number}|undefined;
 if(params.has('retryId')){const id=z.string().uuid().parse(params.get('retryId')),attempt=await client.from('salary_payment_attempts').select('id,employee_id,amount_minor').eq('company_id',companyId).eq('batch_id',batch.id).eq('id',id).eq('kind','Retry Prepared').maybeSingle();databaseError(attempt.error);if(!attempt.data)throw new ApiError(404,'NOT_FOUND','Retry instructions not found.');retry={id:attempt.data.id,employeeId:attempt.data.employee_id,amountMinor:Number(attempt.data.amount_minor)};}
 let csv:string;try{csv=manualInstructionExporter.prepare(batch,retry);}catch(error){throw new ApiError(422,'INSTRUCTIONS_INVALID',error instanceof Error?error.message:'Review the captured payment instructions.');}
 const audit=await client.rpc('record_private_download',{c:companyId,kind:'salary-instructions',r:batch.id});databaseError(audit.error);
 return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="payment-instructions-${m.slice(0,7)}${retry?'-retry':''}.csv"`,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
});
export const POST=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'disbursements.write');
 const input=await body(request,z.discriminatedUnion('action',[
  z.object({action:z.literal('prepare'),month,bankId:z.string().uuid()}).strict(),
  z.object({action:z.literal('record'),batchId:z.string().uuid(),employeeId:z.string().uuid(),amountMinor:z.number().int().positive().max(9000000000000),date:invoiceDate,reference:z.string().trim().min(1).max(160),evidence:z.string().trim().min(1).max(1000)}).strict(),
  z.object({action:z.literal('cancel'),batchId:z.string().uuid(),reason:z.string().trim().min(1).max(1000)}).strict(),
 ]));
 const response=input.action==='prepare'?await client.rpc('prepare_disbursement',{c:companyId,m:input.month,b:input.bankId}):input.action==='cancel'?await client.rpc('cancel_disbursement',{c:companyId,b:input.batchId,reason_text:input.reason}):await client.rpc('record_salary_payment',{c:companyId,batch_id:input.batchId,e:input.employeeId,amount:input.amountMinor,payment_date:input.date,reference_text:input.reference,evidence:input.evidence});
 financeError(response.error);return result({id:response.data,saved:true});
});
