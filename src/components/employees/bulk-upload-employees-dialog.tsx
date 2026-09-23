"use client";

import { BulkUploadDialog, type PreviewColumn } from "@/components/shared/bulk-upload-dialog";
import {
  bulkImportEmployees,
  EMPLOYEE_IMPORT_COLUMNS,
  validateEmployeeImport,
  type EmployeeImportRow,
} from "@/services/employee.service";
import type { ImportRowResult } from "@/types";
import { formatINR } from "@/utils/format";

const SAMPLE_ROWS: (string | number)[][] = [
  [
    "EMP0029",
    "Sample Employee",
    "Sample",
    "Employee",
    "1996-04-12",
    "Female",
    "sample.personal@gmail.com",
    "sample.employee@acme.com",
    "9876543210",
    "Parent — 9812345670",
    "2026-06-01",
    "Full-time",
    "Engineering",
    "Software Engineer",
    "Bengaluru",
    "Karnataka",
    "Siddharth Rao",
    "ABCDE1234F",
    "XXXX XXXX 1234",
    "100234500129",
    "",
    "HDFC Bank",
    "50000001234567",
    "HDFC0001234",
    "35000",
    "70000",
    "900000",
    "Yes",
    "Yes",
    "Yes",
    "Yes",
    "Active",
  ],
];

function parseRow(record: Record<string, string>): EmployeeImportRow {
  return {
    employeeId: record["Employee ID"] ?? "",
    firstName: record["First Name"] ?? "",
    lastName: record["Last Name"] ?? "",
    dateOfBirth: record["Date of Birth"] ?? "",
    gender: record["Gender"] ?? "",
    personalEmail: record["Personal Email"] ?? "",
    officialEmail: record["Official Email"] ?? "",
    mobile: record["Mobile Number"] ?? "",
    dateOfJoining: record["Date of Joining"] ?? "",
    employmentType: record["Employment Type"] ?? "",
    department: record["Department"] ?? "",
    designation: record["Designation"] ?? "",
    workLocation: record["Work Location"] ?? "",
    state: record["State"] ?? "",
    pan: record["PAN"] ?? "",
    aadhaar: record["Aadhaar Number"] ?? "",
    uan: record["UAN"] ?? "",
    ctc: record["CTC"] ?? "",
    status: record["Employee Status"] ?? "Active",
  };
}

const previewColumns: PreviewColumn<ImportRowResult<EmployeeImportRow>>[] = [
  { header: "Employee ID", cell: (r) => r.data.employeeId },
  { header: "Employee Name", cell: (r) => `${r.data.firstName} ${r.data.lastName}` },
  { header: "Email", cell: (r) => r.data.officialEmail },
  { header: "Mobile", cell: (r) => r.data.mobile },
  { header: "State", cell: (r) => r.data.state },
  { header: "PAN", cell: (r) => r.data.pan },
  { header: "UAN", cell: (r) => r.data.uan || "—" },
  { header: "Salary", cell: (r) => (r.data.ctc ? formatINR(Number(r.data.ctc) / 12, { compact: true }) : "—") },
];

interface BulkUploadEmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function BulkUploadEmployeesDialog({ open, onOpenChange, onImported }: BulkUploadEmployeesDialogProps) {
  return (
    <BulkUploadDialog<EmployeeImportRow>
      open={open}
      onOpenChange={onOpenChange}
      title="Bulk Upload Employees"
      description="Import multiple employee records at once using the standard template."
      templateFileName="employee_import_template.csv"
      templateColumns={EMPLOYEE_IMPORT_COLUMNS}
      sampleRows={SAMPLE_ROWS}
      parseRow={parseRow}
      validateRows={validateEmployeeImport}
      previewColumns={previewColumns}
      onImport={async (rows) => {
        const record = await bulkImportEmployees(rows);
        onImported();
        return record;
      }}
    />
  );
}
