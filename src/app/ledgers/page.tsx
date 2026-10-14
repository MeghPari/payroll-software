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
import { getChartOfAccounts } from "@/services/accounting.service";
import { AccountDialog } from '@/components/accounting/account-dialog';
import { useSessionStore } from '@/store/session-store';
import { permitted } from '@/lib/tenant-api';
import { formatINR } from "@/utils/format";
import type { AccountType, AccountGroup, Ledger } from "@/types";
import { toast } from "sonner";

const typeTone: Record<AccountType, "info" | "danger" | "success" | "warning" | "purple"> = {
  Asset: "info",
  Liability: "danger",
  Income: "success",
  Expense: "warning",
  Equity: "purple",
};

export default function LedgersPage() {
  const companyId=useSessionStore(state=>state.companyId);
  return <LedgersContent key={companyId}/>;
}
function LedgersContent() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [groups,setGroups]=useState<AccountGroup[]>([]),[dialog,setDialog]=useState(false),[revision,setRevision]=useState(0);

  useEffect(() => {
    let cancelled=false;
    getChartOfAccounts().then((data) => {
      if(cancelled)return;
      setLedgers(data.ledgers);setGroups(data.groups);
      setLoading(false);
    }).catch(error=>{if(!cancelled){setLoading(false);toast.error(error instanceof Error?error.message:'Unable to load ledgers.');}});
    return()=>{cancelled=true;};
  }, [revision]);

  const filtered = ledgers.filter((l) => {
    if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.code.includes(search)) return false;
    if (type !== "All" && l.type !== type) return false;
    return true;
  });

  const columns: Column<Ledger>[] = [
    { accessorKey: "name", header: "Ledger Name", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
    { accessorKey: "code", header: "Code" },
    { accessorKey: "type", header: "Type", cell: ({ getValue }) => <StatusBadge status={getValue<AccountType>()} tone={typeTone[getValue<AccountType>()]} /> },
    { accessorKey: "balance", header: "Balance (₹)", cell: ({ getValue }) => formatINR(getValue<number>(), { showSymbol: false }) },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Ledgers"
        subtitle="View and manage all general ledger accounts."
        actions={
          <Button className="gap-1.5" disabled={!permitted('accounting.write')} onClick={() => setDialog(true)}>
            <Plus className="h-4 w-4" /> Add Ledger
          </Button>
        }
      />
      <SectionCard noPadding>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search ledgers..." className="w-full sm:w-64" />
          <FilterSelect value={type} onChange={setType} options={["All", "Asset", "Liability", "Income", "Expense", "Equity"]} placeholder="Type" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} pageSize={12} />
      </SectionCard>
      <AccountDialog kind={dialog?'ledger':null} groups={groups} onClose={()=>setDialog(false)} onSaved={()=>setRevision(value=>value+1)}/>
    </div>
  );
}
