"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Wallet,
  CheckCircle2,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Percent,
  Landmark,
  CalendarCheck2,
  AlertCircle,
  FileWarning,
  FileText,
  ReceiptText,
  FileCheck,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { ChartCard } from "@/components/shared/chart-card";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { PayrollBarChart } from "@/components/shared/charts/payroll-bar-chart";
import { CashFlowLineChart } from "@/components/shared/charts/cash-flow-line-chart";
import { DonutChart, DonutLegend } from "@/components/shared/charts/donut-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardOverview } from "@/services/dashboard.service";
import { formatINR } from "@/utils/format";
import Link from "next/link";

type Overview = Awaited<ReturnType<typeof getDashboardOverview>>;

const expenseColors = ["#1769E0", "#22A06B", "#D99823", "#7C5CFC", "#DC4C64", "#94A3B8"];

const pendingActionIcons: Record<string, typeof CalendarClock> = {
  "Leave Requests": CalendarClock,
  "Attendance Exceptions": AlertCircle,
  "Payslips Not Viewed": FileText,
  "Invoices Pending Approval": ReceiptText,
  "GST Returns Pending": FileCheck,
};

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    getDashboardOverview().then(setData);
  }, []);

  const { kpis, payrollSummary, accountsSummary, pendingActions, payrollCostHistory, cashFlowHistory, topExpenses } =
    data ?? ({} as Partial<Overview>);

  return (
    <div>
      <PageHeader title="Company Dashboard" subtitle="A snapshot of payroll, HR and financial health for this period." />

      {!data ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Users}
            tone="blue"
            label="Total Employees"
            value={String(kpis!.totalEmployees)}
            helperText={`${kpis!.newThisMonth} new this month`}
          />
          <StatCard icon={Wallet} tone="green" label="Net Salary Payable" value={formatINR(kpis!.netSalaryPayable)} />
          <StatCard
            icon={CheckCircle2}
            tone="purple"
            label="Payroll Status"
            value={kpis!.payrollStatus}
            helperText={kpis!.payrollPeriod}
          />
          <StatCard icon={CalendarCheck2} tone="amber" label="Pending Leaves" value={String(kpis!.pendingLeaves)} />
        </div>
      )}

      {!data ? (
        <div className="mt-4">
          <CardGridSkeleton count={4} />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={TrendingUp}
            tone="cyan"
            label="Revenue"
            value={formatINR(kpis!.revenue)}
            changeLabel="12.6%"
            changeDirection="up"
          />
          <StatCard
            icon={TrendingDown}
            tone="red"
            label="Expenses"
            value={formatINR(kpis!.expenses)}
            changeLabel="8.3%"
            changeDirection="down"
          />
          <StatCard icon={Percent} tone="amber" label="GST Payable" value={formatINR(kpis!.gstPayable)} helperText="Due on 20 May 2026" />
          <StatCard icon={Landmark} tone="blue" label="Bank Balance" value={formatINR(kpis!.bankBalance)} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Payroll Summary" subtitle={kpis?.payrollPeriod} className="lg:col-span-1">
          {!data ? (
            <SummarySkeleton rows={5} />
          ) : (
            <div className="space-y-3">
              <SummaryRow label="Gross Salary" value={formatINR(payrollSummary!.grossSalary)} />
              <SummaryRow label="Deductions" value={formatINR(payrollSummary!.deductions)} />
              <SummaryRow label="Net Salary Payable" value={formatINR(payrollSummary!.netSalaryPayable)} emphasis />
              <SummaryRow label="Disbursed to Date" value={formatINR(payrollSummary!.disbursedToDate)} />
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-muted-foreground">Disbursement Status</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-success ring-1 ring-inset ring-emerald-200">
                  {payrollSummary!.disbursementStatus}
                </span>
              </div>
              <Link href="/payroll-reports" className="inline-block pt-1 text-xs font-medium text-primary hover:underline">
                View Payroll Report →
              </Link>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Accounts Summary" subtitle="Month to date" className="lg:col-span-1">
          {!data ? (
            <SummarySkeleton rows={6} />
          ) : (
            <div className="space-y-3">
              <SummaryRow label="Revenue" value={formatINR(accountsSummary!.revenue)} />
              <SummaryRow label="Expenses" value={formatINR(accountsSummary!.expenses)} />
              <SummaryRow label="Profit Before Tax" value={formatINR(accountsSummary!.profitBeforeTax)} emphasis />
              <SummaryRow label="GST Payable" value={formatINR(accountsSummary!.gstPayable)} />
              <SummaryRow label="Outstanding Receivables" value={formatINR(accountsSummary!.outstandingReceivables)} />
              <SummaryRow label="Payables to Vendors" value={formatINR(accountsSummary!.payablesToVendors)} />
              <Link href="/accounting" className="inline-block pt-1 text-xs font-medium text-primary hover:underline">
                View Accounting Dashboard →
              </Link>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Pending Actions" className="lg:col-span-1">
          {!data ? (
            <SummarySkeleton rows={5} />
          ) : (
            <div className="space-y-1">
              {pendingActions!.map((action) => {
                const Icon = pendingActionIcons[action.label] ?? FileWarning;
                return (
                  <div key={action.id} className="flex items-center justify-between rounded-lg px-1.5 py-2 hover:bg-muted/50 transition-colors">
                    <span className="flex items-center gap-2.5 text-sm text-foreground">
                      <Icon className="h-4 w-4 text-muted-foreground" /> {action.label}
                    </span>
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-50 px-1.5 text-xs font-semibold text-danger">
                      {action.count}
                    </span>
                  </div>
                );
              })}
              <Link href="/compliance" className="inline-block pt-2 text-xs font-medium text-primary hover:underline">
                View All Pending Actions →
              </Link>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Monthly Payroll Cost (₹)" subtitle="Last 6 months" viewHref="/payroll-reports" className="lg:col-span-1">
          {!data ? <Skeleton className="h-full w-full" /> : <PayrollBarChart data={payrollCostHistory!} />}
        </ChartCard>
        <ChartCard title="Cash Flow (₹)" subtitle="Last 6 months" viewHref="/financial-reports" className="lg:col-span-1">
          {!data ? <Skeleton className="h-full w-full" /> : <CashFlowLineChart data={cashFlowHistory!} />}
        </ChartCard>
        <ChartCard
          title="Top Expenses"
          subtitle="Month to date"
          viewHref="/financial-reports"
          className="lg:col-span-1"
          legend={
            data && (
              <DonutLegend
                data={topExpenses!.map((e, i) => ({ name: e.category, value: e.amount, color: expenseColors[i % expenseColors.length] }))}
                formatValue={(v) => formatINR(v, { compact: true })}
              />
            )
          }
        >
          {!data ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <DonutChart
              data={topExpenses!.map((e, i) => ({ name: e.category, value: e.amount, color: expenseColors[i % expenseColors.length] }))}
              centerLabel="Total"
              centerValue={formatINR(topExpenses!.reduce((s, e) => s + e.amount, 0), { compact: true })}
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={emphasis ? "text-sm font-semibold text-primary" : "text-sm font-medium text-foreground"}>{value}</span>
    </div>
  );
}

function SummarySkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
