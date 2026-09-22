import { financialReportCards, recentReports } from "@/data/mock/financialReports";
import { mockDelay } from "@/lib/async";

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getFinancialReports() {
  return mockDelay(financialReportCards);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getRecentReports() {
  return mockDelay(recentReports);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function generateReport(reportKey: string): Promise<{ success: boolean; reportKey: string }> {
  return mockDelay({ success: true, reportKey }, 1000);
}
