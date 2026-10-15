import {ratio,sum,minor} from './money';
import {employmentDates} from './attendance-completeness';
export interface IllustrationEmployee{id:string;employee_code:string;first_name:string;last_name:string;joining_date:string;exit_date:string|null;status:string}
export interface IllustrationSalary{employee_id:string;effective_from:string;employee_salary_component_values:{component_code:string;amount_minor:number}[]}
export interface IllustrationAttendance{employee_id:string;date:string;status:string}
const earningCodes=['basic','hra','special','conveyance','other','bonus','variable'];
export function payrollIllustration(month:string,employees:IllustrationEmployee[],salaries:IllustrationSalary[],attendance:IllustrationAttendance[],heldEmployees:string[]){
 const days=employmentDates(month,month+'-01',null),denominator=days.length;
 return employees.filter(employee=>!['Inactive','Salary Hold'].includes(employee.status)).flatMap(employee=>{
  const employed=employmentDates(month,employee.joining_date,employee.exit_date);if(!employed.length)return [];
  const history=salaries.filter(salary=>salary.employee_id===employee.id).sort((a,b)=>b.effective_from.localeCompare(a.effective_from));
  const records=new Map(attendance.filter(record=>record.employee_id===employee.id).map(record=>[record.date,record.status]));
  const issues:string[]=[],numerators=new Map<string,number>();let paidHalfDays=0,missingDates=0,uncoveredSalaryDates=0;
  if(heldEmployees.includes(employee.id))issues.push('Salary is on hold.');
  for(const date of employed){
   const status=records.get(date),salary=history.find(salary=>salary.effective_from<=date);
   if(!status||status==='Missing Punch')missingDates++;
   const weight=status==='Half Day'?1:['Present','Paid Leave','Work From Home','Weekly Off','Holiday'].includes(status??'')?2:0;
   paidHalfDays+=weight;
   if(!salary){uncoveredSalaryDates++;continue;}
   for(const value of salary.employee_salary_component_values){
    const amount=Number(value.amount_minor);minor(amount);if(amount<0)throw new Error('Invalid salary input');
    if(!earningCodes.includes(value.component_code))continue;
    const weighted=['bonus','variable'].includes(value.component_code)?(date===employed.at(-1)?amount*denominator*2:0):amount*weight;
    numerators.set(value.component_code,sum([numerators.get(value.component_code)??0,weighted]));
   }
  }
  if(missingDates)issues.push(missingDates+' attendance date(s) are incomplete.');
  if(uncoveredSalaryDates)issues.push(uncoveredSalaryDates+' employment date(s) have no salary assignment.');
  const latest=history.find(salary=>salary.effective_from<=employed.at(-1)!);
  const monthlyGrossMinor=latest?sum(latest.employee_salary_component_values.filter(value=>earningCodes.includes(value.component_code)).map(value=>Number(value.amount_minor))):null;
  const baseEarningsMinor=issues.length?null:sum([...numerators.values()].map(value=>ratio(value,1,denominator*2,'half-up')));
  return [{employeeId:employee.id,employeeCode:employee.employee_code,employeeName:employee.first_name+' '+employee.last_name,monthlyGrossMinor,paidDays:missingDates?null:paidHalfDays/2,baseEarningsMinor,netMinor:null,issues}];
 });
}
export type PayrollIllustrationRow=ReturnType<typeof payrollIllustration>[number];
