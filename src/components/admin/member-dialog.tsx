'use client';
import { useState } from 'react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tenantApi } from '@/lib/tenant-api';
import { roles } from '@/config/permissions';
import { toast } from 'sonner';
export interface CompanyMember {user_id:string;role:string;active:boolean;created_at:string}
export function MemberDialog({member,onClose,onSaved}:{member:CompanyMember|null|undefined;onClose:()=>void;onSaved:()=>void}){
 if(member===undefined)return null;
 return <MemberForm key={member?.user_id??'new'} member={member} onClose={onClose} onSaved={onSaved}/>;
}
function MemberForm({member,onClose,onSaved}:{member:CompanyMember|null;onClose:()=>void;onSaved:()=>void}){
 const [userId,setUserId]=useState(member?.user_id??''),[role,setRole]=useState(member?.role??'Employee'),[active,setActive]=useState(member?.active??true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{await tenantApi('users',{method:'POST',body:JSON.stringify({userId,role,active})});toast.success('Company access saved');onSaved();onClose();}catch(error){setError(error instanceof Error?error.message:'Unable to save company access.');}finally{setBusy(false);}}
 return <Dialog open onOpenChange={open=>!open&&!busy&&onClose()}><DialogContent><DialogHeader><DialogTitle>{member?'Edit company access':'Assign company access'}</DialogTitle></DialogHeader><div className="space-y-3"><Label htmlFor="member-user">Auth user ID</Label><Input id="member-user" value={userId} disabled={!!member} onChange={event=>setUserId(event.target.value.trim())}/><p className="text-xs text-muted-foreground">Use an existing confirmed Supabase Auth user. An employee record alone does not create a login.</p><Label htmlFor="member-role">Role</Label><select id="member-role" className="h-10 w-full rounded-md border px-3" value={role} onChange={event=>setRole(event.target.value)}>{roles.map(role=><option key={role}>{role}</option>)}</select><Label className="flex gap-2"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/>Active company access</Label>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}</div><DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy||!userId} onClick={save}>{busy?'Saving…':'Save Access'}</Button></DialogFooter></DialogContent></Dialog>;
}
