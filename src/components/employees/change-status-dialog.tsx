"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { employmentStatuses } from "@/store/operations-store";
import { updateEmployeeStatus } from "@/services/employee.service";
import type { Employee, ExitType, SettlementStatus } from "@/types";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const exitTypes: ExitType[] = ["Resignation", "Termination", "Retirement", "Contract Completed", "Absconding", "Other"];
const settlementStatuses: SettlementStatus[] = ["Not Started", "In Progress", "Completed"];

const REASON_OPTIONS = [
  "Confirmed after probation",
  "Serving notice period",
  "Approved leave of absence",
  "Payroll / documentation hold",
  "Resignation accepted",
  "Termination",
  "Retirement",
  "Contract completed",
  "Other",
];

interface ChangeStatusDialogProps {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function ChangeStatusDialog({ employee, open, onOpenChange, onChanged }: ChangeStatusDialogProps) {
  const [status, setStatus] = useState(employee.status);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState(REASON_OPTIONS[0]);
  const [remarks, setRemarks] = useState("");
  const [lastWorkingDate, setLastWorkingDate] = useState(new Date().toISOString().slice(0, 10));
  const [exitType, setExitType] = useState<ExitType>("Resignation");
  const [settlement, setSettlement] = useState<SettlementStatus>("Not Started");
  const [submitting, setSubmitting] = useState(false);

  const isExit = status === "Exited";

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await updateEmployeeStatus(employee.id, {
        status,
        effectiveDate,
        reason,
        remarks,
        exit: isExit
          ? { employeeId: employee.id, effectiveDate, reason, remarks, lastWorkingDate, exitType, settlementStatus: settlement }
          : undefined,
      });
      toast.success(`${employee.fullName}'s status updated to ${status}`);
      onChanged();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Employee Status</DialogTitle>
          <DialogDescription>
            Current status: <span className="font-medium text-foreground">{employee.status}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as typeof status)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employmentStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="effectiveDate">Effective Date</Label>
            <Input id="effectiveDate" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => v && setReason(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Optional context for this change" />
          </div>

          {isExit && (
            <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
              <div className="flex items-start gap-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Marking this employee as Exited will exclude them from active payroll runs after their last working date. They remain visible under Employees &gt; Status &gt; Exited.
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lwd">Last Working Date</Label>
                <Input id="lwd" type="date" value={lastWorkingDate} onChange={(e) => setLastWorkingDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Exit Type</Label>
                <Select value={exitType} onValueChange={(v) => v && setExitType(v as ExitType)}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {exitTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Full &amp; Final Settlement Status</Label>
                <Select value={settlement} onValueChange={(v) => v && setSettlement(v as SettlementStatus)}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {settlementStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="!mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Save Status Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
