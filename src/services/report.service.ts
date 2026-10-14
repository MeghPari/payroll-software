import { decimalMinor } from '@/domain/accounting-reports';
import { tenantApi } from '@/lib/tenant-api';
import { companyToday,monthKey } from '@/domain/dates';
import type { ReportTable } from '@/domain/accounting-reports';
import type { FinancialReport } from '@/types';
export const availableFinancialReports=new Set(['trial-balance','profit-loss','balance-sheet','ledger-book','payroll-accounting','cash-book','bank-book','gst-report','receivables-aging','payables-aging','cash-flow']);
export async function getFinancialReports():Promise<FinancialReport[]>{return[
 {id:'cash-flow',key:'cash-flow',title:'Reviewed Cash Flow',description:'Reconciled bank/cash movements with reviewed activity classifications.'},
 {id:'receivables-aging',key:'receivables-aging',title:'Receivables Aging',description:'Month-end balances from dated invoices, notes, receipts and reversals.'},
 {id:'payables-aging',key:'payables-aging',title:'Payables Aging',description:'Month-end balances from dated purchases, notes, payments and reversals.'},
 {id:'trial-balance',key:'trial-balance',title:'Trial Balance',description:'Posted ledger debit and credit balances as of month end.'},
 {id:'profit-loss',key:'profit-loss',title:'Profit & Loss Statement',description:'Income and expenses from posted journals for the month.'},
 {id:'balance-sheet',key:'balance-sheet',title:'Balance Sheet',description:'Assets, liabilities, equity and accumulated unallocated result.'},
 {id:'ledger-book',key:'ledger-book',title:'Ledger Book',description:'Posted journal lines for all visible company ledgers.'},
 {id:'cash-book',key:'cash-book',title:'Cash Book',description:'Posted cash ledger movements and opening/closing book balances.'},
 {id:'bank-book',key:'bank-book',title:'Bank Book',description:'Posted bank ledger movements and opening/closing book balances.'},
 {id:'gst-report',key:'gst-report',title:'GST Report',description:'Dated invoice/note GST books and latest purchase-credit review.'},
 {id:'payroll-accounting',key:'payroll-accounting',title:'Payroll Accounting Entries',description:'Posted payroll accrual journal lines for the month.'},
 ];}
export async function generateReport(kind:string,month=companyToday().slice(0,7)):Promise<ReportTable>{const period=monthKey(month);if(kind==='cash-flow')return(await tenantApi<{report:ReportTable}>('cash-flow?month='+period)).report;if(kind==='gst-report'){const data=await tenantApi<import('@/domain/compliance').GstReport>('gst?month='+period);return{title:'GST Book Report',month:period,headers:['Invoice / Note','Kind','Posting Date','Taxable INR','CGST INR','SGST INR','IGST INR','Latest Reviewed Credit INR'],rows:data.invoices.map(row=>[row.invoice_number,row.kind,row.date,...[row.taxable_minor,row.cgst_minor,row.sgst_minor,row.igst_minor].map(value=>decimalMinor(Number(value))),row.gst_credit_reviews?decimalMinor(Number(row.gst_credit_reviews.cgst_minor)+Number(row.gst_credit_reviews.sgst_minor)+Number(row.gst_credit_reviews.igst_minor)):'Not reviewed']),note:'Original postings, notes and reversals use their own book dates. Credits show the latest saved eligibility review, not an archived return. This is not a filing file.'};}return tenantApi<ReportTable>('reports?kind='+encodeURIComponent(kind)+'&month='+period);}
