export type Department =
  | "Engineering"
  | "Finance"
  | "HR"
  | "Sales"
  | "Marketing"
  | "Operations"
  | "IT";

export type EmployeeStatus = "Active" | "Probation" | "On Notice" | "On Leave" | "Salary Hold" | "Inactive" | "Exited";

export type EmploymentCategory = "Permanent" | "Contract" | "Consultant" | "Intern" | "Temporary" | "Rent Candidate" | "Other";

export type Gender = "Male" | "Female" | "Other";

export type MaritalStatus = "Single" | "Married" | "Divorced" | "Widowed";

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branch: string;
}

export interface StatutoryDetails {
  pan: string;
  aadhaar: string;
  uan?: string;
  pfNumber?: string;
  esicNumber?: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  personalEmail: string;
  phone: string;
  avatarUrl?: string;
  department: Department;
  designation: string;
  status: EmployeeStatus;
  joiningDate: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: string;
  maritalStatus: MaritalStatus;
  address: string;
  city: string;
  state: string;
  pincode: string;
  emergencyContact: EmergencyContact;
  workLocation: string;
  nationality: string;
  languages: string[];
  bankDetails: BankDetails;
  statutory: StatutoryDetails;
  salaryStructureId: string;
  ctc: number;
  reportingManager?: string;
  employmentType: "Full-time" | "Part-time" | "Contractor" | "Intern";
  /** Worker category — drives statutory (PF/ESI) applicability defaults. See "Rent Candidate" handling in operations-store. */
  category?: EmploymentCategory;
}

export interface EmployeeFilters {
  search?: string;
  department?: Department | "All";
  designation?: string | "All";
  location?: string | "All";
  state?: string | "All";
  status?: EmployeeStatus | "All";
  category?: EmploymentCategory | "All";
}
