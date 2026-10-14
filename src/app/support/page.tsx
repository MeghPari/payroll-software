"use client";

import { useEffect,useState } from "react";
import { tenantApi,permitted } from "@/lib/tenant-api";
import { useSessionStore } from "@/store/session-store";
import { StatusBadge } from "@/components/shared/status-badge";
import { Mail, Phone, MessageCircle, LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const faqs = [
  { q: "How do I run payroll for the current month?", a: "Go to Payroll Run, select the month, validate employee data, then follow the guided steps through calculation, review and approval." },
  { q: "How can I publish payslips to employees?", a: "From the Payslips page, use the Publish Payslips quick action to make payslips visible to employees in their authorized account." },
  { q: "How do I add a new salary structure?", a: "Navigate to Salary Structures and click Create Structure. Define earnings and deduction components, then save and assign it to employees." },
  { q: "Where can I download financial reports?", a: "Visit Financial Reports to generate and download Trial Balance, P&L, Balance Sheet and ledger-based reports." },
];

interface Ticket{id:string;subject:string;status:string;version:number;created_at:string;support_messages:{id:string;body:string;created_at:string;created_by:string}[]}
export default function SupportPage(){const id=useSessionStore(state=>state.companyId);return <SupportContent key={id}/>;}
function SupportContent() {
 const[rows,setRows]=useState<Ticket[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[subject,setSubject]=useState(''),[message,setMessage]=useState(''),[contact,setContact]=useState<{supportEmail?:string;supportPhone?:string}|null>(null);
 useEffect(()=>{let cancelled=false;Promise.all([tenantApi<Ticket[]>('support'),tenantApi<{profile?:{supportEmail?:string;supportPhone?:string}}>('company')]).then(([rows,company])=>{if(!cancelled){setRows(rows);setContact(company.profile??{});setError('');}}).catch(error=>{if(!cancelled)setError(error instanceof Error?error.message:'Unable to load tickets.');});return()=>{cancelled=true;};},[revision]);
 async function save(ticket?:Ticket,status?:string){const reply=ticket?window.prompt('Enter your reply or reason for this status change:'):message;if(!reply?.trim())return;setBusy(true);try{await tenantApi('support',{method:'POST',body:JSON.stringify(ticket?{id:ticket.id,expectedVersion:ticket.version,message:reply,...(status?{status}:{})}:{subject,message:reply})});toast.success('Ticket saved');if(!ticket){setSubject('');setMessage('');}setRevision(value=>value+1);}catch(error){toast.error(error instanceof Error?error.message:'Ticket could not be saved.');}finally{setBusy(false);}}

  return (
    <div>
      <PageHeader title="Support" subtitle="Internal company support tickets and payroll guidance." />{error&&<p role="alert" className="mb-4 text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <SectionCard title="Frequently Asked Questions">
          <Accordion>
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Contact Support">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="h-4 w-4 text-primary" /> {contact?.supportEmail||'Support contact not configured'}
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="h-4 w-4 text-primary" /> {contact?.supportPhone||'Phone support not configured'}
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <MessageCircle className="h-4 w-4 text-primary" /> Use the internal ticket form below</div>
            </div>
          </SectionCard>

          <SectionCard title="Raise a Ticket">
            <form
              className="space-y-3"
              onSubmit={event=>{event.preventDefault();void save();}}
            >
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" placeholder="Briefly describe the issue" required maxLength={200} value={subject} onChange={event=>setSubject(event.target.value)}/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" placeholder="Provide more details..." rows={4} required maxLength={10000} value={message} onChange={event=>setMessage(event.target.value)}/>
              </div>
              <Button type="submit" disabled={busy} className="w-full gap-1.5">
                <LifeBuoy className="h-4 w-4" /> Submit Ticket
              </Button>
            </form>
          </SectionCard>
        </div>
      </div>
      <SectionCard title="Support Tickets" className="mt-5">{!rows.length&&<p className="text-sm text-muted-foreground">No visible tickets yet.</p>}<div className="space-y-4">{rows.map(ticket=><div key={ticket.id} className="rounded-lg border p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-medium">{ticket.subject}</h3><StatusBadge status={ticket.status}/></div><p className="mt-1 text-xs text-muted-foreground">Ticket {ticket.id} ? {new Date(ticket.created_at).toLocaleDateString('en-IN')}</p><div className="mt-3 space-y-2">{[...ticket.support_messages].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)).map(reply=><p key={reply.id} className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{reply.body}<span className="mt-1 block text-xs text-muted-foreground">{new Date(reply.created_at).toLocaleString('en-IN')}</span></p>)}</div><div className="mt-3 flex flex-wrap gap-2">{ticket.status!=='Closed'&&<><Button variant="outline" size="sm" disabled={busy} onClick={()=>void save(ticket)}>Reply</Button><Button variant="outline" size="sm" disabled={busy} onClick={()=>void save(ticket,'Closed')}>Close</Button></>}{ticket.status==='Closed'&&<Button variant="outline" size="sm" disabled={busy} onClick={()=>void save(ticket,'Open')}>Reopen</Button>}{permitted('support.manage')&&ticket.status!=='Closed'&&<><Button variant="outline" size="sm" disabled={busy} onClick={()=>void save(ticket,'In Progress')}>In Progress</Button><Button variant="outline" size="sm" disabled={busy} onClick={()=>void save(ticket,'Resolved')}>Resolve</Button></>}</div></div>)}</div></SectionCard>
    </div>
  );
}
