'use client';
import {useState} from 'react';
import {BulkUploadDialog} from '@/components/shared/bulk-upload-dialog';
import {CLIENT_EMPLOYEE_COLUMNS} from '@/domain/client-template-columns';
import {parseClientEmployee,type ClientEmployeeRow} from '@/domain/client-employee';
import {getEmployees} from '@/services/employee.service';
import {tenantApi} from '@/lib/tenant-api';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import type {ImportRowResult,UploadRecord} from '@/types';
import {ZodError} from 'zod';
export function ClientEmployeeImportDialog({open,onOpenChange,onImported,onUseStandard}:{open:boolean;onOpenChange:(value:boolean)=>void;onImported:()=>void;onUseStandard:()=>void}){
 const[effective,setEffective]=useState(''),[useJoining,setUseJoining]=useState(false);
 return <BulkUploadDialog<ClientEmployeeRow> open={open} onOpenChange={onOpenChange} title="Upload Client Employee Database" description="Upload Employee_Database.xlsx or matching CSV. Creates new employees with personal, counter, bank and structured salary details. Existing employee codes are not overwritten." templateFileName="Employee_Database.csv" templateColumns={CLIENT_EMPLOYEE_COLUMNS} parseRow={record=>({record,salaryEffectiveFrom:useJoining?'joining':effective})}
 validateRows={async rows=>{if(rows.length>500)throw new Error('Upload at most 500 employees per file.');const existing=await getEmployees(),codes=new Set(existing.map(employee=>employee.employeeCode)),uans=new Set<string>();return rows.map((data,index)=>{const issues:string[]=[];try{const parsed=parseClientEmployee(data);if(codes.has(parsed.employeeCode))issues.push('Employee code already exists or is duplicated in this file.');codes.add(parsed.employeeCode);if(parsed.uan&&uans.has(parsed.uan))issues.push('Duplicate UAN in this file.');if(parsed.uan)uans.add(parsed.uan);}catch(error){issues.push(error instanceof ZodError?error.issues.map(issue=>issue.message).join(' '):error instanceof Error?error.message:'Invalid row.');}return{row:index+2,data,status:issues.length?'Error':'Valid',issues} as ImportRowResult<ClientEmployeeRow>;});}}
 previewColumns={[{header:'Employee Code',cell:row=>row.data.record['Employee Code']},{header:'Employee Name',cell:row=>row.data.record['Employee Name']},{header:'Counter',cell:row=>row.data.record['Counter Name']},{header:'Function',cell:row=>row.data.record.Function},{header:'Client status',cell:row=>row.data.record.Status||'Active'},{header:'Structured gross',cell:row=>row.data.record['S. Gross']||'Not supplied'}]}
 onImport={async rows=>{const result=await tenantApi<UploadRecord>('employees/client-import',{method:'POST',body:JSON.stringify({rows:rows.map(parseClientEmployee)})});onImported();return result;}}
 extraField={<div className="space-y-3 rounded-lg border p-4"><p className="text-sm">No email is required by the client template. Imported bank details remain unverified. S. PF, S. ESI and Total CTC are retained as reference amounts; they do not set statutory applicability or override calculated deductions.</p><Label className="flex items-center gap-2"><input type="checkbox" checked={useJoining} onChange={event=>setUseJoining(event.target.checked)}/>Use each employee&apos;s joining date for the first salary assignment</Label>{!useJoining&&<div><Label htmlFor="client-salary-effective">Salary effective from (required if salary components are supplied)</Label><Input id="client-salary-effective" type="date" value={effective} onChange={event=>setEffective(event.target.value)}/></div>}<Button variant="outline" onClick={onUseStandard}>Use previous employee CSV format</Button></div>}/>;
}
