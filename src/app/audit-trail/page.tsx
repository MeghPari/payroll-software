"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { EmptyState } from "@/components/shared/empty-state";
import { getAuditTrail } from "@/services/audit.service";
import type { AuditRecord } from "@/types";
import { History } from "lucide-react";

const ACTIONS = [
  "All",
  "Employee Created",
  "Employee Status Changed",
  "Salary Revised",
  "Salary Put on Hold",
  "Salary Released",
  "Attendance Modified",
  "Attendance Finalized",
  "Payroll Approved",
  "Payroll Locked",
  "Payroll Unlocked",
  "KYC Updated",
  "Statutory Configuration Updated",
  "Bulk Employee Import",
];

export default function AuditTrailPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditTrail().then((data) => {
      setRecords(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (action !== "All" && r.action !== action) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.action.toLowerCase().includes(q) && !(r.employeeName ?? "").toLowerCase().includes(q) && !r.remarks.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [records, search, action]);

  return (
    <div>
      <PageHeader title="Audit Trail" subtitle="A record of who changed what, and when, across employees, payroll and attendance." />

      <SectionCard noPadding>
        <div className="border-b border-border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by employee, action or remarks..." className="w-full sm:w-72" />
            <FilterSelect value={action} onChange={setAction} options={ACTIONS} placeholder="Action" />
          </div>
        </div>

        {!loading && filtered.length === 0 ? (
          <EmptyState
            icon={History}
            title="No audit records yet"
            description="Actions like status changes, salary revisions, attendance edits and payroll approvals will appear here as they happen."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Date &amp; Time</th>
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">Previous Value</th>
                  <th className="px-4 py-2.5">New Value</th>
                  <th className="px-4 py-2.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{r.date}</td>
                    <td className="px-4 py-2.5">{r.user}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.action}</td>
                    <td className="px-4 py-2.5">{r.employeeName ?? "—"}</td>
                    <td className="px-4 py-2.5 max-w-[160px] truncate text-muted-foreground">{r.previous || "—"}</td>
                    <td className="px-4 py-2.5 max-w-[160px] truncate">{r.next || "—"}</td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground">{r.remarks || "—"}</td>
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
