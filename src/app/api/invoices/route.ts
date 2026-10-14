import { z } from 'zod';
import { tenant } from '@/server/auth';
import { body,databaseError,endpoint,result } from '@/server/http';
import { financeError } from '@/server/finance-errors';
import { invoiceDate,invoiceInput } from '@/domain/invoice-input';
import { allRows } from '@/server/paging';
export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'accounting.read');const kind=z.enum(['Sales','Purchase']).parse(new URL(request.url).searchParams.get('kind'));
 const invoices=[];
 for(let offset=0;;offset+=100){
  const response=await client.from('invoices').select('*,invoice_items(*)').eq('company_id',companyId).eq('kind',kind).order('date',{ascending:false}).order('id').range(offset,offset+99);databaseError(response.error);invoices.push(...(response.data??[]));if((response.data?.length??0)<100)break;
 }
 const payments=await allRows((first,last)=>client.from('invoice_payments').select('invoice_id,transaction_id,bank_transactions(id,date,reference,amount_minor,status)').eq('company_id',companyId).order('invoice_id').order('transaction_id').range(first,last));
 const grouped=new Map<string,typeof payments>();for(const payment of payments){const rows=grouped.get(payment.invoice_id)??[];rows.push(payment);grouped.set(payment.invoice_id,rows);}
 return result(invoices.map(invoice=>({...invoice,invoice_payments:grouped.get(invoice.id)??[]})));
});
export const POST=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'accounting.write');
 const input=await body(request,z.discriminatedUnion('action',[
  z.object({action:z.literal('create'),invoice:invoiceInput}).strict(),
  z.object({action:z.literal('edit'),id:z.string().uuid(),expectedVersion:z.number().int().positive(),invoice:invoiceInput}).strict(),
  z.object({action:z.literal('post'),id:z.string().uuid(),expectedVersion:z.number().int().positive()}).strict(),
  z.object({action:z.literal('cancel'),id:z.string().uuid(),expectedVersion:z.number().int().positive(),date:invoiceDate,reason:z.string().trim().min(1).max(1000)}).strict(),
  z.object({action:z.literal('payment'),id:z.string().uuid(),bankId:z.string().uuid(),amountMinor:z.number().int().positive().max(9000000000000),date:invoiceDate,reference:z.string().trim().min(1).max(160),evidence:z.string().trim().min(1).max(1000)}).strict(),
 ]));
 const response=input.action==='create'||input.action==='edit'?await client.rpc('create_invoice',{c:companyId,p:input.action==='edit'?{...input.invoice,id:input.id,expectedVersion:input.expectedVersion}:input.invoice}):input.action==='post'?await client.rpc('post_invoice',{c:companyId,i:input.id,expected_version:input.expectedVersion}):input.action==='cancel'?await client.rpc('cancel_invoice',{c:companyId,i:input.id,expected_version:input.expectedVersion,reversal_date:input.date,reason_text:input.reason}):await client.rpc('record_invoice_payment',{c:companyId,i:input.id,b:input.bankId,amount:input.amountMinor,payment_date:input.date,reference_text:input.reference,evidence:input.evidence});
 financeError(response.error);return result({id:response.data,saved:true});
});
