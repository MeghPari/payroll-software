'use client';
import { create } from 'zustand';
export interface SessionData {
  user: { id: string; email?: string };
  memberships: { company_id: string; role: string; companies: { id: string; name: string } }[];
  permissions: { role: string; permission: string }[];
}
export const useSessionStore = create<{ session: SessionData | null; companyId: string; setSession: (value: SessionData | null) => void; selectCompany: (id: string) => void }>((set) => ({
  session: null, companyId: '',
  setSession: session => set(state => ({ session, companyId: session?.memberships.some(m => m.company_id === state.companyId) ? state.companyId : session?.memberships[0]?.company_id ?? '' })),
  selectCompany: companyId => set(state => state.session?.memberships.some(m => m.company_id === companyId) ? { companyId } : {}),
}));
