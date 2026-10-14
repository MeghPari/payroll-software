"use client";

import { useEffect, useState } from "react";
import type { Column } from "@/components/shared/data-table";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { getVouchers,getLedgers } from '@/services/accounting.service';
import { JournalDialog } from '@/components/accounting/journal-dialog';
import { useSessionStore } from '@/store/session-store';
import { tenantApi,permitted } from '@/lib/tenant-api';
import { companyToday } from '@/domain/dates';
import type { Ledger } from '@/types';
import { formatINR } from "@/utils/format";
import type { Voucher } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";

export default function JournalEntriesPage(){const id=useSessionStore(state=>state.companyId);return <JournalEntriesPageTenantContent key={id}/>;}
function JournalEntriesPageTenantContent() {
  const companyId=useSessionStore(s=>s.companyId);
  const[editing,setEditing]=useState<Voucher|undefined>(undefined),[viewing,setViewing]=useState<Voucher|null>(null);
  const[dialog,setDialog]=useState(false),[ledgers,setLedgers]=useState<Ledger[]>([]),[refresh,setRefresh]=useState(0);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");

  useEffect(() => {
    Promise.all([getVouchers(),getLedgers()]).then(([data,accounts]) => {
      setLedgers(accounts);
      setVouchers(data);
      setLoading(false);
    }).catch(error=>{setVouchers([]);setLoading(false);toast.error(error.message);});
  }, [companyId,refresh]);

  const filtered = vouchers.filter((v) => {
    if (type !== "All" && v.type !== type) return false;
    if (search && !v.voucherNumber.toLowerCase().includes(search.toLowerCase()) && !v.narration.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columns: Column<Voucher>[] = [
    { accessorKey: "voucherNumber", header: "Voucher #", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
    { accessorKey: "type", header: "Type", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} tone="info" /> },
    { accessorKey: "narration", header: "Narration" },
    { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => formatINR(getValue<number>()) },
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => format(new Date(getValue<string>()), "dd MMM yyyy") },
    {id:"status",header:"Status",accessorKey:"status"},
    {id:'action',header:'Action',cell:({row})=>{const voucher=row.original;return <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>setViewing(voucher)}>View</Button>{permitted('accounting.write')&&voucher.status==='Draft'&&<><Button size="sm" variant="outline" onClick={()=>{setEditing(voucher);setDialog(true);}}>Edit</Button><Button size="sm" variant="outline" onClick={async()=>{try{await tenantApi('journals',{method:'POST',body:JSON.stringify({action:'post',id:voucher.id,expectedVersion:voucher.version})});setRefresh(value=>value+1);}catch(error){toast.error(error instanceof Error?error.message:'Posting failed.');}}}>Post</Button><Button size="sm" variant="outline" onClick={async()=>{const reason=window.prompt('Reason for cancelling this draft:');if(!reason?.trim())return;try{await tenantApi('journals',{method:'PATCH',body:JSON.stringify({action:'cancel',id:voucher.id,expectedVersion:voucher.version,reason})});setRefresh(value=>value+1);}catch(error){toast.error(error instanceof Error?error.message:'Cancellation failed.');}}}>Cancel</Button></>}{permitted('accounting.write')&&voucher.status==='Posted'&&voucher.sourceType==='manual'&&!voucher.reversalOf&&!voucher.hasReversal&&<Button size="sm" variant="outline" onClick={async()=>{const reason=window.prompt('Reason for reversing this posted journal:');if(!reason?.trim())return;try{await tenantApi('journals',{method:'POST',body:JSON.stringify({action:'reverse',id:voucher.id,date:companyToday(),reason})});setRefresh(value=>value+1);}catch(error){toast.error(error instanceof Error?error.message:'Reversal failed.');}}}>Reverse</Button>}</div>;}},
  ];

  return (
    <div>
      <JournalDialog record={editing} open={dialog}onClose={()=>{setDialog(false);setEditing(undefined);}}onSaved={()=>setRefresh(n=>n+1)}ledgers={ledgers}/>
      <PageHeader
        title="Journal Entries"
        subtitle="Record and review journal, payment, receipt and contra vouchers."
        actions={
          <Button className="gap-1.5" disabled={!permitted("accounting.write")} onClick={()=>{setEditing(undefined);setDialog(true);}}>
            <Plus className="h-4 w-4" /> New Voucher
          </Button>
        }
      />
      {viewing&&<SectionCard title={'Voucher '+viewing.voucherNumber} className="mb-4" actions={<Button variant="outline" size="sm" onClick={()=>setViewing(null)}>Close</Button>}><p className="mb-3 text-sm">{viewing.date} ? {viewing.status} ? {viewing.narration}</p><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Ledger</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead><tbody>{viewing.lines?.map((line,index)=><tr key={index}><td className="p-2">{ledgers.find(ledger=>ledger.id===line.accountId)?.name??'Ledger'}</td><td className="p-2 text-right">{formatINR(line.debitMinor/100)}</td><td className="p-2 text-right">{formatINR(line.creditMinor/100)}</td></tr>)}</tbody></table></SectionCard>}
      <SectionCard noPadding>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search vouchers..." className="w-full sm:w-64" />
          <FilterSelect value={type} onChange={setType} options={["All", "Journal", "Payment", "Receipt", "Contra"]} placeholder="Type" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} pageSize={10} />
      </SectionCard>
    </div>
  );
}
