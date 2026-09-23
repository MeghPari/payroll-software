"use client";

import { useRef, useState } from "react";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { uploadKYCDocument, verifyKYCDocument } from "@/services/kyc.service";
import type { Employee, EmployeeKYC, KYCDocumentName } from "@/types";
import { toast } from "sonner";
import { FileText, Upload, CheckCircle2 } from "lucide-react";

interface DocumentsPanelProps {
  employee: Employee;
  kyc: EmployeeKYC;
  onChanged: () => void;
}

export function DocumentsPanel({ employee, kyc, onChanged }: DocumentsPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleUpload(docName: KYCDocumentName, file: File) {
    setBusy(docName);
    try {
      await uploadKYCDocument(employee.id, docName, file.name);
      toast.success(`${docName} uploaded`, { description: "Pending verification." });
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function handleVerify(docName: KYCDocumentName) {
    setBusy(docName);
    try {
      await verifyKYCDocument(employee.id, docName);
      toast.success(`${docName} verified`);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionCard title="Documents" subtitle="Identity, bank and onboarding documents for this employee." noPadding>
      <div className="divide-y divide-border">
        {kyc.documents.map((doc) => (
          <div key={doc.name} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{doc.fileName || "No file uploaded"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={doc.status} />
              <input
                ref={(el) => {
                  fileInputs.current[doc.name] = el;
                }}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(doc.name, file);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" size="sm" className="gap-1.5" disabled={busy === doc.name} onClick={() => fileInputs.current[doc.name]?.click()}>
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
              {doc.status !== "Verified" && doc.fileName && (
                <Button variant="outline" size="sm" className="gap-1.5 text-success border-emerald-200 hover:bg-emerald-50" disabled={busy === doc.name} onClick={() => handleVerify(doc.name)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
