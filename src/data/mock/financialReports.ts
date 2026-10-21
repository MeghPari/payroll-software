import type { FinancialReport, RecentReport } from "@/types";

export const financialReportCards: FinancialReport[] = [
  { id: "fr-1", key: "trial-balance", title: "Trial Balance", description: "Summary of all ledger balances in debit and credit form." },
  { id: "fr-2", key: "profit-loss", title: "Profit & Loss Statement", description: "Revenue, expenses and profitability for the selected period." },
  { id: "fr-3", key: "balance-sheet", title: "Balance Sheet", description: "Summary of assets, liabilities and equity position." },
  { id: "fr-4", key: "ledger-book", title: "Ledger Book", description: "Detailed transactions for a specific ledger account." },
  { id: "fr-5", key: "cash-book", title: "Cash Book", description: "All cash receipts and payments during the selected period." },
  { id: "fr-6", key: "bank-book", title: "Bank Book", description: "All bank transactions including receipts and payments." },
  { id: "fr-7", key: "gst-report", title: "GST Report", description: "Summary of GST liability, claims and returns information." },
  { id: "fr-8", key: "payroll-accounting", title: "Payroll Accounting Entries", description: "Journal entries generated from payroll transactions." },
];

export const recentReports: RecentReport[] = [
  { id: "rr-1", title: "Profit & Loss Statement", generatedOn: "Today, 10:30 AM", status: "Ready" },
  { id: "rr-2", title: "Balance Sheet", generatedOn: "Yesterday, 04:15 PM", status: "Ready" },
  { id: "rr-3", title: "Trial Balance", generatedOn: "Yesterday, 11:20 AM", status: "Ready" },
  { id: "rr-4", title: "GST Report", generatedOn: "28 May 2026, 03:45 PM", status: "Ready" },
  { id: "rr-5", title: "Ledger Book - Sundry Debtors", generatedOn: "27 May 2026, 05:10 PM", status: "Ready" },
  { id: "rr-6", title: "Cash Book", generatedOn: "27 May 2026, 02:30 PM", status: "Ready" },
  { id: "rr-7", title: "Payroll Accounting Entries", generatedOn: "26 May 2026, 10:05 AM", status: "Ready" },
  { id: "rr-8", title: "Bank Book", generatedOn: "26 May 2026, 09:15 AM", status: "Ready" },
];
