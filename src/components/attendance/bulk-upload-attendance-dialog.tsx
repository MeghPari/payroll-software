"use client";

import { useState } from "react";
import { BulkUploadDialog, type PreviewColumn } from "@/components/shared/bulk-upload-dialog";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/shared/filter-select";
import {
  ATTENDANCE_IMPORT_COLUMNS,
  uploadAttendance,
  validateAttendanceImport,
  type AttendanceImportRow,
} from "@/services/attendance.service";
import { payrollMonths } from "@/store/app-store";
import { monthKeyFromLabel } from "@/store/operations-store";
import type { ImportRowResult } from "@/types";

const SAMPLE_ROWS: (string | number)[][] = [
  ["EMP0001", "Arjun Mehta", "2026-05-12", "09:30 – 18:30", "09:34", "18:40", "8.9", "Present", "", "0", ""],
  ["EMP0004", "Neha Kapoor", "2026-05-12", "09:30 – 18:30", "", "", "0", "Paid Leave", "Paid Leave", "0", "Planned leave"],
];

function parseRow(record: Record<string, string>): AttendanceImportRow {
  return {
    employeeId: record["Employee ID"] ?? "",
    date: record["Date"] ?? "",
    shift: record["Shift"] ?? "",
    checkIn: record["Check-In"] ?? "",
    checkOut: record["Check-Out"] ?? "",
    workHours: record["Work Hours"] ?? "",
    status: record["Attendance Status"] ?? "",
    leaveType: record["Leave Type"] ?? "",
    overtime: record["Overtime"] ?? "",
    remarks: record["Remarks"] ?? "",
  };
}

const previewColumns: PreviewColumn<ImportRowResult<AttendanceImportRow>>[] = [
  { header: "Employee ID", cell: (r) => r.data.employeeId },
  { header: "Date", cell: (r) => r.data.date },
  { header: "Status", cell: (r) => r.data.status },
  { header: "Check-In", cell: (r) => r.data.checkIn || "—" },
  { header: "Check-Out", cell: (r) => r.data.checkOut || "—" },
];

interface BulkUploadAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function BulkUploadAttendanceDialog({ open, onOpenChange, onImported }: BulkUploadAttendanceDialogProps) {
  const [month, setMonth] = useState(payrollMonths[payrollMonths.length - 1]);

  return (
    <BulkUploadDialog<AttendanceImportRow>
      open={open}
      onOpenChange={onOpenChange}
      title="Upload Attendance"
      description="Import a full attendance sheet for the selected payroll month."
      templateFileName="attendance_import_template.csv"
      templateColumns={ATTENDANCE_IMPORT_COLUMNS}
      sampleRows={SAMPLE_ROWS}
      parseRow={parseRow}
      validateRows={validateAttendanceImport}
      previewColumns={previewColumns}
      onImport={async (rows) => {
        const record = await uploadAttendance(rows, monthKeyFromLabel(month));
        onImported();
        return record;
      }}
      extraField={
        <div className="space-y-1.5">
          <Label>Select Payroll Month</Label>
          <FilterSelect value={month} onChange={setMonth} options={payrollMonths} className="w-full bg-white" />
        </div>
      }
    />
  );
}
