"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStatutoryConfig, updateStatutoryConfig, updateStatePayrollConfig } from "@/services/statutory.service";
import type { LopRounding, ProrationMethod, StatutoryConfiguration, TDSMode } from "@/types";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

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

function DisclaimerNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-warning ring-1 ring-inset ring-amber-200">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default function SettingsPage() {
  const [config, setConfig] = useState<StatutoryConfiguration | null>(null);

  useEffect(() => {
    getStatutoryConfig().then(setConfig);
  }, []);

  function set<K extends keyof StatutoryConfiguration>(key: K, value: StatutoryConfiguration[K]) {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function saveConfig(section: string) {
    if (!config) return;
    await updateStatutoryConfig(config);
    toast.success(`${section} saved`);
  }

  async function saveStatePT(state: string, value: number) {
    await updateStatePayrollConfig(state, value);
    setConfig((prev) => (prev ? { ...prev, states: prev.states.map((s) => (s.state === state ? { ...s, professionalTax: value } : s)) } : prev));
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your company profile, payroll configuration and preferences." />

      <Tabs defaultValue="company">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Settings</TabsTrigger>
          <TabsTrigger value="statutory">Statutory Configuration</TabsTrigger>
          <TabsTrigger value="tax">Tax Configuration</TabsTrigger>
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

        {/* Payroll Settings > Salary Proration */}
        <TabsContent value="payroll" className="mt-4 space-y-4">
          <SectionCard title="Payroll Cycle">
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
          </SectionCard>

          <SectionCard title="Salary Proration" subtitle="Controls how attendance-based LOP deductions are calculated during payroll run.">
            {!config ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Salary Proration Method</Label>
                    <Select value={config.proration} onValueChange={(v) => v && set("proration", v as ProrationMethod)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["Calendar Days", "Working Days", "Fixed 30 Days", "Actual Days in Month", "Custom Payroll Days"] as ProrationMethod[]).map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {config.proration === "Custom Payroll Days" && (
                    <div className="space-y-1.5">
                      <Label>Custom Payroll Days</Label>
                      <Input type="number" min={1} max={31} value={config.customDays} onChange={(e) => set("customDays", Number(e.target.value) || 30)} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>LOP Rounding Method</Label>
                    <Select value={config.rounding} onValueChange={(v) => v && set("rounding", v as LopRounding)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["Exact", "Round", "Ceil"] as LopRounding[]).map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Half-Day Calculation Factor</Label>
                    <Input type="number" step="0.1" min={0} max={1} value={config.halfDayFactor} onChange={(e) => set("halfDayFactor", Number(e.target.value) || 0.5)} />
                  </div>
                </div>
                <Separator />
                <ToggleRow label="Treatment of Weekly Off" description="Pay employees for weekly off days" defaultChecked={config.weeklyOffPaid} />
                <ToggleRow label="Treatment of Paid Holiday" description="Pay employees for company holidays" defaultChecked={config.holidayPaid} />
                <ToggleRow label="Paid Leave Included" description="Count approved paid leave as payable days" defaultChecked={config.paidLeaveIncluded} />
                <div className="flex justify-end">
                  <Button onClick={() => saveConfig("Salary proration settings")}>Save Changes</Button>
                </div>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* Statutory Configuration */}
        <TabsContent value="statutory" className="mt-4 space-y-4">
          <DisclaimerNote>
            Final statutory calculation must be provided by the payroll backend/configuration based on applicable Indian laws, wage limits, employee
            category, state and tax rules. The values below drive the frontend demo calculation only.
          </DisclaimerNote>

          {!config ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <>
              <SectionCard title="Provident Fund (PF)">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Employee PF %</Label>
                    <Input type="number" step="0.01" value={config.employeePF} onChange={(e) => set("employeePF", Number(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Employer Contribution %</Label>
                    <Input type="number" step="0.01" value={config.employerPF} onChange={(e) => set("employerPF", Number(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>PF Wage Limit (₹)</Label>
                    <Input type="number" value={config.pfLimit} onChange={(e) => set("pfLimit", Number(e.target.value) || 0)} />
                  </div>
                </div>
                <Separator className="my-4" />
                <ToggleRow label="EPS Applicable" description="Employee Pension Scheme applies to employer PF contribution" defaultChecked={config.epsApplicable} />
                <ToggleRow label="Allow PF Override" description="Let HR/Payroll admins override PF applicability per employee" defaultChecked={config.allowPFOverride} />
              </SectionCard>

              <SectionCard title="Employee State Insurance (ESI)">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Employee ESI %</Label>
                    <Input type="number" step="0.01" value={config.employeeESI} onChange={(e) => set("employeeESI", Number(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Employer ESI %</Label>
                    <Input type="number" step="0.01" value={config.employerESI} onChange={(e) => set("employerESI", Number(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ESI Wage Limit (₹)</Label>
                    <Input type="number" value={config.esiLimit} onChange={(e) => set("esiLimit", Number(e.target.value) || 0)} />
                  </div>
                </div>
                <Separator className="my-4" />
                <ToggleRow label="Allow ESI Override" description="Let HR/Payroll admins override ESI applicability per employee" defaultChecked={config.allowESIOverride} />
              </SectionCard>

              <div className="flex justify-end">
                <Button onClick={() => saveConfig("Statutory configuration")}>Save PF / ESI Configuration</Button>
              </div>

              <SectionCard title="Professional Tax" subtitle="State-based flat monthly deduction, applied per employee's state.">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {config.states.map((s) => (
                    <div key={s.state} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                      <span className="text-sm text-foreground">{s.state}</span>
                      <Input
                        type="number"
                        className="w-24 text-right"
                        value={s.professionalTax}
                        onChange={(e) => saveStatePT(s.state, Number(e.target.value) || 0)}
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}
        </TabsContent>

        {/* Tax Configuration */}
        <TabsContent value="tax" className="mt-4 space-y-4">
          <DisclaimerNote>
            Employee salary income-tax withholding must ultimately be calculated by backend statutory rules based on applicable tax law, employee
            declarations and tax regime.
          </DisclaimerNote>
          {!config ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <SectionCard title="TDS Configuration">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>TDS Calculation Mode</Label>
                  <Select value={config.tdsMode} onValueChange={(v) => v && set("tdsMode", v as TDSMode)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["Automatic Tax Calculation", "Fixed Percentage", "Fixed Amount", "No TDS"] as TDSMode[]).map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(config.tdsMode === "Fixed Percentage" || config.tdsMode === "Fixed Amount") && (
                  <div className="space-y-1.5">
                    <Label>{config.tdsMode === "Fixed Percentage" ? "TDS Percentage" : "TDS Amount (₹)"}</Label>
                    <Input type="number" step="0.01" value={config.tdsValue} onChange={(e) => set("tdsValue", Number(e.target.value) || 0)} />
                  </div>
                )}
              </div>
              {config.tdsMode === "Automatic Tax Calculation" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Automatic mode is reserved for backend slab-based tax calculation. TDS will show as ₹0 in this frontend demo until that integration exists.
                </p>
              )}
              <div className="mt-4 flex justify-end">
                <Button onClick={() => saveConfig("Tax configuration")}>Save Tax Configuration</Button>
              </div>
            </SectionCard>
          )}
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
