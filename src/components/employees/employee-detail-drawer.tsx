"use client";

import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pencil, ExternalLink } from "lucide-react";
import type { Employee } from "@/types";
import { format } from "date-fns";

interface EmployeeDetailDrawerProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (employee: Employee) => void;
  canEdit: boolean;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium text-foreground">{value.trim() || "Not provided"}</p>
    </div>
  );
}

function fmtDate(iso: string) {
  if (!iso) return "";
  try {
    return format(new Date(iso), "dd MMM yyyy");
  } catch {
    return iso;
  }
}

export function EmployeeDetailDrawer({ employee, open, onOpenChange, onEdit, canEdit }: EmployeeDetailDrawerProps) {
  const router = useRouter();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-hidden gap-0 p-0">
        {employee && (
          <>
            <div className="shrink-0 border-b border-border p-5 pr-12">
              <div className="flex items-center gap-3">
                <EmployeeAvatar name={employee.fullName} size="lg" />
                <div className="min-w-0">
                  <SheetTitle className="truncate text-base font-semibold text-foreground">{employee.fullName}</SheetTitle>
                  <p className="truncate text-sm text-muted-foreground">{employee.designation}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{employee.employeeCode}</span>
                    <StatusBadge status={employee.status} />
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Personal Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date of Birth" value={fmtDate(employee.dateOfBirth)} />
                  <Field label="Gender" value={employee.gender} />
                  <Field label="Blood Group" value={employee.bloodGroup} />
                  <Field label="Marital Status" value={employee.maritalStatus} />
                  <Field label="Nationality" value={employee.nationality} />
                  <Field label="Languages" value={employee.languages.join(", ")} />
                  <div className="col-span-2">
                    <Field label="Address" value={[employee.address, employee.city, employee.state, employee.pincode].filter(value=>value?.trim()).join(", ")} />
                  </div>
                </div>
              </section>

              <Separator />

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Personal Email" value={employee.personalEmail} />
                  <Field label="Phone Number" value={employee.phone} />
                  <div className="col-span-2">
                    <Field label="Emergency Contact" value={[employee.emergencyContact.name, employee.emergencyContact.relation, employee.emergencyContact.phone].filter(value=>value?.trim()).join(" / ")} />
                  </div>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Employment Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Department" value={employee.department} />
                  <Field label="Work Location" value={employee.workLocation} />
                  <Field label="Employment Type" value={employee.employmentType} />
                  <Field label="Joining Date" value={fmtDate(employee.joiningDate)} />
                  <Field label="Reporting Manager" value={employee.reportingManager ?? "—"} />
                </div>
              </section>
            </div>

            <div className="shrink-0 flex flex-wrap gap-2 border-t border-border bg-background p-4">
              <Button variant="outline" className="flex-1 gap-1.5" disabled={!canEdit} onClick={() => { onOpenChange(false); onEdit(employee); }}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button className="flex-1 gap-1.5" onClick={() => { onOpenChange(false); router.push(`/employees/${employee.id}`); }}>
                <ExternalLink className="h-4 w-4" /> View Full Profile
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
