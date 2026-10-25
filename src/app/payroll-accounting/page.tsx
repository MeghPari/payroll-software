"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Wallet, Landmark } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getJournals,type JournalRow } from '@/services/accounts.service';
import { getLedgers } from '@/services/accounting.service';
import { tenantApi,permitted } from '@/lib/tenant-api';
import { PayrollMappings } from '@/components/accounting/payroll-mappings';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/session-store';
import { toast } from 'sonner';
import { formatINR } from "@/utils/format";
import type { Ledger } from '@/types';

interface PostingData{mappings:{code:string;account_id:string}[];runs:{id:string;month:string;status:string;version:number;batch_number?:number}[];journals:{id:string;source_id:string;date:string;status:string}[]}

export default function PayrollAccountingPage(){const id=useSessionStore(state=>state.companyId);return <PayrollAccountingPageTenantContent key={id}/>;}
function PayrollAccountingPageTenantContent() {
  const companyId=useSessionStore(s=>s.companyId);
  const[data,setData]=useState<PostingData|null>(null),[ledgers,setLedgers]=useState<Ledger[]>([]),[journals,setJournals]=useState<JournalRow[]>([]),[month,setMonth]=useState(''),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false);
  useEffect(()=>{let cancelled=false;Promise.all([tenantApi<PostingData>('payroll-accounting'),getLedgers(),getJournals()]).then(([data,ledgers,journals])=>{if(cancelled)return;setData(data);setLedgers(ledgers);setJournals(journals);setMonth(previous=>data.runs.some(run=>run.id===previous)?previous:data.runs[0]?.id??'');}).catch(error=>{if(!cancelled){setData(null);setJournals([]);toast.error(error.message);}});return()=>{cancelled=true;};},[companyId,refresh]);
  const run=data?.runs.find(run=>run.id===month),posted=data?.journals.find(journal=>journal.source_id===run?.id),journal=journals.find(journal=>journal.id===posted?.id);
  const entries=journal?.journal_lines.map((line,index)=>({id:String(index),ledger:ledgers.find(ledger=>ledger.id===line.account_id)?.name??line.account_id,amount:(Number(line.debit_minor)||Number(line.credit_minor))/100,type:Number(line.debit_minor)>0?'Debit':'Credit'}))??[];
  const debits=entries.filter(entry=>entry.type==='Debit').reduce((sum,entry)=>sum+entry.amount,0),credits=entries.filter(entry=>entry.type==='Credit').reduce((sum,entry)=>sum+entry.amount,0);
  async function post(){if(!run)return;setBusy(true);try{await tenantApi('payroll-accounting',{method:'POST',body:JSON.stringify({action:'post',runId:run.id,month:run.month,expectedVersion:run.version})});toast.success('Payroll journal posted');setRefresh(n=>n+1);}catch(error){toast.error(error instanceof Error?error.message:'Posting failed.');}finally{setBusy(false);}}
  return (
    <div>
      <PageHeader title="Payroll Accounting Entries" subtitle="Post balanced payroll accruals to the configured ledgers." actions={<><select aria-label="Payroll month and batch" className="rounded-md border p-2" value={month} onChange={event=>setMonth(event.target.value)}>{data?.runs.map(run=><option key={run.id} value={run.id}>{run.month.slice(0,7)} - Batch {run.batch_number??1}</option>)}</select><Button disabled={busy||!run||!!posted||!permitted("accounting.write")}onClick={post}>Post payroll journal</Button></>} />

      {journal && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={FileSpreadsheet} tone="blue" label="Journal lines" value={String(entries.length)} helperText={run?.month??''} />
          <StatCard icon={Wallet} tone="green" label="Total debits" value={formatINR(debits)} />
          <StatCard icon={Landmark} tone="purple" label="Total credits" value={formatINR(credits)} />
        </div>
      )}

      <SectionCard title="Journal Entry — Payroll" subtitle={posted?`${run?.month} · Posted journal`:"No payroll journal posted for the selected month"} className="mt-5" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Ledger Account</th>
                <th className="px-4 py-2.5">Entry Type</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{e.ledger}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.type} tone={e.type === "Debit" ? "info" : "neutral"} />
                  </td>
                  <td className="px-4 py-3 text-right">{formatINR(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      {data&&<PayrollMappings key={companyId+"-"+refresh}initial={Object.fromEntries(data.mappings.map(mapping=>[mapping.code,mapping.account_id]))}ledgers={ledgers}onSaved={()=>setRefresh(n=>n+1)}/>}
    </div>
  );
}
