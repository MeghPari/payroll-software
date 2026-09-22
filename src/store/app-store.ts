import { create } from "zustand";

export interface Company {
  id: string;
  name: string;
}

export const companies: Company[] = [
  { id: "co-1", name: "Acme Technologies Pvt. Ltd." },
  { id: "co-2", name: "Demo Pvt. Ltd." },
];

export const payrollMonths = [
  "January 2026",
  "February 2026",
  "March 2026",
  "April 2026",
  "May 2026",
];

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
  companyId: companies[0].id,
  month: "May 2026",
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  setCompanyId: (id) => set({ companyId: id }),
  setMonth: (month) => set({ month }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
}));
