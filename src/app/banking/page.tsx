"use client";

import { useEffect, useState } from "react";
import { Landmark, Wallet, ArrowRightLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { ChartCard } from "@/components/shared/chart-card";
import { StatCard } from "@/components/shared/stat-card";
import { CashFlowLineChart } from "@/components/shared/charts/cash-flow-line-chart";
import { getLedgers, getVouchers, getCashFlowHistory } from "@/services/accounting.service";
import { formatINR } from "@/utils/format";
import type { Ledger, Voucher } from "@/types";
import { format } from "date-fns";

export default function BankingPage() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [cashFlow, setCashFlow] = useState<Awaited<ReturnType<typeof getCashFlowHistory>>>([]);

  useEffect(() => {
    getLedgers().then((data) => setLedgers(data.filter((l) => l.groupId === "cash-bank")));
    getVouchers().then(setVouchers);
    getCashFlowHistory().then(setCashFlow);
  }, []);

  const totalBalance = ledgers.reduce((sum, l) => sum + l.balance, 0);
  const bankBalance = ledgers.filter((l) => l.name !== "Cash in Hand").reduce((sum, l) => sum + l.balance, 0);
  const cashBalance = ledgers.find((l) => l.name === "Cash in Hand")?.balance ?? 0;

  return (
    <div>
      <PageHeader title="Banking & Cash" subtitle="Monitor cash and bank account balances and transactions." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Landmark} tone="blue" label="Total Balance" value={formatINR(totalBalance)} />
        <StatCard icon={Landmark} tone="green" label="Bank Balance" value={formatINR(bankBalance)} />
        <StatCard icon={Wallet} tone="amber" label="Cash Balance" value={formatINR(cashBalance)} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Accounts" className="lg:col-span-1" noPadding>
          <div className="divide-y divide-border">
            {ledgers.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{l.name}</p>
                  <p className="text-xs text-muted-foreground">A/c Code {l.code}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatINR(l.balance)}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <ChartCard title="Cash Flow" subtitle="Last 6 months" className="lg:col-span-2">
          {cashFlow.length === 0 ? <div className="h-full w-full animate-pulse rounded-lg bg-muted" /> : <CashFlowLineChart data={cashFlow} />}
        </ChartCard>
      </div>

      <SectionCard title="Recent Transactions" className="mt-5" noPadding>
        <div className="divide-y divide-border">
          {vouchers.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                <ArrowRightLeft className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{v.narration}</p>
                <p className="text-xs text-muted-foreground">{v.voucherNumber} · {format(new Date(v.date), "dd MMM yyyy")}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">{formatINR(v.amount)}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
