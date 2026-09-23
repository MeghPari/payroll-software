"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getSalaryStructures } from "@/services/payroll.service";
import { updateSalaryProfile } from "@/services/salary.service";
import { calculatePayrollPreview } from "@/services/payroll.service";
import { CURRENT_PAYROLL_MONTH } from "@/data/mock/attendance";
import { formatINR } from "@/utils/format";
import type { Employee, PayrollCalculation, SalaryProfile, SalaryStructure } from "@/types";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface SalaryPanelProps {
  employee: Employee;
  salary: SalaryProfile | undefined;
  onChanged: () => void;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

function ReadRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={emphasis ? "text-sm font-semibold text-foreground" : "text-sm font-medium text-foreground"}>{value}</span>
    </div>
  );
}

export function SalaryPanel({ employee, salary, onChanged }: SalaryPanelProps) {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [form, setForm] = useState<SalaryProfile | undefined>(salary);
  const [saving, setSaving] = useState(false);
  const [calc, setCalc] = useState<PayrollCalculation | undefined>(undefined);

  useEffect(() => {
    getSalaryStructures().then(setStructures);
  }, []);

  useEffect(() => {
    // Seeds the editable copy from the freshly (re)loaded profile — e.g. after
    // the initial async fetch resolves, or after a save round-trips through
    // the parent. Deliberate one-way sync, not a derived-state anti-pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(salary);
  }, [salary]);

  useEffect(() => {
    calculatePayrollPreview(employee.id, CURRENT_PAYROLL_MONTH).then(setCalc);
  }, [employee.id, salary]);

  if (!form) return <Skeleton className="h-64 w-full" />;

  const grossEarnings = form.basic + form.hra + form.special + form.conveyance + form.other + form.bonus + form.variable;

  function set<K extends keyof SalaryProfile>(key: K, value: SalaryProfile[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      await updateSalaryProfile(employee.id, form);
      toast.success("Salary profile updated", { description: "A new salary revision has been recorded if the gross amount changed." });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <SectionCard title="Salary Profile">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Effective From</Label>
              <Input type="date" value={form.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Salary Structure</Label>
              <Select value={form.structure} onValueChange={(v) => v && set("structure", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {structures.map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            The salary structure defines which components apply. The amounts below are specific to {employee.fullName} — other employees on the same
            structure can have entirely different figures.
          </p>
        </SectionCard>

        <SectionCard title="Earnings">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <NumberField label="Basic" value={form.basic} onChange={(v) => set("basic", v)} />
            <NumberField label="HRA" value={form.hra} onChange={(v) => set("hra", v)} />
            <NumberField label="Special Allowance" value={form.special} onChange={(v) => set("special", v)} />
            <NumberField label="Conveyance" value={form.conveyance} onChange={(v) => set("conveyance", v)} />
            <NumberField label="Other Allowance" value={form.other} onChange={(v) => set("other", v)} />
            <NumberField label="Bonus" value={form.bonus} onChange={(v) => set("bonus", v)} />
            <NumberField label="Variable Pay" value={form.variable} onChange={(v) => set("variable", v)} />
          </div>
        </SectionCard>

        <SectionCard title="Other Deductions" subtitle="Statutory deductions (PF, ESI, PT, TDS) are configured centrally in Settings.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <NumberField label="Loan Deduction" value={form.loan} onChange={(v) => set("loan", v)} />
            <NumberField label="Advance" value={form.advance} onChange={(v) => set("advance", v)} />
            <NumberField label="Other Deduction" value={form.otherDeduction} onChange={(v) => set("otherDeduction", v)} />
          </div>
        </SectionCard>

        <SectionCard title="Employer Contributions">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <NumberField label="Other Employer Contribution" value={form.employerOther} onChange={(v) => set("employerOther", v)} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Employer PF and ESI are computed automatically from Statutory Configuration.</p>
        </SectionCard>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Salary Profile"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <SectionCard title="Summary" subtitle={CURRENT_PAYROLL_MONTH}>
          <ReadRow label="Monthly Gross" value={formatINR(grossEarnings)} />
          <ReadRow label="Annual CTC" value={formatINR(grossEarnings * 12)} />
          {calc && (
            <>
              <div className="my-2 h-px bg-border" />
              <ReadRow label="Gross Earnings" value={formatINR(calc.grossEarnings)} />
              <ReadRow label="Total Employee Deductions" value={formatINR(calc.totalDeductions)} />
              <ReadRow label="Net Salary" value={formatINR(calc.netPayable)} emphasis />
              <div className="my-2 h-px bg-border" />
              <ReadRow label="Employer Contribution" value={formatINR(calc.employerPF + calc.employerESI + calc.employerOther)} />
              <ReadRow label="Monthly CTC" value={formatINR(calc.totalEmployerCost)} />
              <ReadRow label="Annual CTC" value={formatINR(calc.totalEmployerCost * 12)} emphasis />
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
