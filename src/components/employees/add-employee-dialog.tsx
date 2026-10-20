"use client";

import {DesignationInput} from './designation-input';
import { useForm, Controller,useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { createEmployee, updateEmployee, checkDuplicateUAN } from "@/services/employee.service";
import { indianStates, employmentCategories } from "@/config/employee-options";
import type { Employee } from "@/types";
import { AlertTriangle, Loader2 } from "lucide-react";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().max(100),
  email: z.union([z.literal(""),z.string().email("Enter a valid work email")]),
  phone: z.union([z.literal(""),z.string().min(10, "Enter a valid phone number")]),
  department: z.string().trim().max(100),
  designation: z.string().max(100),
  employmentType: z.enum(["Full-time", "Part-time", "Contractor", "Intern"]),
  category: z.enum(["Permanent", "Contract", "Consultant", "Intern", "Temporary", "Rent Candidate", "Other"]),
  joiningDate: z.string().min(1, "Joining date is required"),
  counterCode:z.string().max(80),counterName:z.string().max(160),
  workLocation: z.string().max(160),
  state: z.string().max(100),
  uan: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (employee: Employee) => void;
  employee?: Employee | null;
}

export function AddEmployeeDialog({ open, onOpenChange, onCreated, employee }: AddEmployeeDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [uanCheck, setUanCheck] = useState<{ checking: boolean; duplicate?: Employee }>({ checking: false });
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      department: "",
      employmentType: "Full-time",
      category: "Permanent",
      state: indianStates[0],
    },
  });

  const category = useWatch({control,name:'category'});
  const uan = useWatch({control,name:'uan'});
  useEffect(() => {
    if (open) reset(employee ? { firstName:employee.firstName,lastName:employee.lastName,email:employee.email,phone:employee.phone,department:employee.department as FormValues['department'],designation:employee.designation,employmentType:employee.employmentType,category:employee.category??'Permanent',joiningDate:employee.joiningDate,counterCode:employee.counterCode??'',counterName:employee.counterName??'',workLocation:employee.workLocation,state:employee.state,uan:employee.statutory.uan??'' } : {firstName:'',lastName:'',email:'',phone:'',department:'',designation:'',employmentType:'Full-time',category:'Permanent',joiningDate:'',counterCode:'',counterName:'',workLocation:'',state:'',uan:''});
  }, [open,employee,reset]);

  const runUanCheck = useCallback(async (value: string) => {
    if (!value.trim()) {
      setUanCheck({ checking: false, duplicate: undefined });
      return;
    }
    setUanCheck({ checking: true });
    try { const match = await checkDuplicateUAN(value,employee?.id); setUanCheck({ checking: false, duplicate: match }); }
    catch (error) { setUanCheck({checking:false}); toast.error(error instanceof Error?error.message:'Unable to validate UAN.'); }
  }, [employee]);

  useEffect(() => {
    const timeout = setTimeout(() => runUanCheck(uan ?? ""), 400);
    return () => clearTimeout(timeout);
  }, [uan, runUanCheck]);

  async function onSubmit(values: FormValues) {
    if (uanCheck.duplicate) {
      toast.error("Cannot add employee with a duplicate UAN", { description: "Resolve the UAN conflict before continuing." });
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        department: values.department,
        designation: values.designation,
        joiningDate: values.joiningDate,
        state: values.state,
        workLocation: values.workLocation,counterCode:values.counterCode,counterName:values.counterName,
        ...(values.uan ? {statutory:{pan:employee?.statutory.pan??'',aadhaar:'',uan:values.uan,esicNumber:employee?.statutory.esicNumber}} : {}),
        employmentType: values.employmentType,
        category: values.category,
      };
      const newEmployee = employee ? await updateEmployee(employee.id,{...data,version:employee.version}) : await createEmployee(data);
      if(!newEmployee) throw new Error('Unable to reload employee.');
      toast.success(employee ? 'Employee updated' : 'Employee added');
      onCreated(newEmployee);
      reset();
      setUanCheck({ checking: false });
      onOpenChange(false);
    } catch(error) { toast.error(error instanceof Error ? error.message : 'Unable to save employee.'); } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
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
              <Label htmlFor="department">Department</Label>
              <Input id="department" {...register('department')}/>
              {errors.department&&<p className="text-xs text-danger">{errors.department.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Controller control={control} name="designation" render={({field})=><DesignationInput id="designation" value={field.value??''} onChange={field.onChange}/>}/>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Employment Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {employmentCategories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {indianStates.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.state && <p className="text-xs text-danger">{errors.state.message}</p>}
            </div>
          </div>

          {category === "Rent Candidate" && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-primary ring-1 ring-inset ring-blue-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Review and explicitly configure statutory applicability on the employee&apos;s KYC &amp; Statutory tab.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="workLocation">Work Location</Label>
            <Input id="workLocation" {...register("workLocation")} placeholder="Bengaluru" />
            {errors.workLocation && <p className="text-xs text-danger">{errors.workLocation.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="counterCode">Counter Code</Label><Input id="counterCode" {...register("counterCode")}/><Label htmlFor="counterName">Counter Name</Label><Input id="counterName" {...register("counterName")}/>
            <Label htmlFor="uan">UAN Number (optional)</Label>
            <div className="relative">
              <Input id="uan" {...register("uan")} placeholder="100234500129" className={uanCheck.duplicate ? "border-danger pr-9" : "pr-9"} />
              {uanCheck.checking && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            {uanCheck.duplicate && (
              <div className="flex items-start justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs ring-1 ring-inset ring-rose-200">
                <div>
                  <StatusBadge status="Duplicate UAN" />
                  <p className="mt-1 text-foreground/80">
                    UAN already exists for employee {uanCheck.duplicate.employeeCode} — {uanCheck.duplicate.fullName}.
                  </p>
                </div>
                <Link
                  href={`/employees/${uanCheck.duplicate.id}`}
                  target="_blank"
                  className="shrink-0 whitespace-nowrap text-xs font-medium text-primary hover:underline"
                >
                  View Existing Employee
                </Link>
              </div>
            )}
          </div>

          <DialogFooter className="!mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || uanCheck.checking || !!uanCheck.duplicate}>
              {submitting ? "Adding..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
