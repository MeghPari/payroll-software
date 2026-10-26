'use client';
import {useState}from'react';
import {SectionCard}from'@/components/shared/section-card';
import {Input}from'@/components/ui/input';
import {Button}from'@/components/ui/button';
import {Label}from'@/components/ui/label';
import {updateEmployee}from'@/services/employee.service';
import {permitted}from'@/lib/tenant-api';
import {bankDetailsInput,statutoryIdentifiersInput}from'@/domain/employee-identifiers';
import type{Employee}from'@/types';
import{toast}from'sonner';
export function IdentityEditor({employee,onSaved}:{employee:Employee;onSaved:()=>void}){
 const[bank,setBank]=useState({...employee.bankDetails}),[statutory,setStatutory]=useState({...employee.statutory}),[busy,setBusy]=useState<'bank'|'statutory'|null>(null),[errors,setErrors]=useState<Record<string,string>>({});
 const canSave=permitted('employees.write')&&permitted('employees.sensitive');
 async function save(section:'bank'|'statutory'){
  const identifiers={pan:statutory.pan??'',aadhaar:statutory.aadhaar??'',uan:statutory.uan??'',esicNumber:statutory.esicNumber??''};
  const checked=section==='bank'?bankDetailsInput.safeParse(bank):statutoryIdentifiersInput.safeParse(identifiers);
  if(!checked.success){const issues=Object.fromEntries(checked.error.issues.map(issue=>[section+'-'+issue.path[0],issue.message]));setErrors(issues);toast.error('Correct the highlighted '+(section==='bank'?'bank details.':'identity details.'));document.getElementById(Object.keys(issues)[0])?.focus();return;}
  setErrors({});setBusy(section);
  try{
   if(section==='bank')await updateEmployee(employee.id,{version:employee.version,bankDetails:bankDetailsInput.parse(bank)});
   else await updateEmployee(employee.id,{version:employee.version,statutory:{...statutory,...statutoryIdentifiersInput.parse(identifiers)}});
   toast.success(section==='bank'?'Bank details saved':'Identity details saved');onSaved();
  }catch(error){toast.error(error instanceof Error?error.message:'Unable to save details.');}finally{setBusy(null);}
 }
 function error(id:string){return errors[id]?<p id={id+'-error'} role="alert" className="mt-1 text-xs text-danger">{errors[id]}</p>:null;}
 return <>
 <SectionCard title="Edit bank details" className="lg:col-span-2"><p className="mb-4 text-sm text-muted-foreground">Save bank details independently of PAN, UAN and other identifiers. Use the IFSC printed on the bank statement or cheque. Blank optional fields are accepted.</p>
 <form onSubmit={event=>{event.preventDefault();if(!busy&&canSave)void save('bank');}}><div className="grid gap-4 sm:grid-cols-3">
 {(['accountHolderName','accountNumber','ifscCode','bankName','branch']as const).map(field=>{const id='bank-'+field;return <div key={field}><Label htmlFor={id}>{({accountHolderName:'Account holder',accountNumber:'Account number',ifscCode:'IFSC',bankName:'Bank name',branch:'Branch'})[field]}</Label><Input id={id} value={bank[field]} disabled={!!busy||!canSave} aria-invalid={!!errors[id]} aria-describedby={errors[id]?id+'-error':field==='ifscCode'?id+'-hint':undefined} onChange={event=>setBank({...bank,[field]:field==='ifscCode'?event.target.value.toUpperCase():event.target.value})}/>{field==='ifscCode'&&<p id={id+'-hint'} className="mt-1 text-xs text-muted-foreground">11 characters: 4 letters, 0, then 6 letters or digits.</p>}{error(id)}</div>;})}
 </div><Button type="submit" className="mt-4" disabled={!!busy||!canSave}>{busy==='bank'?'Saving...':'Save bank details'}</Button></form></SectionCard>
 <SectionCard title="Edit identity and statutory identifiers" className="lg:col-span-2"><p className="mb-4 text-sm text-muted-foreground">Leave unavailable identifiers blank. Invalid supplied values must be corrected. Aadhaar card upload and verification are managed in Documents.</p>
 <form onSubmit={event=>{event.preventDefault();if(!busy&&canSave)void save('statutory');}}><div className="grid gap-4 sm:grid-cols-3">
 {(['pan','aadhaar','uan','esicNumber']as const).map(field=>{const id='statutory-'+field;return <div key={field}><Label htmlFor={id}>{field==='pan'?'PAN':field==='aadhaar'?'Aadhaar number':field==='uan'?'UAN':'ESIC number'}</Label><Input id={id} value={statutory[field]??''} disabled={!!busy||!canSave} aria-invalid={!!errors[id]} aria-describedby={errors[id]?id+'-error':id+'-hint'} onChange={event=>setStatutory({...statutory,[field]:field==='pan'?event.target.value.toUpperCase():event.target.value})}/><p id={id+'-hint'} className="mt-1 text-xs text-muted-foreground">{field==='pan'?'5 letters, 4 digits, 1 letter. Optional.':field==='aadhaar'||field==='uan'?'12 digits. Optional.':'Optional.'}</p>{error(id)}</div>;})}
 </div><Button type="submit" className="mt-4" disabled={!!busy||!canSave}>{busy==='statutory'?'Saving...':'Save identity details'}</Button></form></SectionCard>
 </>;
}
