"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { payrollMonths } from "@/store/app-store";
import { holdSalary, releaseSalary } from "@/services/salary.service";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const HOLD_REASONS = ["Pending documents", "Attendance discrepancy", "Management instruction", "Exit settlement", "Bank details issue", "Other"];

interface SalaryHoldDialogProps {
  employeeId: string;
  employeeName: string;
  defaultMonth: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function SalaryHoldDialog({ employeeId, employeeName, defaultMonth, open, onOpenChange, onDone }: SalaryHoldDialogProps) {
  const [month, setMonth] = useState(defaultMonth);
  const [reason, setReason] = useState(HOLD_REASONS[0]);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await holdSalary(employeeId, month, reason, remarks);
      toast.success(`Salary put on hold for ${employeeName}`, { description: `${month} · ${reason}` });
      onDone();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hold Salary</DialogTitle>
          <DialogDescription>{employeeName}&apos;s salary will be excluded from disbursement totals until released.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-warning ring-1 ring-inset ring-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The employee will remain visible in payroll with status &quot;On Hold&quot;, but will not be included in this run&apos;s net payable total.
          </div>
          <div className="space-y-1.5">
            <Label>Salary Month</Label>
            <Select value={month} onValueChange={(v) => v && setMonth(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {payrollMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => v && setReason(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOLD_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hold-remarks">Remarks</Label>
            <Textarea id="hold-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="!mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting} className="bg-danger text-white hover:bg-danger/90">
            {submitting ? "Holding..." : "Confirm Salary Hold"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReleaseSalaryDialogProps {
  employeeId: string;
  employeeName: string;
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function ReleaseSalaryDialog({ employeeId, employeeName, month, open, onOpenChange, onDone }: ReleaseSalaryDialogProps) {
  const [releaseMonth, setReleaseMonth] = useState(month);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await releaseSalary(employeeId, releaseMonth, remarks);
      toast.success(`Salary released for ${employeeName}`);
      onDone();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Release Salary</DialogTitle>
          <DialogDescription>{employeeName}&apos;s salary will be included in the next disbursement run.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Release Month</Label>
            <Select value={releaseMonth} onValueChange={(v) => v && setReleaseMonth(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {payrollMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="release-remarks">Remarks</Label>
            <Textarea id="release-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="!mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Releasing..." : "Release Salary"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
