"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

function ToggleRow({ label, description, defaultChecked = true }: { label: string; description: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={setChecked} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your company profile, payroll configuration and preferences." />

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Config</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <SectionCard title="Company Profile">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Company Name</Label>
                <Input defaultValue="Acme Technologies Pvt. Ltd." />
              </div>
              <div className="space-y-1.5">
                <Label>GSTIN</Label>
                <Input defaultValue="29AACCA1234B1Z5" />
              </div>
              <div className="space-y-1.5">
                <Label>PAN</Label>
                <Input defaultValue="AACCA1234B" />
              </div>
              <div className="space-y-1.5">
                <Label>Registered Address</Label>
                <Input defaultValue="4th Floor, Prestige Tech Park, Bengaluru, Karnataka - 560103" />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => toast.success("Company profile updated")}>Save Changes</Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          <SectionCard title="Payroll Configuration">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Payroll Cycle</Label>
                <Input defaultValue="1st to end of month" />
              </div>
              <div className="space-y-1.5">
                <Label>Salary Disbursement Date</Label>
                <Input defaultValue="Last working day of the month" />
              </div>
            </div>
            <Separator className="my-4" />
            <ToggleRow label="Auto-calculate PF" description="Automatically calculate employee and employer PF contributions" />
            <ToggleRow label="Auto-calculate ESI" description="Apply ESI deductions for eligible employees" />
            <ToggleRow label="Enable overtime pay" description="Include overtime hours in salary calculations" defaultChecked={false} />
            <div className="mt-4 flex justify-end">
              <Button onClick={() => toast.success("Payroll configuration saved")}>Save Changes</Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <SectionCard title="Notification Preferences">
            <ToggleRow label="Payroll run reminders" description="Get notified before the payroll processing deadline" />
            <ToggleRow label="Leave request alerts" description="Receive alerts for new leave requests" />
            <ToggleRow label="Compliance due date reminders" description="Get reminded before statutory filing due dates" />
            <ToggleRow label="Weekly summary email" description="Receive a weekly digest of HR and payroll activity" defaultChecked={false} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <SectionCard title="Billing & Subscription">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Business Plan</p>
                <p className="text-xs text-muted-foreground">Up to 200 employees · Billed annually</p>
              </div>
              <Button variant="outline">Manage Plan</Button>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
