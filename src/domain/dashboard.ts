export interface DashboardOverview {
  kpis: {totalEmployees:number;newThisMonth:number;netSalaryPayable:number|null;payrollStatus:string;payrollPeriod:string;pendingLeaves:number;revenue:number|null;expenses:number|null;gstPayable:number|null;bankBalance:number|null};
  payrollSummary: {grossSalary:number|null;deductions:number|null;netSalaryPayable:number|null;disbursedToDate:number|null;disbursementStatus:string};
  accountsSummary: {revenue:number|null;expenses:number|null;profitBeforeTax:number|null;gstPayable:number|null;outstandingReceivables:number|null;payablesToVendors:number|null};
  pendingActions: {id:string;label:string;count:number}[];
  payrollCostHistory: {month:string;value:number}[];
  cashFlowHistory: {month:string;inflow:number;outflow:number}[];
  topExpenses: {category:string;amount:number}[];
  ops: {today:{present:number;absent:number;onLeave:number;late:number|null};exceptionCount:number|null;eligible:number|null;total:number|null};
}
