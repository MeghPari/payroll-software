"use client";

import { useEffect, useState } from "react";
import { Percent, FileCheck2, CalendarClock, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { ChartCard } from "@/components/shared/chart-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DonutChart, DonutLegend } from "@/components/shared/charts/donut-chart";
import { Button } from "@/components/ui/button";
import { getGstSummary } from "@/services/accounting.service";
import { formatINR } from "@/utils/format";
import type { GstSummary } from "@/types";

const returns = [
  { id: "r1", period: "April 2026", type: "GSTR-1", dueDate: "11 May 2026", status: "Completed" },
  { id: "r2", period: "April 2026", type: "GSTR-3B", dueDate: "20 May 2026", status: "Completed" },
  { id: "r3", period: "May 2026", type: "GSTR-1", dueDate: "11 Jun 2026", status: "Pending" },
  { id: "r4", period: "May 2026", type: "GSTR-3B", dueDate: "20 Jun 2026", status: "Pending" },
];

export default function GstPage() {
  const [summary, setSummary] = useState<GstSummary | null>(null);

  useEffect(() => {
    getGstSummary().then(setSummary);
  }, []);

  const total = summary ? summary.cgst + summary.sgst + summary.igst + summary.cess : 0;
  const donutData = summary
    ? [
        { name: "CGST", value: summary.cgst, color: "#1769E0" },
        { name: "SGST", value: summary.sgst, color: "#22A06B" },
        { name: "IGST", value: summary.igst, color: "#D99823" },
        { name: "Cess", value: summary.cess, color: "#7C5CFC" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div>
      <PageHeader title="GST" subtitle="Summary of GST liability, input credits and return filing status." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Percent} tone="amber" label="GST Payable" value={formatINR(total)} helperText="Due 20 May 2026" />
        <StatCard icon={FileCheck2} tone="green" label="Returns Filed" value="2 of 4" helperText="This quarter" />
        <StatCard icon={CalendarClock} tone="red" label="Next Due Date" value="20 Jun 2026" helperText="GSTR-3B for May 2026" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="GST Summary"
          subtitle="May 2026"
          className="lg:col-span-1"
          legend={summary && <DonutLegend data={donutData} formatValue={(v) => formatINR(v, { compact: true })} />}
        >
          {!summary ? <div className="h-full w-full animate-pulse rounded-lg bg-muted" /> : <DonutChart data={donutData} centerLabel="Total GST" centerValue={formatINR(total, { compact: true })} />}
        </ChartCard>

        <SectionCard
          title="Return Filing Status"
          className="lg:col-span-2"
          actions={
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" /> Export
            </Button>
          }
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Period</th>
                  <th className="px-4 py-2.5">Return Type</th>
                  <th className="px-4 py-2.5">Due Date</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">{r.period}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{r.type}</td>
                    <td className="px-4 py-3">{r.dueDate}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
