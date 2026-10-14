'use client';
import { useEffect,useState } from 'react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { tenantApi } from '@/lib/tenant-api';
import { getParties,type PartyRow } from '@/services/invoice.service';
import { toast } from 'sonner';
export function PartyDialog({kind,id,onClose,onSaved}:{kind:'Customer'|'Vendor';id:string|null|undefined;onClose:()=>void;onSaved:()=>void}){if(id===undefined)return null;return <Form key={id??'new'} kind={kind} id={id} onClose={onClose} onSaved={onSaved}/>;}
function Form({kind,id,onClose,onSaved}:{kind:'Customer'|'Vendor';id:string|null;onClose:()=>void;onSaved:()=>void}){
 const [fields,setFields]=useState({name:'',email:'',phone:'',gstin:'',address:'',state:''}),[party,setParty]=useState<PartyRow|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!id)return;let cancelled=false;getParties(kind).then(parties=>{if(cancelled)return;const party=parties.find(party=>party.id===id);if(!party){setError('Party not found. Refresh the page.');return;}setParty(party);setFields({name:party.name,email:party.email,phone:party.phone,gstin:party.gstin,address:party.address,state:party.state});}).catch(error=>{if(!cancelled)setError(error instanceof Error?error.message:'Unable to load party.');});return()=>{cancelled=true;};},[id,kind]);
 async function save(){setBusy(true);setError('');try{await tenantApi('parties',{method:'POST',body:JSON.stringify({kind,...fields,...(party?{id:party.id,expectedVersion:party.version}:{})})});toast.success(`${kind} saved`);onSaved();onClose();}catch(error){setError(error instanceof Error?error.message:'Unable to save party.');}finally{setBusy(false);}}
 return <Dialog open onOpenChange={open=>!open&&!busy&&onClose()}><DialogContent className="max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>{id?'Edit':'Add'} {kind}</DialogTitle></DialogHeader><div className="space-y-3">{(Object.keys(fields)as(keyof typeof fields)[]).map(key=><div key={key}><Label htmlFor={`party-${key}`}>{key==='gstin'?'GSTIN':key.charAt(0).toUpperCase()+key.slice(1)}</Label><Input id={`party-${key}`} type={key==='email'?'email':'text'} disabled={!!id&&!party} value={fields[key]} onChange={event=>setFields({...fields,[key]:event.target.value})}/></div>)}{error&&<p role="alert" className="text-sm text-danger">{error}</p>}</div><DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy||!fields.name.trim()||!!id&&!party} onClick={save}>Save</Button></DialogFooter></DialogContent></Dialog>;
}
