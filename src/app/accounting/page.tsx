"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, LineChart, Wallet, Landmark, Percent, ArrowDownCircle, PiggyBank } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { ChartCard } from "@/components/shared/chart-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { DonutChart, DonutLegend } from "@/components/shared/charts/donut-chart";
import { CashFlowLineChart } from "@/components/shared/charts/cash-flow-line-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccountingDashboard } from "@/services/accounting.service";
import { getCashFlowHistory } from "@/services/accounting.service";
import { formatINR } from "@/utils/format";

type Overview = Awaited<ReturnType<typeof getAccountingDashboard>>;

export default function AccountingDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [cashFlow, setCashFlow] = useState<Awaited<ReturnType<typeof getCashFlowHistory>>>([]);

  useEffect(() => {
    getAccountingDashboard().then(setData);
    getCashFlowHistory().then(setCashFlow);
  }, []);

  const gstData = data
    ? [
        { name: "CGST", value: data.gstSummary.cgst, color: "#1769E0" },
        { name: "SGST", value: data.gstSummary.sgst, color: "#22A06B" },
        { name: "IGST", value: data.gstSummary.igst, color: "#D99823" },
        { name: "Cess", value: data.gstSummary.cess, color: "#7C5CFC" },
      ].filter((d) => d.value > 0)
    : [];

  const totalGst = data ? data.gstSummary.cgst + data.gstSummary.sgst + data.gstSummary.igst + data.gstSummary.cess : 0;

  return (
    <div>
      <PageHeader title="Accounting Dashboard" subtitle="Financial overview for revenue, expenses, and cash position." />

      {!data ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={TrendingUp} tone="cyan" label="Revenue (MTD)" value={formatINR(data.revenue)} changeLabel="12.6%" changeDirection="up" />
          <StatCard icon={TrendingDown} tone="red" label="Expenses (MTD)" value={formatINR(data.expenses)} changeLabel="8.3%" changeDirection="down" />
          <StatCard icon={LineChart} tone="green" label="Net Profit (MTD)" value={formatINR(data.netProfit)} changeLabel="18.9%" changeDirection="up" />
          <StatCard icon={Landmark} tone="blue" label="Bank Balance" value={formatINR(data.bankBalance)} />
        </div>
      )}

      {!data ? (
        <div className="mt-4">
          <CardGridSkeleton count={4} />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={ArrowDownCircle} tone="amber" label="Payables" value={formatINR(data.payables)} />
          <StatCard icon={Percent} tone="purple" label="GST Payable" value={formatINR(data.gstPayable)} helperText="Due on 20 May 2026" />
          <StatCard icon={Wallet} tone="blue" label="Receivables" value={formatINR(data.receivables)} />
          <StatCard icon={PiggyBank} tone="cyan" label="Cash Balance" value={formatINR(data.cashBalance)} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Recent Invoices" actions={<Link href="/sales-invoices" className="text-xs font-medium text-primary hover:underline">View All</Link>} className="lg:col-span-1" noPadding>
          <div className="divide-y divide-border">
            {!data
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))
              : data.recentInvoices.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{inv.invoiceNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">{inv.customer}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium text-foreground">{formatINR(inv.amount, { compact: true })}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                ))}
          </div>
          <div className="border-t border-border p-3">
            <Link href="/sales-invoices" className="text-xs font-medium text-primary hover:underline">Create Invoice →</Link>
          </div>
        </SectionCard>

        <SectionCard title="Recent Vouchers" actions={<Link href="/banking" className="text-xs font-medium text-primary hover:underline">View All</Link>} className="lg:col-span-1" noPadding>
          <div className="divide-y divide-border">
            {!data
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))
              : data.recentVouchers.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{v.voucherNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">{v.type} · {new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-foreground">{formatINR(v.amount, { compact: true })}</span>
                  </div>
                ))}
          </div>
          <div className="border-t border-border p-3">
            <Link href="/banking" className="text-xs font-medium text-primary hover:underline">Create Voucher →</Link>
          </div>
        </SectionCard>

        <ChartCard
          title="GST Summary"
          subtitle="May 2026"
          viewHref="/gst"
          className="lg:col-span-1"
          legend={data && <DonutLegend data={gstData} formatValue={(v) => formatINR(v, { compact: true })} />}
        >
          {!data ? <Skeleton className="h-full w-full" /> : <DonutChart data={gstData} centerLabel="Total GST" centerValue={formatINR(totalGst, { compact: true })} />}
        </ChartCard>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Cash / Bank Summary" subtitle="Last 6 months" viewHref="/banking" viewLabel="View Bank Reconciliation" className="lg:col-span-2">
          {cashFlow.length === 0 ? <Skeleton className="h-full w-full" /> : <CashFlowLineChart data={cashFlow} />}
        </ChartCard>

        <SectionCard title="Payroll Accounting (May 2026)" actions={<Link href="/payroll-accounting" className="text-xs font-medium text-primary hover:underline">View →</Link>}>
          {!data ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payroll Cost (MTD)</span>
                <span className="font-medium text-foreground">{formatINR(data.payrollAccounting.payrollCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Employer Contributions</span>
                <span className="font-medium text-foreground">{formatINR(data.payrollAccounting.employerContribution)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Payroll Cost</span>
                <span className="font-semibold text-primary">{formatINR(data.payrollAccounting.totalPayrollCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Salary Liabilities</span>
                <span className="font-medium text-foreground">{formatINR(data.payrollAccounting.salaryLiabilities)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Payable to Employees</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
