"use client";
import Link from 'next/link';
import { PayrollNavigation } from '@/components/payroll/payroll-navigation';
import { useAppStore } from '@/store/app-store';
import { PaymentAttempts } from "@/components/payroll/payment-attempts";

import { useEffect, useState } from "react";
import type { Column } from "@/components/shared/data-table";
import { Send, CheckCircle2, Clock, XCircle, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { getDisbursement,downloadPaymentInstructions } from "@/services/disbursement.service";
import { getBanking,type BankData } from "@/services/banking.service";
import { SalaryPaymentDialog } from "@/components/payroll/payment-dialog";
import { useSessionStore } from "@/store/session-store";
import { tenantApi,permitted } from "@/lib/tenant-api";
import { monthKey } from "@/domain/dates";
import { payrollMonths } from "@/store/app-store";
import { FilterSelect } from "@/components/shared/filter-select";
import { sum } from "@/domain/money";
import type { DisbursementBatch } from "@/domain/disbursement";
import { formatINR } from "@/utils/format";

import { toast } from "sonner";

interface SalaryPosting {runs:{id:string;month:string;version:number;status:string;batch_number?:number}[];journals:{source_id:string;status:string}[]}
export default function DisbursementPage() {
  const companyId=useSessionStore(state=>state.companyId);
  return <DisbursementContent key={companyId}/>;
}
function DisbursementContent() {
  const month=useAppStore(s=>s.month),setMonth=useAppStore(s=>s.setMonth);
  return <DisbursementMonth key={month} month={month} setMonth={setMonth}/>;
}
function DisbursementMonth({month,setMonth}:{month:string;setMonth:(month:string)=>void}) {
  const [paymentBatches,setPaymentBatches]=useState<{id:string;runId:string;batchNumber:number;preparedAt:string}[]>([]),[selectedBatch,setSelectedBatch]=useState('');
  const [posting,setPosting]=useState<SalaryPosting|null>(null),[postOpen,setPostOpen]=useState(false),[postingBusy,setPostingBusy]=useState(false);
  const [batch,setBatch]=useState<DisbursementBatch|null>(null),[banking,setBanking]=useState<BankData|null>(null),[bankId,setBankId]=useState('');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[disburseOpen,setDisburseOpen]=useState(false),[disbursing,setDisbursing]=useState(false),[paying,setPaying]=useState<DisbursementBatch['items'][number]|null>(null);
  useEffect(()=>{let cancelled=false;(async()=>{const[banking,posting,batches]=await Promise.all([getBanking(),permitted('accounting.read')?tenantApi<SalaryPosting>('payroll-accounting'):Promise.resolve(null),tenantApi<{id:string;runId:string;batchNumber:number;preparedAt:string}[]>('disbursements?month='+monthKey(month)+'-01&list=true')]);const latest=posting?.runs.find(run=>run.month===monthKey(month)+'-01');const selected=selectedBatch||(latest&&!batches.some(b=>b.runId===latest.id)?'new':batches[0]?.id??'new');const batch=selected==='new'||selected.startsWith('run:')?null:await getDisbursement(month,selected);if(cancelled)return;setPaymentBatches(batches);setBatch(batch);setBanking(banking);setPosting(posting);setLoading(false);setError('');})().catch(error=>{if(!cancelled){setLoading(false);setError(error instanceof Error?error.message:'Unable to load payment records.');}});return()=>{cancelled=true;};},[month,revision,selectedBatch]);
  const selectedRun=selectedBatch.startsWith('run:')?posting?.runs.find(run=>run.id===selectedBatch.slice(4)):posting?.runs.find(run=>run.month===monthKey(month)+'-01');
  const payrollPosted=!!selectedRun&&!!posting?.journals.some(journal=>journal.source_id===selectedRun.id&&journal.status==='Posted');
  async function postPayroll(){if(!selectedRun)return;setPostingBusy(true);try{await tenantApi('payroll-accounting',{method:'POST',body:JSON.stringify({action:'post',runId:selectedRun.id,month:selectedRun.month,expectedVersion:selectedRun.version})});toast.success('Payroll entry posted. You can now prepare payment instructions.');setRevision(n=>n+1);setPostOpen(false);}catch(error){toast.error(error instanceof Error?error.message:'Unable to post payroll.');}finally{setPostingBusy(false);}}
  const disbursementStatus=(batch?.items??[]).map(item=>({...item,id:item.employeeId,employeeCode:item.employeeCode,employeeName:item.employeeName,department:item.bank.accountNumber,netPayable:Number(item.amountMinor)/100,paid:Number(item.paidMinor)/100,outstanding:(Number(item.amountMinor)-Number(item.paidMinor))/100,disbursementStatus:Number(item.paidMinor)===Number(item.amountMinor)?'Completed':Number(item.paidMinor)>0?'Partial':'Pending'}));
  const pending=disbursementStatus.filter(item=>item.disbursementStatus!=='Completed').length,totalAmount=sum((batch?.items??[]).map(item=>Number(item.amountMinor)))/100;
  async function handleDisburse(){setDisbursing(true);try{await tenantApi('disbursements',{method:'POST',body:JSON.stringify({action:'prepare',runId:selectedRun?.id,month:monthKey(month)+'-01',bankId})});toast.success('Payment instructions prepared; no bank transfer was initiated');setSelectedBatch('');setRevision(value=>value+1);setDisburseOpen(false);}catch(error){toast.error(error instanceof Error?error.message:'Unable to prepare payments.');}finally{setDisbursing(false);}}
  async function exportInstructions(){try{await downloadPaymentInstructions(month,undefined,batch?.id);}catch(error){toast.error(error instanceof Error?error.message:'Unable to export payment instructions.');}}
  async function cancelBatch(){if(!batch)return;const reason=window.prompt('Reason for cancelling these instructions. Confirmed book entries must be corrected first.');if(!reason?.trim())return;try{await tenantApi('disbursements',{method:'POST',body:JSON.stringify({action:'cancel',batchId:batch.id,reason})});setSelectedBatch('');setRevision(value=>value+1);toast.success('Payment instructions cancelled');}catch(error){toast.error(error instanceof Error?error.message:'Unable to cancel instructions.');}}
  const columns: Column<(typeof disbursementStatus)[number]>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => row.employeeName,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={row.original.employeeName} size="sm" />
          <span className="font-medium text-foreground">{row.original.employeeName}</span>
        </div>
      ),
    },
    { accessorKey: "employeeCode", header: "Employee ID" },
    { accessorKey: "department", header: "Account" },
    { accessorKey: "netPayable", header: "Amount", cell: ({ getValue }) => formatINR(getValue<number>()) },
    { accessorKey: "paid", header: "Recorded Paid", cell: ({ getValue }) => formatINR(getValue<number>()) },
    { accessorKey: "outstanding", header: "Outstanding", cell: ({ getValue }) => formatINR(getValue<number>()) },
    {id:"actions",header:"Actions",cell:({row})=><Button size="sm" variant="outline" disabled={row.original.outstanding<=0||!permitted("disbursements.write")} onClick={()=>setPaying(row.original)}>Record Payment</Button>},
    { accessorKey: "disbursementStatus", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
  ];

  return (
    <div>
      <PayrollNavigation/>
      <PageHeader
        title="Salary Payments"
        subtitle="Prepare reviewed instructions and record confirmed salary transfers with evidence."
        actions={
          <>
            <FilterSelect value={month} onChange={setMonth} options={payrollMonths} className="w-44 bg-white"/>
            <Button variant="outline" className="gap-1.5" disabled={!batch} onClick={exportInstructions}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button className="gap-1.5" onClick={() => setDisburseOpen(true)} disabled={loading||!!batch||!bankId||!payrollPosted||!permitted("disbursements.write")}>
              <Send className="h-4 w-4" /> Prepare Instructions
            </Button>
          </>
        }
      />

      <div className="mb-4"><label className="mr-3 text-sm font-medium" htmlFor="payment-batch">Payment batch</label><select id="payment-batch" className="rounded-md border p-2" value={selectedBatch||batch?.id||'new'} onChange={event=>{setSelectedBatch(event.target.value);setLoading(true);}}><option value="new">Prepare latest payroll batch</option>{posting?.runs.filter(run=>run.month===monthKey(month)+'-01'&&!paymentBatches.some(b=>b.runId===run.id)).map(run=><option key={run.id} value={"run:"+run.id}>Prepare payroll batch {run.batch_number??1}</option>)}{paymentBatches.map(item=><option key={item.id} value={item.id}>Batch {item.batchNumber} - {new Date(item.preparedAt).toLocaleDateString('en-IN')}</option>)}</select><p className="mt-2 text-sm text-muted-foreground">Each payroll batch has separate payment instructions. Earlier payments and outstanding balances remain available here.</p></div>
      {!loading&&!error&&<section className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-semibold">{batch?'Track confirmed salary payments':!selectedRun?'Approve and lock salaries first':!payrollPosted?'Prepare the payroll entry':'Choose your funding bank and prepare instructions'}</h2><p className="mt-2 text-sm text-muted-foreground">{batch?'Download the instructions, transfer salaries through your bank, then record each confirmed payment below.':!selectedRun?'Return to Calculate Salaries to calculate, review and lock this month.':!payrollPosted?'Create the balanced payroll entry before recording salary payments. Your accountant can configure the salary ledgers once.':'Select the company bank account below. The exported file contains reviewed salary instructions; preparing it does not transfer money.'}</p><div className="mt-3 flex flex-wrap gap-3">{!selectedRun?permitted('payroll.run')?<Link className="text-sm font-semibold text-primary" href="/payroll">Go to Calculate Salaries</Link>:<p className="text-sm">Ask your payroll administrator to lock this month.</p>:!payrollPosted?<><Button disabled={postingBusy||!permitted('accounting.write')} onClick={()=>setPostOpen(true)}>Post payroll entry</Button><Link className="self-center text-sm text-primary" href="/payroll-accounting">Configure salary ledgers</Link></>:batch?<Button variant="outline" onClick={exportInstructions}>Download bank instructions</Button>:null}</div></section>}
      <ConfirmDialog open={postOpen} onOpenChange={setPostOpen} title={'Post payroll entry for '+month+'?'} description="This records the locked payroll against your configured salary ledgers. It does not transfer money. Review the configured ledger mappings before posting." confirmLabel="Post payroll entry" loading={postingBusy} onConfirm={postPayroll}/>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Send} tone="blue" label="Prepared Salary" value={formatINR(totalAmount)} />
        <StatCard icon={CheckCircle2} tone="green" label="Recorded paid" value={formatINR(disbursementStatus.reduce((total,item)=>total+item.paid,0))} />
        <StatCard icon={Clock} tone="amber" label="Still to pay" value={formatINR(disbursementStatus.reduce((total,item)=>total+item.outstanding,0))} />
        <StatCard icon={XCircle} tone="red" label="Employees unpaid / partial" value={String(pending)} />
      </div>

      {error&&<p role="alert" className="mt-4 rounded-xl border p-4 text-sm text-danger">{error}</p>}
      <SectionCard title="Payment Instructions" className="mt-5"><div className="flex flex-wrap items-center gap-3"><select aria-label="Source company bank account" className="h-10 rounded-md border px-3" disabled={!!batch} value={batch?.bankId??bankId} onChange={event=>setBankId(event.target.value)}><option value="">Select company funding bank account</option>{banking?.accounts.filter(account=>account.kind==="Bank").map(account=><option key={account.id} value={account.id}>{account.name} {account.account_number}</option>)}</select>{batch&&<Button variant="outline" disabled={!permitted("disbursements.write")} onClick={cancelBatch}>Cancel Instructions</Button>}</div><p className="mt-2 text-xs text-muted-foreground">Verify employee bank details before preparation. Review the exported instructions against your bank format. Record Payment only after your bank confirms the transfer.</p></SectionCard>
      {paying&&batch&&<SalaryPaymentDialog key={paying.employeeId} batch={batch} item={paying} onClose={()=>setPaying(null)} onSaved={()=>setRevision(value=>value+1)}/>}
      <SectionCard title="Disbursement Status" className="mt-5" noPadding>
        <DataTable columns={columns} data={disbursementStatus} loading={loading} pageSize={10} />
      </SectionCard>

      {batch&&<PaymentAttempts key={batch.id+"/"+revision} batch={batch} month={month}/>}
      <ConfirmDialog
        open={disburseOpen}
        onOpenChange={setDisburseOpen}
        title="Prepare salary payment instructions?"
        description="This captures verified employee bank details and outstanding salary amounts. No bank transfer is initiated. Record payments only after reviewing actual bank evidence."
        confirmLabel="Prepare Instructions"
        loading={disbursing}
        onConfirm={handleDisburse}
      />
    </div>
  );
}
