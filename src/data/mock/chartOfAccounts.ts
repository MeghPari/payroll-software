import type { AccountGroup, Ledger } from "@/types";

export const accountGroups: AccountGroup[] = [
  {
    id: "assets", name: "Assets", type: "Asset", parentId: null,
    children: [
      {
        id: "current-assets", name: "Current Assets", type: "Asset", parentId: "assets",
        children: [
          { id: "cash-bank", name: "Cash & Bank", type: "Asset", parentId: "current-assets" },
          { id: "accounts-receivable", name: "Accounts Receivable", type: "Asset", parentId: "current-assets" },
          { id: "inventory", name: "Inventory", type: "Asset", parentId: "current-assets" },
          { id: "prepaid-expenses", name: "Prepaid Expenses", type: "Asset", parentId: "current-assets" },
        ],
      },
      { id: "fixed-assets", name: "Fixed Assets", type: "Asset", parentId: "assets" },
    ],
  },
  {
    id: "liabilities", name: "Liabilities", type: "Liability", parentId: null,
    children: [
      {
        id: "current-liabilities", name: "Current Liabilities", type: "Liability", parentId: "liabilities",
        children: [
          { id: "accounts-payable", name: "Accounts Payable", type: "Liability", parentId: "current-liabilities" },
          { id: "statutory-liabilities", name: "Statutory Liabilities", type: "Liability", parentId: "current-liabilities" },
          { id: "payroll-liabilities", name: "Payroll Liabilities", type: "Liability", parentId: "current-liabilities" },
        ],
      },
      { id: "long-term-liabilities", name: "Long Term Liabilities", type: "Liability", parentId: "liabilities" },
    ],
  },
  {
    id: "income", name: "Income", type: "Income", parentId: null,
    children: [
      { id: "operating-income", name: "Operating Income", type: "Income", parentId: "income" },
      { id: "other-income", name: "Other Income", type: "Income", parentId: "income" },
    ],
  },
  {
    id: "expenses", name: "Expenses", type: "Expense", parentId: null,
    children: [
      { id: "operating-expenses", name: "Operating Expenses", type: "Expense", parentId: "expenses" },
      { id: "other-expenses", name: "Other Expenses", type: "Expense", parentId: "expenses" },
    ],
  },
];

export const ledgers: Ledger[] = [
  { id: "l1", name: "Cash in Hand", code: "1001", type: "Asset", groupId: "cash-bank", balance: 28450, status: "Active" },
  { id: "l2", name: "HDFC Bank - Main A/c", code: "1002", type: "Asset", groupId: "cash-bank", balance: 1284560, status: "Active" },
  { id: "l3", name: "State Bank of India - A/c", code: "1003", type: "Asset", groupId: "cash-bank", balance: 835210, status: "Active" },
  { id: "l4", name: "Accounts Receivable", code: "1101", type: "Asset", groupId: "accounts-receivable", balance: 975000, status: "Active" },
  { id: "l5", name: "Inventory - Raw Materials", code: "1102", type: "Asset", groupId: "inventory", balance: 1540300, status: "Active" },
  { id: "l6", name: "Prepaid Insurance", code: "1103", type: "Asset", groupId: "prepaid-expenses", balance: 84000, status: "Active" },
  { id: "l7", name: "Office Equipment", code: "1201", type: "Asset", groupId: "fixed-assets", balance: 1250000, status: "Active" },
  { id: "l8", name: "Furniture & Fixtures", code: "1202", type: "Asset", groupId: "fixed-assets", balance: 640000, status: "Active" },
  { id: "l9", name: "Accounts Payable", code: "2001", type: "Liability", groupId: "accounts-payable", balance: 782600, status: "Active" },
  { id: "l10", name: "Sundry Creditors", code: "2002", type: "Liability", groupId: "accounts-payable", balance: 321450, status: "Active" },
  { id: "l11", name: "GST Payable", code: "2003", type: "Liability", groupId: "statutory-liabilities", balance: 215320, status: "Active" },
  { id: "l12", name: "TDS Payable", code: "2004", type: "Liability", groupId: "statutory-liabilities", balance: 96500, status: "Active" },
  { id: "l13", name: "Salary Payable", code: "2101", type: "Liability", groupId: "payroll-liabilities", balance: 168500, status: "Active" },
  { id: "l14", name: "PF Payable", code: "2102", type: "Liability", groupId: "payroll-liabilities", balance: 84200, status: "Active" },
  { id: "l15", name: "ESI Payable", code: "2103", type: "Liability", groupId: "payroll-liabilities", balance: 18450, status: "Active" },
  { id: "l16", name: "Term Loan - HDFC", code: "2201", type: "Liability", groupId: "long-term-liabilities", balance: 4500000, status: "Active" },
  { id: "l17", name: "Service Income", code: "3001", type: "Income", groupId: "operating-income", balance: 4875000, status: "Active" },
  { id: "l18", name: "Product Sales", code: "3002", type: "Income", groupId: "operating-income", balance: 3120000, status: "Active" },
  { id: "l19", name: "Other Income", code: "3101", type: "Income", groupId: "other-income", balance: 245000, status: "Active" },
  { id: "l20", name: "Interest Income", code: "3102", type: "Income", groupId: "other-income", balance: 42500, status: "Active" },
  { id: "l21", name: "Salaries & Wages", code: "4001", type: "Expense", groupId: "operating-expenses", balance: 1840000, status: "Active" },
  { id: "l22", name: "Rent Expense", code: "4002", type: "Expense", groupId: "operating-expenses", balance: 480000, status: "Active" },
  { id: "l23", name: "Professional Fees", code: "4003", type: "Expense", groupId: "operating-expenses", balance: 325600, status: "Active" },
  { id: "l24", name: "Office Expenses", code: "4004", type: "Expense", groupId: "operating-expenses", balance: 168500, status: "Active" },
  { id: "l25", name: "Travel & Conveyance", code: "4005", type: "Expense", groupId: "operating-expenses", balance: 92400, status: "Active" },
  { id: "l26", name: "Software Subscriptions", code: "4006", type: "Expense", groupId: "operating-expenses", balance: 156200, status: "Active" },
  { id: "l27", name: "Bank Charges", code: "4101", type: "Expense", groupId: "other-expenses", balance: 8450, status: "Inactive" },
  { id: "l28", name: "Miscellaneous Expense", code: "4102", type: "Expense", groupId: "other-expenses", balance: 22300, status: "Inactive" },
];
