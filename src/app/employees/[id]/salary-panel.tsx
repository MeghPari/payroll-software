'use client';
import {useState} from 'react';
import Link from 'next/link';
import {SectionCard} from '@/components/shared/section-card';
import {ConfirmDialog} from '@/components/shared/confirm-dialog';
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
 const initial=employee.clientSalaryReference;
 const[saved,setSaved]=useState({
  amounts:{basic:salary?String(salary.basic):'',da:String(salary?.da??0),hra:String(salary?.hra??0),other:String(salary?.other??0)},
  references:{pfMinor:initial?.pf_minor==null?'':String(Number(initial.pf_minor)/100),esiMinor:initial?.esi_minor==null?'':String(Number(initial.esi_minor)/100),ctcMinor:initial?.ctc_minor==null?'':String(Number(initial.ctc_minor)/100)},
  effective:salary?.effectiveFrom??employee.joiningDate,
 });
 const[amounts,setAmounts]=useState(saved.amounts),[references,setReferences]=useState(saved.references),[effective,setEffective]=useState(saved.effective);
 const[remarks,setRemarks]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(!salary),[confirming,setConfirming]=useState(false),[hasSalary,setHasSalary]=useState(!!salary);
 const canWrite=!!employee.version&&permitted('salary.write')&&permitted('employees.sensitive');
 let gross=0;try{gross=Object.values(amounts).reduce((n,value)=>n+toMinor(value||'0'),0);}catch{}
 const savedGross=Object.values(saved.amounts).reduce((n,value)=>n+Number(value||0),0);
 function payload(){
  if(!amounts.basic.trim()||!effective)throw new Error('Enter Structured Basic and an effective date.');
  if(hasSalary&&effective<=saved.effective)throw new Error('Choose a revision date after the saved salary effective date.');
  return{employeeId:employee.id,expectedVersion:employee.version,effectiveFrom:effective,
   amounts:Object.fromEntries(Object.entries(amounts).map(([key,value])=>[key,toMinor(value||'0')])),
   references:Object.fromEntries(Object.entries(references).map(([key,value])=>[key,value.trim()?toMinor(value):null])),remarks};
 }
 function review(){try{payload();setConfirming(true);}catch(e){toast.error(e instanceof Error?e.message:'Review the salary amounts.');}}
 function cancel(){setAmounts(saved.amounts);setReferences(saved.references);setEffective(saved.effective);setRemarks('');setEditing(false);}
 async function save(){
  if(!editing||!canWrite||busy)return;
  setBusy(true);
  try{
   await tenantApi('employees/salary',{method:'POST',body:JSON.stringify(payload())});
   setSaved({amounts:{...amounts},references:{...references},effective});setHasSalary(true);setEditing(false);setConfirming(false);setRemarks('');
   toast.success(hasSalary?'Salary revision saved':'Employee salary saved');onChanged();
  }catch(e){toast.error(e instanceof Error?e.message:'Unable to save salary.');}finally{setBusy(false);}
 }
 return <SectionCard title="Employee salary" subtitle={employee.fullName}>
 <p className="mb-4 text-sm text-muted-foreground">{hasSalary&&!editing?'Saved salary components are read-only. Choose Revise salary to prepare a change with a new effective date.':'Enter the same monthly salary components as the Employee Database. Saved components are used with attendance to calculate pay. Existing salary and payroll history is retained.'}</p>
 {hasSalary&&editing&&<p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">Preparing a salary revision. The saved salary remains unchanged until you review and confirm this revision.</p>}
 <div className="grid gap-4 sm:grid-cols-2">
 <div><Label htmlFor="salary-effective">{hasSalary&&editing?'Revision effective from':'Salary effective from'}</Label><Input id="salary-effective" type="date" value={effective} readOnly={!editing} disabled={busy||!canWrite} onChange={e=>setEffective(e.target.value)}/></div>
 {Object.entries({basic:'Structured Basic (required)',da:'S. DA',hra:'S. HRA',other:'S. Other Allowance'}).map(([key,label])=><div key={key}><Label htmlFor={'salary-'+key}>{label} (INR/month)</Label><Input id={'salary-'+key} inputMode="decimal" required={key==='basic'} readOnly={!editing} disabled={busy||!canWrite} value={amounts[key as keyof typeof amounts]} onChange={e=>setAmounts({...amounts,[key]:e.target.value})}/></div>)}
 <div><Label>S. Gross (calculated)</Label><p className="py-2 font-semibold">{formatINR(gross/100)}</p></div>
 {Object.entries({pfMinor:'S. PF',esiMinor:'S. ESI',ctcMinor:'Total CTC'}).map(([key,label])=><div key={key}><Label htmlFor={'salary-reference-'+key}>{label} (optional reference, INR)</Label><Input id={'salary-reference-'+key} inputMode="decimal" readOnly={!editing} disabled={busy||!canWrite} value={references[key as keyof typeof references]} onChange={e=>setReferences({...references,[key]:e.target.value})}/></div>)}
 {editing&&<div><Label htmlFor="salary-remarks">Remarks (optional)</Label><Input id="salary-remarks" maxLength={1000} value={remarks} disabled={busy||!canWrite} onChange={e=>setRemarks(e.target.value)}/></div>}
 </div>
 <p className="my-4 text-xs text-muted-foreground">Blank DA, HRA and Other Allowance are 0. S. PF, S. ESI and Total CTC are references; reviewed statutory settings control deductions.</p>
 <div className="flex flex-wrap items-center gap-3">
 {!editing?<Button disabled={!canWrite} onClick={()=>{setEffective('');setEditing(true);}}>Revise salary</Button>:<><Button disabled={busy||!canWrite||!amounts.basic.trim()||!effective} onClick={review}>{hasSalary?'Review salary revision':'Review and save salary'}</Button>{hasSalary&&<Button variant="outline" disabled={busy} onClick={cancel}>Cancel revision</Button>}</>}
 <Link href="/salary-structures" className="text-primary underline">Upload Employee Dataset / View salaries</Link>
 </div>
 <ConfirmDialog open={confirming} onOpenChange={open=>{if(!busy)setConfirming(open);}} title={hasSalary?'Confirm salary revision?':'Save employee salary?'} description={hasSalary?`Saved monthly gross: ${formatINR(savedGross)} from ${saved.effective}. Revised monthly gross: ${formatINR(gross/100)} from ${effective}. The previous salary and calculated payroll history will be retained.`:`Save monthly gross ${formatINR(gross/100)}, effective ${effective}? These components will be used with attendance to calculate pay.`} confirmLabel={hasSalary?'Confirm salary revision':'Confirm salary'} loading={busy} onConfirm={save}/>
 </SectionCard>;
}
