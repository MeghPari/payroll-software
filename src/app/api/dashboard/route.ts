import { tenant } from '@/server/auth';
import { databaseError,endpoint,result } from '@/server/http';
import { companyToday,monthLabel } from '@/domain/dates';
import { sum } from '@/domain/money';
import type { DashboardOverview } from '@/domain/dashboard';

export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request);
 const today=companyToday(),month=today.slice(0,7),start=`${month}-01`;
 const end=new Date(`${start}T00:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1);
 const permissions=await Promise.all(['payroll.run','accounting.read'].map(permission_code=>client.rpc('has_permission',{c:companyId,permission_code})));
 permissions.forEach(response=>databaseError(response.error));
 const [canPayroll,canAccounts]=permissions.map(response=>response.data===true);
 const initial=await Promise.all([
  client.from('employees').select('id',{count:'exact',head:true}).eq('company_id',companyId).not('status','in','(Inactive,Exited)'),
  client.from('employees').select('id',{count:'exact',head:true}).eq('company_id',companyId).gte('joining_date',start).lte('joining_date',today),
  client.from('leave_requests').select('id',{count:'exact',head:true}).eq('company_id',companyId).eq('status','Pending'),
 ]);initial.forEach(response=>databaseError(response.error));
 const data:DashboardOverview={
  kpis:{totalEmployees:initial[0].count??0,newThisMonth:initial[1].count??0,netSalaryPayable:null,payrollStatus:canPayroll?'Not calculated':'No access',payrollPeriod:monthLabel(month),pendingLeaves:initial[2].count??0,revenue:null,expenses:null,gstPayable:null,bankBalance:null},
  payrollSummary:{grossSalary:null,deductions:null,netSalaryPayable:null,disbursedToDate:null,disbursementStatus:'Not recorded'},
  accountsSummary:{revenue:null,expenses:null,profitBeforeTax:null,gstPayable:null,outstandingReceivables:null,payablesToVendors:null},
  pendingActions:[{id:'leave',label:'Leave Requests',count:initial[2].count??0}],payrollCostHistory:[],cashFlowHistory:[],topExpenses:[],
  ops:{today:{present:0,absent:0,onLeave:0,late:null},exceptionCount:null,eligible:null,total:null},
 };
 for(let offset=0;;offset+=500){
  const attendance=await client.from('attendance_records').select('status').eq('company_id',companyId).eq('date',today).order('employee_id').range(offset,offset+499);databaseError(attendance.error);
  for(const row of attendance.data??[]){if(['Present','Work From Home'].includes(row.status))data.ops.today.present++;if(row.status==='Absent')data.ops.today.absent++;if(['Paid Leave','Unpaid Leave'].includes(row.status))data.ops.today.onLeave++;}
  if((attendance.data?.length??0)<500)break;
 }
 if(canPayroll){
  const [runs,checks]=await Promise.all([client.from('payroll_runs').select('id,month,status').eq('company_id',companyId).lte('month',start).order('month',{ascending:false}).limit(6),client.rpc('validate_payroll',{c:companyId,m:start})]);databaseError(runs.error);databaseError(checks.error);
  const issues=checks.data.issues as {employeeId:string}[];
  data.ops.total=checks.data.totalChecked;data.ops.exceptionCount=issues.length;
  // A period-level issue blocks every employee; otherwise count distinct affected employees.
  data.ops.eligible=issues.some(issue=>!issue.employeeId)?0:Math.max(0,checks.data.totalChecked-new Set(issues.map(issue=>issue.employeeId)).size);
  for(const run of runs.data??[]){
   const gross:number[]=[],deductions:number[]=[],net:number[]=[],employer:number[]=[];
   for(let offset=0;;offset+=500){
    const snapshots=await client.from('payroll_run_employees').select('gross_minor,deduction_minor,net_minor,employer_minor').eq('company_id',companyId).eq('run_id',run.id).order('employee_id').range(offset,offset+499);databaseError(snapshots.error);
    for(const row of snapshots.data??[]){gross.push(Number(row.gross_minor));deductions.push(Number(row.deduction_minor));net.push(Number(row.net_minor));employer.push(Number(row.employer_minor));}
    if((snapshots.data?.length??0)<500)break;
   }
   if(run.status!=='Draft')data.payrollCostHistory.unshift({month:monthLabel(run.month.slice(0,7)),value:sum([...gross,...employer])/100});
   if(run.month===start){data.kpis.payrollStatus=run.status;if(run.status!=='Draft'){data.kpis.netSalaryPayable=sum(net)/100;data.payrollSummary.grossSalary=sum(gross)/100;data.payrollSummary.deductions=sum(deductions)/100;data.payrollSummary.netSalaryPayable=sum(net)/100;}}
  }
 }
 if(canAccounts){
  const accountResult=await client.from('ledger_accounts').select('id,name,account_groups(type)').eq('company_id',companyId);databaseError(accountResult.error);
  const accounts=new Map((accountResult.data??[]).map(row=>[row.id,{name:row.name,type:(row.account_groups as unknown as {type:string}).type}]));
  const income:number[]=[],expense:number[]=[],categories=new Map<string,number[]>();
  for(let offset=0;;offset+=250){
   const entries=await client.from('journal_entries').select('id,journal_lines(account_id,debit_minor,credit_minor)').eq('company_id',companyId).eq('status','Posted').gte('date',start).lte('date',today).order('id').range(offset,offset+249);databaseError(entries.error);
   for(const entry of entries.data??[])for(const line of entry.journal_lines){const account=accounts.get(line.account_id);const amount=Number(line.debit_minor)-Number(line.credit_minor);if(account?.type==='Income')income.push(-amount);if(account?.type==='Expense'){expense.push(amount);categories.set(account.name,[...(categories.get(account.name)??[]),amount]);}}
   if((entries.data?.length??0)<250)break;
  }
  data.kpis.revenue=sum(income)/100;data.kpis.expenses=sum(expense)/100;
  data.accountsSummary.revenue=data.kpis.revenue;data.accountsSummary.expenses=data.kpis.expenses;data.accountsSummary.profitBeforeTax=sum([...income,...expense.map(amount=>-amount)])/100;
  data.topExpenses=Array.from(categories,([category,amounts])=>({category,amount:sum(amounts)/100})).filter(row=>row.amount>0).sort((a,b)=>b.amount-a.amount).slice(0,6);
 }
 return result(data);
});
