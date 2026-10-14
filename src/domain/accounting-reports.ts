import { sum } from './money';
export interface ReportTable {title:string;month:string;headers:string[];rows:(string|number)[][];note:string}
export interface ReportAccount {id:string;code:string;name:string;type:string}
export interface ReportEntry {id:string;date:string;voucher_number:string;status:string;source_type:string;narration:string;journal_lines:{account_id:string;debit_minor:number;credit_minor:number}[]}
export function decimalMinor(amount:number):string {
 if(!Number.isSafeInteger(amount))throw new Error('Report amount exceeds safe minor units.');
 const value=BigInt(amount),absolute=value<0?-value:value;
 return `${value<0?'-':''}${absolute/BigInt(100)}.${String(absolute%BigInt(100)).padStart(2,'0')}`;
}
export function accountingReport(kind:'trial-balance'|'profit-loss'|'balance-sheet'|'ledger-book'|'payroll-accounting',month:string,accounts:ReportAccount[],entries:ReportEntry[]):ReportTable {
 const start=`${month}-01`,end=new Date(`${start}T00:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1);
 const posted=entries.filter(entry=>entry.status==='Posted'&&entry.date<end.toISOString().slice(0,10));
 const lookup=new Map(accounts.map(account=>[account.id,account]));
 const changes=new Map<string,number[]>();
 for(const entry of posted)if(kind!=='profit-loss'||entry.date>=start)for(const line of entry.journal_lines){if(!lookup.has(line.account_id))throw new Error('A posted line has no visible ledger account.');changes.set(line.account_id,[...(changes.get(line.account_id)??[]),Number(line.debit_minor)-Number(line.credit_minor)]);}
 const balances=accounts.map(account=>({...account,balance:sum(changes.get(account.id)??[])}));
 const note='Amounts are INR, derived only from posted journals. Drafts are excluded.';
 if(kind==='trial-balance'){
  const debits=balances.map(account=>Math.max(0,account.balance)),credits=balances.map(account=>Math.max(0,-account.balance));
  if(sum(debits)!==sum(credits))throw new Error('Posted trial balance is not balanced.');
  return{title:'Trial Balance',month,headers:['Code','Ledger','Type','Debit INR','Credit INR'],rows:[...balances.map(account=>[account.code,account.name,account.type,decimalMinor(Math.max(0,account.balance)),decimalMinor(Math.max(0,-account.balance))]),['','Total','',decimalMinor(sum(debits)),decimalMinor(sum(credits))]],note:`As of month end. ${note}`};
 }
 if(kind==='profit-loss'){
  const selected=balances.filter(account=>['Income','Expense'].includes(account.type));
  const income=sum(selected.filter(account=>account.type==='Income').map(account=>-account.balance)),expense=sum(selected.filter(account=>account.type==='Expense').map(account=>account.balance));
  return{title:'Profit & Loss',month,headers:['Code','Ledger','Type','Amount INR'],rows:[...selected.map(account=>[account.code,account.name,account.type,decimalMinor(account.type==='Income'?-account.balance:account.balance)]),['','Profit before tax','Result',decimalMinor(sum([income,-expense]))]],note};
 }
 if(kind==='balance-sheet'){
  const result=-sum(balances.filter(account=>['Income','Expense'].includes(account.type)).map(account=>account.balance));
  const selected=balances.filter(account=>['Asset','Liability','Equity'].includes(account.type));
  return{title:'Balance Sheet',month,headers:['Code','Ledger','Type','Amount INR'],rows:[...selected.map(account=>[account.code,account.name,account.type,decimalMinor(account.type==='Asset'?account.balance:-account.balance)]),['','Accumulated unallocated result','Equity',decimalMinor(result)]],note:`As of month end; accumulated income and expense balances are shown separately as unallocated result. ${note}`};
 }
 const rows:(string|number)[][]=[];
 for(const entry of posted.filter(entry=>entry.date>=start&&(kind!=='payroll-accounting'||entry.source_type==='payroll')))for(const line of entry.journal_lines){const account=lookup.get(line.account_id)!;rows.push([entry.date,entry.voucher_number,account.code,account.name,decimalMinor(Number(line.debit_minor)),decimalMinor(Number(line.credit_minor)),entry.narration]);}
 return{title:kind==='ledger-book'?'Ledger Book':'Payroll Accounting Entries',month,headers:['Date','Voucher','Code','Ledger','Debit INR','Credit INR','Narration'],rows,note};
}
