import { payslips as mockPayslips } from "@/data/mock/payslips";
import { mockDelay } from "@/lib/async";
import type { Payslip } from "@/types";

const store: Payslip[] = [...mockPayslips];

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getPayslips(month?: string): Promise<Payslip[]> {
  return mockDelay(month ? store.filter((p) => p.month === month) : [...store]);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getPayslipById(id: string): Promise<Payslip | undefined> {
  return mockDelay(store.find((p) => p.id === id));
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function publishPayslips(ids: string[]): Promise<Payslip[]> {
  ids.forEach((id) => {
    const index = store.findIndex((p) => p.id === id);
    if (index !== -1) {
      store[index] = { ...store[index], status: "Published", publishedOn: new Date().toLocaleString("en-IN") };
    }
  });
  return mockDelay(store.filter((p) => ids.includes(p.id)), 1200);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function reprocessFailedPayslips(): Promise<number> {
  let count = 0;
  store.forEach((p, index) => {
    if (p.status === "Failed") {
      store[index] = { ...p, status: "Generated" };
      count += 1;
    }
  });
  return mockDelay(count, 1500);
}
