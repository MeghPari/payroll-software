import { invoiceAging,type AgingInvoice } from '@/domain/invoice-aging';
import { bankBook } from '@/domain/bank-book';import { headcountReport,type EmploymentRecord } from '@/domain/headcount-report';import { allRows } from '@/server/paging';
import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError,databaseError,endpoint,result } from '@/server/http';
import { accountingReport,decimalMinor,type ReportAccount,type ReportEntry,type ReportTable } from '@/domain/accounting-reports';
export const GET=endpoint(async request=>{
 const params=new URL(request.url).searchParams;
 const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(params.get('month'));
 const kind=z.enum(['trial-balance','profit-loss','balance-sheet','ledger-book','payroll-accounting','payroll-register','salary-cost','pf-summary','esi-summary','tds-summary','pt-summary','bank-book','cash-book','headcount','receivables-aging','payables-aging']).parse(params.get('kind'));
 const financial=['trial-balance','profit-loss','balance-sheet','ledger-book','payroll-accounting','bank-book','cash-book','receivables-aging','payables-aging'].includes(kind);
 const {client,companyId}=await tenant(request,financial?'accounting.read':kind==='headcount'?'employees.read':'payroll.run');
 const start=`${month}-01`,end=new Date(`${start}T00:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1);
 if(kind==='headcount'){const rows=await allRows((first,last)=>client.from('employees').select('id,employee_code,first_name,last_name,joining_date,exit_date,status').eq('company_id',companyId).lt('joining_date',end.toISOString().slice(0,10)).order('id').range(first,last));return result(headcountReport(month,rows as EmploymentRecord[]));}
 if(kind==='receivables-aging'||kind==='payables-aging'){
 const invoices=await allRows((first,last)=>client.from('invoices').select('id,kind,invoice_number,date,due_date,total_minor,journal_id,party_snapshot').eq('company_id',companyId).eq('kind',kind==='receivables-aging'?'Sales':'Purchase').not('journal_id','is',null).lt('date',end.toISOString().slice(0,10)).order('id').range(first,last));
 const notes=await allRows((first,last)=>client.from('invoice_notes').select('invoice_id,journal_id,kind,total_minor').eq('company_id',companyId).order('id').range(first,last));
 const payments=await allRows((first,last)=>client.from('invoice_payments').select('invoice_id,transaction_id,bank_transactions(journal_id,amount_minor)').eq('company_id',companyId).order('transaction_id').range(first,last));
 const journals=await allRows((first,last)=>client.from('journal_entries').select('id,date,status,reversal_of').eq('company_id',companyId).eq('status','Posted').lt('date',end.toISOString().slice(0,10)).order('id').range(first,last));
 const events=[...notes.map(note=>({invoiceId:note.invoice_id,journalId:note.journal_id,changeMinor:(note.kind==='Credit'?-1:1)*Number(note.total_minor)})),...payments.map(payment=>{const transaction=payment.bank_transactions as unknown as {journal_id:string;amount_minor:number};return{invoiceId:payment.invoice_id,journalId:transaction.journal_id,changeMinor:-Number(transaction.amount_minor)};})];
 return result(invoiceAging(kind==='receivables-aging'?'Sales':'Purchase',month,invoices as AgingInvoice[],events,journals));
 }
 if(financial){
  const accounts=await allRows((first,last)=>client.from('ledger_accounts').select('id,code,name,account_groups(type)').eq('company_id',companyId).order('id').range(first,last));
  const entries:ReportEntry[]=[];
  for(let offset=0;;offset+=250){
   let query=client.from('journal_entries').select('id,date,voucher_number,narration,status,source_type,journal_lines(account_id,debit_minor,credit_minor)').eq('company_id',companyId).eq('status','Posted').lt('date',end.toISOString().slice(0,10)).order('date').order('id').range(offset,offset+249);
   if(!['trial-balance','balance-sheet','bank-book','cash-book'].includes(kind))query=query.gte('date',start);
   if(kind==='payroll-accounting')query=query.eq('source_type','payroll');
   const page=await query;databaseError(page.error);entries.push(...(page.data??[]) as ReportEntry[]);if((page.data?.length??0)<250)break;
  }
  if(kind==='bank-book'||kind==='cash-book'){const banks=await allRows((first,last)=>client.from('bank_accounts').select('account_id,name,kind').eq('company_id',companyId).order('id').range(first,last));return result(bankBook(kind==='bank-book'?'Bank':'Cash',month,banks,entries));}
  const ledgers:ReportAccount[]=accounts.map(account=>({id:account.id,code:account.code,name:account.name,type:(account.account_groups as unknown as {type:string}).type}));
  return result(accountingReport(kind as Parameters<typeof accountingReport>[0],month,ledgers,entries));
 }
 const run=await client.from('payroll_runs').select('id,status,version').eq('company_id',companyId).eq('month',start).maybeSingle();databaseError(run.error);
 if(!run.data||run.data.status==='Draft')throw new ApiError(422,'PAYROLL_NOT_CALCULATED','Calculate payroll for the selected month before generating this report.');
 const report:ReportTable={title:kind,month,headers:[],rows:[],note:`Saved payroll version ${run.data.version}, status ${run.data.status}. Contribution summaries are review reports; they are not statutory filing files or evidence of payment.`};
 const contribution=kind.endsWith('-summary')?kind.slice(0,-8):null;
 report.headers=contribution?['Employee Code','Employee Name','Employee Contribution INR','Employer Contribution INR']:kind==='salary-cost'?['Employee Code','Employee Name','Gross INR','Employer Contributions INR','Total Cost INR']:['Employee Code','Employee Name','Gross INR','Deductions INR','Net INR'];
 for(let offset=0;;offset+=500){
  const page=await client.from('payroll_run_employees').select('employee_id,gross_minor,deduction_minor,net_minor,employer_minor,snapshot').eq('company_id',companyId).eq('run_id',run.data.id).order('employee_id').range(offset,offset+499);databaseError(page.error);
  for(const row of page.data??[]){const snapshot=row.snapshot;const values=contribution?[Number(snapshot.deductions[contribution]??0),Number(snapshot.employer[contribution]??0)]:kind==='salary-cost'?[Number(row.gross_minor),Number(row.employer_minor),Number(row.gross_minor)+Number(row.employer_minor)]:[Number(row.gross_minor),Number(row.deduction_minor),Number(row.net_minor)];report.rows.push([snapshot.employeeCode,snapshot.employeeName,...values.map(decimalMinor)]);}
  if((page.data?.length??0)<500)break;
 }
 return result(report);
});
