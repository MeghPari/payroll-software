import { accountGroups, ledgers as mockLedgers } from "@/data/mock/chartOfAccounts";
import {
  customers,
  vendors,
  recentInvoices,
  purchaseInvoices,
  recentVouchers,
  gstSummary,
  cashBankHistory,
  cashFlowHistory,
  topExpenses,
} from "@/data/mock/accounting";
import { dashboardKpis, accountsSummary, payrollSummary } from "@/data/mock/dashboard";
import { mockDelay } from "@/lib/async";

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getAccountingDashboard() {
  return mockDelay({
    revenue: accountsSummary.revenue,
    expenses: accountsSummary.expenses,
    netProfit: accountsSummary.profitBeforeTax,
    bankBalance: dashboardKpis.bankBalance,
    payables: accountsSummary.payablesToVendors,
    gstPayable: accountsSummary.gstPayable,
    receivables: accountsSummary.outstandingReceivables,
    cashBalance: cashBankHistory[cashBankHistory.length - 1].cash,
    recentInvoices,
    recentVouchers,
    gstSummary,
    cashBankHistory,
    payrollAccounting: {
      payrollCost: payrollSummary.netSalaryPayable,
      employerContribution: 525000,
      totalPayrollCost: payrollSummary.netSalaryPayable + 525000,
      salaryLiabilities: 1260000,
    },
  });
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getChartOfAccounts() {
  return mockDelay({ groups: accountGroups, ledgers: mockLedgers });
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getLedgers() {
  return mockDelay(mockLedgers);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getCustomers() {
  return mockDelay(customers);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getVendors() {
  return mockDelay(vendors);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getSalesInvoices() {
  return mockDelay(recentInvoices);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getPurchaseInvoices() {
  return mockDelay(purchaseInvoices);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getVouchers() {
  return mockDelay(recentVouchers);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getGstSummary() {
  return mockDelay(gstSummary);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getCashFlowHistory() {
  return mockDelay(cashFlowHistory);
}

// TODO: Replace mock implementation with REST/GraphQL API.
export async function getTopExpenses() {
  return mockDelay(topExpenses);
}
