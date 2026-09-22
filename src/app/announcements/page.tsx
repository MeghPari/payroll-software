"use client";

import { useState } from "react";
import { Plus, Megaphone, Pin } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const initialAnnouncements = [
  {
    id: "an-1",
    title: "May 2026 payroll has been processed",
    body: "Salaries for May 2026 have been disbursed to all active employees. Payslips are now available in the employee app.",
    author: "Payroll Team",
    date: "31 May 2026",
    pinned: true,
    audience: "All Employees",
  },
  {
    id: "an-2",
    title: "Updated leave policy effective June 2026",
    body: "The annual leave policy has been revised to include an additional 2 days of casual leave. Please review the updated policy document.",
    author: "HR Team",
    date: "28 May 2026",
    pinned: false,
    audience: "All Employees",
  },
  {
    id: "an-3",
    title: "New tax regime declaration window open",
    body: "Employees can now update their tax regime preference for FY 2026-27 through the employee portal until 15 June 2026.",
    author: "Finance Team",
    date: "20 May 2026",
    pinned: false,
    audience: "All Employees",
  },
];

export default function AnnouncementsPage() {
  const [announcements] = useState(initialAnnouncements);

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Share company-wide updates and important notices with employees."
        actions={
          <Button className="gap-1.5" onClick={() => toast.info("New Announcement — form coming soon")}>
            <Plus className="h-4 w-4" /> New Announcement
          </Button>
        }
      />
      <div className="space-y-4">
        {announcements.map((a) => (
          <SectionCard key={a.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                    {a.pinned && <Pin className="h-3.5 w-3.5 text-warning" />}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {a.author} · {a.date} · {a.audience}
                  </p>
                </div>
              </div>
              <StatusBadge status="Published" />
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
