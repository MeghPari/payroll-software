"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, CalendarClock, FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { AlertCard } from "@/components/shared/alert-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getPayroll } from "@/services/payroll.service";
import type { PayrollRun } from "@/types";

const complianceItems = [
  { id: "c1", name: "PF Return (ECR)", frequency: "Monthly", dueDate: "15 Jun 2026", status: "Pending" },
  { id: "c2", name: "ESI Return", frequency: "Monthly", dueDate: "15 Jun 2026", status: "Pending" },
  { id: "c3", name: "Professional Tax", frequency: "Monthly", dueDate: "20 Jun 2026", status: "Pending" },
  { id: "c4", name: "TDS Payment (24Q)", frequency: "Monthly", dueDate: "07 Jun 2026", status: "Completed" },
  { id: "c5", name: "GSTR-3B Filing", frequency: "Monthly", dueDate: "20 Jun 2026", status: "Pending" },
  { id: "c6", name: "Labour Welfare Fund", frequency: "Half-Yearly", dueDate: "15 Jul 2026", status: "Completed" },
];

export default function CompliancePage() {
  const [payroll, setPayroll] = useState<PayrollRun | null>(null);

  useEffect(() => {
    getPayroll().then(setPayroll);
  }, []);

  const critical = payroll?.alerts.filter((a) => a.severity === "critical") ?? [];
  const warnings = payroll?.alerts.filter((a) => a.severity === "warning") ?? [];
  const pendingCount = complianceItems.filter((c) => c.status === "Pending").length;

  return (
    <div>
      <PageHeader title="Compliance" subtitle="Statutory compliance checklist, filings and payroll alerts." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ShieldCheck} tone="green" label="Compliance Score" value="92%" helperText="Last updated today" />
        <StatCard icon={CalendarClock} tone="amber" label="Pending Filings" value={String(pendingCount)} />
        <StatCard icon={AlertTriangle} tone="red" label="Critical Alerts" value={String(critical.length)} />
        <StatCard icon={FileCheck2} tone="blue" label="Filed This Quarter" value="8" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AlertCard tone="critical" title="Critical Alerts" count={critical.length} items={critical.map((a) => a.message)} />
        <AlertCard tone="warning" title="Warnings" count={warnings.length} items={warnings.map((a) => a.message)} />
      </div>

      <SectionCard title="Statutory Compliance Checklist" subtitle="Monthly and periodic filing obligations" className="mt-5" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Compliance Item</th>
                <th className="px-4 py-2.5">Frequency</th>
                <th className="px-4 py-2.5">Due Date</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {complianceItems.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.frequency}</td>
                  <td className="px-4 py-3">{c.dueDate}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
