import { mockDelay } from "@/lib/async";
import { useOperations } from "@/store/operations-store";
import type { EmployeeKYC, KYCDocumentName } from "@/types";

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getEmployeeKYC(employeeId: string): Promise<EmployeeKYC | undefined> {
  return mockDelay(useOperations.getState().kyc[employeeId]);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function updateEmployeeKYC(employeeId: string, data: Partial<EmployeeKYC>): Promise<EmployeeKYC> {
  useOperations.getState().updateKYC(employeeId, data);
  return mockDelay(useOperations.getState().kyc[employeeId], 700);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function uploadKYCDocument(employeeId: string, docName: KYCDocumentName, fileName: string): Promise<void> {
  useOperations.getState().uploadDocument(employeeId, docName, fileName);
  return mockDelay(undefined, 900);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function verifyKYCDocument(employeeId: string, docName: KYCDocumentName): Promise<void> {
  useOperations.getState().verifyDocument(employeeId, docName);
  return mockDelay(undefined, 600);
}
