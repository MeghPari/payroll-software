"use client";

import { PeriodsPanel } from '@/components/accounting/periods-panel';
import { useEffect, useMemo, useState } from "react";
import type { Column } from "@/components/shared/data-table";
import { Upload, FolderPlus, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { AccountTree } from "@/components/shared/account-tree";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { getChartOfAccounts } from "@/services/accounting.service";
import { formatINR } from "@/utils/format";
import type { AccountGroup, AccountType, Ledger } from "@/types";
import { toast } from 'sonner';
import { AccountDialog } from '@/components/accounting/account-dialog';
import { useSessionStore } from '@/store/session-store';
import { permitted } from '@/lib/tenant-api';

const typeTone: Record<AccountType, "info" | "danger" | "success" | "warning" | "purple"> = {
  Asset: "info",
  Liability: "danger",
  Income: "success",
  Expense: "warning",
  Equity: "purple",
};

function allDescendantIds(group: AccountGroup): string[] {
  const ids = [group.id];
  group.children?.forEach((c) => ids.push(...allDescendantIds(c)));
  return ids;
}

export default function ChartOfAccountsPage(){const id=useSessionStore(state=>state.companyId);return <ChartOfAccountsPageTenantContent key={id}/>;}
function ChartOfAccountsPageTenantContent() {
  const companyId=useSessionStore(s=>s.companyId);
  const[dialog,setDialog]=useState<'group'|'ledger'|'year'|null>(null),[refresh,setRefresh]=useState(0);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<AccountGroup | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getChartOfAccounts().then((data) => {
      setGroups(data.groups);
      setLedgers(data.ledgers);
      setLoading(false);
    }).catch(error=>{setGroups([]);setLedgers([]);setLoading(false);toast.error(error.message);});
  }, [companyId,refresh]);

  const filteredLedgers = useMemo(() => {
    let result = ledgers;
    if (selectedGroup) {
      const ids = new Set(allDescendantIds(selectedGroup));
      result = result.filter((l) => ids.has(l.groupId));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) => l.name.toLowerCase().includes(q) || l.code.includes(q));
    }
    return result;
  }, [ledgers, selectedGroup, search]);

  const columns: Column<Ledger>[] = [
    { accessorKey: "name", header: "Ledger Name", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
    { accessorKey: "code", header: "Code" },
    { accessorKey: "type", header: "Type", cell: ({ getValue }) => <StatusBadge status={getValue<AccountType>()} tone={typeTone[getValue<AccountType>()]} /> },
    { accessorKey: "balance", header: "Balance (₹)", cell: ({ getValue }) => formatINR(getValue<number>(), { showSymbol: false }) },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
  ];

  return (
    <div>
      <AccountDialog kind={dialog}onClose={()=>setDialog(null)}onSaved={()=>setRefresh(n=>n+1)}groups={groups}/>
      <PageHeader
        title="Chart of Accounts"
        subtitle="Manage your account groups and ledgers in a structured hierarchy."
        actions={
          <>
            <Button variant="outline" className="gap-1.5" disabled title="Chart import is awaiting integration">
              <Upload className="h-4 w-4" /> Import Chart
            </Button>
            <Button variant="outline" className="gap-1.5" disabled={!permitted("accounting.write")} onClick={()=>setDialog("group")}>
              <FolderPlus className="h-4 w-4" /> Add Group
            </Button>
            <Button variant="outline" disabled={!permitted("accounting.write")} onClick={()=>setDialog("year")}>Financial Year</Button>
            <Button className="gap-1.5" disabled={!permitted("accounting.write")} onClick={()=>setDialog("ledger")}>
              <Plus className="h-4 w-4" /> Add Ledger
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        <SectionCard title="Account Groups" noPadding>
          <div className="p-3">
            {loading ? (
              <div className="h-64 animate-pulse rounded-lg bg-muted" />
            ) : (
              <AccountTree groups={groups} selectedId={selectedGroup?.id ?? null} onSelect={setSelectedGroup} />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title={`Ledgers (${filteredLedgers.length})`}
          subtitle={selectedGroup ? `Filtered by ${selectedGroup.name}` : undefined}
          actions={<SearchInput value={search} onChange={setSearch} placeholder="Search ledgers..." className="w-56" />}
          noPadding
        >
          {selectedGroup && (
            <div className="flex items-center gap-2 border-b border-border px-5 py-2.5">
              <span className="text-xs text-muted-foreground">Filtering by:</span>
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">{selectedGroup.name}</span>
              <button className="text-xs text-primary hover:underline" onClick={() => setSelectedGroup(null)}>
                Clear
              </button>
            </div>
          )}
          <DataTable columns={columns} data={filteredLedgers} loading={loading} pageSize={10} />
        </SectionCard>
      </div>
      <PeriodsPanel key={companyId}/>
    </div>
  );
}
