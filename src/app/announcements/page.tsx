'use client';
import { useEffect,useState } from 'react';
import { Plus,Megaphone,Pin } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog,DialogContent,DialogTitle } from '@/components/ui/dialog';
import { permitted,tenantApi } from '@/lib/tenant-api';
import { useSessionStore } from '@/store/session-store';
import { toast } from 'sonner';
interface Announcement{id:string;title:string;body:string;pinned:boolean;status:'Published'|'Archived';version:number;created_at:string}
export default function AnnouncementsPage(){const id=useSessionStore(state=>state.companyId);return <AnnouncementsContent key={id}/>;}
function AnnouncementsContent(){
 const[rows,setRows]=useState<Announcement[]>([]),[revision,setRevision]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true),[editor,setEditor]=useState<Announcement|null|undefined>(undefined);
 useEffect(()=>{let cancelled=false;tenantApi<Announcement[]>('announcements').then(data=>{if(!cancelled){setRows(data);setError('');}}).catch(error=>{if(!cancelled)setError(error instanceof Error?error.message:'Unable to load announcements.');}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[revision]);
 return <div><PageHeader title="Announcements" subtitle="Share company-wide updates and important notices with employees." actions={permitted('announcements.write')&&<Button className="gap-1.5" onClick={()=>setEditor(null)}><Plus className="h-4 w-4"/>New Announcement</Button>}/>{error&&<p role="alert" className="mb-4 text-destructive">{error}</p>}{loading&&<p>Loading announcements...</p>}{!loading&&!error&&!rows.length&&<SectionCard>No announcements have been published.</SectionCard>}<div className="space-y-4">{rows.map(row=><SectionCard key={row.id}><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><Megaphone className="mt-1 h-5 w-5 shrink-0 text-primary"/><div><h3 className="flex items-center gap-2 text-sm font-semibold">{row.title}{row.pinned&&<Pin className="h-4 w-4 text-warning"/>}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{row.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleDateString('en-IN')} ? All company members</p></div></div><div className="space-y-2"><StatusBadge status={row.status}/>{permitted('announcements.write')&&<Button variant="outline" size="sm" onClick={()=>setEditor(row)}>Edit</Button>}</div></div></SectionCard>)}</div>{editor!==undefined&&<AnnouncementEditor key={editor?.id??'new'} record={editor} onClose={()=>setEditor(undefined)} onSaved={()=>{setEditor(undefined);setRevision(value=>value+1);}}/>}</div>;
}
function AnnouncementEditor({record,onClose,onSaved}:{record:Announcement|null;onClose:()=>void;onSaved:()=>void}){
 const[title,setTitle]=useState(record?.title??''),[body,setBody]=useState(record?.body??''),[pinned,setPinned]=useState(record?.pinned??false),[status,setStatus]=useState(record?.status??'Published'),[busy,setBusy]=useState(false);
 async function save(){setBusy(true);try{await tenantApi('announcements',{method:'POST',body:JSON.stringify({title,body,pinned,status,...(record?{id:record.id,expectedVersion:record.version}:{})})});toast.success('Announcement saved');onSaved();}catch(error){toast.error(error instanceof Error?error.message:'Save failed.');}finally{setBusy(false);}}
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent><DialogTitle>{record?'Edit Announcement':'New Announcement'}</DialogTitle><form className="space-y-4" onSubmit={event=>{event.preventDefault();void save();}}><div><Label htmlFor="announcement-title">Title</Label><Input id="announcement-title" value={title} maxLength={200} required onChange={event=>setTitle(event.target.value)}/></div><div><Label htmlFor="announcement-body">Message</Label><Textarea id="announcement-body" value={body} rows={6} maxLength={10000} required onChange={event=>setBody(event.target.value)}/></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={event=>setPinned(event.target.checked)}/>Pin announcement</label>{record&&<select className="h-9 rounded-md border px-3" value={status} onChange={event=>setStatus(event.target.value as Announcement['status'])}><option>Published</option><option>Archived</option></select>}<Button disabled={busy} type="submit">Save Announcement</Button></form></DialogContent></Dialog>;
}
