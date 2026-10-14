'use client';
import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { DropdownMenu,DropdownMenuContent,DropdownMenuGroup,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { tenantApi } from '@/lib/tenant-api';
import { useSessionStore } from '@/store/session-store';
import { toast } from 'sonner';
interface Notice{id:string;title:string;href:string;created_at:string}
export function NotificationDropdown(){const id=useSessionStore(state=>state.companyId);return <Inbox key={id}/>;}
function Inbox(){
 const[items,setItems]=useState<Notice[]>([]),[total,setTotal]=useState<number|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false);const router=useRouter();
 useEffect(()=>{let cancelled=false,pending=false;const controller=new AbortController();async function refresh(){if(pending)return;pending=true;try{const data=await tenantApi<{items:Notice[];total:number}>('notifications',{signal:controller.signal});if(!cancelled){setItems(data.items);setTotal(data.total);setError('');}}catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Unable to load notifications.');}finally{pending=false;}}void refresh();const timer=setInterval(()=>void refresh(),60000);return()=>{cancelled=true;controller.abort();clearInterval(timer);};},[revision]);
 async function read(ids:string[],href?:string){setBusy(true);try{await tenantApi('notifications',{method:'POST',body:JSON.stringify({ids})});setRevision(value=>value+1);if(href)router.push(href);}catch(error){toast.error(error instanceof Error?error.message:'Unable to mark notification read.');}finally{setBusy(false);}}
 return <DropdownMenu onOpenChange={open=>{if(open)setRevision(value=>value+1);}}><DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications"/>}><Bell className="h-5 w-5 text-muted-foreground"/>{total!==null&&total>0&&<span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] text-white">{total>99?'99+':total}</span>}</DropdownMenuTrigger><DropdownMenuContent align="end" className="w-80"><DropdownMenuGroup><DropdownMenuLabel>Notifications</DropdownMenuLabel></DropdownMenuGroup><DropdownMenuSeparator/>{error?<p role="status" className="p-3 text-xs text-muted-foreground">{error}</p>:items.length?items.map(item=><DropdownMenuItem key={item.id} disabled={busy} className="items-start py-3" onClick={()=>void read([item.id],item.href)}><div><p className="text-sm">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('en-IN')}</p></div></DropdownMenuItem>):<p className="p-3 text-sm text-muted-foreground">{total===null?'Loading notifications...':'No unread notifications.'}</p>}{items.length>0&&<><DropdownMenuSeparator/><DropdownMenuItem disabled={busy} onClick={()=>void read(items.map(item=>item.id))}>Mark displayed notifications read</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>;
}
