import { tenantApi } from '@/lib/tenant-api';
import { employeeView, type EmployeeRow } from '@/domain/employee-view';
import type { Employee, EmployeeFilters, EmploymentStatus, ExitRecord, ImportRowResult, UploadRecord, StatusChangeRecord } from '@/types';

export type EmployeeCreate = Pick<Employee,'firstName'|'lastName'|'email'|'phone'|'department'|'designation'|'joiningDate'|'workLocation'|'state'|'employmentType'> & Partial<Employee>;
function input(data: EmployeeCreate) {
  return { firstName:data.firstName,lastName:data.lastName,email:data.email,phone:data.phone,department:data.department,designation:data.designation,joiningDate:data.joiningDate,workLocation:data.workLocation,state:data.state,employmentType:data.employmentType,category:data.category,employeeCode:data.employeeCode,counterCode:data.counterCode,counterName:data.counterName,
    ...(data.bankDetails ? {bankDetails:data.bankDetails} : {}), ...(data.statutory ? {statutory:{aadhaar:data.statutory.aadhaar,pan:data.statutory.pan,uan:data.statutory.uan,esicNumber:data.statutory.esicNumber}} : {}) };
}
export async function getEmployees(filters: EmployeeFilters = {}): Promise<Employee[]> {
  const all: Employee[]=[];
  for (let page=1;;page++) {
    const response=await tenantApi<{items:EmployeeRow[];total:number}>(`employees?page=${page}&pageSize=100`);
    all.push(...response.items.map(employeeView));
    if (all.length>=response.total || !response.items.length) break;
  }
  return all.filter(e => (!filters.search || `${e.fullName} ${e.employeeCode} ${e.email}`.toLowerCase().includes(filters.search.toLowerCase())) &&
    (!filters.department || filters.department==='All' || e.department===filters.department) &&
    (!filters.designation || filters.designation==='All' || e.designation===filters.designation) &&
    (!filters.location || filters.location==='All' || e.workLocation===filters.location) &&
    (!filters.state || filters.state==='All' || e.state===filters.state) &&
    (!filters.status || filters.status==='All' || e.status===filters.status) &&
    (!filters.category || filters.category==='All' || e.category===filters.category));
}
interface Detail {
 clientSalaryReference?:Employee['clientSalaryReference'];
 canReadDocuments:boolean;
 employee:EmployeeRow; bank:{account_holder_name:string;account_number:string;ifsc_code:string;bank_name:string;branch:string}|null;
 statutory:{pan:string|null;uan:string|null;esic_number:string|null}|null;
 personal:{aadhaar_number?:string;personal_email:string;date_of_birth:string|null;gender:Employee['gender'];address:string;city:string;pincode:string;emergency_contact:Employee['emergencyContact'];blood_group:string;marital_status:Employee['maritalStatus'];nationality:string;languages:string[]}|null;
 history:{id:string;employee_id:string;previous_status:EmploymentStatus;new_status:EmploymentStatus;effective_date:string;reason:string;remarks:string;changed_by:string;created_at:string}[];
}
async function detail(id:string) { return tenantApi<Detail>(`employees/detail?id=${encodeURIComponent(id)}`); }
export async function getEmployeeById(id:string):Promise<Employee|undefined> {
 const data=await detail(id), employee=employeeView(data.employee);
 employee.canReadDocuments=data.canReadDocuments;employee.clientSalaryReference=data.clientSalaryReference;
 if(data.bank) employee.bankDetails={accountHolderName:data.bank.account_holder_name,accountNumber:data.bank.account_number,ifscCode:data.bank.ifsc_code,bankName:data.bank.bank_name,branch:data.bank.branch};
 if(data.statutory) employee.statutory={pan:data.statutory.pan??'',aadhaar:'',uan:data.statutory.uan??undefined,esicNumber:data.statutory.esic_number??undefined};
 if(data.personal){if(employee.statutory)employee.statutory.aadhaar=data.personal.aadhaar_number??'';Object.assign(employee,{bloodGroup:data.personal.blood_group??'',maritalStatus:data.personal.marital_status??'',nationality:data.personal.nationality??'',languages:data.personal.languages??[],personalEmail:data.personal.personal_email,dateOfBirth:data.personal.date_of_birth??'',gender:data.personal.gender??'',address:data.personal.address,city:data.personal.city,pincode:data.personal.pincode,emergencyContact:{...employee.emergencyContact,...data.personal.emergency_contact}});}
 return employee;
}
export async function createEmployee(data:EmployeeCreate):Promise<Employee> {
 const response=await tenantApi<{id:string}>('employees',{method:'POST',body:JSON.stringify({employee:input(data)})});
 const employee=await getEmployeeById(response.id); if(!employee) throw new Error('Employee saved but reload failed.'); return employee;
}
export async function updateEmployee(id:string,data:Partial<Employee>):Promise<Employee|undefined> {
 const previous=await getEmployeeById(id); if(!previous) throw new Error('Employee not found.');
 const merged={...previous,...data};
 // Only write sensitive objects when the caller explicitly edits them.
 const core=input({...merged,bankDetails:undefined,statutory:undefined});
 const employee={...core,...(data.bankDetails?{bankDetails:data.bankDetails}:{}),...(data.statutory?{statutory:{pan:data.statutory.pan,uan:data.statutory.uan,esicNumber:data.statutory.esicNumber}}:{})};
 await tenantApi('employees',{method:'POST',body:JSON.stringify({id,expectedVersion:data.version??previous.version,employee})});
 return getEmployeeById(id);
}
export async function deleteEmployee(_id?:string):Promise<boolean> { void _id;throw new Error('Historical employee records cannot be deleted. Change employment status instead.'); }
export async function checkDuplicateUAN(uan:string,excludeEmployeeId?:string):Promise<Employee|undefined> {
 if(!uan.trim())return undefined;
 const result=await tenantApi<{employee_id:string}|null>(`employees/uan-check?uan=${encodeURIComponent(uan)}${excludeEmployeeId?`&exclude=${encodeURIComponent(excludeEmployeeId)}`:''}`);
 return result ? getEmployeeById(result.employee_id) : undefined;
}
export interface StatusChangePayload {status:EmploymentStatus;effectiveDate:string;reason:string;remarks:string;exit?:ExitRecord;expectedVersion?:number}
export async function updateEmployeeStatus(employeeId:string,payload:StatusChangePayload):Promise<void> {
 const current=payload.expectedVersion?undefined:await getEmployeeById(employeeId);
 await tenantApi('employees/status',{method:'POST',body:JSON.stringify({id:employeeId,status:payload.status,expectedVersion:payload.expectedVersion??current?.version,effectiveDate:payload.effectiveDate,reason:payload.reason,remarks:payload.remarks,...(payload.exit?{exit:{lastWorkingDate:payload.exit.lastWorkingDate,exitType:payload.exit.exitType,settlementStatus:payload.exit.settlementStatus}}:{})})});
}
export async function getStatusHistory(employeeId:string):Promise<StatusChangeRecord[]> {
 return (await detail(employeeId)).history.map(row=>({id:row.id,employeeId:row.employee_id,previousStatus:row.previous_status,newStatus:row.new_status,effectiveDate:row.effective_date,reason:row.reason,remarks:row.remarks,changedBy:row.changed_by,changedOn:row.created_at}));
}
export async function getExitRecord(id?:string):Promise<ExitRecord|undefined> {if(!id)return undefined;return(await tenantApi<ExitRecord|null>(`employees/exit?employeeId=${encodeURIComponent(id)}`))??undefined;}
export const EMPLOYEE_IMPORT_COLUMNS=['Employee ID','First Name','Last Name','Official Email','Mobile Number','Date of Joining','Employment Type','Department','Designation','Work Location','State','PAN','UAN'] as const;
export interface EmployeeImportRow {employeeId:string;firstName:string;lastName:string;dateOfBirth:string;gender:string;personalEmail:string;officialEmail:string;mobile:string;dateOfJoining:string;employmentType:string;department:string;designation:string;workLocation:string;state:string;pan:string;aadhaar:string;uan:string;ctc:string;status:string}
export async function validateEmployeeImport(rows:EmployeeImportRow[]):Promise<ImportRowResult<EmployeeImportRow>[]> {
 const existing=await getEmployees(), seen=new Set(existing.map(e=>e.employeeCode)), uans=new Set<string>();
 return rows.map((data,index)=>{const issues:string[]=[];
  if(!/^[A-Za-z0-9_-]{1,40}$/.test(data.employeeId))issues.push('Valid employee code is required.');
  if(seen.has(data.employeeId))issues.push('Duplicate employee code.');seen.add(data.employeeId);
  if(!data.firstName.trim()||!data.lastName.trim())issues.push('First and last name required.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.officialEmail))issues.push('Valid email required.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfJoining)||Number.isNaN(Date.parse(data.dateOfJoining)))issues.push('Valid joining date required.');
  if(data.pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(data.pan))issues.push('Invalid PAN.');
  if(data.uan&&(!/^[0-9]{12}$/.test(data.uan)||uans.has(data.uan)))issues.push('Invalid or duplicate UAN.');if(data.uan)uans.add(data.uan);
  if(data.aadhaar||data.ctc||data.dateOfBirth||data.personalEmail||data.gender)issues.push('This employee import only supports template fields. Configure personal details and salary separately.');
  if(data.status&&data.status!=='Active')issues.push('Import starts employees as Active; use the status workflow for changes.');
  return {row:index+1,data,status:issues.length?'Error':'Valid',issues};});
}
export async function bulkImportEmployees(rows:EmployeeImportRow[]):Promise<UploadRecord> {
 const validation=await validateEmployeeImport(rows);if(validation.some(r=>r.status!=='Valid'))throw new Error('Resolve import errors first.');
 return tenantApi('employees/import',{method:'POST',body:JSON.stringify({rows:rows.map(row=>({employeeCode:row.employeeId,firstName:row.firstName,lastName:row.lastName,email:row.officialEmail,phone:row.mobile,joiningDate:row.dateOfJoining,department:row.department,designation:row.designation,workLocation:row.workLocation,state:row.state,employmentType:row.employmentType||'Full-time',statutory:{pan:row.pan,uan:row.uan}}))})});
}
async function bulk(ids:string[],field:string,value:string|boolean) {await tenantApi('employees/bulk',{method:'POST',body:JSON.stringify({ids,field,value})});}
export async function bulkAssignSalaryStructure(ids:string[],value:string) {await bulk(ids,'salaryStructureId',value);}
export async function bulkSetDepartment(ids:string[],value:Employee['department']) {await bulk(ids,'department',value);}
export async function bulkSetWorkLocation(ids:string[],value:string) {await bulk(ids,'workLocation',value);}
export async function bulkSetState(ids:string[],value:string) {await bulk(ids,'state',value);}
export async function bulkSetStatutoryApplicability(ids:string[],field:'pfApplicable'|'esiApplicable',value:boolean) {await bulk(ids,field,value);}
