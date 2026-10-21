import { tenantApi } from '@/lib/tenant-api';
import type { SalaryStructure } from '@/types';
export const componentCodes=['basic','da','hra','special','conveyance','other','bonus','variable','loan','advance','otherDeduction','employerOther'] as const;
interface Row {id:string;name:string;status:SalaryStructure['status'];created_at:string;version:number;salary_structure_components:{component_code:string;calculation_type:string;value_minor:number|null;salary_components:{name:string;kind:string}}[]}
export async function getSalaryStructures():Promise<SalaryStructure[]> {
 return(await tenantApi<Row[]>('salary-structures')).map(row=>({id:row.id,name:row.name,status:row.status,frequency:'Monthly',createdOn:row.created_at,version:row.version,employeeCount:0,
  earnings:row.salary_structure_components.filter(x=>x.salary_components.kind==='earning').map(x=>({id:x.component_code,name:x.salary_components.name,type:'Earning',calculationType:'As per record',value:null})),
  deductions:row.salary_structure_components.filter(x=>x.salary_components.kind==='deduction').map(x=>({id:x.component_code,name:x.salary_components.name,type:'Deduction',calculationType:'As per record',value:null}))}));
}
export async function getSalaryStructureById(id:string){return(await getSalaryStructures()).find(s=>s.id===id);}
export async function createSalaryStructure(data:Omit<SalaryStructure,'id'|'employeeCount'>) {
 const result=await tenantApi<{id:string}>('salary-structures',{method:'POST',body:JSON.stringify({name:data.name,status:data.status,components:componentCodes.map(code=>({code,calculationType:'As per record',valueMinor:null}))})});
 const structure=await getSalaryStructureById(result.id);if(!structure)throw new Error('Unable to reload salary structure.');return structure;
}
export async function updateSalaryStructure(id:string,data:Partial<SalaryStructure>) {
 const previous=await getSalaryStructureById(id);if(!previous)throw new Error('Structure not found.');
 await tenantApi('salary-structures',{method:'POST',body:JSON.stringify({id,expectedVersion:previous.version,name:data.name??previous.name,status:data.status??previous.status,components:componentCodes.map(code=>({code,calculationType:'As per record',valueMinor:null}))})});
 return getSalaryStructureById(id);
}
