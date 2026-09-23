"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { attendanceStatuses } from "@/store/operations-store";
import { updateAttendance } from "@/services/attendance.service";
import type { AttendanceStatus, DailyAttendanceRecord, Employee } from "@/types";
import { toast } from "sonner";
import { History } from "lucide-react";

interface MarkEditAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  date: string;
  fixedEmployeeId?: string;
  existingRecord?: DailyAttendanceRecord;
  onDone: () => void;
}

export function MarkEditAttendanceDialog({ open, onOpenChange, employees, date, fixedEmployeeId, existingRecord, onDone }: MarkEditAttendanceDialogProps) {
  const [employeeId, setEmployeeId] = useState(fixedEmployeeId ?? existingRecord?.employeeId ?? employees[0]?.id ?? "");
  const [status, setStatus] = useState<AttendanceStatus>(existingRecord?.status ?? "Present");
  const [checkIn, setCheckIn] = useState(existingRecord?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(existingRecord?.checkOut ?? "");
  const [workHours, setWorkHours] = useState(String(existingRecord?.workHours ?? ""));
  const [leaveType, setLeaveType] = useState(existingRecord?.leaveType ?? "");
  const [overtime, setOvertime] = useState(String(existingRecord?.overtime ?? 0));
  const [remarks, setRemarks] = useState(existingRecord?.remarks ?? "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reseeds the form fields whenever the dialog opens for a (possibly different) record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmployeeId(fixedEmployeeId ?? existingRecord?.employeeId ?? employees[0]?.id ?? "");
    setStatus(existingRecord?.status ?? "Present");
    setCheckIn(existingRecord?.checkIn ?? "");
    setCheckOut(existingRecord?.checkOut ?? "");
    setWorkHours(String(existingRecord?.workHours ?? ""));
    setLeaveType(existingRecord?.leaveType ?? "");
    setOvertime(String(existingRecord?.overtime ?? 0));
    setRemarks(existingRecord?.remarks ?? "");
    setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingRecord, fixedEmployeeId]);

  const employee = employees.find((e) => e.id === employeeId);

  async function handleSave() {
    if (!employee || !reason.trim()) {
      toast.error("Reason for manual change is required.");
      return;
    }
    setSubmitting(true);
    try {
      const record: DailyAttendanceRecord = {
        id: existingRecord?.id ?? `${employee.id}-${date}`,
        employeeId: employee.id,
        date,
        shift: existingRecord?.shift ?? "09:30 – 18:30",
        checkIn,
        checkOut,
        workHours: Number(workHours) || 0,
        status,
        leaveType,
        overtime: Number(overtime) || 0,
        remarks,
        source: existingRecord?.source ?? "Manual",
      };
      await updateAttendance(record, reason);
      toast.success(`Attendance ${existingRecord ? "updated" : "marked"} for ${employee.fullName}`);
      onDone();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingRecord ? "Edit Attendance" : "Mark Attendance"}</DialogTitle>
          <DialogDescription>{date}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={(v) => v && setEmployeeId(v)} disabled={!!fixedEmployeeId || !!existingRecord}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.fullName} ({e.employeeCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Attendance Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as AttendanceStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {attendanceStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="checkIn">Check-In Time</Label>
              <Input id="checkIn" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkOut">Check-Out Time</Label>
              <Input id="checkOut" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="workHours">Working Hours</Label>
              <Input id="workHours" type="number" step="0.1" min={0} value={workHours} onChange={(e) => setWorkHours(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="overtime">Overtime (hrs)</Label>
              <Input id="overtime" type="number" step="0.1" min={0} value={overtime} onChange={(e) => setOvertime(e.target.value)} />
            </div>
          </div>

          {(status === "Paid Leave" || status === "Unpaid Leave") && (
            <div className="space-y-1.5">
              <Label htmlFor="leaveType">Leave Type</Label>
              <Input id="leaveType" value={leaveType} onChange={(e) => setLeaveType(e.target.value)} placeholder={status} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Label htmlFor="reason" className="text-warning">
              Reason for Manual Change <span className="text-danger">*</span>
            </Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Required for the audit trail" className="bg-white" />
          </div>

          {existingRecord?.modifiedBy && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              Last modified by {existingRecord.modifiedBy} on {existingRecord.modifiedOn}
            </div>
          )}
        </div>

        <DialogFooter className="!mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save Attendance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
