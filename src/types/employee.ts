export type Department =
  | "Engineering"
  | "Finance"
  | "HR"
  | "Sales"
  | "Marketing"
  | "Operations"
  | "IT";

export type EmployeeStatus = "Active" | "On Leave" | "Notice Period" | "Inactive";

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
}

export interface EmployeeFilters {
  search?: string;
  department?: Department | "All";
  designation?: string | "All";
  location?: string | "All";
  status?: EmployeeStatus | "All";
}
