import { z } from 'zod';
import { tenant } from '@/server/auth';
import { body,databaseError,endpoint,result } from '@/server/http';
import { financeError } from '@/server/finance-errors';
import { invoiceDate } from '@/domain/invoice-input';
import { companyToday,monthLabel } from '@/domain/dates';
import { sum } from '@/domain/money';
export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'accounting.read');
 const [accounts,transactions]=await Promise.all([client.from('bank_accounts').select('id,account_id,kind,name,bank_name,account_number,ifsc').eq('company_id',companyId).order('name'),client.from('bank_transactions').select('id,bank_id,date,direction,amount_minor,reference,status,confirmed_at').eq('company_id',companyId).order('date',{ascending:false}).order('id').limit(100)]);
 for(const response of[accounts,transactions])databaseError(response.error);
 const balances=new Map<string,number[]>((accounts.data??[]).map(account=>[account.account_id,[]]));
 const today=companyToday(),months=new Map<string,{inflow:number[];outflow:number[]}>();
 const cursor=new Date(`${today.slice(0,7)}-01T00:00:00Z`);cursor.setUTCMonth(cursor.getUTCMonth()-5);
 for(let n=0;n<6;n++){months.set(cursor.toISOString().slice(0,7),{inflow:[],outflow:[]});cursor.setUTCMonth(cursor.getUTCMonth()+1);}
 if(balances.size)for(let offset=0;;offset+=250){
  const entries=await client.from('journal_entries').select('id,date,journal_lines(account_id,debit_minor,credit_minor)').eq('company_id',companyId).eq('status','Posted').lte('date',today).order('id').range(offset,offset+249);databaseError(entries.error);
  for(const entry of entries.data??[])for(const line of entry.journal_lines){const values=balances.get(line.account_id);if(!values)continue;const debit=Number(line.debit_minor),credit=Number(line.credit_minor);values.push(debit-credit);const movement=months.get(entry.date.slice(0,7));movement?.inflow.push(debit);movement?.outflow.push(credit);}
  if((entries.data?.length??0)<250)break;
 }
 return result({accounts:(accounts.data??[]).map(account=>({...account,account_number:account.account_number?`••••${account.account_number.slice(-4)}`:'',balanceMinor:sum(balances.get(account.account_id)??[])})),transactions:transactions.data??[],cashFlow:balances.size?Array.from(months,([month,amounts])=>({month:monthLabel(month),inflow:sum(amounts.inflow)/100,outflow:sum(amounts.outflow)/100})):[]});
});
export const POST=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'accounting.write');
 const input=await body(request,z.discriminatedUnion('action',[
  z.object({action:z.literal('account'),accountId:z.string().uuid(),kind:z.enum(['Bank','Cash']),name:z.string().trim().min(1).max(160),bankName:z.string().max(160).default(''),accountNumber:z.string().regex(/^([0-9]{6,34})?$/).default(''),ifsc:z.string().regex(/^([A-Z]{4}0[A-Z0-9]{6})?$/).default('')}).strict(),
  z.object({action:z.literal('reverse'),id:z.string().uuid(),date:invoiceDate,reason:z.string().trim().min(1).max(1000)}).strict(),
 ]));
 const response=input.action==='account'?await client.rpc('save_bank_account',{c:companyId,p:input}):await client.rpc('reverse_bank_transaction',{c:companyId,t:input.id,reversal_date:input.date,reason_text:input.reason});financeError(response.error);return result({id:response.data,saved:true});
});
