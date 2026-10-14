"use client";
import { useState } from 'react';

import { Users, Wallet, FileSpreadsheet, Percent, ShieldCheck, FileClock, BadgeIndianRupee, UserMinus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ReportCard } from "@/components/shared/report-card";
import { toast } from "sonner";
import type { StatTone } from "@/components/shared/stat-card";
import { ReportPreview } from '@/components/shared/report-preview';
import { generateReport } from '@/services/report.service';
import { companyToday,monthLabel } from '@/domain/dates';
import { payrollMonths } from '@/store/app-store';
import { FilterSelect } from '@/components/shared/filter-select';
import { useSessionStore } from '@/store/session-store';
import type { ReportTable } from '@/domain/accounting-reports';

const reports: { icon: typeof Users; tone: StatTone; title: string; description: string }[] = [
  { icon: Users, tone: "blue", title: "Payroll Register", description: "Complete earnings and deductions register for all employees." },
  { icon: Wallet, tone: "green", title: "Salary Cost Summary", description: "Saved gross salary and employer contributions by employee." },
  { icon: BadgeIndianRupee, tone: "purple", title: "PF Contribution Summary", description: "Saved employee and employer contributions for review; not an ECR filing file." },
  { icon: ShieldCheck, tone: "cyan", title: "ESI Report", description: "Employee state insurance contribution summary." },
  { icon: Percent, tone: "amber", title: "TDS Report", description: "Tax deducted at source summary by employee." },
  { icon: FileSpreadsheet, tone: "purple", title: "Professional Tax Report", description: "State-wise professional tax deduction summary." },
  { icon: FileClock, tone: "red", title: "Full & Final Settlement", description: "F&F settlement details for exited employees." },
  { icon: UserMinus, tone: "slate", title: "Headcount & Attrition", description: "Monthly headcount movement and attrition trends." },
];

export default function PayrollReportsPage() {
  const companyId=useSessionStore(state=>state.companyId);
  return <PayrollReportsContent key={companyId}/>;
}
function PayrollReportsContent() {
  const [month,setMonth]=useState(()=>monthLabel(companyToday().slice(0,7))),[preview,setPreview]=useState<ReportTable|null>(null),[busy,setBusy]=useState(false);
  const keys=['payroll-register','salary-cost','pf-summary','esi-summary','tds-summary','pt-summary',null,'headcount'];
  async function view(kind:string){setBusy(true);try{setPreview(await generateReport(kind,month));}catch(error){toast.error(error instanceof Error?error.message:'Unable to generate payroll report.');}finally{setBusy(false);}}
  return (
    <div>
      <PageHeader title="Payroll Reports" subtitle="Review reports from saved payroll snapshots. Statutory filing requires separate validation." actions={<FilterSelect value={month} onChange={setMonth} options={payrollMonths} className="w-44 bg-white"/>}/>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {reports.map((r,index) => (
          <ReportCard
            key={r.title}
            icon={r.icon}
            tone={r.tone}
            title={r.title}
            description={r.description}
            disabled={busy||!keys[index]}
            onView={() => view(keys[index]!)}
          />
        ))}
      </div>
      <ReportPreview report={preview} onClose={()=>setPreview(null)}/>
    </div>
  );
}
