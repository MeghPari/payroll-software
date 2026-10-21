'use client';
import {useEffect,useState} from 'react';
import {tenantApi} from '@/lib/tenant-api';
import {DEPARTMENT_DESIGNATIONS} from '@/domain/department-designations';
export const BUILTIN_DESIGNATIONS=['Associate','Executive','Senior Executive','Supervisor','Team Lead','Manager','Senior Manager'];
type Role={name:string;department:string};
function useRoles(){
 const[roles,setRoles]=useState<Role[]>([...DEPARTMENT_DESIGNATIONS,...BUILTIN_DESIGNATIONS.map(name=>({name,department:'General'}))]);
 useEffect(()=>{let active=true;tenantApi<Role[]>('designation-salaries?namesOnly=true').then(rows=>{if(active&&rows.length)setRoles(rows);}).catch(()=>{});return()=>{active=false;};},[]);
 return roles;
}
const selectClass='h-10 w-full rounded-md border bg-background px-3 text-sm';
export function DepartmentInput({value,onChange,id}:{value:string;onChange:(value:string)=>void;id?:string}){
 const roles=useRoles(),departments=[...new Set(roles.map(role=>role.department))].sort();
 return <select id={id} aria-label="Department" className={selectClass} value={value} onChange={event=>onChange(event.target.value)}><option value="">Select department</option>{value&&!departments.includes(value)&&value!=='Other'&&<option>{value}</option>}{departments.filter(name=>name!=='Other').map(name=><option key={name}>{name}</option>)}<option>Other</option></select>;
}
export function DesignationInput({value,onChange,id,department}:{value:string;onChange:(value:string)=>void;id?:string;department?:string}){
 const roles=useRoles(),options=roles.filter(role=>!department||role.department===department);
 return <><select id={id} aria-label="Designation" value={value} onChange={event=>onChange(event.target.value)} className={selectClass}><option value="">Select designation</option>{value&&value!=='Other'&&!options.some(role=>role.name===value)&&<option value={value}>{value} (current)</option>}{options.filter(role=>role.name!=='Other').map(role=><option key={role.name} value={role.name}>{role.name}{!department?' - '+role.department:''}</option>)}<option value="Other">Other / Custom</option></select><p className="mt-1 text-xs text-muted-foreground">A matching designation supplies the default salary. Choose Other for manual/custom salary. Existing custom salaries are preserved.</p></>;
}
