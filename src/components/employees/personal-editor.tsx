'use client';
import { useState } from 'react';
import { SectionCard } from '@/components/shared/section-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { permitted,tenantApi } from '@/lib/tenant-api';
import type { Employee } from '@/types';
import { toast } from 'sonner';
export function PersonalEditor({employee,onSaved,onCancel,embedded=false}:{employee:Employee;onSaved:()=>void;onCancel?:()=>void;embedded?:boolean}){
 const[draft,setDraft]=useState({personalEmail:employee.personalEmail,dateOfBirth:employee.dateOfBirth,gender:employee.gender,address:employee.address,city:employee.city,pincode:employee.pincode,bloodGroup:employee.bloodGroup,maritalStatus:employee.maritalStatus,nationality:employee.nationality,languages:employee.languages.join(', '),emergencyContact:{...employee.emergencyContact}}),[busy,setBusy]=useState(false);
 if(!permitted('employees.sensitive'))return null;
 async function save(){setBusy(true);try{await tenantApi('employees/personal',{method:'POST',body:JSON.stringify({employeeId:employee.id,expectedVersion:employee.version,personal:{...draft,languages:draft.languages.split(',').map(item=>item.trim()).filter(Boolean)}})});toast.success('Personal information saved');onSaved();}catch(error){toast.error(error instanceof Error?error.message:'Unable to save personal information.');}finally{setBusy(false);}}
 const textField=(field:'personalEmail'|'dateOfBirth'|'address'|'city'|'pincode'|'nationality'|'languages',label:string,type='text')=><div key={field}><Label htmlFor={`personal-${field}`}>{label}</Label><Input id={`personal-${field}`} type={type} value={draft[field]} onChange={event=>setDraft({...draft,[field]:event.target.value})}/></div>;
 const selectField=(field:'gender'|'bloodGroup'|'maritalStatus',label:string,options:string[])=><div key={field}><Label htmlFor={`personal-${field}`}>{label}</Label><select id={`personal-${field}`} className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={draft[field]} onChange={event=>setDraft({...draft,[field]:event.target.value})}>{['',...options].map(value=><option key={value} value={value}>{value||'Not provided'}</option>)}</select></div>;
 const form=<form onSubmit={event=>{event.preventDefault();void save();}} className="space-y-6">
  <fieldset disabled={busy} className="space-y-3"><legend className="mb-3 font-semibold">Personal information</legend><div className="grid gap-4 sm:grid-cols-2">
   {textField('dateOfBirth','Date of birth','date')}{selectField('gender','Gender',['Male','Female','Other'])}
   {selectField('bloodGroup','Blood group',['A+','A-','B+','B-','AB+','AB-','O+','O-'])}{selectField('maritalStatus','Marital status',['Single','Married','Divorced','Widowed'])}
   {textField('nationality','Nationality')}{textField('languages','Languages (comma separated)')}
  </div></fieldset>
  <fieldset disabled={busy} className="border-t pt-4"><legend className="pr-2 font-semibold">Address</legend><div className="mt-3 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2">{textField('address','Street address')}</div>{textField('city','City')}{textField('pincode','Pincode')}</div></fieldset>
  <fieldset disabled={busy} className="border-t pt-4"><legend className="pr-2 font-semibold">Personal contact</legend><div className="mt-3 grid gap-4 sm:grid-cols-2">
   {textField('personalEmail','Personal email','email')}
   {(['name','relation','phone']as const).map(field=><div key={field}><Label htmlFor={`emergency-${field}`}>{({name:'Emergency contact name',relation:'Relationship',phone:'Emergency phone'})[field]}</Label><Input id={`emergency-${field}`} value={draft.emergencyContact[field]} onChange={event=>setDraft({...draft,emergencyContact:{...draft.emergencyContact,[field]:event.target.value}})}/></div>)}
  </div></fieldset>
  <div className="flex justify-end gap-2 border-t pt-4">{onCancel&&<Button variant="outline" disabled={busy} type="button" onClick={onCancel}>Cancel</Button>}<Button disabled={busy} type="submit">{busy?'Saving...':'Save personal details'}</Button></div>
 </form>;
 return embedded?form:<SectionCard title="Edit Personal Information" className="lg:col-span-2">{form}</SectionCard>;
}
