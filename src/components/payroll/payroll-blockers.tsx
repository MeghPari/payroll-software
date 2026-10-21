'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Employee,PayrollValidationIssue } from '@/types';
export function PayrollBlockers({issues,employees,onReviewOvertime}:{issues:PayrollValidationIssue[];employees:Employee[];onReviewOvertime:()=>void}){
 const blockers=issues.filter(issue=>issue.severity==='Blocking Error');
 if(!blockers.length)return null;
 const employeeMap=new Map(employees.map(employee=>[employee.id,employee]));
 return <section aria-label="Payroll issues to resolve" role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-5"><h2 className="text-lg font-semibold">{blockers.length} issue(s) need attention before calculation</h2><p className="mt-1 text-sm text-muted-foreground">Attendance finalization is one step. Review the employee and payroll setup items below, then calculate again.</p><ul className="mt-4 divide-y divide-red-200">{blockers.map((issue,index)=>{
  const employee=employeeMap.get(issue.employeeId);
  const attendance=['Attendance Finalization','Attendance Missing','Working Day Calendar','Working Day Attendance'].includes(issue.check);
  const settings=['Reviewed Rule Required','Payroll Configuration'].includes(issue.check);
  const employeeTab=['No Salary Assigned','Salary Hold'].includes(issue.check)?'salary':['Missing Bank Details','Statutory Configuration','Missing UAN','Missing ESIC','Missing PAN'].includes(issue.check)?'kyc':'overview';
  const href=issue.check==='Employee Database'?'/salary-structures':attendance?'/attendance':settings?'/settings':employee?`/employees/${employee.id}?tab=${employeeTab}`:'/employees';
  return <li key={index} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="max-w-3xl"><p className="text-sm font-semibold">{employee?`${employee.fullName} (${employee.employeeCode})`:'Company payroll'} · {issue.check}</p><p className="mt-1 text-sm">{issue.message}</p></div>{issue.check==='Overtime Review'?<Button variant="outline" size="sm" onClick={onReviewOvertime}>Review overtime</Button>:<Link className="rounded-lg border bg-card px-3 py-2 text-sm font-medium text-primary" href={href}>{issue.check==='Employee Database'?'Upload Employee Database':attendance?'Review attendance':settings?'Review payroll settings':employee?'Open employee':'Review employees'}</Link>}</li>;
 })}</ul></section>;
}
