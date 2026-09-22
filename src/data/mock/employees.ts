import type {
  Department,
  Employee,
  EmployeeStatus,
  Gender,
  MaritalStatus,
} from "@/types";

interface EmployeeSeed {
  firstName: string;
  lastName: string;
  department: Department;
  designation: string;
  status: EmployeeStatus;
  gender: Gender;
  maritalStatus: MaritalStatus;
  joiningDate: string;
  dob: string;
  city: string;
  state: string;
  ctc: number;
  employmentType: Employee["employmentType"];
  structureId: string;
}

const SEEDS: EmployeeSeed[] = [
  { firstName: "Arjun", lastName: "Mehta", department: "Finance", designation: "Senior Accountant", status: "Active", gender: "Male", maritalStatus: "Married", joiningDate: "2022-01-15", dob: "1992-08-12", city: "Bengaluru", state: "Karnataka", ctc: 1250000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Priya", lastName: "Sharma", department: "HR", designation: "HR Executive", status: "Active", gender: "Female", maritalStatus: "Single", joiningDate: "2023-03-03", dob: "1996-04-22", city: "Pune", state: "Maharashtra", ctc: 780000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Rohan", lastName: "Verma", department: "Engineering", designation: "Software Engineer", status: "Active", gender: "Male", maritalStatus: "Single", joiningDate: "2021-06-21", dob: "1994-11-02", city: "Hyderabad", state: "Telangana", ctc: 1600000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Neha", lastName: "Kapoor", department: "Marketing", designation: "Marketing Manager", status: "Active", gender: "Female", maritalStatus: "Married", joiningDate: "2022-08-11", dob: "1990-02-17", city: "Mumbai", state: "Maharashtra", ctc: 1850000, employmentType: "Full-time", structureId: "ss-2" },
  { firstName: "Vikram", lastName: "Singh", department: "Operations", designation: "Operations Executive", status: "On Leave", gender: "Male", maritalStatus: "Married", joiningDate: "2023-02-07", dob: "1993-06-09", city: "Delhi", state: "Delhi", ctc: 690000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Anjali", lastName: "Desai", department: "Finance", designation: "Accounts Executive", status: "Active", gender: "Female", maritalStatus: "Single", joiningDate: "2023-12-18", dob: "1998-01-30", city: "Ahmedabad", state: "Gujarat", ctc: 620000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Siddharth", lastName: "Rao", department: "IT", designation: "Team Lead", status: "Active", gender: "Male", maritalStatus: "Married", joiningDate: "2020-09-01", dob: "1989-09-25", city: "Chennai", state: "Tamil Nadu", ctc: 2400000, employmentType: "Full-time", structureId: "ss-2" },
  { firstName: "Kavya", lastName: "Nair", department: "HR", designation: "HR Associate", status: "Active", gender: "Female", maritalStatus: "Single", joiningDate: "2023-04-26", dob: "1997-07-14", city: "Kochi", state: "Kerala", ctc: 550000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Aditya", lastName: "Joshi", department: "Sales", designation: "Sales Executive", status: "Active", gender: "Male", maritalStatus: "Single", joiningDate: "2022-11-14", dob: "1995-03-19", city: "Jaipur", state: "Rajasthan", ctc: 720000, employmentType: "Full-time", structureId: "ss-3" },
  { firstName: "Ananya", lastName: "Gupta", department: "Engineering", designation: "Product Manager", status: "Active", gender: "Female", maritalStatus: "Married", joiningDate: "2021-02-08", dob: "1991-12-05", city: "Bengaluru", state: "Karnataka", ctc: 2800000, employmentType: "Full-time", structureId: "ss-2" },
  { firstName: "Rahul", lastName: "Verma", department: "Engineering", designation: "UI/UX Designer", status: "Active", gender: "Male", maritalStatus: "Single", joiningDate: "2022-05-30", dob: "1996-10-11", city: "Pune", state: "Maharashtra", ctc: 1150000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Sneha", lastName: "Iyer", department: "HR", designation: "HR Executive", status: "Notice Period", gender: "Female", maritalStatus: "Married", joiningDate: "2020-07-19", dob: "1992-05-08", city: "Chennai", state: "Tamil Nadu", ctc: 850000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Amit", lastName: "Kumar", department: "Finance", designation: "Accountant", status: "Active", gender: "Male", maritalStatus: "Married", joiningDate: "2019-10-02", dob: "1988-01-27", city: "Lucknow", state: "Uttar Pradesh", ctc: 980000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Pooja", lastName: "Singh", department: "HR", designation: "HR Executive", status: "Active", gender: "Female", maritalStatus: "Single", joiningDate: "2023-01-16", dob: "1997-09-21", city: "Noida", state: "Uttar Pradesh", ctc: 640000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Karan", lastName: "Malhotra", department: "Sales", designation: "Business Analyst", status: "Active", gender: "Male", maritalStatus: "Single", joiningDate: "2022-06-13", dob: "1995-08-03", city: "Gurugram", state: "Haryana", ctc: 1050000, employmentType: "Full-time", structureId: "ss-3" },
  { firstName: "Divya", lastName: "Menon", department: "Marketing", designation: "Content Strategist", status: "Active", gender: "Female", maritalStatus: "Married", joiningDate: "2021-11-22", dob: "1993-04-16", city: "Kochi", state: "Kerala", ctc: 890000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Rajesh", lastName: "Pillai", department: "Operations", designation: "Operations Manager", status: "Active", gender: "Male", maritalStatus: "Married", joiningDate: "2018-03-05", dob: "1985-11-30", city: "Thiruvananthapuram", state: "Kerala", ctc: 1950000, employmentType: "Full-time", structureId: "ss-2" },
  { firstName: "Meera", lastName: "Bhatt", department: "IT", designation: "QA Engineer", status: "Active", gender: "Female", maritalStatus: "Single", joiningDate: "2022-09-19", dob: "1996-02-28", city: "Ahmedabad", state: "Gujarat", ctc: 980000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Vivek", lastName: "Chandra", department: "Engineering", designation: "Backend Developer", status: "Active", gender: "Male", maritalStatus: "Single", joiningDate: "2023-07-10", dob: "1998-06-06", city: "Hyderabad", state: "Telangana", ctc: 1400000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Ritu", lastName: "Agarwal", department: "Finance", designation: "Finance Manager", status: "Active", gender: "Female", maritalStatus: "Married", joiningDate: "2019-04-01", dob: "1987-03-14", city: "Delhi", state: "Delhi", ctc: 2600000, employmentType: "Full-time", structureId: "ss-2" },
  { firstName: "Suresh", lastName: "Reddy", department: "Sales", designation: "Regional Sales Head", status: "Active", gender: "Male", maritalStatus: "Married", joiningDate: "2017-08-21", dob: "1983-10-19", city: "Hyderabad", state: "Telangana", ctc: 3200000, employmentType: "Full-time", structureId: "ss-2" },
  { firstName: "Ishita", lastName: "Sen", department: "Marketing", designation: "Marketing Executive", status: "Active", gender: "Female", maritalStatus: "Single", joiningDate: "2023-10-09", dob: "1999-01-12", city: "Kolkata", state: "West Bengal", ctc: 560000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Manoj", lastName: "Tiwari", department: "Operations", designation: "Logistics Executive", status: "Inactive", gender: "Male", maritalStatus: "Married", joiningDate: "2020-01-27", dob: "1990-07-23", city: "Indore", state: "Madhya Pradesh", ctc: 610000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Nikita", lastName: "Kulkarni", department: "IT", designation: "DevOps Engineer", status: "Active", gender: "Female", maritalStatus: "Single", joiningDate: "2022-02-14", dob: "1994-05-27", city: "Pune", state: "Maharashtra", ctc: 1750000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Deepak", lastName: "Yadav", department: "Engineering", designation: "Software Engineer", status: "Active", gender: "Male", maritalStatus: "Single", joiningDate: "2023-05-15", dob: "1997-12-08", city: "Bengaluru", state: "Karnataka", ctc: 1500000, employmentType: "Full-time", structureId: "ss-1" },
  { firstName: "Sanjana", lastName: "Rao", department: "HR", designation: "Talent Acquisition Lead", status: "Active", gender: "Female", maritalStatus: "Married", joiningDate: "2019-12-02", dob: "1990-09-04", city: "Chennai", state: "Tamil Nadu", ctc: 1650000, employmentType: "Full-time", structureId: "ss-2" },
  { firstName: "Farhan", lastName: "Ansari", department: "Engineering", designation: "Intern - Frontend", status: "Active", gender: "Male", maritalStatus: "Single", joiningDate: "2026-01-05", dob: "2002-03-15", city: "Mumbai", state: "Maharashtra", ctc: 300000, employmentType: "Intern", structureId: "ss-4" },
  { firstName: "Tanvi", lastName: "Shah", department: "Finance", designation: "Payroll Specialist", status: "Active", gender: "Female", maritalStatus: "Single", joiningDate: "2022-10-24", dob: "1995-11-19", city: "Surat", state: "Gujarat", ctc: 920000, employmentType: "Full-time", structureId: "ss-1" },
];

const bloodGroups = ["A+", "B+", "O+", "AB+", "A-", "O-"];
const languagesPool = [
  ["English", "Hindi"],
  ["English", "Hindi", "Kannada"],
  ["English", "Marathi", "Hindi"],
  ["English", "Tamil"],
  ["English", "Telugu", "Hindi"],
  ["English", "Malayalam", "Hindi"],
  ["English", "Gujarati", "Hindi"],
  ["English", "Bengali", "Hindi"],
];

function pad(n: number, len = 4): string {
  return String(n).padStart(len, "0");
}

function pincodeFor(index: number): string {
  return String(400000 + index * 137).slice(0, 6);
}

export const employees: Employee[] = SEEDS.map((seed, index) => {
  const fullName = `${seed.firstName} ${seed.lastName}`;
  const emailBase = `${seed.firstName.toLowerCase()}.${seed.lastName.toLowerCase()}`;
  const employeeCode = `EMP${pad(index + 1)}`;
  return {
    id: `emp-${index + 1}`,
    employeeCode,
    firstName: seed.firstName,
    lastName: seed.lastName,
    fullName,
    email: `${emailBase}@acme.com`,
    personalEmail: `${emailBase}@gmail.com`,
    phone: `+91 ${90000 + index * 37}${10000 + index * 91}`.slice(0, 14),
    department: seed.department,
    designation: seed.designation,
    status: seed.status,
    joiningDate: seed.joiningDate,
    dateOfBirth: seed.dob,
    gender: seed.gender,
    bloodGroup: bloodGroups[index % bloodGroups.length],
    maritalStatus: seed.maritalStatus,
    address: `${100 + index * 7}, ${["MG Road", "Park Street", "Residency Lane", "Church Road", "Lake View", "Green Avenue"][index % 6]}`,
    city: seed.city,
    state: seed.state,
    pincode: pincodeFor(index),
    emergencyContact: {
      name: index % 2 === 0 ? `${seed.firstName === "Arjun" ? "Neha" : "Rekha"} ${seed.lastName}` : `${seed.lastName} Sr.`,
      relation: index % 3 === 0 ? "Spouse" : index % 3 === 1 ? "Parent" : "Sibling",
      phone: `+91 9${(1000 + index * 53) % 9000 + 1000}${(2000 + index * 71) % 9000 + 1000}`.slice(0, 13),
    },
    workLocation: seed.city,
    nationality: "Indian",
    languages: languagesPool[index % languagesPool.length],
    bankDetails: {
      accountHolderName: fullName,
      accountNumber: `${5000000000 + index * 91827}`,
      ifscCode: ["HDFC0001234", "SBIN0004567", "ICIC0002345", "AXIS0003456"][index % 4],
      bankName: ["HDFC Bank", "State Bank of India", "ICICI Bank", "Axis Bank"][index % 4],
      branch: `${seed.city} Main Branch`,
    },
    statutory: {
      pan: `${["ABCDE", "PQRSX", "LMNOP", "WXYZQ"][index % 4]}${1000 + index}${["F", "G", "H"][index % 3]}`,
      aadhaar: `XXXX XXXX ${5000 + index * 13}`.slice(0, 14),
      uan: `1002345${pad(index, 3)}`,
      pfNumber: `PF${pad(index + 1, 6)}`,
      esicNumber: seed.ctc <= 2100000 ? `ESIC${pad(index + 1, 6)}` : undefined,
    },
    salaryStructureId: seed.structureId,
    ctc: seed.ctc,
    reportingManager: index > 4 ? SEEDS[index % 5].firstName + " " + SEEDS[index % 5].lastName : undefined,
    employmentType: seed.employmentType,
  };
});

export function getEmployeeById(id: string): Employee | undefined {
  return employees.find((e) => e.id === id || e.employeeCode === id);
}

export const departments: Department[] = ["Engineering", "Finance", "HR", "Sales", "Marketing", "Operations", "IT"];
export const workLocations: string[] = Array.from(new Set(employees.map((e) => e.workLocation)));
export const designations: string[] = Array.from(new Set(employees.map((e) => e.designation)));
