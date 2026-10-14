"use client";

import { useEffect, useState } from "react";
import type { Column } from "@/components/shared/data-table";
import { Plus, Truck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { getVendors } from "@/services/accounting.service";
import { formatINR } from "@/utils/format";
import type { Vendor } from "@/types";
import { PartyDialog } from "@/components/accounting/party-dialog";
import { useSessionStore } from "@/store/session-store";
import { permitted } from "@/lib/tenant-api";

export default function VendorsPage() {
  const companyId=useSessionStore(state=>state.companyId);
  return <VendorsContent key={companyId}/>;
}
function VendorsContent() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing,setEditing]=useState<string|null|undefined>(undefined),[revision,setRevision]=useState(0),[error,setError]=useState("");

  useEffect(() => {
    let cancelled=false;
    getVendors().then((data) => {
      if(cancelled)return;
      setVendors(data);
      setLoading(false);
    }).catch(error=>{if(!cancelled){setLoading(false);setError(error instanceof Error?error.message:"Unable to load records.");}});
    return()=>{cancelled=true;};
  }, [revision]);

  const filtered = vendors.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));
  const totalPayable = vendors.reduce((sum, v) => sum + v.outstandingBalance, 0);

  const columns: Column<Vendor>[] = [
    {id:"actions",header:"Actions",cell:({row})=><Button size="sm" variant="outline" disabled={!permitted("accounting.write")} onClick={()=>setEditing(row.original.id)}>Edit</Button>},
    { accessorKey: "name", header: "Vendor", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "gstin", header: "GSTIN" },
    {
      accessorKey: "outstandingBalance",
      header: "Payable Balance",
      cell: ({ getValue }) => <span className="font-medium text-foreground">{formatINR(getValue<number>())}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle="Manage vendor accounts and outstanding payables."
        actions={
          <Button className="gap-1.5" disabled={!permitted("accounting.write")} onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Add Vendor
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={Truck} tone="blue" label="Total Vendors" value={String(vendors.length)} />
        <StatCard icon={Truck} tone="amber" label="Total Payables" value={formatINR(totalPayable)} />
      </div>
      {error&&<p role="alert" className="mb-4 rounded-xl border p-4 text-sm text-danger">{error}</p>}
      <PartyDialog kind="Vendor" id={editing} onClose={()=>setEditing(undefined)} onSaved={()=>{setError("");setRevision(value=>value+1);}}/>
      <SectionCard noPadding>
        <div className="border-b border-border p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search vendors..." className="w-full sm:w-64" />
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} pageSize={10} />
      </SectionCard>
    </div>
  );
}
