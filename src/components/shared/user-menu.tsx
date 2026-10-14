"use client";

import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSessionStore } from "@/store/session-store";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from 'react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function UserMenu() {
  const session = useSessionStore(s => s.session);
  const router = useRouter();
  const name=session?.user.displayName?.trim()||'Account';
  const initials=name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
  async function saveName(){setSaving(true);setError('');try{const response=await api<{displayName:string}>('auth/profile',{method:'POST',body:JSON.stringify({displayName:draft})});const current=useSessionStore.getState().session;if(current)useSessionStore.getState().setSession({...current,user:{...current.user,displayName:response.displayName}});setEditing(false);toast.success('Display name updated');}catch(error){setError(error instanceof Error?error.message:'Unable to update name.');}finally{setSaving(false);}}
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted/60 transition-colors">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-48 truncate text-sm font-medium text-foreground sm:inline">{name}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{name}</span>
              <span className="text-xs font-normal text-muted-foreground">{session?.user.email ?? "Signed out"}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={()=>{setDraft(name==='Account'?'':name);setError('');setEditing(true);}}><User className="h-4 w-4"/>Edit name</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/employees')}>
          <User className="h-4 w-4" /> My Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Settings className="h-4 w-4" /> Account Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger focus:text-danger" onClick={async () => { try { await api('auth/logout', { method: 'POST' }); useSessionStore.getState().setSession(null); router.replace('/login'); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Sign out failed.'); } }}>
          <LogOut className="h-4 w-4" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={editing} onOpenChange={open=>!saving&&setEditing(open)}><DialogContent><DialogHeader><DialogTitle>Your display name</DialogTitle></DialogHeader><Label htmlFor="display-name">Full name</Label><Input id="display-name" autoComplete="name" maxLength={100} value={draft} onChange={event=>setDraft(event.target.value)}/>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}<DialogFooter><Button variant="outline" disabled={saving} onClick={()=>setEditing(false)}>Cancel</Button><Button disabled={saving||!draft.trim()} onClick={saveName}>{saving?'Saving...':'Save name'}</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
}
