export type AccountType = "Asset" | "Liability" | "Income" | "Expense" | "Equity";

export type AccountStatus = "Active" | "Inactive";

export interface AccountGroup {
  id: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  children?: AccountGroup[];
}

export interface Ledger {
  id: string;
  name: string;
  code: string;
  type: AccountType;
  groupId: string;
  balance: number;
  status: AccountStatus;
}

export type InvoiceStatus = "Paid" | "Partial" | "Due" | "Overdue";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  status: InvoiceStatus;
  date: string;
  dueDate: string;
}

export type PurchaseInvoiceStatus = "Paid" | "Partial" | "Due" | "Overdue";

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  amount: number;
  status: PurchaseInvoiceStatus;
  date: string;
  dueDate: string;
}

export type VoucherType = "Journal" | "Payment" | "Receipt" | "Contra";

export interface Voucher {
  id: string;
  voucherNumber: string;
  type: VoucherType;
  amount: number;
  date: string;
  narration: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  outstandingBalance: number;
  gstin?: string;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  outstandingBalance: number;
  gstin?: string;
}

export interface GstSummary {
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

export interface DashboardMetric {
  label: string;
  value: number;
  changeLabel?: string;
  changeDirection?: "up" | "down" | "neutral";
}
