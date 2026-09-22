"use client";

import { useEffect, useState } from "react";
import {
  Scale,
  TrendingUp,
  PieChartIcon,
  BookOpen,
  Wallet,
  Landmark,
  Percent,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { ReportCard } from "@/components/shared/report-card";
import { FilterSelect } from "@/components/shared/filter-select";
import { Button } from "@/components/ui/button";
import { getFinancialReports, getRecentReports, generateReport } from "@/services/report.service";
import type { FinancialReport, RecentReport, ReportIconKey } from "@/types";
import { payrollMonths } from "@/store/app-store";
import { toast } from "sonner";
import type { StatTone } from "@/components/shared/stat-card";

const iconMap: Record<ReportIconKey, { icon: typeof Scale; tone: StatTone }> = {
  "trial-balance": { icon: Scale, tone: "blue" },
  "profit-loss": { icon: TrendingUp, tone: "green" },
  "balance-sheet": { icon: PieChartIcon, tone: "purple" },
  "ledger-book": { icon: BookOpen, tone: "cyan" },
  "cash-book": { icon: Wallet, tone: "amber" },
  "bank-book": { icon: Landmark, tone: "blue" },
  "gst-report": { icon: Percent, tone: "red" },
  "payroll-accounting": { icon: FileSpreadsheet, tone: "purple" },
};

export default function FinancialReportsPage() {
  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [recent, setRecent] = useState<RecentReport[]>([]);
  const [dateRange, setDateRange] = useState(payrollMonths[payrollMonths.length - 1]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getFinancialReports(), getRecentReports()]).then(([r, rr]) => {
      setReports(r);
      setRecent(rr);
      setLoading(false);
    });
  }, []);

  async function handleView(report: FinancialReport) {
    toast.promise(generateReport(report.key), {
      loading: `Generating ${report.title}...`,
      success: `${report.title} is ready to view.`,
      error: "Something went wrong.",
    });
  }

  return (
    <div>
      <PageHeader
        title="Financial Reports"
        subtitle="Access key financial reports to analyze your company's performance."
        actions={
          <div className="flex items-center gap-2">
            <FilterSelect value={dateRange} onChange={setDateRange} options={payrollMonths} placeholder="Date Range" className="w-44 bg-white" />
            <FilterSelect value="All Books" onChange={() => {}} options={["All Books", "Company Books", "Payroll Books"]} className="w-40 bg-white" />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {reports.map((r) => {
                const { icon, tone } = iconMap[r.key];
                return <ReportCard key={r.id} icon={icon} tone={tone} title={r.title} description={r.description} onView={() => handleView(r)} />;
              })}
            </div>
          )}
        </div>

        <SectionCard title="Recent Reports" actions={<Button variant="ghost" size="sm" className="text-primary">View All</Button>} noPadding>
          <div className="divide-y divide-border">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 animate-pulse bg-muted/50" />)
              : recent.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.generatedOn}</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label={`Download ${r.title}`} onClick={() => toast.info(`Downloading ${r.title}...`)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
