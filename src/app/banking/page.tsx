"use client";

import { ReconciliationPanel } from '@/components/accounting/reconciliation-panel';
import { useEffect, useState } from "react";
import { Landmark, Wallet, ArrowRightLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { ChartCard } from "@/components/shared/chart-card";
import { StatCard } from "@/components/shared/stat-card";
import { CashFlowLineChart } from "@/components/shared/charts/cash-flow-line-chart";
import { getBanking,type BankData } from "@/services/banking.service";
import { BankAccountDialog } from "@/components/accounting/bank-account-dialog";
import { useSessionStore } from "@/store/session-store";
import { tenantApi,permitted } from "@/lib/tenant-api";
import { companyToday } from "@/domain/dates";
import { sum } from "@/domain/money";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatINR } from "@/utils/format";

import { format } from "date-fns";

export default function BankingPage() {
  const companyId=useSessionStore(state=>state.companyId);
  return <BankingContent key={companyId}/>;
}
function BankingContent() {
  const [data,setData]=useState<BankData|null>(null),[error,setError]=useState(''),[dialog,setDialog]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{let cancelled=false;getBanking().then(data=>{if(!cancelled){setData(data);setError('');}}).catch(error=>{if(!cancelled)setError(error instanceof Error?error.message:'Unable to load banking records.');});return()=>{cancelled=true;};},[revision]);
  const ledgers=data?.accounts??[],cashFlow=data?.cashFlow??[];
  const vouchers=(data?.transactions??[]).map(transaction=>({id:transaction.id,narration:(ledgers.find(account=>account.id===transaction.bank_id)?.name??'')+' '+transaction.direction,voucherNumber:transaction.reference,date:transaction.date,amount:Number(transaction.amount_minor)/100,status:transaction.status}));
  const totalBalance=sum(ledgers.map(account=>account.balanceMinor))/100,bankBalance=sum(ledgers.filter(account=>account.kind==='Bank').map(account=>account.balanceMinor))/100,cashBalance=sum(ledgers.filter(account=>account.kind==='Cash').map(account=>account.balanceMinor))/100;
  async function correct(id:string){const reason=window.prompt('Reason for correcting this recorded payment. This reverses its book entry and does not move bank funds.');if(!reason?.trim())return;try{await tenantApi('banking',{method:'POST',body:JSON.stringify({action:'reverse',id,date:companyToday(),reason})});toast.success('Payment entry reversed in the books');setRevision(value=>value+1);}catch(error){toast.error(error instanceof Error?error.message:'Unable to correct entry.');}}
  return (
    <div>
      <PageHeader title="Banking & Cash" subtitle="Posted company book balances through today; recorded payments are backed by reviewed evidence." actions={<Button disabled={!permitted("accounting.write")} onClick={()=>setDialog(true)}>Configure Account</Button>}/>
      {error&&<p role="alert" className="mb-4 rounded-xl border p-4 text-sm text-danger">{error}</p>}
      {dialog&&<BankAccountDialog onClose={()=>setDialog(false)} onSaved={()=>setRevision(value=>value+1)}/>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Landmark} tone="blue" label="Total Balance" value={!data?"Loading?":ledgers.length?formatINR(totalBalance):"Not configured"} />
        <StatCard icon={Landmark} tone="green" label="Bank Balance" value={!data?"Loading?":ledgers.some(account=>account.kind==="Bank")?formatINR(bankBalance):"Not configured"} />
        <StatCard icon={Wallet} tone="amber" label="Cash Balance" value={!data?"Loading?":ledgers.some(account=>account.kind==="Cash")?formatINR(cashBalance):"Not configured"} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Accounts" className="lg:col-span-1" noPadding>
          <div className="divide-y divide-border">
            {ledgers.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.kind} {l.account_number}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatINR(l.balanceMinor/100)}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <ChartCard title="Bank & Cash Ledger Movements" subtitle="Last 6 months" className="lg:col-span-2">
          {cashFlow.length === 0 ? <p className="text-sm text-muted-foreground">{data?"Configure bank and cash ledgers to show their posted movements.":"Loading ledger movements?"}</p> : <CashFlowLineChart data={cashFlow} />}
        </ChartCard>
      </div>

      <SectionCard title="Recent Recorded Payments" subtitle="Latest 100 evidence records; correcting an entry does not execute a refund." className="mt-5" noPadding>
        <div className="divide-y divide-border">
          {vouchers.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                <ArrowRightLeft className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{v.narration}</p>
                <p className="text-xs text-muted-foreground">{v.voucherNumber} · {format(new Date(v.date), "dd MMM yyyy")}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">{formatINR(v.amount)} ? {v.status}</span>{v.status==="Confirmed"&&<Button size="sm" variant="outline" disabled={!permitted("accounting.write")} onClick={()=>correct(v.id)}>Correct Entry</Button>}
            </div>
          ))}
        </div>
      </SectionCard>
      {data&&<ReconciliationPanel accounts={data.accounts}/>}
    </div>
  );
}
