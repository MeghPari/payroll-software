'use client';
import {useEffect,useId,useState} from 'react';
import {Input} from '@/components/ui/input';
import {tenantApi} from '@/lib/tenant-api';
export const BUILTIN_DESIGNATIONS=['Associate','Executive','Senior Executive','Supervisor','Team Lead','Manager','Senior Manager'];
export function DesignationInput({value,onChange,id}:{value:string;onChange:(value:string)=>void;id?:string}){
 const listId=useId(),[names,setNames]=useState(BUILTIN_DESIGNATIONS);
 useEffect(()=>{let active=true;tenantApi<{name:string}[]>('designation-salaries?namesOnly=true').then(rows=>{if(active&&rows.length)setNames(rows.map(row=>row.name));}).catch(()=>{});return()=>{active=false;};},[]);
 return <><Input id={id} value={value} onChange={event=>onChange(event.target.value)} list={listId} placeholder="Select designation or Other"/><datalist id={listId}>{names.map(name=><option key={name} value={name}/>)}<option value="Other">Other / Custom</option></datalist><p className="mt-1 text-xs text-muted-foreground">A matching designation supplies the default salary. Choose Other for manual/custom salary. Existing custom salaries are preserved.</p></>;
}
