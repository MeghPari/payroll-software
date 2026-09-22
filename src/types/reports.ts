export type ReportIconKey =
  | "trial-balance"
  | "profit-loss"
  | "balance-sheet"
  | "ledger-book"
  | "cash-book"
  | "bank-book"
  | "gst-report"
  | "payroll-accounting";

export interface FinancialReport {
  id: string;
  key: ReportIconKey;
  title: string;
  description: string;
}

export type RecentReportStatus = "Ready" | "Generating" | "Failed";

export interface RecentReport {
  id: string;
  title: string;
  generatedOn: string;
  status: RecentReportStatus;
}
