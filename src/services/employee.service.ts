import { employees as mockEmployees } from "@/data/mock/employees";
import { mockDelay } from "@/lib/async";
import type { Employee, EmployeeFilters } from "@/types";

// In-memory mutable copy so create/update actions persist for the session.
const store: Employee[] = [...mockEmployees];

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getEmployees(filters: EmployeeFilters = {}): Promise<Employee[]> {
  let results = [...store];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
    );
  }
  if (filters.department && filters.department !== "All") {
    results = results.filter((e) => e.department === filters.department);
  }
  if (filters.designation && filters.designation !== "All") {
    results = results.filter((e) => e.designation === filters.designation);
  }
  if (filters.location && filters.location !== "All") {
    results = results.filter((e) => e.workLocation === filters.location);
  }
  if (filters.status && filters.status !== "All") {
    results = results.filter((e) => e.status === filters.status);
  }

  return mockDelay(results);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getEmployeeById(id: string): Promise<Employee | undefined> {
  return mockDelay(store.find((e) => e.id === id));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function createEmployee(data: Omit<Employee, "id" | "employeeCode" | "fullName">): Promise<Employee> {
  const id = `emp-${store.length + 1}`;
  const employeeCode = `EMP${String(store.length + 1).padStart(4, "0")}`;
  const newEmployee: Employee = {
    ...data,
    id,
    employeeCode,
    fullName: `${data.firstName} ${data.lastName}`,
  };
  store.push(newEmployee);
  return mockDelay(newEmployee);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function updateEmployee(id: string, data: Partial<Employee>): Promise<Employee | undefined> {
  const index = store.findIndex((e) => e.id === id);
  if (index === -1) return mockDelay(undefined);
  store[index] = { ...store[index], ...data };
  return mockDelay(store[index]);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function deleteEmployee(id: string): Promise<boolean> {
  const index = store.findIndex((e) => e.id === id);
  if (index === -1) return mockDelay(false);
  store.splice(index, 1);
  return mockDelay(true);
}
