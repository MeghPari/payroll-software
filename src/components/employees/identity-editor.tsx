'use client';
import { useState } from 'react';
import { SectionCard } from '@/components/shared/section-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updateEmployee } from '@/services/employee.service';
import { permitted } from '@/lib/tenant-api';
import type { Employee } from '@/types';
import { toast } from 'sonner';
export function IdentityEditor({employee,onSaved}:{employee:Employee;onSaved:()=>void}){
 const [bank,setBank]=useState({...employee.bankDetails});const[statutory,setStatutory]=useState({...employee.statutory});const[busy,setBusy]=useState(false);
 async function save(){setBusy(true);try{await updateEmployee(employee.id,{version:employee.version,bankDetails:bank,statutory});toast.success('Bank and statutory details saved');onSaved();}catch(error){toast.error(error instanceof Error?error.message:'Unable to save details.');}finally{setBusy(false);}}
 return <SectionCard title="Edit bank and statutory identifiers" className="lg:col-span-2"><div className="grid gap-4 sm:grid-cols-3">{(['accountHolderName','accountNumber','ifscCode','bankName','branch']as const).map(field=><div key={field}><Label htmlFor={'bank-'+field}>{({accountHolderName:'Account holder',accountNumber:'Account number',ifscCode:'IFSC',bankName:'Bank name',branch:'Branch'})[field]}</Label><Input id={'bank-'+field} value={bank[field]} onChange={e=>setBank({...bank,[field]:field==='ifscCode'?e.target.value.toUpperCase():e.target.value})}/></div>)}{(['pan','uan','esicNumber']as const).map(field=><div key={field}><Label htmlFor={'stat-'+field}>{field==='pan'?'PAN':field==='uan'?'UAN':'ESIC number'}</Label><Input id={'stat-'+field} value={statutory[field]??''} onChange={e=>setStatutory({...statutory,[field]:field==='pan'?e.target.value.toUpperCase():e.target.value})}/></div>)}</div><Button className="mt-4" disabled={busy||!permitted('employees.write')||!permitted('employees.sensitive')} onClick={save}>Save details</Button></SectionCard>;
}
