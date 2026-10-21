import { tenantApi } from '@/lib/tenant-api';
import { companyToday,monthKey } from '@/domain/dates';
import { componentCodes } from './salary-structure.service';
import type {SalaryProfile,SalaryRevision,SalaryHold}from '@/types';
interface Assignment {id:string;employee_id:string;structure_id:string;effective_from:string;remarks:string;created_by:string;created_at:string;salary_structures:{name:string};employee_salary_component_values:{component_code:string;amount_minor:number}[]}
function assignmentAt(rows:Assignment[],date:string){const history=[...rows].sort((a,b)=>b.effective_from.localeCompare(a.effective_from));return history.find(row=>row.effective_from<=date)??history.at(-1);}
function profile(row:Assignment):SalaryProfile {
 const amounts=Object.fromEntries(componentCodes.map(code=>[code,0]));for(const item of row.employee_salary_component_values)amounts[item.component_code]=Number(item.amount_minor)/100;
 return {employeeId:row.employee_id,effectiveFrom:row.effective_from,structure:row.salary_structures.name,remarks:row.remarks,...amounts}as SalaryProfile;
}
export async function salaryAssignments(employeeId?:string) {return tenantApi<Assignment[]>(`salary${employeeId?`?employeeId=${encodeURIComponent(employeeId)}`:''}`);}
export async function getSalaryProfile(employeeId:string):Promise<SalaryProfile|undefined> {const row=assignmentAt(await salaryAssignments(employeeId),companyToday());return row?profile(row):undefined;}
const gross=(p:SalaryProfile)=>p.basic+(p.da??0)+p.hra+p.special+p.conveyance+p.other+p.bonus+p.variable;
export async function getSalaryRevisions(employeeId?:string):Promise<SalaryRevision[]> {
 const rows=await salaryAssignments(employeeId);
 return rows.map(row=>{const previous=rows.filter(r=>r.employee_id===row.employee_id&&r.effective_from<row.effective_from).sort((a,b)=>b.effective_from.localeCompare(a.effective_from))[0];const old=previous?gross(profile(previous)):0;const current=profile(row),revised=gross(current);
  return {id:row.id,employeeId:row.employee_id,structureId:row.structure_id,previousGross:old,revisedGross:revised,effectiveFrom:row.effective_from,revisionPercent:old?Math.round((revised-old)/old*10000)/100:0,changedBy:row.created_by,changedOn:row.created_at,profile:current};});
}
export async function holdSalary(employeeId:string,month:string,reason:string,remarks:string){await tenantApi('salary/holds',{method:'POST',body:JSON.stringify({employeeId,month:monthKey(month),reason,remarks,release:false})});}
export async function releaseSalary(employeeId:string,month:string,remarks:string){await tenantApi('salary/holds',{method:'POST',body:JSON.stringify({employeeId,month:monthKey(month),reason:remarks,remarks,release:true})});}
export async function getSalaryHoldHistory(employeeId:string):Promise<SalaryHold[]>{return tenantApi(`salary/holds?employeeId=${encodeURIComponent(employeeId)}`);}
export async function getActiveSalaryHold(employeeId:string,month:string){return(await getSalaryHoldHistory(employeeId)).find(h=>monthKey(h.month)===monthKey(month)&&h.status==='Held');}
