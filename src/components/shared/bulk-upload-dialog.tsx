"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { downloadCSV, formatFileSize, parseCSV, readFileAsText } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Download, UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, X } from "lucide-react";
import type { ImportRowResult, UploadRecord } from "@/types";

type Step = "template" | "upload" | "preview" | "summary";

const STEP_LABELS: Record<Step, string> = {
  template: "Download Template",
  upload: "Upload File",
  preview: "Validation Preview",
  summary: "Import Summary",
};
const STEP_ORDER: Step[] = ["template", "upload", "preview", "summary"];

export interface PreviewColumn<TRow> {
  header: string;
  cell: (row: TRow) => ReactNode;
}

interface BulkUploadDialogProps<TRow> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  templateFileName: string;
  templateColumns: readonly string[];
  sampleRows?: (string | number)[][];
  /** Maps one parsed CSV row (or one simulated demo row, for .xls/.xlsx) into the domain row shape. */
  parseRow: (record: Record<string, string>) => TRow;
  /** Runs validation (typically a service call) and returns per-row status. */
  validateRows: (rows: TRow[]) => Promise<ImportRowResult<TRow>[]>;
  previewColumns: PreviewColumn<ImportRowResult<TRow>>[];
  /** Commits the valid rows (typically a service call) and returns the resulting upload record. */
  onImport: (rows: TRow[]) => Promise<UploadRecord>;
  /** Optional extra control rendered above the dropzone, e.g. a payroll-month selector for attendance uploads. */
  extraField?: ReactNode;
}

export function BulkUploadDialog<TRow>({
  open,
  onOpenChange,
  title,
  description,
  templateFileName,
  templateColumns,
  sampleRows = [],
  parseRow,
  validateRows,
  previewColumns,
  onImport,
  extraField,
}: BulkUploadDialogProps<TRow>) {
  const [step, setStep] = useState<Step>("template");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<TRow[]>([]);
  const [results, setResults] = useState<ImportRowResult<TRow>[]>([]);
  const [importing, setImporting] = useState(false);
  const [uploadRecord, setUploadRecord] = useState<UploadRecord | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("template");
    setFile(null);
    setParsing(false);
    setRows([]);
    setResults([]);
    setImporting(false);
    setUploadRecord(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  const handleFile = useCallback(
    async (selected: File) => {
      setFile(selected);
      setParsing(true);
      try {
        const isCsv = /\.csv$/i.test(selected.name);
        let records: Record<string, string>[];
        if (isCsv) {
          const text = await readFileAsText(selected);
          records = parseCSV(text);
        } else {
          // .xls / .xlsx: browser-side binary parsing needs a spreadsheet library.
          // Simulated for this frontend demo using the same sample data as the template.
          await new Promise((r) => setTimeout(r, 600));
          records = sampleRows.map((row) => Object.fromEntries(templateColumns.map((col, i) => [col, String(row[i] ?? "")])));
        }
        const parsedRows = records.map(parseRow);
        setRows(parsedRows);
        setStep("preview");
        const validated = await validateRows(parsedRows);
        setResults(validated);
      } catch {
        toast.error("Could not read the file", { description: "Please check the file format and try again." });
      } finally {
        setParsing(false);
      }
    },
    [parseRow, sampleRows, templateColumns, validateRows]
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  }

  async function handleImport() {
    const validRows = results.filter((r) => r.status === "Valid" || r.status === "Warning").map((r) => r.data);
    setImporting(true);
    try {
      const record = await onImport(validRows);
      setUploadRecord(record);
      setStep("summary");
      toast.success("Import completed", { description: `${validRows.length} records imported successfully.` });
    } finally {
      setImporting(false);
    }
  }

  const valid = results.filter((r) => r.status === "Valid").length;
  const warnings = results.filter((r) => r.status === "Warning").length;
  const errors = results.filter((r) => r.status === "Error").length;
  const duplicates = results.filter((r) => r.status === "Duplicate").length;
  const readyToImport = valid + warnings;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 border-b border-border pb-4">
          {STEP_ORDER.map((s, i) => {
            const active = s === step;
            const done = STEP_ORDER.indexOf(step) > i;
            return (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                    active && "bg-primary text-white",
                    done && "bg-emerald-100 text-success",
                    !active && !done && "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={cn("text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>{STEP_LABELS[s]}</span>
                {i < STEP_ORDER.length - 1 && <div className="mx-1 h-px w-6 bg-border" />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Template */}
        {step === "template" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Template columns</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {templateColumns.map((c) => (
                  <span key={c} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-muted-foreground ring-1 ring-inset ring-border">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => {
                downloadCSV(templateFileName, templateColumns, sampleRows);
                toast.success("Template downloaded");
              }}
            >
              <Download className="h-4 w-4" /> Download Import Template
            </Button>
            <div className="flex justify-end">
              <Button onClick={() => setStep("upload")}>Continue to Upload</Button>
            </div>
          </div>
        )}

        {/* Step 2: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            {extraField}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
                dragActive ? "border-primary bg-blue-50/50" : "border-border bg-muted/20 hover:bg-muted/40"
              )}
            >
              <UploadCloud className="h-8 w-8 text-primary" />
              <p className="text-sm font-medium text-foreground">Drag and drop your file here, or click to browse</p>
              <p className="text-xs text-muted-foreground">Supports CSV, XLS, XLSX</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) handleFile(selected);
                }}
              />
            </div>
            {file && (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                {parsing && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            {results.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Validating {rows.length} rows...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniStat label="Rows Detected" value={results.length} tone="neutral" />
                  <MiniStat label="Valid" value={valid} tone="success" />
                  <MiniStat label="Warnings" value={warnings} tone="warning" />
                  <MiniStat label="Errors / Duplicates" value={errors + duplicates} tone="danger" />
                </div>
                <div className="max-h-72 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/60 text-left font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        {previewColumns.map((c) => (
                          <th key={c.header} className="px-3 py-2">
                            {c.header}
                          </th>
                        ))}
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {results.map((r) => (
                        <tr key={r.row} className={cn(r.status === "Error" || r.status === "Duplicate" ? "bg-rose-50/40" : r.status === "Warning" ? "bg-amber-50/40" : "")}>
                          <td className="px-3 py-2 text-muted-foreground">{r.row}</td>
                          {previewColumns.map((c) => (
                            <td key={c.header} className="px-3 py-2">
                              {c.cell(r)}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              <StatusBadge status={r.status} />
                              {r.issues.length > 0 && (
                                <span className="text-[10.5px] leading-tight text-muted-foreground">{r.issues.join(" ")}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button disabled={results.length === 0 || readyToImport === 0} onClick={() => setStep("summary")}>
                Review Summary
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === "summary" && !uploadRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Total Records" value={results.length} tone="neutral" />
              <MiniStat label="Valid Records" value={valid} tone="success" />
              <MiniStat label="Invalid / Duplicate" value={errors + duplicates} tone="danger" />
              <MiniStat label="Ready to Import" value={readyToImport} tone="success" />
            </div>
            {errors + duplicates > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-warning ring-1 ring-inset ring-amber-200">
                {errors + duplicates} row{errors + duplicates === 1 ? "" : "s"} will be skipped due to errors or duplicates. Go back to fix them, or continue to import the remaining valid rows.
              </p>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("preview")}>
                Back
              </Button>
              <Button disabled={readyToImport === 0 || importing} onClick={handleImport} className="gap-1.5">
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {importing ? "Importing..." : `Import ${readyToImport} Records`}
              </Button>
            </div>
          </div>
        )}

        {step === "summary" && uploadRecord && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="text-sm font-semibold text-success">Import completed successfully</p>
              <p className="text-xs text-foreground/70">
                {uploadRecord.validRows} of {uploadRecord.totalRows} records were imported.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)} className="gap-1.5">
                <X className="h-4 w-4" /> Close
              </Button>
            </div>
          </div>
        )}

        {results.length === 0 && step === "preview" && rows.length === 0 && (
          <EmptyState title="No rows found" description="The uploaded file did not contain any data rows." />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" | "neutral" }) {
  const toneClass = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    neutral: "text-foreground",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold", toneClass)}>{value}</p>
    </div>
  );
}
