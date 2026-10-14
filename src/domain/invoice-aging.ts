import { decimalMinor,type ReportTable } from './accounting-reports';import { sum } from './money';
export interface AgingInvoice{id:string;kind:'Sales'|'Purchase';invoice_number:string;date:string;due_date:string;total_minor:number;journal_id:string|null;party_snapshot:{name:string}}
export interface AgingEvent{invoiceId:string;journalId:string;changeMinor:number}
export function invoiceAging(kind:'Sales'|'Purchase',month:string,invoices:AgingInvoice[],events:AgingEvent[],journals:{id:string;date:string;status:string;reversal_of:string|null}[]):ReportTable{
 const end=new Date(month+'-01T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);const cutoff=end.toISOString().slice(0,10),asOf=new Date(end.getTime()-86400000).toISOString().slice(0,10);
 const posted=new Map(journals.filter(journal=>journal.status==='Posted'&&journal.date<cutoff).map(journal=>[journal.id,journal]));
 const grouped=new Map<string,AgingEvent[]>();for(const event of events){const group=grouped.get(event.invoiceId)??[];group.push(event);grouped.set(event.invoiceId,group);}
 const reversals=new Map<string,string[]>();for(const journal of posted.values())if(journal.reversal_of)reversals.set(journal.reversal_of,[...(reversals.get(journal.reversal_of)??[]),journal.id]);
 const rows:(string|number)[][]=[];const totals:number[]=[];
 for(const invoice of invoices.filter(invoice=>invoice.kind===kind&&invoice.journal_id&&posted.has(invoice.journal_id))){
  const changes=[{invoiceId:invoice.id,journalId:invoice.journal_id!,changeMinor:Number(invoice.total_minor)},...(grouped.get(invoice.id)??[])];
  const balance=sum(changes.flatMap(event=>[...(posted.has(event.journalId)?[event.changeMinor]:[]),...(reversals.get(event.journalId)??[]).map(()=>-event.changeMinor)]));
  if(balance===0)continue;
  const days=Math.max(0,Math.floor((Date.parse(asOf+'T00:00:00Z')-Date.parse(invoice.due_date+'T00:00:00Z'))/86400000)),bucket=balance<0?'Credit balance':days===0?'Not overdue':days<=30?'1-30 days':days<=60?'31-60 days':days<=90?'61-90 days':'Over 90 days';
  rows.push([invoice.invoice_number,invoice.party_snapshot.name,invoice.date,invoice.due_date,days,bucket,decimalMinor(balance)]);totals.push(balance);
 }
 rows.sort((a,b)=>String(a[3]).localeCompare(String(b[3]))||String(a[0]).localeCompare(String(b[0])));rows.push(['','Total','','','','',decimalMinor(sum(totals))]);
 return{title:kind==='Sales'?'Receivables Aging':'Payables Aging',month,headers:['Invoice','Captured Party','Invoice Date','Due Date','Days Overdue','Age Bucket','Outstanding INR'],rows,note:`As of ${asOf}, reconstructed from posted invoices, notes, payment journals and their dated reversals. Current cancellation/payment status does not rewrite earlier periods. Credit balances are shown separately; no refund or collection action is inferred.`};
}
