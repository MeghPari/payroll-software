import type { SalaryComponent, SalaryStructure } from "@/types";
import { employees } from "./employees";

function earning(id: string, name: string, calculationType: SalaryComponent["calculationType"], value: number | null): SalaryComponent {
  return { id, name, type: "Earning", calculationType, value };
}
function deduction(id: string, name: string, calculationType: SalaryComponent["calculationType"], value: number | null): SalaryComponent {
  return { id, name, type: "Deduction", calculationType, value };
}

const standardEarnings: SalaryComponent[] = [
  earning("e1", "Basic", "Percentage of Basic", 40),
  earning("e2", "HRA", "Percentage of Basic", 20),
  earning("e3", "Special Allowance", "Fixed Amount", 10000),
];
const standardDeductions: SalaryComponent[] = [
  deduction("d1", "PF (Employee)", "Percentage of Basic", 12),
  deduction("d2", "ESI (Employee)", "Percentage of Gross", 0.75),
  deduction("d3", "Professional Tax", "Fixed Amount", 200),
  deduction("d4", "TDS", "As per IT Slab", null),
  deduction("d5", "Loan / Advance", "As per record", null),
];

const managementEarnings: SalaryComponent[] = [
  earning("e1", "Basic", "Percentage of Basic", 45),
  earning("e2", "HRA", "Percentage of Basic", 25),
  earning("e3", "Special Allowance", "Fixed Amount", 25000),
  earning("e4", "Leadership Allowance", "Fixed Amount", 15000),
];
const managementDeductions: SalaryComponent[] = [
  deduction("d1", "PF (Employee)", "Percentage of Basic", 12),
  deduction("d2", "Professional Tax", "Fixed Amount", 200),
  deduction("d3", "TDS", "As per IT Slab", null),
];

const salesEarnings: SalaryComponent[] = [
  earning("e1", "Basic", "Percentage of Basic", 40),
  earning("e2", "HRA", "Percentage of Basic", 20),
  earning("e3", "Incentive Allowance", "Fixed Amount", 8000),
];
const salesDeductions: SalaryComponent[] = [
  deduction("d1", "PF (Employee)", "Percentage of Basic", 12),
  deduction("d2", "ESI (Employee)", "Percentage of Gross", 0.75),
  deduction("d3", "Professional Tax", "Fixed Amount", 200),
  deduction("d4", "TDS", "As per IT Slab", null),
];

const internEarnings: SalaryComponent[] = [
  earning("e1", "Stipend", "Fixed Amount", 25000),
];
const internDeductions: SalaryComponent[] = [
  deduction("d1", "Professional Tax", "Fixed Amount", 0),
];

function countFor(structureId: string): number {
  return employees.filter((e) => e.salaryStructureId === structureId).length;
}

export const salaryStructures: SalaryStructure[] = [
  {
    id: "ss-1",
    name: "Standard Monthly Structure",
    status: "Active",
    frequency: "Monthly",
    createdOn: "2025-01-01",
    employeeCount: countFor("ss-1"),
    earnings: standardEarnings,
    deductions: standardDeductions,
  },
  {
    id: "ss-2",
    name: "Management Structure",
    status: "Active",
    frequency: "Monthly",
    createdOn: "2024-11-15",
    employeeCount: countFor("ss-2"),
    earnings: managementEarnings,
    deductions: managementDeductions,
  },
  {
    id: "ss-3",
    name: "Sales Team Structure",
    status: "Active",
    frequency: "Monthly",
    createdOn: "2024-10-10",
    employeeCount: countFor("ss-3"),
    earnings: salesEarnings,
    deductions: salesDeductions,
  },
  {
    id: "ss-4",
    name: "Intern Structure",
    status: "Draft",
    frequency: "Monthly",
    createdOn: "2025-05-05",
    employeeCount: countFor("ss-4"),
    earnings: internEarnings,
    deductions: internDeductions,
  },
  {
    id: "ss-5",
    name: "Contractor Structure",
    status: "Draft",
    frequency: "Monthly",
    createdOn: "2025-04-28",
    employeeCount: 0,
    earnings: [earning("e1", "Consulting Fee", "Fixed Amount", 60000)],
    deductions: [deduction("d1", "TDS", "As per IT Slab", null)],
  },
  {
    id: "ss-6",
    name: "Executive Structure",
    status: "Active",
    frequency: "Monthly",
    createdOn: "2024-12-20",
    employeeCount: 0,
    earnings: [
      earning("e1", "Basic", "Percentage of Basic", 50),
      earning("e2", "HRA", "Percentage of Basic", 25),
      earning("e3", "Executive Allowance", "Fixed Amount", 60000),
    ],
    deductions: [
      deduction("d1", "PF (Employee)", "Percentage of Basic", 12),
      deduction("d2", "Professional Tax", "Fixed Amount", 200),
      deduction("d3", "TDS", "As per IT Slab", null),
    ],
  },
];

export function getStructureById(id: string): SalaryStructure | undefined {
  return salaryStructures.find((s) => s.id === id);
}
