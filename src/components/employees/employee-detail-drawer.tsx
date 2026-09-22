"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
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
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function fmtDate(iso: string) {
  try {
    return format(new Date(iso), "dd MMM yyyy");
  } catch {
    return iso;
  }
}

export function EmployeeDetailDrawer({ employee, open, onOpenChange }: EmployeeDetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        {employee && (
          <>
            <div className="border-b border-border p-5 pr-12">
              <div className="flex items-center gap-3">
                <EmployeeAvatar name={employee.fullName} size="lg" />
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">{employee.fullName}</h2>
                  <p className="truncate text-sm text-muted-foreground">{employee.designation}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{employee.employeeCode}</span>
                    <StatusBadge status={employee.status} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-6 p-5">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Personal Information</h3>
                  <Button variant="ghost" size="sm" className="gap-1 text-primary">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date of Birth" value={fmtDate(employee.dateOfBirth)} />
                  <Field label="Gender" value={employee.gender} />
                  <Field label="Blood Group" value={employee.bloodGroup} />
                  <Field label="Marital Status" value={employee.maritalStatus} />
                  <div className="col-span-2">
                    <Field label="Address" value={`${employee.address}, ${employee.city}, ${employee.state} - ${employee.pincode}`} />
                  </div>
                </div>
              </section>

              <Separator />

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
                  <Button variant="ghost" size="sm" className="gap-1 text-primary">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Personal Email" value={employee.personalEmail} />
                  <Field label="Phone Number" value={employee.phone} />
                  <div className="col-span-2">
                    <Field label="Emergency Contact" value={`${employee.emergencyContact.name} (${employee.emergencyContact.relation}) · ${employee.emergencyContact.phone}`} />
                  </div>
                </div>
              </section>

              <Separator />

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Additional Information</h3>
                  <Button variant="ghost" size="sm" className="gap-1 text-primary">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Work Location" value={employee.workLocation} />
                  <Field label="Nationality" value={employee.nationality} />
                  <div className="col-span-2">
                    <Field label="Languages" value={employee.languages.join(", ")} />
                  </div>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Employment Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Department" value={employee.department} />
                  <Field label="Employment Type" value={employee.employmentType} />
                  <Field label="Joining Date" value={fmtDate(employee.joiningDate)} />
                  <Field label="Reporting Manager" value={employee.reportingManager ?? "—"} />
                </div>
              </section>
            </div>

            <div className="flex gap-2 border-t border-border p-4">
              <Button variant="outline" className="flex-1 gap-1.5">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button className="flex-1 gap-1.5">
                <ExternalLink className="h-4 w-4" /> View Full Profile
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
