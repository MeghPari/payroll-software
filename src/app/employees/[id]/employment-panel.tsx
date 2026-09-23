"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { getExitRecord, getStatusHistory } from "@/services/employee.service";
import type { Employee, ExitRecord, StatusChangeRecord } from "@/types";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

interface EmploymentPanelProps {
  employee: Employee;
  onChanged: () => void;
}

export function EmploymentPanel({ employee }: EmploymentPanelProps) {
  const [history, setHistory] = useState<StatusChangeRecord[]>([]);
  const [exit, setExit] = useState<ExitRecord | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStatusHistory(employee.id), getExitRecord(employee.id)]).then(([h, e]) => {
      setHistory(h);
      setExit(e);
      setLoading(false);
    });
  }, [employee.id]);

  return (
    <div className="space-y-4">
      <SectionCard title="Employment Details">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Department" value={employee.department} />
          <Field label="Designation" value={employee.designation} />
          <Field label="Employment Type" value={employee.employmentType} />
          <Field label="Employment Category" value={employee.category ?? "Permanent"} />
          <Field label="Work Location" value={employee.workLocation} />
          <Field label="State" value={employee.state} />
          <Field label="Reporting Manager" value={employee.reportingManager ?? "—"} />
          <div>
            <p className="text-xs text-muted-foreground">Current Status</p>
            <div className="mt-1">
              <StatusBadge status={employee.status} />
            </div>
          </div>
        </div>

        {employee.category === "Rent Candidate" && (
          <div className="mt-4 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-primary ring-1 ring-inset ring-blue-200">
            Statutory Applicability — PF: Not Applicable · ESI: Not Applicable (default for Rent Candidate category; overridable in KYC &amp; Statutory).
          </div>
        )}
      </SectionCard>

      {exit && (
        <SectionCard title="Exit Details">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Exit Type" value={exit.exitType} />
            <Field label="Last Working Date" value={exit.lastWorkingDate} />
            <Field label="Effective Date" value={exit.effectiveDate} />
            <div>
              <p className="text-xs text-muted-foreground">Full &amp; Final Settlement</p>
              <div className="mt-1">
                <StatusBadge status={exit.settlementStatus} tone={exit.settlementStatus === "Completed" ? "success" : exit.settlementStatus === "In Progress" ? "warning" : "neutral"} />
              </div>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <Field label="Reason" value={exit.reason || "—"} />
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Status Change History" subtitle="Every lifecycle status change is recorded for audit purposes." noPadding>
        {!loading && history.length === 0 ? (
          <EmptyState title="No status changes yet" description="This employee's status has not been changed since onboarding." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">From</th>
                  <th className="px-4 py-2.5">To</th>
                  <th className="px-4 py-2.5">Effective Date</th>
                  <th className="px-4 py-2.5">Reason</th>
                  <th className="px-4 py-2.5">Changed By</th>
                  <th className="px-4 py-2.5">Changed On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={h.previousStatus} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={h.newStatus} />
                    </td>
                    <td className="px-4 py-2.5">{h.effectiveDate}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{h.reason}</td>
                    <td className="px-4 py-2.5">{h.changedBy}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{h.changedOn}</td>
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
