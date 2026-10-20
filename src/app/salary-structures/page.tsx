"use client";
import {DesignationSalaryPresets} from '@/components/salary/designation-salary-presets';
import {ClientTemplateFields} from '@/components/salary/client-template-fields';
import dynamic from 'next/dynamic';
import {useAppStore} from '@/store/app-store';
import {salaryStructureMonth,structureDisplayName} from '@/domain/salary-structure-month';
import { useSessionStore } from '@/store/session-store';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layers, CheckCircle2, FileEdit, Users, Plus, Pencil, Copy, MoreVertical, Eye, Save, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSalaryStructures } from "@/services/payroll.service";
import { getEmployees } from "@/services/employee.service";
import { getSalaryRevisions } from "@/services/salary.service";
import { BulkUploadSalaryDialog } from "@/components/salary/bulk-upload-salary-dialog";
import {monthKey}from '@/domain/dates';
import{StructureDialog}from '@/components/salary/structure-dialog';

import{createSalaryStructure}from '@/services/salary-structure.service';
import{permitted}from '@/lib/tenant-api';
import{useRouter}from 'next/navigation';
import type { Employee, SalaryRevision, SalaryStructure } from "@/types";
import { cn } from "@/lib/utils";
import { formatINR, pluralize } from "@/utils/format";
import { toast } from "sonner";

const ClientSalarySheet=dynamic(()=>import('@/components/payroll/client-salary-sheet').then(module=>module.ClientSalarySheet),{loading:()=> <p role="status">Loading client salary sheet...</p>});
export default function SalaryStructuresPage(){const id=useSessionStore(state=>state.companyId);return <SalaryStructuresPageTenantContent key={id}/>;}
function SalaryStructuresPageTenantContent() {
  const month=useAppStore(state=>state.month);
  const [clientSheet,setClientSheet]=useState(true);
  const [savedStructures, setStructures] = useState<SalaryStructure[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [revisions, setRevisions] = useState<SalaryRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const[dialogOpen,setDialogOpen]=useState(false),[editing,setEditing]=useState<SalaryStructure|null>(null);
  const router=useRouter();

  function refresh() {
    Promise.all([getSalaryStructures(), getEmployees(), getSalaryRevisions()]).then(([data, emp, rev]) => {
      setStructures(data);
      setEmployees(emp);
      setRevisions(rev);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
      setLoading(false);

    }).catch(error=>{setLoading(false);toast.error(error instanceof Error?error.message:'Unable to load salary structures.');});
  }

  useEffect(() => {
    refresh();
  }, []);

  const {structures,endDate,assignments:employeeSalaries}=useMemo(()=>salaryStructureMonth(savedStructures,employees,revisions,month),[savedStructures,employees,revisions,month]);
  const visibleRevisions=revisions.filter(row=>row.effectiveFrom<=endDate);
  const selected = structures.find((s) => s.id === selectedId) ?? null;
  const filtered = structures.filter((s) => (s.name+' '+structureDisplayName(s.name)).toLowerCase().includes(search.toLowerCase()));

  const employeesOnStructure = useMemo(() => {
    if (!selected) return [];
    return employees
      .filter((e) => employeeSalaries[e.id]?.structureId===selected.id)
      .map((e) => ({ employee: e, gross: employeeSalaries[e.id].gross }));
  }, [employees, selected,employeeSalaries]);

  const kpis = {
    total: structures.length,
    active: structures.filter((s) => s.status === "Active").length,
    draft: structures.filter((s) => s.status === "Draft").length,
    covered: structures.filter(s=>s.status==='Active').reduce((sum, s) => sum + s.employeeCount, 0),
  };

  return (
    <div>
      <StructureDialog open={dialogOpen}onOpenChange={setDialogOpen}structure={editing}onSaved={refresh}/>
      <PageHeader
        title="Salary Structures"
        subtitle={`Salary assignments for ${month}. Structures carry forward until an effective salary change.`}
        actions={
          <>
            {permitted('payroll.run')&&permitted('employees.sensitive')&&permitted('salary.read')&&<Button variant="outline" onClick={()=>setClientSheet(value=>!value)} aria-expanded={clientSheet}>{clientSheet?'Hide':'Show'} salary sheet - {month}</Button>}
            <Button variant="outline" className="gap-1.5" onClick={() => setBulkUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload Base Salaries
            </Button>
            <Button className="gap-1.5" disabled={!permitted('salary.write')} onClick={() => {setEditing(null);setDialogOpen(true);}}>
              <Plus className="h-4 w-4" /> Create Structure
            </Button>
          </>
        }
      />

      {permitted('salary.read')&&<DesignationSalaryPresets onChanged={refresh} onCustom={()=>{setEditing(null);setDialogOpen(true);}}/>}
      <div className="mb-5 rounded-lg bg-blue-50 px-4 py-3 text-xs text-primary ring-1 ring-inset ring-blue-200">
        Salary layout: Salary_Structure.xlsx for {month}. Set Basic, DA, HRA and Other Allowance under Employees &gt; Salary. Record Sunday Amount, OT, Incentive and recoveries in monthly salary adjustments. Review employer costs and invoice amounts in the salary sheet.

      </div>

      {clientSheet&&permitted('employees.sensitive')&&permitted('salary.read')&&<ClientSalarySheet key={month} month={monthKey(month)}/>}
      {loading ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Layers} tone="blue" label="Total Structures" value={String(kpis.total)} helperText="All time" />
          <StatCard icon={CheckCircle2} tone="green" label="Active Structures" value={String(kpis.active)} helperText={`${((kpis.active / kpis.total) * 100 || 0).toFixed(0)}% of total`} />
          <StatCard icon={FileEdit} tone="amber" label="Draft Structures" value={String(kpis.draft)} helperText={`${((kpis.draft / kpis.total) * 100 || 0).toFixed(0)}% of total`} />
          <StatCard icon={Users} tone="purple" label="Employees Covered" value={String(kpis.covered)} helperText={`Assigned in ${month}`} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <SectionCard title="Salary Structures" noPadding className="h-fit">
          <div className="border-b border-border p-3">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search structures..." />
          </div>
          <div className="divide-y divide-border">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/50",
                  selectedId === s.id && "bg-accent"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{structureDisplayName(s.name)}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {s.frequency} · Created on {new Date(s.createdOn).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={s.status} />
                  <span className="text-[11px] text-muted-foreground">{pluralize(s.employeeCount, "employee")}</span>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard noPadding>
          {!selected ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Select a structure to view details.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[16px] font-semibold text-foreground">{structureDisplayName(selected.name)}</h2>
                    <StatusBadge status={selected.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{pluralize(selected.employeeCount, "employee")} assigned · {selected.frequency}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push('/employees')}>
                    <Users className="h-3.5 w-3.5" /> Assign to Employees
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push('/payslips')}>
                    <Eye className="h-3.5 w-3.5" /> Preview Salary Slip
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More options" />}>
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {setEditing(selected);setDialogOpen(true);}}>
                        <Pencil className="h-4 w-4" /> Edit Structure
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {try{await createSalaryStructure({...selected,name:`${selected.name} copy`,status:'Draft'});toast.success('Structure duplicated');refresh();}catch(error){toast.error(error instanceof Error?error.message:'Unable to duplicate structure.');}}}>
                        <Copy className="h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-6 p-5">
                <ClientTemplateFields/>

                <div>
                  <h3 className="mb-2.5 text-sm font-semibold text-foreground">Employees on this Structure - {month}</h3>
                  {employeesOnStructure.length === 0 ? (
                    <p className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
                      No employees have an effective assignment to this structure in {month}.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2.5">Employee</th>
                            <th className="px-4 py-2.5">Designation</th>
                            <th className="px-4 py-2.5">Monthly Base Gross</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {employeesOnStructure.slice(0, 8).map(({ employee, gross }) => (
                            <tr key={employee.id} className="hover:bg-muted/30">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <EmployeeAvatar name={employee.fullName} size="sm" />
                                  <Link href={`/employees/${employee.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                                    {employee.fullName}
                                  </Link>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">{employee.designation}</td>
                              <td className="px-4 py-2.5 font-medium text-foreground">{formatINR(gross)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Base amounts shown are effective at month end or the employee&apos;s exit date. Calculate Salaries applies attendance and mid-month changes. Each employee&apos;s gross differs — the structure only defines which components apply, not fixed amounts.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border p-4">
                <Button variant="outline"onClick={refresh}>Refresh</Button>
                <Button className="gap-1.5" disabled={!permitted('salary.write')} onClick={() => {setEditing(selected);setDialogOpen(true);}}>
                  <Save className="h-4 w-4" /> Save Structure
                </Button>
              </div>
            </>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent Salary Revisions" subtitle={`History through ${month}; earlier effective dates carry forward until revised.`} className="mt-5" noPadding>
        {visibleRevisions.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-muted-foreground">No salary revisions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">Previous</th>
                  <th className="px-4 py-2.5">Revised</th>
                  <th className="px-4 py-2.5">Revision %</th>
                  <th className="px-4 py-2.5">Effective From</th>
                  <th className="px-4 py-2.5">Changed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRevisions.slice(0, 10).map((r) => {
                  const emp = employees.find((e) => e.id === r.employeeId);
                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <EmployeeAvatar name={emp?.fullName ?? "?"} size="sm" />
                          <span className="font-medium text-foreground">{emp?.fullName ?? r.employeeId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{formatINR(r.previousGross)}</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{formatINR(r.revisedGross)}</td>
                      <td className={cn("px-4 py-2.5", r.revisionPercent >= 0 ? "text-success" : "text-danger")}>
                        {r.revisionPercent >= 0 ? "+" : ""}
                        {r.revisionPercent}%
                      </td>
                      <td className="px-4 py-2.5">{r.effectiveFrom}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.changedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <BulkUploadSalaryDialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen} onImported={refresh} />
    </div>
  );
}
