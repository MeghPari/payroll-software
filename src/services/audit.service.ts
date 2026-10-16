import { api } from '@/lib/api-client';
import { useSessionStore } from '@/store/session-store';
import type { AuditRecord } from "@/types";

export interface AuditFilters {
  search?: string;
  action?: string | "All";
  employeeId?: string;
}

// Read the authorized, paginated audit endpoint.
export async function getAuditTrail(filters: AuditFilters = {}): Promise<AuditRecord[]> {
  const companyId = useSessionStore.getState().companyId;
  if (!companyId) throw new Error('Select an authorized company first.');
  const response = await api<{ items: { id: string; actor_id: string; action: string; entity_type: string; entity_id: string; metadata: Record<string, unknown>; created_at: string }[]; total: number }>('audit-logs', {}, companyId);
  let results: AuditRecord[] = response.items.map(row => ({ id: row.id, date: new Date(row.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), user: row.actor_id, action: row.action, employeeId: row.entity_type === 'employee' ? row.entity_id : undefined, previous: String(row.metadata.previous ?? ''), next: String(row.metadata.next ?? ''), remarks: JSON.stringify(row.metadata) }));
  if (filters.employeeId) results = results.filter((a) => a.employeeId === filters.employeeId);
  if (filters.action && filters.action !== "All") results = results.filter((a) => a.action === filters.action);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (a) => a.action.toLowerCase().includes(q) || (a.employeeName ?? "").toLowerCase().includes(q) || a.remarks.toLowerCase().includes(q)
    );
  }
  return results;
}
