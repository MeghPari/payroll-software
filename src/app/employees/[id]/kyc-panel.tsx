"use client";

import { useState } from "react";
import Link from 'next/link';
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { IdentityEditor } from '@/components/employees/identity-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateEmployeeKYC } from "@/services/kyc.service";
import type { Employee, EmployeeKYC, TaxRegime, VerificationStatus } from "@/types";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function VerifiableField({ label, value, status, onVerify }: { label: string; value: string; status: VerificationStatus; onVerify: () => void }) {
  return (
    <div className="flex items-end justify-between gap-2">
      <Field label={label} value={value || "—"} />
      <div className="flex flex-col items-end gap-1.5">
        <StatusBadge status={status} />
        {status !== "Verified" && value && (
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs text-primary" onClick={onVerify}>
            <CheckCircle2 className="h-3 w-3" /> Verify
          </Button>
        )}
      </div>
    </div>
  );
}

interface KYCPanelProps {
  employee: Employee;
  kyc: EmployeeKYC;
  onChanged: () => void;
}

export function KYCPanel({ employee, kyc, onChanged }: KYCPanelProps) {
  const [saving, setSaving] = useState<string | null>(null);

  async function patch(field: keyof EmployeeKYC, value: unknown, label: string) {
    setSaving(field);
    try {
      await updateEmployeeKYC(employee.id, { [field]: value, overridden: true } as Partial<EmployeeKYC>);
      toast.success(`${label} updated`);
      onChanged();
    } catch(error) {
      toast.error(error instanceof Error?error.message:'Unable to update KYC.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SectionCard title={kyc.kycComplete?'KYC complete':'Aadhaar card required to complete KYC'} className="lg:col-span-2"><p className="text-sm">Upload and verify the Aadhaar card in Documents. PAN, bank proof and other documents are optional for KYC completion.</p><Link href={'/employees/'+employee.id+'?tab=documents'} className="mt-2 inline-block text-primary underline">Upload / review Aadhaar card</Link></SectionCard>
      <IdentityEditor key={employee.id+'-'+employee.version} employee={employee} onSaved={onChanged}/>
      <SectionCard title="Identity Details">
        <div className="space-y-4">
          <VerifiableField label="PAN Number" value={employee.statutory.pan} status={kyc.panStatus} onVerify={() => patch("panStatus", "Verified", "PAN status")} />
          <Field label="Aadhaar Number" value={employee.statutory.aadhaar||'Not provided'} /><p className="text-xs">Aadhaar card: {kyc.aadhaarStatus}. Verification is completed through Documents.</p>
          <Field label="Date of Birth" value={employee.dateOfBirth} />
        </div>
      </SectionCard>

      <SectionCard title="Bank Details">
        <div className="space-y-4">
          <Field label="Account Holder Name" value={employee.bankDetails.accountHolderName} />
          <Field label="Bank Name" value={employee.bankDetails.bankName || "—"} />
          <Field label="Account Number" value={employee.bankDetails.accountNumber || "—"} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="IFSC" value={employee.bankDetails.ifscCode || "—"} />
            <Field label="Branch" value={employee.bankDetails.branch || "—"} />
          </div>
          <VerifiableField
            label="Bank Verification"
            value={employee.bankDetails.accountNumber ? "On file" : "Not provided"}
            status={kyc.bankStatus}
            onVerify={() => patch("bankStatus", "Verified", "Bank verification status")}
          />
        </div>
      </SectionCard>

      <SectionCard title="PF Details">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">PF Applicable</p>
            <Applicability value={kyc.pfApplicable} configured={kyc.applicabilityConfigured?.pfApplicable} disabled={!!saving} onChange={v=>patch('pfApplicable',v,'PF applicability')}/>
          </div>
          <Field label="UAN Number" value={employee.statutory.uan || "—"} />
          <Field label="PF Account Number" value={employee.statutory.pfNumber || "—"} />
        </div>
      </SectionCard>

      <SectionCard title="ESI Details">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">ESI Applicable</p>
            <Applicability value={kyc.esiApplicable} configured={kyc.applicabilityConfigured?.esiApplicable} disabled={!!saving} onChange={v=>patch('esiApplicable',v,'ESI applicability')}/>
          </div>
          <Field label="ESIC Number" value={employee.statutory.esicNumber || "—"} />
        </div>
      </SectionCard>

      <SectionCard title="Tax Information" className="lg:col-span-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Tax Regime</p>
            <Select value={kyc.taxRegimeConfigured?kyc.taxRegime:''} onValueChange={(v) => v && patch("taxRegime", v as TaxRegime, "Tax regime")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unconfigured" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Old Regime">Old Regime</SelectItem>
                <SelectItem value="New Regime">New Regime</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="PAN" value={employee.statutory.pan} />
          <div className="flex flex-col justify-between">
            <p className="text-xs text-muted-foreground">TDS Applicable</p>
            <Applicability value={kyc.tdsApplicable} configured={kyc.applicabilityConfigured?.tdsApplicable} disabled={!!saving} onChange={v=>patch('tdsApplicable',v,'TDS applicability')}/>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Declaration Status</p>
            <div className="mt-1.5">
              <StatusBadge status={kyc.declarationStatus} />
            </div>
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Professional Tax"><Applicability value={kyc.ptApplicable} configured={kyc.applicabilityConfigured?.ptApplicable} disabled={!!saving} onChange={v=>patch('ptApplicable',v,'PT applicability')}/></SectionCard>
    </div>
  );
}
function Applicability({value,configured,disabled,onChange}:{value:boolean;configured?:boolean;disabled:boolean;onChange:(value:boolean)=>void}){
 return <Select value={configured?String(value):''} disabled={disabled} onValueChange={value=>value&&onChange(value==='true')}><SelectTrigger aria-label="Statutory applicability"><SelectValue placeholder="Unconfigured"/></SelectTrigger><SelectContent><SelectItem value="true">Applicable</SelectItem><SelectItem value="false">Not applicable</SelectItem></SelectContent></Select>;
}
