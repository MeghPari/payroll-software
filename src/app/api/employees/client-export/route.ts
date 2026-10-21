import {tenant} from '@/server/auth';
import {ApiError,databaseError,endpoint} from '@/server/http';
import {allRows} from '@/server/paging';
import {CLIENT_EMPLOYEE_COLUMNS} from '@/domain/client-template-columns';
import {escapeCSV} from '@/domain/csv';
import type {ClientEmployeeInput} from '@/domain/client-employee';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'employees.sensitive');const access=await client.rpc('has_permission',{c:companyId,permission_code:'salary.read'});databaseError(access.error);if(!access.data)throw new ApiError(403,'FORBIDDEN','Salary read access required.');
 const revisions=await allRows((first,last)=>client.from('employee_master_revisions').select('employee_id,source_data,created_at,id').eq('company_id',companyId).order('revision_no',{ascending:false}).range(first,last));
 const latest=new Map<string,ClientEmployeeInput>();for(const revision of revisions)if(!latest.has(revision.employee_id))latest.set(revision.employee_id,revision.source_data as ClientEmployeeInput);
 const money=(value:number|null|undefined)=>value===null||value===undefined?'':(value/100).toFixed(2);
 const rows=[...latest.values()].sort((a,b)=>a.employeeCode.localeCompare(b.employeeCode)).map(p=>[p.employeeCode,p.employeeName,p.gender,p.dateOfBirth,p.maritalStatus,p.phone,p.aadhaar,p.pan,p.uan,p.esicNumber,p.joiningDate,p.exitDate,p.clientStatus,p.counterCode,p.counterName,p.reportingManager,p.workLocation,p.state,p.department,p.designation,p.accountNumber,p.ifscCode,money(p.amounts?.basic),money(p.amounts?.da),money(p.amounts?.hra),money(p.amounts?.other),money(p.salaryReference.grossMinor),money(p.salaryReference.pfMinor),money(p.salaryReference.esiMinor),money(p.salaryReference.ctcMinor)]);
 const audit=await client.rpc('audit_client_employee_export',{c:companyId});databaseError(audit.error);
 return new Response('\uFEFF'+[CLIENT_EMPLOYEE_COLUMNS,...rows].map(row=>row.map(escapeCSV).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="Employee_Database.csv"','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
});
