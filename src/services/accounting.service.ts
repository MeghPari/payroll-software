import * as invoiceApi from './invoice.service';
import * as accountsApi from './accounts.service';
import { getDashboardOverview } from './dashboard.service';
import { getBanking } from './banking.service';
import { tenantApi } from '@/lib/tenant-api';
import { companyToday } from '@/domain/dates';
import { sum } from '@/domain/money';
import type { GstReport } from '@/domain/compliance';
export async function getAccountingDashboard(){
 const[overview,bank,sales,purchases,vouchers,gst,accounts,posting]=await Promise.all([getDashboardOverview(),getBanking(),invoiceApi.getInvoiceRows('Sales'),invoiceApi.getInvoiceRows('Purchase'),accountsApi.getVouchers(),getGstSummary(),accountsApi.accountData(),tenantApi<{mappings:{code:string;account_id:string}[]}>('payroll-accounting')]);
 const netAccount=posting.mappings.find(row=>row.code==='netPayable')?.account_id,expenseAccount=posting.mappings.find(row=>row.code==='salaryExpense')?.account_id,employerAccount=posting.mappings.find(row=>row.code==='employerExpense')?.account_id;
 const month=companyToday().slice(0,7),monthVouchers=await accountsApi.getJournals();
 const movements=(id:string|undefined)=>id?sum(monthVouchers.filter(row=>row.status==='Posted'&&row.date.startsWith(month)).flatMap(row=>row.journal_lines.filter(line=>line.account_id===id).map(line=>Number(line.debit_minor)-Number(line.credit_minor))))/100:null;
 const payrollCost=movements(expenseAccount),employerContribution=movements(employerAccount);
 return{revenue:overview.accountsSummary.revenue,expenses:overview.accountsSummary.expenses,netProfit:overview.accountsSummary.profitBeforeTax,bankBalance:bank.accounts.some(row=>row.kind==='Bank')?sum(bank.accounts.filter(row=>row.kind==='Bank').map(row=>row.balanceMinor))/100:null,cashBalance:bank.accounts.some(row=>row.kind==='Cash')?sum(bank.accounts.filter(row=>row.kind==='Cash').map(row=>row.balanceMinor))/100:null,payables:sum(purchases.map(row=>invoiceApi.invoiceBalance(row).outstanding))/100,receivables:sum(sales.map(row=>invoiceApi.invoiceBalance(row).outstanding))/100,gstPayable:null,gstSummary:gst,recentInvoices:sales.slice(0,5).map(row=>({id:row.id,invoiceNumber:row.invoice_number,customer:row.party_snapshot.name,amount:Number(row.total_minor)/100,status:invoiceApi.invoiceStatus(row)})),recentVouchers:vouchers.filter(row=>row.status==='Posted').slice(0,5),cashBankHistory:[],payrollAccounting:{payrollCost,employerContribution,totalPayrollCost:payrollCost!==null&&employerContribution!==null?sum([Math.round(payrollCost*100),Math.round(employerContribution*100)])/100:null,salaryLiabilities:netAccount?-Number(accounts.balances.find(row=>row.account_id===netAccount)?.balance_minor??0)/100:null}};
}
export function getChartOfAccounts(){return accountsApi.getChartOfAccounts();}
export function getLedgers(){return accountsApi.getLedgers();}
export function getCustomers(){return invoiceApi.getCustomers();}
export function getVendors(){return invoiceApi.getVendors();}
export function getSalesInvoices(){return invoiceApi.getSalesInvoices();}
export function getPurchaseInvoices(){return invoiceApi.getPurchaseInvoices();}
export function getVouchers(){return accountsApi.getVouchers();}
export function getGstSummary(month=companyToday().slice(0,7)){return tenantApi<GstReport>('gst?month='+month);}
export async function getCashFlowHistory(){return(await getBanking()).cashFlow;}
export async function getTopExpenses(){return(await getDashboardOverview()).topExpenses;}
