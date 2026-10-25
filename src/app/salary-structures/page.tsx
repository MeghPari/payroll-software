'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {PageHeader} from '@/components/shared/page-header';
import {Button} from '@/components/ui/button';
import {getSalaryRevisions} from '@/services/salary.service';
import {getEmployees} from '@/services/employee.service';
import {ClientEmployeeImportDialog} from '@/components/employees/client-employee-import-dialog';
import {ClientSalarySheet} from '@/components/payroll/client-salary-sheet';
import {useAppStore} from '@/store/app-store';
import {useSessionStore} from '@/store/session-store';
import {monthKey} from '@/domain/dates';
import {formatINR} from '@/utils/format';
import {permitted} from '@/lib/tenant-api';
import type {Employee,SalaryRevision} from '@/types';
export default function SalaryStructuresPage(){const company=useSessionStore(s=>s.companyId);return <DatasetSalaryPage key={company}/>;}
function DatasetSalaryPage(){
 const month=useAppStore(s=>s.month),[open,setOpen]=useState(false),[revision,setRevision]=useState(0),[rows,setRows]=useState<SalaryRevision[]>([]),[employees,setEmployees]=useState<Employee[]>([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;Promise.all([getSalaryRevisions(),getEmployees()]).then(([salary,staff])=>{if(active){setRows(salary);setEmployees(staff);setError('');}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load salary data.');});return()=>{active=false;};},[revision]);
 return <div><PageHeader title="Employee Salaries" subtitle="Upload employee dataset, upload attendance, then calculate salaries." actions={<Button disabled={!permitted('salary.write')||!permitted('employees.write')||!permitted('employees.sensitive')} onClick={()=>setOpen(true)}>Upload Employee Dataset</Button>}/>
 <ClientEmployeeImportDialog open={open} onOpenChange={setOpen} onImported={()=>setRevision(v=>v+1)}/>
 <div className="mb-5 rounded-lg border bg-blue-50 p-4 text-sm">Monthly salary components come from the employee dataset or Employees / Salary. Designation does not assign a salary. Attendance determines payable days; configured deductions and reviewed adjustments are included during calculation. <Link className="text-primary underline" href="/attendance">Upload attendance</Link></div>
 {error&&<p role="alert">{error}</p>}
 <div className="mb-6 overflow-auto rounded-xl border bg-card"><table className="w-full whitespace-nowrap text-left text-sm"><thead><tr>{['Employee','Salary effective from','Basic','DA','HRA','Other Allowance','Monthly gross'].map(label=><th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr className="border-t" key={row.id}><td className="p-3">{employees.find(e=>e.id===row.employeeId)?.fullName??'Employee'}</td><td className="p-3">{row.effectiveFrom}</td>{[row.profile?.basic??0,row.profile?.da??0,row.profile?.hra??0,row.profile?.other??0,row.revisedGross].map((value,index)=><td className="p-3" key={index}>{formatINR(value)}</td>)}</tr>)}</tbody></table>{!rows.length&&!error&&<p className="p-4 text-sm text-muted-foreground">Upload an employee dataset or add salary under Employees / Salary. Blank allowances are 0.</p>}</div>
 {permitted('payroll.run')&&permitted('employees.sensitive')&&permitted('salary.read')&&<ClientSalarySheet key={month} month={monthKey(month)}/>}
 </div>;
}
