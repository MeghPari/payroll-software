import type { ReportTable } from './accounting-reports';
export interface EmploymentRecord{id:string;employee_code:string;first_name:string;last_name:string;joining_date:string;exit_date:string|null;status:string}
export function headcountReport(month:string,employees:EmploymentRecord[]):ReportTable{
 const start=month+'-01',end=new Date(start+'T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);const next=end.toISOString().slice(0,10);
 const inMonth=employees.filter(e=>e.joining_date<next&&(!e.exit_date||e.exit_date>=start));
 const opening=inMonth.filter(e=>e.joining_date<start).length,joined=inMonth.filter(e=>e.joining_date>=start).length,exited=inMonth.filter(e=>e.exit_date&&e.exit_date<next).length;
 return{title:'Headcount & Attrition',month,headers:['Employee Code','Employee Name','Joined','Exit Date','Current Status','Period Movement'],rows:[...inMonth.sort((a,b)=>a.employee_code.localeCompare(b.employee_code)).map(e=>[e.employee_code,e.first_name+' '+e.last_name,e.joining_date,e.exit_date??'',e.status,[e.joining_date>=start?'Joined':'Continuing',e.exit_date&&e.exit_date<next?'Exited':''].filter(Boolean).join(', ')]),['','Opening employment count',opening,'','',''],['','Joined',joined,'','',''],['','Exited',exited,'','',''],['','Closing employment count',opening+joined-exited,'','','']],note:'Employment counts use saved joining and exit dates. Exit dates are the last working day. Current status is shown separately and is not treated as historical status. No historical department or attrition percentage is inferred.'};
}
