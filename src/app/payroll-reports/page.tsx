"use client";

import { Users, Wallet, FileSpreadsheet, Percent, ShieldCheck, FileClock, BadgeIndianRupee, UserMinus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ReportCard } from "@/components/shared/report-card";
import { toast } from "sonner";
import type { StatTone } from "@/components/shared/stat-card";

const reports: { icon: typeof Users; tone: StatTone; title: string; description: string }[] = [
  { icon: Users, tone: "blue", title: "Payroll Register", description: "Complete earnings and deductions register for all employees." },
  { icon: Wallet, tone: "green", title: "Salary Cost Summary", description: "Monthly salary cost trends across departments." },
  { icon: BadgeIndianRupee, tone: "purple", title: "PF Report (ECR)", description: "Provident fund contribution report for statutory filing." },
  { icon: ShieldCheck, tone: "cyan", title: "ESI Report", description: "Employee state insurance contribution summary." },
  { icon: Percent, tone: "amber", title: "TDS Report", description: "Tax deducted at source summary by employee." },
  { icon: FileSpreadsheet, tone: "purple", title: "Professional Tax Report", description: "State-wise professional tax deduction summary." },
  { icon: FileClock, tone: "red", title: "Full & Final Settlement", description: "F&F settlement details for exited employees." },
  { icon: UserMinus, tone: "slate", title: "Headcount & Attrition", description: "Monthly headcount movement and attrition trends." },
];

export default function PayrollReportsPage() {
  return (
    <div>
      <PageHeader title="Payroll Reports" subtitle="Statutory and management reports generated from payroll data." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {reports.map((r) => (
          <ReportCard
            key={r.title}
            icon={r.icon}
            tone={r.tone}
            title={r.title}
            description={r.description}
            onView={() => toast.promise(new Promise((res) => setTimeout(res, 900)), { loading: `Generating ${r.title}...`, success: `${r.title} is ready.`, error: "Failed to generate report." })}
          />
        ))}
      </div>
    </div>
  );
}
