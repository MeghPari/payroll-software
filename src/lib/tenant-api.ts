import { api } from './api-client';
import { useSessionStore } from '@/store/session-store';
export async function tenantApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const companyId = useSessionStore.getState().companyId;
  if (!companyId) throw new Error('Select an authorized company first.');
  return api<T>(path, options, companyId);
}
export function permitted(permission: string) {
  const { session, companyId } = useSessionStore.getState();
  const role = session?.memberships.find(m => m.company_id === companyId)?.role;
  return !!session?.permissions.some(p => p.role === role && p.permission === permission);
}
