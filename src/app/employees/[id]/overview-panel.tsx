"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { format } from "date-fns";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PersonalEditor } from "@/components/employees/personal-editor";
import { AddEmployeeDialog } from "@/components/employees/add-employee-dialog";
import { permitted } from "@/lib/tenant-api";
import type { Employee } from "@/types";

function Field({ label, value }: { label: string; value?: string }) {
  const text=value?.trim();
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={`mt-1 break-words text-sm ${text?'font-medium text-foreground':'text-muted-foreground'}`}>{text||"Not provided"}</dd></div>;
}
function fmtDate(iso:string){if(!iso)return '';try{return format(new Date(iso),"dd MMM yyyy");}catch{return iso;}}

export function OverviewPanel({employee,onSaved}:{employee:Employee;onSaved:()=>void}){
  const [personalOpen,setPersonalOpen]=useState(false),[employmentOpen,setEmploymentOpen]=useState(false);
  const address=[employee.address,employee.city,employee.state,employee.pincode].filter(value=>value?.trim()).join(', ');
  const emergency=[employee.emergencyContact.name,employee.emergencyContact.relation,employee.emergencyContact.phone].filter(value=>value?.trim()).join(' / ');
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Employee details</h2><p className="mt-1 text-sm text-muted-foreground">Personal, contact and employment information.</p></div><div className="flex flex-wrap gap-2">
      {permitted('employees.sensitive')&&<Button variant="outline" size="sm" className="gap-2" onClick={()=>setPersonalOpen(true)}><Pencil className="h-3.5 w-3.5"/>Edit personal details</Button>}
      {permitted('employees.write')&&<Button variant="outline" size="sm" className="gap-2" onClick={()=>setEmploymentOpen(true)}><Pencil className="h-3.5 w-3.5"/>Edit employment &amp; work contact</Button>}
    </div></div>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <SectionCard title="Personal information"><dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field label="Date of birth" value={fmtDate(employee.dateOfBirth)}/><Field label="Gender" value={employee.gender}/>
        <Field label="Blood group" value={employee.bloodGroup}/><Field label="Marital status" value={employee.maritalStatus}/>
        <Field label="Nationality" value={employee.nationality}/><Field label="Languages" value={employee.languages.join(', ')}/>
        <div className="border-t pt-4 sm:col-span-2"><Field label="Address" value={address}/></div>
      </dl></SectionCard>
      <SectionCard title="Contact information"><dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field label="Work email" value={employee.email}/><Field label="Phone number" value={employee.phone}/>
        <Field label="Personal email" value={employee.personalEmail}/><Field label="Work location" value={employee.workLocation}/>
        <div className="border-t pt-4 sm:col-span-2"><Field label="Emergency contact" value={emergency}/></div>
      </dl></SectionCard>
    </div>
    <SectionCard title="Employment information"><dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
      <Field label="Employee code" value={employee.employeeCode}/><Field label="Joining date" value={fmtDate(employee.joiningDate)}/>
      <Field label="Department" value={employee.department}/><Field label="Designation" value={employee.designation}/>
      <Field label="Employment type" value={employee.employmentType}/><Field label="Category" value={employee.category}/>
      <Field label="Status" value={employee.clientStatus||employee.status}/><Field label="State" value={employee.state}/>
      <Field label="Counter code" value={employee.counterCode}/><Field label="Counter name" value={employee.counterName}/>
      <div><Field label="Reporting manager" value={employee.reportingManager}/>{permitted('employees.write')&&<Link href={`/employees/${employee.id}?tab=employment`} className="mt-1 inline-block text-xs text-primary underline underline-offset-2">Manage reporting manager</Link>}</div>
    </dl></SectionCard>
    <Dialog open={personalOpen} onOpenChange={setPersonalOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Edit personal details</DialogTitle><DialogDescription>Update personal information, personal email and emergency contact. Save to apply your changes.</DialogDescription></DialogHeader>{personalOpen&&<PersonalEditor embedded key={employee.version} employee={employee} onCancel={()=>setPersonalOpen(false)} onSaved={()=>{setPersonalOpen(false);onSaved();}}/>}</DialogContent></Dialog>
    <AddEmployeeDialog employee={employee} open={employmentOpen} onOpenChange={setEmploymentOpen} onCreated={()=>onSaved()}/>
  </div>;
}
