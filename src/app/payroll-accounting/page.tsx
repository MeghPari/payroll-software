"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Wallet, Landmark } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getPayroll } from "@/services/payroll.service";
import { formatINR } from "@/utils/format";
import type { PayrollRun } from "@/types";

export default function PayrollAccountingPage() {
  const [payroll, setPayroll] = useState<PayrollRun | null>(null);

  useEffect(() => {
    getPayroll().then(setPayroll);
  }, []);

  const entries = payroll
    ? [
        { id: "je-1", ledger: "Salaries & Wages (Dr)", amount: payroll.grossPay, type: "Debit" },
        { id: "je-2", ledger: "PF Payable (Cr)", amount: payroll.rows.reduce((s, r) => s + r.pf, 0), type: "Credit" },
        { id: "je-3", ledger: "ESI Payable (Cr)", amount: payroll.rows.reduce((s, r) => s + r.esi, 0), type: "Credit" },
        { id: "je-4", ledger: "Professional Tax Payable (Cr)", amount: payroll.rows.reduce((s, r) => s + r.pt, 0), type: "Credit" },
        { id: "je-5", ledger: "TDS Payable (Cr)", amount: payroll.rows.reduce((s, r) => s + r.tds, 0), type: "Credit" },
        { id: "je-6", ledger: "Salary Payable (Cr)", amount: payroll.netPayable, type: "Credit" },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Payroll Accounting Entries" subtitle="Journal entries automatically generated from payroll processing." />

      {payroll && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={FileSpreadsheet} tone="blue" label="Payroll Journal Entries" value="6" helperText={payroll.month} />
          <StatCard icon={Wallet} tone="green" label="Total Payroll Cost" value={formatINR(payroll.grossPay)} />
          <StatCard icon={Landmark} tone="purple" label="Employer Contribution" value={formatINR(payroll.employerContribution)} />
        </div>
      )}

      <SectionCard title="Journal Entry — Payroll" subtitle={payroll ? `${payroll.month} · Auto-generated` : undefined} className="mt-5" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Ledger Account</th>
                <th className="px-4 py-2.5">Entry Type</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{e.ledger}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.type} tone={e.type === "Debit" ? "info" : "neutral"} />
                  </td>
                  <td className="px-4 py-3 text-right">{formatINR(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
