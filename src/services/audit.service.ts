import { mockDelay } from "@/lib/async";
import { useOperations } from "@/store/operations-store";
import type { AuditRecord } from "@/types";

export interface AuditFilters {
  search?: string;
  action?: string | "All";
  employeeId?: string;
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getAuditTrail(filters: AuditFilters = {}): Promise<AuditRecord[]> {
  let results = [...useOperations.getState().audit];
  if (filters.employeeId) results = results.filter((a) => a.employeeId === filters.employeeId);
  if (filters.action && filters.action !== "All") results = results.filter((a) => a.action === filters.action);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (a) => a.action.toLowerCase().includes(q) || (a.employeeName ?? "").toLowerCase().includes(q) || a.remarks.toLowerCase().includes(q)
    );
  }
  return mockDelay(results);
}
