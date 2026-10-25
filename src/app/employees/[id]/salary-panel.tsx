'use client';
import {useState} from 'react';
import Link from 'next/link';
import {SectionCard} from '@/components/shared/section-card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {tenantApi,permitted} from '@/lib/tenant-api';
import {toMinor} from '@/domain/currency';
import {formatINR} from '@/utils/format';
import {toast} from 'sonner';
import type {Employee,SalaryProfile} from '@/types';
export function SalaryPanel(props:{employee:Employee;salary:SalaryProfile|undefined;onChanged:()=>void}){return <SalaryEditor key={props.employee.id+'-'+props.employee.version+'-'+props.salary?.effectiveFrom} {...props}/>;}
function SalaryEditor({employee,salary,onChanged}:{employee:Employee;salary:SalaryProfile|undefined;onChanged:()=>void}){
 const[amounts,setAmounts]=useState({basic:salary?String(salary.basic):'',da:String(salary?.da??0),hra:String(salary?.hra??0),other:String(salary?.other??0)}),[effective,setEffective]=useState(salary?.effectiveFrom??employee.joiningDate),[remarks,setRemarks]=useState(''),[busy,setBusy]=useState(false);
 const initial=employee.clientSalaryReference;
 const[references,setReferences]=useState({pfMinor:initial?.pf_minor==null?'':String(Number(initial.pf_minor)/100),esiMinor:initial?.esi_minor==null?'':String(Number(initial.esi_minor)/100),ctcMinor:initial?.ctc_minor==null?'':String(Number(initial.ctc_minor)/100)});
 let gross=0;try{gross=Object.values(amounts).reduce((n,value)=>n+toMinor(value||'0'),0);}catch{}
 async function save(){setBusy(true);try{await tenantApi('employees/salary',{method:'POST',body:JSON.stringify({employeeId:employee.id,expectedVersion:employee.version,effectiveFrom:effective,amounts:Object.fromEntries(Object.entries(amounts).map(([key,value])=>[key,toMinor(value||'0')])),references:Object.fromEntries(Object.entries(references).map(([key,value])=>[key,value.trim()?toMinor(value):null])),remarks})});toast.success('Employee salary saved');onChanged();}catch(e){toast.error(e instanceof Error?e.message:'Unable to save salary.');}finally{setBusy(false);}}
 return <SectionCard title="Employee salary" subtitle={employee.fullName}><p className="mb-4 text-sm text-muted-foreground">Enter the same monthly salary components as the Employee Database. Saved components are used with attendance to calculate pay. For a revision, choose a new effective date; existing payroll history is retained.</p>
 <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="salary-effective">Salary effective from</Label><Input id="salary-effective" type="date" value={effective} disabled={busy} onChange={e=>setEffective(e.target.value)}/></div>
 {Object.entries({basic:'Structured Basic (required)',da:'S. DA',hra:'S. HRA',other:'S. Other Allowance'}).map(([key,label])=><div key={key}><Label htmlFor={'salary-'+key}>{label} (INR/month)</Label><Input id={'salary-'+key} inputMode="decimal" required={key==='basic'} disabled={busy} value={amounts[key as keyof typeof amounts]} onChange={e=>setAmounts({...amounts,[key]:e.target.value})}/></div>)}
 <div><Label>S. Gross (calculated)</Label><p className="py-2 font-semibold">{formatINR(gross/100)}</p></div>
 {Object.entries({pfMinor:'S. PF',esiMinor:'S. ESI',ctcMinor:'Total CTC'}).map(([key,label])=><div key={key}><Label htmlFor={'salary-reference-'+key}>{label} (optional reference, INR)</Label><Input id={'salary-reference-'+key} inputMode="decimal" disabled={busy} value={references[key as keyof typeof references]} onChange={e=>setReferences({...references,[key]:e.target.value})}/></div>)}
 <div><Label htmlFor="salary-remarks">Remarks (optional)</Label><Input id="salary-remarks" maxLength={1000} value={remarks} disabled={busy} onChange={e=>setRemarks(e.target.value)}/></div></div>
 <p className="my-4 text-xs text-muted-foreground">Blank DA, HRA and Other Allowance are 0. S. PF, S. ESI and Total CTC are references; reviewed statutory settings control deductions.</p>
 <Button disabled={busy||!employee.version||!amounts.basic.trim()||!effective||!permitted('salary.write')||!permitted('employees.sensitive')} onClick={save}>{busy?'Saving...':salary?'Save salary revision':'Save salary'}</Button>
 <Link href="/salary-structures" className="ml-4 text-primary underline">Upload Employee Dataset / View salaries</Link></SectionCard>;
}
