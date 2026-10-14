"use client";
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
import { companyToday,monthKey,monthLabel } from "@/domain/dates";
import { payrollMonths } from "@/store/app-store";
import { FilterSelect } from "@/components/shared/filter-select";
import { sum } from "@/domain/money";
import type { DisbursementBatch } from "@/domain/disbursement";
import { formatINR } from "@/utils/format";

import { toast } from "sonner";

export default function DisbursementPage() {
  const companyId=useSessionStore(state=>state.companyId);
  return <DisbursementContent key={companyId}/>;
}
function DisbursementContent() {
  const [month,setMonth]=useState(()=>monthLabel(companyToday().slice(0,7)));
  return <DisbursementMonth key={month} month={month} setMonth={setMonth}/>;
}
function DisbursementMonth({month,setMonth}:{month:string;setMonth:(month:string)=>void}) {
  const [batch,setBatch]=useState<DisbursementBatch|null>(null),[banking,setBanking]=useState<BankData|null>(null),[bankId,setBankId]=useState('');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[disburseOpen,setDisburseOpen]=useState(false),[disbursing,setDisbursing]=useState(false),[paying,setPaying]=useState<DisbursementBatch['items'][number]|null>(null);
  useEffect(()=>{let cancelled=false;Promise.all([getDisbursement(month),getBanking()]).then(([batch,banking])=>{if(cancelled)return;setBatch(batch);setBanking(banking);setLoading(false);setError('');}).catch(error=>{if(!cancelled){setLoading(false);setError(error instanceof Error?error.message:'Unable to load payment records.');}});return()=>{cancelled=true;};},[month,revision]);
  const disbursementStatus=(batch?.items??[]).map(item=>({...item,id:item.employeeId,employeeCode:item.employeeCode,employeeName:item.employeeName,department:item.bank.accountNumber,netPayable:Number(item.amountMinor)/100,paid:Number(item.paidMinor)/100,outstanding:(Number(item.amountMinor)-Number(item.paidMinor))/100,disbursementStatus:Number(item.paidMinor)===Number(item.amountMinor)?'Completed':Number(item.paidMinor)>0?'Partial':'Pending'}));
  const completed=disbursementStatus.filter(item=>item.disbursementStatus==='Completed').length,pending=disbursementStatus.filter(item=>item.disbursementStatus!=='Completed').length,partial=disbursementStatus.filter(item=>item.disbursementStatus==='Partial').length,totalAmount=sum((batch?.items??[]).map(item=>Number(item.amountMinor)))/100;
  async function handleDisburse(){setDisbursing(true);try{await tenantApi('disbursements',{method:'POST',body:JSON.stringify({action:'prepare',month:monthKey(month)+'-01',bankId})});toast.success('Payment instructions prepared; no bank transfer was initiated');setRevision(value=>value+1);setDisburseOpen(false);}catch(error){toast.error(error instanceof Error?error.message:'Unable to prepare payments.');}finally{setDisbursing(false);}}
  async function exportInstructions(){try{await downloadPaymentInstructions(month);}catch(error){toast.error(error instanceof Error?error.message:'Unable to export payment instructions.');}}
  async function cancelBatch(){if(!batch)return;const reason=window.prompt('Reason for cancelling these instructions. Confirmed book entries must be corrected first.');if(!reason?.trim())return;try{await tenantApi('disbursements',{method:'POST',body:JSON.stringify({action:'cancel',batchId:batch.id,reason})});setRevision(value=>value+1);toast.success('Payment instructions cancelled');}catch(error){toast.error(error instanceof Error?error.message:'Unable to cancel instructions.');}}
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
      <PageHeader
        title="Disbursement"
        subtitle="Prepare reviewed instructions and record confirmed salary transfers with evidence."
        actions={
          <>
            <FilterSelect value={month} onChange={setMonth} options={payrollMonths} className="w-44 bg-white"/>
            <Button variant="outline" className="gap-1.5" disabled={!batch} onClick={exportInstructions}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button className="gap-1.5" onClick={() => setDisburseOpen(true)} disabled={!!batch||!bankId||!permitted("disbursements.write")}>
              <Send className="h-4 w-4" /> Prepare Instructions
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Send} tone="blue" label="Prepared Salary" value={formatINR(totalAmount)} />
        <StatCard icon={CheckCircle2} tone="green" label="Completed" value={String(completed)} />
        <StatCard icon={Clock} tone="amber" label="Pending" value={String(pending)} />
        <StatCard icon={XCircle} tone="red" label="Partial Payments" value={String(partial)} />
      </div>

      {error&&<p role="alert" className="mt-4 rounded-xl border p-4 text-sm text-danger">{error}</p>}
      <SectionCard title="Payment Instructions" className="mt-5"><div className="flex flex-wrap items-center gap-3"><select aria-label="Source company bank account" className="h-10 rounded-md border px-3" disabled={!!batch} value={batch?.bankId??bankId} onChange={event=>setBankId(event.target.value)}><option value="">Select company funding bank account</option>{banking?.accounts.filter(account=>account.kind==="Bank").map(account=><option key={account.id} value={account.id}>{account.name} {account.account_number}</option>)}</select>{batch&&<Button variant="outline" disabled={!permitted("disbursements.write")} onClick={cancelBatch}>Cancel Instructions</Button>}</div><p className="mt-2 text-xs text-muted-foreground">Post locked payroll in Payroll Accounting and verify employee bank details before preparation. Review the exported instructions against your bank?s required format. Exports do not confirm a transfer.</p></SectionCard>
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
