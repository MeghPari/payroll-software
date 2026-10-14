import { create } from "zustand";
import{companyToday,monthLabel}from '@/domain/dates';

export interface Company {
  id: string;
  name: string;
}

export const companies: Company[] = [
  { id: "co-1", name: "Acme Technologies Pvt. Ltd." },
  { id: "co-2", name: "Demo Pvt. Ltd." },
];

const currentDate=companyToday();
export const payrollMonths=Array.from({length:24},(_,index)=>{const date=new Date(`${currentDate.slice(0,7)}-01T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()-23+index);return monthLabel(date.toISOString().slice(0,7));});

interface AppState {
  companyId: string;
  month: string;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  setCompanyId: (id: string) => void;
  setMonth: (month: string) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  companyId: '',
  month: monthLabel(currentDate.slice(0,7)),
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  setCompanyId: (id) => set({ companyId: id }),
  setMonth: (month) => set({ month }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
}));
