import {monthKey} from './dates';
import type {Employee,SalaryRevision,SalaryStructure} from '../types';

export function structureDisplayName(name:string){
 return name==='Sample monthly salary - September 2026'?'Sample monthly salary':name;
}

// This is the effective base salary at the employee's last employed date in
// the selected month. Actual attendance-adjusted money remains in payroll.
export function salaryStructureMonth(structures:SalaryStructure[],employees:Employee[],revisions:SalaryRevision[],month:string){
 const key=monthKey(month),start=key+'-01',end=new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),0)).toISOString().slice(0,10);
 const assignments:Record<string,{structureId:string;structure:string;gross:number;effectiveFrom:string}>={};
 for(const employee of employees){
  if(employee.joiningDate>end||employee.exitDate&&employee.exitDate<start)continue;
  const cutoff=employee.exitDate&&employee.exitDate<end?employee.exitDate:end;
  const history=revisions.filter(row=>row.employeeId===employee.id).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom));
  const revision=history.find(row=>row.effectiveFrom<=cutoff)??history.at(-1);
  if(!revision)continue;
  const structure=structures.find(row=>revision.structureId?row.id===revision.structureId:row.name===revision.profile?.structure);
  if(structure)assignments[employee.id]={structureId:structure.id,structure:structure.name,gross:revision.revisedGross,effectiveFrom:revision.effectiveFrom};
 }
 return{endDate:end,assignments,structures:structures.map(structure=>({...structure,employeeCount:Object.values(assignments).filter(row=>row.structureId===structure.id).length}))};
}
