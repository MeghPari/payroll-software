"use client";

import { useEffect, useState } from "react";
import { Layers, CheckCircle2, FileEdit, Users, Plus, Pencil, Copy, MoreVertical, Eye, Save } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
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
import type { SalaryStructure } from "@/types";
import { cn } from "@/lib/utils";
import { pluralize } from "@/utils/format";
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    getSalaryStructures().then((data) => {
      setStructures(data);
      setSelectedId(data[0]?.id ?? null);
      setLoading(false);
    });
  }, []);

  const selected = structures.find((s) => s.id === selectedId) ?? null;
  const filtered = structures.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

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
          <Button className="gap-1.5" onClick={() => toast.info("Create Structure — form coming soon")}>
            <Plus className="h-4 w-4" /> Create Structure
          </Button>
        }
      />

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
