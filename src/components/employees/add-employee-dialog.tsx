"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { departments } from "@/data/mock/employees";
import { createEmployee } from "@/services/employee.service";
import type { Employee } from "@/types";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid work email"),
  phone: z.string().min(10, "Enter a valid phone number"),
  department: z.enum(["Engineering", "Finance", "HR", "Sales", "Marketing", "Operations", "IT"]),
  designation: z.string().min(1, "Designation is required"),
  employmentType: z.enum(["Full-time", "Part-time", "Contractor", "Intern"]),
  joiningDate: z.string().min(1, "Joining date is required"),
  workLocation: z.string().min(1, "Work location is required"),
});

type FormValues = z.infer<typeof schema>;

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (employee: Employee) => void;
}

export function AddEmployeeDialog({ open, onOpenChange, onCreated }: AddEmployeeDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      department: "Engineering",
      employmentType: "Full-time",
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const newEmployee = await createEmployee({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        personalEmail: values.email,
        phone: values.phone,
        department: values.department,
        designation: values.designation,
        status: "Active",
        joiningDate: values.joiningDate,
        dateOfBirth: "1995-01-01",
        gender: "Male",
        bloodGroup: "O+",
        maritalStatus: "Single",
        address: "",
        city: values.workLocation,
        state: "",
        pincode: "",
        emergencyContact: { name: "", relation: "", phone: "" },
        workLocation: values.workLocation,
        nationality: "Indian",
        languages: ["English"],
        bankDetails: { accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "", branch: "" },
        statutory: { pan: "", aadhaar: "" },
        salaryStructureId: "ss-1",
        ctc: 600000,
        employmentType: values.employmentType,
      });
      toast.success("Employee added", { description: `${newEmployee.fullName} has been added to the organization.` });
      onCreated(newEmployee);
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription>Enter the employee&apos;s basic details. You can complete the rest of the profile later.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" {...register("firstName")} placeholder="Arjun" />
              {errors.firstName && <p className="text-xs text-danger">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" {...register("lastName")} placeholder="Mehta" />
              {errors.lastName && <p className="text-xs text-danger">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Work Email</Label>
              <Input id="email" type="email" {...register("email")} placeholder="arjun.mehta@acme.com" />
              {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" {...register("phone")} placeholder="+91 98765 43210" />
              {errors.phone && <p className="text-xs text-danger">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Controller
                control={control}
                name="department"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" {...register("designation")} placeholder="Software Engineer" />
              {errors.designation && <p className="text-xs text-danger">{errors.designation.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Employment Type</Label>
              <Controller
                control={control}
                name="employmentType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Full-time", "Part-time", "Contractor", "Intern"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="joiningDate">Joining Date</Label>
              <Input id="joiningDate" type="date" {...register("joiningDate")} />
              {errors.joiningDate && <p className="text-xs text-danger">{errors.joiningDate.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workLocation">Work Location</Label>
            <Input id="workLocation" {...register("workLocation")} placeholder="Bengaluru" />
            {errors.workLocation && <p className="text-xs text-danger">{errors.workLocation.message}</p>}
          </div>

          <DialogFooter className="!mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
