import { decimalMinor,type ReportEntry,type ReportTable } from './accounting-reports';
import { sum } from './money';
export function bankBook(kind:'Bank'|'Cash',month:string,accounts:{account_id:string;name:string;kind:string}[],entries:ReportEntry[]):ReportTable{
 const start=month+'-01',end=new Date(start+'T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);
 const selected=accounts.filter(account=>account.kind===kind),ids=new Set(selected.map(account=>account.account_id));
 if(ids.size!==selected.length)throw new Error('Bank and cash ledgers must have unique account classifications.');
 const posted=entries.filter(entry=>entry.status==='Posted'&&entry.date<end.toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const report:ReportTable={title:kind+' Book',month,headers:['Account','Date','Voucher','Inflow INR','Outflow INR','Book Balance INR','Narration'],rows:[],note:'Posted ledger movements and opening/closing balances. These are company book records, not a fetched bank statement.'};
 for(const account of selected){
  let balance=sum(posted.filter(entry=>entry.date<start).flatMap(entry=>entry.journal_lines.filter(line=>line.account_id===account.account_id).map(line=>Number(line.debit_minor)-Number(line.credit_minor))));
  report.rows.push([account.name,start,'Opening','','',decimalMinor(balance),'']);
  for(const entry of posted.filter(entry=>entry.date>=start)){
   const lines=entry.journal_lines.filter(line=>line.account_id===account.account_id);if(!lines.length)continue;
   const debit=sum(lines.map(line=>Number(line.debit_minor))),credit=sum(lines.map(line=>Number(line.credit_minor)));balance=sum([balance,debit,-credit]);
   report.rows.push([account.name,entry.date,entry.voucher_number,decimalMinor(debit),decimalMinor(credit),decimalMinor(balance),entry.narration]);
  }
  report.rows.push([account.name,end.toISOString().slice(0,10),'Closing','','',decimalMinor(balance),'As of previous day']);
 }
 if(!selected.length)report.note+=' No '+kind.toLowerCase()+' accounts are configured in Banking.';
 return report;
}
