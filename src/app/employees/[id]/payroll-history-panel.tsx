"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { getPayslips } from "@/services/payslip.service";
import { getSalaryRevisions, getSalaryHoldHistory } from "@/services/salary.service";
import { formatINR } from "@/utils/format";
import type { Employee, Payslip, SalaryHold, SalaryRevision } from "@/types";

export function PayrollHistoryPanel({ employee }: { employee: Employee }) {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [revisions, setRevisions] = useState<SalaryRevision[]>([]);
  const [holds, setHolds] = useState<SalaryHold[]>([]);

  useEffect(() => {
    getPayslips().then((all) => setPayslips(all.filter((p) => p.employeeId === employee.id)));
    getSalaryRevisions(employee.id).then(setRevisions);
    getSalaryHoldHistory(employee.id).then(setHolds);
  }, [employee.id]);

  return (
    <div className="space-y-4">
      <SectionCard title="Payslips" noPadding>
        {payslips.length === 0 ? (
          <EmptyState title="No payslips yet" description="Payslips will appear here once payroll has been processed." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Month</th>
                  <th className="px-4 py-2.5">Net Payable</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Published On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payslips.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{p.month}</td>
                    <td className="px-4 py-2.5">{formatINR(p.netPayable)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.publishedOn ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Salary Revision History" subtitle="Every salary change is preserved with its effective date." noPadding>
        {revisions.length === 0 ? (
          <EmptyState title="No salary revisions" description="This employee's salary has not been revised since assignment." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Previous</th>
                  <th className="px-4 py-2.5">Revised</th>
                  <th className="px-4 py-2.5">Revision %</th>
                  <th className="px-4 py-2.5">Effective From</th>
                  <th className="px-4 py-2.5">Changed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {revisions.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">{formatINR(r.previousGross)}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{formatINR(r.revisedGross)}</td>
                    <td className={`px-4 py-2.5 ${r.revisionPercent >= 0 ? "text-success" : "text-danger"}`}>
                      {r.revisionPercent >= 0 ? "+" : ""}
                      {r.revisionPercent}%
                    </td>
                    <td className="px-4 py-2.5">{r.effectiveFrom}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.changedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Salary Hold History" noPadding>
        {holds.length === 0 ? (
          <EmptyState title="No salary holds" description="This employee's salary has never been placed on hold." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Month</th>
                  <th className="px-4 py-2.5">Reason</th>
                  <th className="px-4 py-2.5">Held By</th>
                  <th className="px-4 py-2.5">Held On</th>
                  <th className="px-4 py-2.5">Released By</th>
                  <th className="px-4 py-2.5">Released On</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holds.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{h.month}</td>
                    <td className="px-4 py-2.5">{h.reason}</td>
                    <td className="px-4 py-2.5">{h.heldBy}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{h.heldOn}</td>
                    <td className="px-4 py-2.5">{h.releasedBy ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{h.releasedOn ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={h.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
