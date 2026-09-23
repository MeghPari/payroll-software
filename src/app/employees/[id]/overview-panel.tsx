import { SectionCard } from "@/components/shared/section-card";
import type { Employee } from "@/types";
import { format } from "date-fns";

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

export function OverviewPanel({ employee }: { employee: Employee }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SectionCard title="Personal Information">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date of Birth" value={fmtDate(employee.dateOfBirth)} />
          <Field label="Gender" value={employee.gender} />
          <Field label="Blood Group" value={employee.bloodGroup} />
          <Field label="Marital Status" value={employee.maritalStatus} />
          <div className="col-span-2">
            <Field label="Address" value={`${employee.address}, ${employee.city}, ${employee.state} - ${employee.pincode}`} />
          </div>
          <Field label="Nationality" value={employee.nationality} />
          <Field label="Languages" value={employee.languages.join(", ")} />
        </div>
      </SectionCard>

      <SectionCard title="Contact Information">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Official Email" value={employee.email} />
          <Field label="Personal Email" value={employee.personalEmail} />
          <Field label="Phone Number" value={employee.phone} />
          <Field label="Work Location" value={employee.workLocation} />
          <div className="col-span-2">
            <Field
              label="Emergency Contact"
              value={`${employee.emergencyContact.name || "—"} (${employee.emergencyContact.relation || "—"}) · ${employee.emergencyContact.phone || "—"}`}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Employment Snapshot" className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Department" value={employee.department} />
          <Field label="Designation" value={employee.designation} />
          <Field label="Employment Type" value={employee.employmentType} />
          <Field label="Category" value={employee.category ?? "Permanent"} />
          <Field label="Joining Date" value={fmtDate(employee.joiningDate)} />
          <Field label="Reporting Manager" value={employee.reportingManager ?? "—"} />
          <Field label="Employee ID" value={employee.employeeCode} />
          <Field label="State" value={employee.state} />
        </div>
      </SectionCard>
    </div>
  );
}
