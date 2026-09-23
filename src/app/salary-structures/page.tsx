"use client";

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
import { useOperations, grossOf } from "@/store/operations-store";
import type { Employee, SalaryRevision, SalaryStructure } from "@/types";
import { cn } from "@/lib/utils";
import { formatINR, pluralize } from "@/utils/format";
import { toast } from "sonner";

function formatComponentValue(component: SalaryStructure["earnings"][number]) {
  if (component.calculationType === "Percentage of Basic" || component.calculationType === "Percentage of Gross") {
    return `${component.value}%`;
  }
  if (component.calculationType === "Fixed Amount") {
    return `₹ ${component.value?.toLocaleString("en-IN")}`;
  }
  return "-";
}

export default function SalaryStructuresPage() {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [revisions, setRevisions] = useState<SalaryRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  function refresh() {
    Promise.all([getSalaryStructures(), getEmployees(), getSalaryRevisions()]).then(([data, emp, rev]) => {
      setStructures(data);
      setEmployees(emp);
      setRevisions(rev);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const selected = structures.find((s) => s.id === selectedId) ?? null;
  const filtered = structures.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const employeesOnStructure = useMemo(() => {
    if (!selected) return [];
    const salaries = useOperations.getState().salaries;
    return employees
      .filter((e) => e.salaryStructureId === selected.id)
      .map((e) => ({ employee: e, gross: salaries[e.id] ? grossOf(salaries[e.id]) : Math.round(e.ctc / 12) }));
  }, [employees, selected]);

  const kpis = {
    total: structures.length,
    active: structures.filter((s) => s.status === "Active").length,
    draft: structures.filter((s) => s.status === "Draft").length,
    covered: structures.reduce((sum, s) => sum + s.employeeCount, 0),
  };

  return (
    <div>
      <PageHeader
        title="Salary Structures"
        subtitle="Create, manage and assign salary structures for your organization."
        actions={
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => setBulkUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Bulk Upload Salary
            </Button>
            <Button className="gap-1.5" onClick={() => toast.info("Create Structure — form coming soon")}>
              <Plus className="h-4 w-4" /> Create Structure
            </Button>
          </>
        }
      />

      <div className="mb-5 rounded-lg bg-blue-50 px-4 py-3 text-xs text-primary ring-1 ring-inset ring-blue-200">
        A salary structure defines which components apply (Basic, HRA, Special Allowance, PF, ESI, PT, TDS...). The actual amount for each component is
        employee-specific — two employees on the same structure can have entirely different gross salaries. Edit an individual employee&apos;s figures
        under Employees &gt; Salary.
      </div>

      {loading ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Layers} tone="blue" label="Total Structures" value={String(kpis.total)} helperText="All time" />
          <StatCard icon={CheckCircle2} tone="green" label="Active Structures" value={String(kpis.active)} helperText={`${((kpis.active / kpis.total) * 100 || 0).toFixed(0)}% of total`} />
          <StatCard icon={FileEdit} tone="amber" label="Draft Structures" value={String(kpis.draft)} helperText={`${((kpis.draft / kpis.total) * 100 || 0).toFixed(0)}% of total`} />
          <StatCard icon={Users} tone="purple" label="Employees Covered" value={String(kpis.covered)} helperText="Across active structures" />
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
                  <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
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
                    <h2 className="text-[16px] font-semibold text-foreground">{selected.name}</h2>
                    <StatusBadge status={selected.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{pluralize(selected.employeeCount, "employee")} assigned · {selected.frequency}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Assign to Employees — coming soon")}>
                    <Users className="h-3.5 w-3.5" /> Assign to Employees
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Preview Salary Slip — coming soon")}>
                    <Eye className="h-3.5 w-3.5" /> Preview Salary Slip
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More options" />}>
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toast.info("Edit structure — coming soon")}>
                        <Pencil className="h-4 w-4" /> Edit Structure
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info("Structure duplicated")}>
                        <Copy className="h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-6 p-5">
                <ComponentTable
                  title="Earnings"
                  components={selected.earnings}
                  onAdd={() => toast.info("Add Earning — coming soon")}
                  addLabel="Add Earning"
                />
                <ComponentTable
                  title="Deductions"
                  components={selected.deductions}
                  onAdd={() => toast.info("Add Deduction — coming soon")}
                  addLabel="Add Deduction"
                />

                <div>
                  <h3 className="mb-2.5 text-sm font-semibold text-foreground">Employees on this Structure</h3>
                  {employeesOnStructure.length === 0 ? (
                    <p className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
                      No employees are currently assigned to this structure.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2.5">Employee</th>
                            <th className="px-4 py-2.5">Designation</th>
                            <th className="px-4 py-2.5">Monthly Gross</th>
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
                    Notice each employee&apos;s gross differs — the structure only defines which components apply, not fixed amounts.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border p-4">
                <Button variant="outline">Cancel</Button>
                <Button className="gap-1.5" onClick={() => toast.success("Salary structure saved")}>
                  <Save className="h-4 w-4" /> Save Structure
                </Button>
              </div>
            </>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent Salary Revisions" subtitle="Every salary change is preserved with its effective date." className="mt-5" noPadding>
        {revisions.length === 0 ? (
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
                {revisions.slice(0, 10).map((r) => {
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

function ComponentTable({
  title,
  components,
  onAdd,
  addLabel,
}: {
  title: string;
  components: SalaryStructure["earnings"];
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div>
      <h3 className="mb-2.5 text-sm font-semibold text-foreground">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Component Name</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Calculation</th>
              <th className="px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {components.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium text-foreground">{c.name}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={c.type} tone={c.type === "Earning" ? "success" : "danger"} />
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.calculationType}</td>
                <td className="px-4 py-2.5">{formatComponentValue(c)}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" className="mt-2.5 gap-1.5" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
    </div>
  );
}
