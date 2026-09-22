import { dashboardKpis, payrollSummary, accountsSummary, pendingActions, payrollCostHistory, cashFlowHistory, topExpenses } from "@/data/mock/dashboard";
import { mockDelay } from "@/lib/async";

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getDashboardOverview() {
  return mockDelay({
    kpis: dashboardKpis,
    payrollSummary,
    accountsSummary,
    pendingActions,
    payrollCostHistory,
    cashFlowHistory,
    topExpenses,
  });
}
