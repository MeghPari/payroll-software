import type { Employee } from '../types/employee';
export interface EmployeeRow {
  manager_id?:string|null;counter_code?:string;counter_name?:string;client_status?:Employee['clientStatus'];
  id: string; employee_code: string; first_name: string; last_name: string; email: string; phone: string;
  status: Employee['status']; joining_date: string; exit_date?: string | null; work_location: string; state: string;
  category: Employee['category']; employment_type: Employee['employmentType']; version: number;
  departments: { name: string } | null; designations: { name: string } | null;
}
// Missing personal/salary data remains explicitly unconfigured; never invent records.
export function employeeView(row: EmployeeRow): Employee {
  return {counterCode:row.counter_code??'',counterName:row.counter_name??'',clientStatus:row.client_status??null, managerId:row.manager_id??null,id: row.id, employeeCode: row.employee_code, firstName: row.first_name, lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(), email: row.email, phone: row.phone, department: row.departments?.name ?? '',
    designation: row.designations?.name ?? '', status: row.status, joiningDate: row.joining_date, exitDate: row.exit_date,
    workLocation: row.work_location, state: row.state, employmentType: row.employment_type, category: row.category,
    version: row.version, personalEmail: '', dateOfBirth: '', gender: '', bloodGroup: '', maritalStatus: '', address: '', city: '', pincode: '',
    emergencyContact: { name: '', relation: '', phone: '' }, nationality: '', languages: [],
    bankDetails: { accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '', branch: '' }, statutory: { pan: '', aadhaar: '' },
    salaryStructureId: '', ctc: 0, salaryConfigured: false };
}
