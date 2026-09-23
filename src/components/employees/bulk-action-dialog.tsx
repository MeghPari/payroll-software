"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BulkActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fieldLabel: string;
  type: "select" | "text";
  options?: string[];
  onApply: (value: string) => Promise<void>;
}

export function BulkActionDialog({ open, onOpenChange, title, description, fieldLabel, type, options = [], onApply }: BulkActionDialogProps) {
  const [value, setValue] = useState(options[0] ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleApply() {
    if (!value.trim()) return;
    setSubmitting(true);
    try {
      await onApply(value);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>{fieldLabel}</Label>
          {type === "select" ? (
            <Select value={value} onValueChange={(v) => v && setValue(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
          )}
        </div>
        <DialogFooter className="!mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={submitting || !value.trim()}>
            {submitting ? "Applying..." : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
