"use client";

import { BulkUploadDialog, type PreviewColumn } from "@/components/shared/bulk-upload-dialog";
import { SALARY_IMPORT_COLUMNS, bulkUpdateSalary, validateSalaryImport, type SalaryImportRow } from "@/services/salary.service";
import { formatINR } from "@/utils/format";
import type { ImportRowResult } from "@/types";

const SAMPLE_ROWS: (string | number)[][] = [
  ["EMP0001", "Arjun Mehta", "2026-06-01", "SVS Employee Structure", "55000", "22000", "10000", "0", "87000", "0", "Yes", "Yes", "200", "1740", "Annual increment"],
];

function parseRow(record: Record<string, string>): SalaryImportRow {
  return {
    employeeId: record["Employee ID"] ?? "",
    effectiveFrom: record["Effective From"] ?? "",
    structure: record["Salary Structure"] ?? "",
    basic: record["Basic"] ?? "",
    hra: record["HRA"] ?? "",
    special: record["Special Allowance"] ?? "",
    other: record["Other Allowance"] ?? "",
    grossSalary: record["Gross Salary"] ?? "",
    variable: record["Variable Pay"] ?? "",
    remarks: record["Remarks"] ?? "",
  };
}

const previewColumns: PreviewColumn<ImportRowResult<SalaryImportRow>>[] = [
  { header: "Employee ID", cell: (r) => r.data.employeeId },
  { header: "Employee", cell: (r) => r.data.employeeName ?? "—" },
  { header: "Old Gross", cell: (r) => formatINR(r.data.oldGross ?? 0, { compact: true }) },
  { header: "New Gross", cell: (r) => formatINR(r.data.newGross ?? 0, { compact: true }) },
  {
    header: "Difference",
    cell: (r) => {
      const diff = r.data.difference ?? 0;
      return (
        <span className={diff >= 0 ? "text-success" : "text-danger"}>
          {diff >= 0 ? "+" : ""}
          {formatINR(diff, { compact: true })}
        </span>
      );
    },
  },
  { header: "Effective Date", cell: (r) => r.data.effectiveFrom || "—" },
];

interface BulkUploadSalaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function BulkUploadSalaryDialog({ open, onOpenChange, onImported }: BulkUploadSalaryDialogProps) {
  return (
    <BulkUploadDialog<SalaryImportRow>
      open={open}
      onOpenChange={onOpenChange}
      title="Bulk Upload Salary"
      description="Update salary for multiple employees at once. Each employee keeps their own effective-dated revision history."
      templateFileName="salary_bulk_update_template.csv"
      templateColumns={SALARY_IMPORT_COLUMNS}
      sampleRows={SAMPLE_ROWS}
      parseRow={parseRow}
      validateRows={validateSalaryImport}
      previewColumns={previewColumns}
      onImport={async (rows) => {
        const record = await bulkUpdateSalary(rows);
        onImported();
        return record;
      }}
    />
  );
}
