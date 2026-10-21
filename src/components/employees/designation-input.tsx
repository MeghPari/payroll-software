'use client';
import {useEffect,useState} from 'react';
import {tenantApi} from '@/lib/tenant-api';
export const BUILTIN_DESIGNATIONS=['Associate','Executive','Senior Executive','Supervisor','Team Lead','Manager','Senior Manager'];
export function DesignationInput({value,onChange,id}:{value:string;onChange:(value:string)=>void;id?:string}){
 const[names,setNames]=useState(BUILTIN_DESIGNATIONS);
 useEffect(()=>{let active=true;tenantApi<{name:string}[]>('designation-salaries?namesOnly=true').then(rows=>{if(active&&rows.length)setNames(rows.map(row=>row.name));}).catch(()=>{});return()=>{active=false;};},[]);
 const options=[...new Set(names.filter(name=>name!=='Other'))];
 return <><select id={id} aria-label="Designation" value={value} onChange={event=>onChange(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select designation</option>{value&&value!=='Other'&&!options.includes(value)&&<option value={value}>{value}</option>}{options.map(name=><option key={name} value={name}>{name}</option>)}<option value="Other">Other / Custom</option></select><p className="mt-1 text-xs text-muted-foreground">A matching designation supplies the default salary. Choose Other for manual/custom salary. Existing custom salaries are preserved.</p></>;
}
