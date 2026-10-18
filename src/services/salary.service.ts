import { tenantApi } from '@/lib/tenant-api';
import { companyToday,monthKey } from '@/domain/dates';
import { toMinor } from '@/domain/currency';
import { componentCodes,getSalaryStructures } from './salary-structure.service';
import { getEmployees } from './employee.service';
import type {SalaryProfile,SalaryRevision,SalaryHold,ImportRowResult,UploadRecord}from '@/types';
interface Assignment {id:string;employee_id:string;structure_id:string;effective_from:string;remarks:string;created_by:string;created_at:string;salary_structures:{name:string};employee_salary_component_values:{component_code:string;amount_minor:number}[]}
function profile(row:Assignment):SalaryProfile {
 const amounts=Object.fromEntries(componentCodes.map(code=>[code,0]));for(const item of row.employee_salary_component_values)amounts[item.component_code]=Number(item.amount_minor)/100;
 return {employeeId:row.employee_id,effectiveFrom:row.effective_from,structure:row.salary_structures.name,remarks:row.remarks,...amounts}as SalaryProfile;
}
export async function salaryAssignments(employeeId?:string) {return tenantApi<Assignment[]>(`salary${employeeId?`?employeeId=${encodeURIComponent(employeeId)}`:''}`);}
export async function getSalaryProfile(employeeId:string):Promise<SalaryProfile|undefined> {const row=(await salaryAssignments(employeeId)).find(r=>r.effective_from<=companyToday());return row?profile(row):undefined;}
export async function updateSalaryProfile(employeeId:string,data:SalaryProfile):Promise<SalaryProfile> {
 const structure=(await getSalaryStructures()).find(s=>s.name===data.structure||s.id===data.structure);if(!structure)throw new Error('Choose an active salary structure.');
 const amounts=Object.fromEntries(componentCodes.map(code=>[code,toMinor(data[code]??0)]));
 await tenantApi('salary',{method:'POST',body:JSON.stringify({employeeId,structureId:structure.id,effectiveFrom:data.effectiveFrom,amounts,remarks:data.remarks??''})});return data;
}
const gross=(p:SalaryProfile)=>p.basic+(p.da??0)+p.hra+p.special+p.conveyance+p.other+p.bonus+p.variable;
export async function getSalaryRevisions(employeeId?:string):Promise<SalaryRevision[]> {
 const rows=await salaryAssignments(employeeId);
 return rows.map(row=>{const previous=rows.filter(r=>r.employee_id===row.employee_id&&r.effective_from<row.effective_from).sort((a,b)=>b.effective_from.localeCompare(a.effective_from))[0];const old=previous?gross(profile(previous)):0;const current=profile(row),revised=gross(current);
  return {id:row.id,employeeId:row.employee_id,previousGross:old,revisedGross:revised,effectiveFrom:row.effective_from,revisionPercent:old?Math.round((revised-old)/old*10000)/100:0,changedBy:row.created_by,changedOn:row.created_at,profile:current};});
}
export async function holdSalary(employeeId:string,month:string,reason:string,remarks:string){await tenantApi('salary/holds',{method:'POST',body:JSON.stringify({employeeId,month:monthKey(month),reason,remarks,release:false})});}
export async function releaseSalary(employeeId:string,month:string,remarks:string){await tenantApi('salary/holds',{method:'POST',body:JSON.stringify({employeeId,month:monthKey(month),reason:remarks,remarks,release:true})});}
export async function getSalaryHoldHistory(employeeId:string):Promise<SalaryHold[]>{return tenantApi(`salary/holds?employeeId=${encodeURIComponent(employeeId)}`);}
export async function getActiveSalaryHold(employeeId:string,month:string){return(await getSalaryHoldHistory(employeeId)).find(h=>monthKey(h.month)===monthKey(month)&&h.status==='Held');}
export const SALARY_IMPORT_COLUMNS=['Employee ID','Effective From','Salary Structure','Basic','DA','HRA','Special Allowance','Other Allowance','Variable Pay','Remarks']as const;
export interface SalaryImportRow {employeeId:string;effectiveFrom:string;structure:string;basic:string;da?:string;hra:string;special:string;other:string;grossSalary:string;variable:string;remarks:string;employeeName?:string;oldGross?:number;newGross?:number;difference?:number}
export async function validateSalaryImport(rows:SalaryImportRow[]):Promise<ImportRowResult<SalaryImportRow>[]> {
 const employees=await getEmployees(),structures=await getSalaryStructures(),seen=new Set<string>();
 return rows.map((data,index)=>{const issues:string[]=[];const e=employees.find(e=>e.id===data.employeeId||e.employeeCode===data.employeeId);
  if(!e)issues.push('Employee not found.');if(seen.has(data.employeeId))issues.push('Duplicate employee in batch.');seen.add(data.employeeId);
  if(!structures.some(s=>s.status==='Active'&&s.name===data.structure))issues.push('Choose an active structure name.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data.effectiveFrom))issues.push('Effective date required.');
  try{for(const key of ['basic','da','hra','special','other','variable']as const)toMinor(data[key]||'0');}catch(error){issues.push(error instanceof Error?error.message:'Invalid amount.');}
  return {row:index+1,data:{...data,employeeName:e?.fullName},status:issues.length?'Error':'Valid',issues};});
}
export async function bulkUpdateSalary(rows:SalaryImportRow[]):Promise<UploadRecord> {
 if((await validateSalaryImport(rows)).some(row=>row.status!=='Valid'))throw new Error('Resolve salary import errors.');
 const employees=await getEmployees(),structures=await getSalaryStructures(),assignments=await salaryAssignments();
 return tenantApi('salary/import',{method:'POST',body:JSON.stringify({rows:rows.map(row=>({employeeId:employees.find(e=>e.id===row.employeeId||e.employeeCode===row.employeeId)!.id,structureId:structures.find(s=>s.name===row.structure)!.id,effectiveFrom:row.effectiveFrom,remarks:row.remarks,amounts:Object.fromEntries(componentCodes.map(code=>[code,code==='da'&&!(row.da??'').trim() ? Number(assignments.filter(a=>a.employee_id===employees.find(e=>e.id===row.employeeId||e.employeeCode===row.employeeId)!.id&&a.effective_from<=row.effectiveFrom).sort((a,b)=>b.effective_from.localeCompare(a.effective_from))[0]?.employee_salary_component_values.find(v=>v.component_code==='da')?.amount_minor??0) : toMinor(['basic','da','hra','special','other','variable'].includes(code)?row[code as 'basic']||'0':'0')]))}))})});
}
