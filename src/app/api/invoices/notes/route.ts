import { z } from 'zod';import { tenant } from '@/server/auth';import { body,databaseError,endpoint,result } from '@/server/http';import { financeError } from '@/server/finance-errors';import { invoiceDate } from '@/domain/invoice-input';import { allRows } from '@/server/paging';
export const GET=endpoint(async request=>{const{client,companyId}=await tenant(request,'accounting.read'),id=z.string().uuid().parse(new URL(request.url).searchParams.get('invoiceId'));return result(await allRows((start,end)=>client.from('invoice_notes').select('*').eq('company_id',companyId).eq('invoice_id',id).order('date').order('id').range(start,end)));});
export const POST=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'accounting.write'),minor=z.number().int().nonnegative().max(9000000000000);
 const input=await body(request,z.discriminatedUnion('action',[
  z.object({action:z.literal('post'),invoiceId:z.string().uuid(),expectedVersion:z.number().int().positive(),kind:z.enum(['Credit','Debit']),number:z.string().trim().min(1).max(80),date:invoiceDate,taxableMinor:minor,cgstMinor:minor,sgstMinor:minor,igstMinor:minor,reason:z.string().trim().min(1).max(1000),reviewReference:z.string().trim().min(1).max(1000)}).strict(),
  z.object({action:z.literal('reverse'),id:z.string().uuid(),expectedVersion:z.number().int().positive(),date:invoiceDate,reason:z.string().trim().min(1).max(1000)}).strict()
 ]));
 const response=input.action==='post'?await client.rpc('post_invoice_note',{c:companyId,i:input.invoiceId,expected_version:input.expectedVersion,p:input}):await client.rpc('reverse_invoice_note',{c:companyId,n:input.id,expected_version:input.expectedVersion,reversal_date:input.date,reason_text:input.reason});financeError(response.error);databaseError(response.error);return result({id:response.data});
});
