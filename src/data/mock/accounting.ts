import type { Customer, GstSummary, Invoice, PurchaseInvoice, Vendor, Voucher } from "@/types";

export const customers: Customer[] = [
  { id: "c1", name: "TechNova Solutions", email: "accounts@technova.com", phone: "+91 98450 12345", outstandingBalance: 0, gstin: "29AACCT1234A1Z5" },
  { id: "c2", name: "Bright Future Ltd.", email: "finance@brightfuture.in", phone: "+91 98220 65432", outstandingBalance: 0, gstin: "27AAACB5678B1Z2" },
  { id: "c3", name: "Omega Enterprises", email: "billing@omega-ent.com", phone: "+91 99870 11223", outstandingBalance: 285000, gstin: "06AAECO9012C1Z8" },
  { id: "c4", name: "Vertex Systems", email: "ap@vertexsys.com", phone: "+91 98765 44556", outstandingBalance: 190000, gstin: "33AAFCV3456D1Z1" },
  { id: "c5", name: "Quantum Innovations", email: "pay@quantuminno.com", phone: "+91 97654 33221", outstandingBalance: 145000, gstin: "19AABCQ7890E1Z6" },
  { id: "c6", name: "Silverline Retail", email: "accounts@silverline.in", phone: "+91 96543 22110", outstandingBalance: 68000, gstin: "24AAGCS2345F1Z3" },
  { id: "c7", name: "Pinnacle Traders", email: "finance@pinnacletrd.com", phone: "+91 95432 11009", outstandingBalance: 0, gstin: "07AAHCP6789G1Z4" },
  { id: "c8", name: "Horizon Logistics", email: "billing@horizonlog.com", phone: "+91 94321 00998", outstandingBalance: 92000, gstin: "36AAICH0123H1Z7" },
];

export const vendors: Vendor[] = [
  { id: "v1", name: "Metro Office Supplies", email: "sales@metrooffice.in", phone: "+91 98123 45670", outstandingBalance: 45600, gstin: "29AADCM4567J1Z0" },
  { id: "v2", name: "CloudHost Technologies", email: "billing@cloudhost.io", phone: "+91 98234 56781", outstandingBalance: 128000, gstin: "27AAECC8901K1Z9" },
  { id: "v3", name: "Prime Facility Services", email: "accounts@primefac.in", phone: "+91 98345 67892", outstandingBalance: 84500, gstin: "19AAFCP2345L1Z6" },
  { id: "v4", name: "Skyline Travels", email: "corporate@skylinetravels.com", phone: "+91 98456 78903", outstandingBalance: 32400, gstin: "07AAGCS6789M1Z3" },
  { id: "v5", name: "Nexus Software Solutions", email: "billing@nexussoft.com", phone: "+91 98567 89014", outstandingBalance: 156800, gstin: "36AAHCN0123N1Z8" },
  { id: "v6", name: "Greenfield Caterers", email: "orders@greenfieldcaters.in", phone: "+91 98678 90125", outstandingBalance: 21200, gstin: "24AAICG4567P1Z5" },
];

export const recentInvoices: Invoice[] = [
  { id: "inv-1", invoiceNumber: "INV-2605-024", customer: "TechNova Solutions", amount: 475000, status: "Paid", date: "2026-05-24", dueDate: "2026-06-08" },
  { id: "inv-2", invoiceNumber: "INV-2605-023", customer: "Bright Future Ltd.", amount: 320000, status: "Paid", date: "2026-05-23", dueDate: "2026-06-07" },
  { id: "inv-3", invoiceNumber: "INV-2605-022", customer: "Omega Enterprises", amount: 285000, status: "Partial", date: "2026-05-22", dueDate: "2026-06-06" },
  { id: "inv-4", invoiceNumber: "INV-2605-021", customer: "Vertex Systems", amount: 190000, status: "Due", date: "2026-05-21", dueDate: "2026-06-05" },
  { id: "inv-5", invoiceNumber: "INV-2605-020", customer: "Quantum Innovations", amount: 145000, status: "Due", date: "2026-05-20", dueDate: "2026-06-04" },
  { id: "inv-6", invoiceNumber: "INV-2605-019", customer: "Silverline Retail", amount: 68000, status: "Overdue", date: "2026-05-12", dueDate: "2026-05-27" },
  { id: "inv-7", invoiceNumber: "INV-2605-018", customer: "Pinnacle Traders", amount: 212000, status: "Paid", date: "2026-05-10", dueDate: "2026-05-25" },
  { id: "inv-8", invoiceNumber: "INV-2605-017", customer: "Horizon Logistics", amount: 92000, status: "Due", date: "2026-05-08", dueDate: "2026-05-23" },
  { id: "inv-9", invoiceNumber: "INV-2605-016", customer: "TechNova Solutions", amount: 158000, status: "Paid", date: "2026-05-05", dueDate: "2026-05-20" },
  { id: "inv-10", invoiceNumber: "INV-2605-015", customer: "Bright Future Ltd.", amount: 264000, status: "Paid", date: "2026-05-02", dueDate: "2026-05-17" },
];

export const purchaseInvoices: PurchaseInvoice[] = [
  { id: "pinv-1", invoiceNumber: "PINV-2605-011", vendor: "CloudHost Technologies", amount: 128000, status: "Due", date: "2026-05-18", dueDate: "2026-06-02" },
  { id: "pinv-2", invoiceNumber: "PINV-2605-010", vendor: "Nexus Software Solutions", amount: 156800, status: "Due", date: "2026-05-16", dueDate: "2026-05-31" },
  { id: "pinv-3", invoiceNumber: "PINV-2605-009", vendor: "Prime Facility Services", amount: 84500, status: "Partial", date: "2026-05-14", dueDate: "2026-05-29" },
  { id: "pinv-4", invoiceNumber: "PINV-2605-008", vendor: "Metro Office Supplies", amount: 45600, status: "Paid", date: "2026-05-10", dueDate: "2026-05-25" },
  { id: "pinv-5", invoiceNumber: "PINV-2605-007", vendor: "Skyline Travels", amount: 32400, status: "Paid", date: "2026-05-06", dueDate: "2026-05-21" },
  { id: "pinv-6", invoiceNumber: "PINV-2605-006", vendor: "Greenfield Caterers", amount: 21200, status: "Overdue", date: "2026-04-28", dueDate: "2026-05-13" },
];

export const recentVouchers: Voucher[] = [
  { id: "v-1", voucherNumber: "JV-2605-017", type: "Journal", amount: 250000, date: "2026-05-31", narration: "Payroll accounting entry for May 2026" },
  { id: "v-2", voucherNumber: "PV-2605-031", type: "Payment", amount: 120000, date: "2026-05-30", narration: "Payment to CloudHost Technologies" },
  { id: "v-3", voucherNumber: "RV-2605-029", type: "Receipt", amount: 375000, date: "2026-05-30", narration: "Receipt from TechNova Solutions" },
  { id: "v-4", voucherNumber: "PV-2605-030", type: "Payment", amount: 85000, date: "2026-05-29", narration: "Office rent payment" },
  { id: "v-5", voucherNumber: "JV-2605-016", type: "Journal", amount: 115000, date: "2026-05-29", narration: "GST liability adjustment" },
  { id: "v-6", voucherNumber: "RV-2605-028", type: "Receipt", amount: 264000, date: "2026-05-28", narration: "Receipt from Bright Future Ltd." },
  { id: "v-7", voucherNumber: "CV-2605-004", type: "Contra", amount: 50000, date: "2026-05-27", narration: "Cash deposited to HDFC Bank" },
  { id: "v-8", voucherNumber: "PV-2605-029", type: "Payment", amount: 45600, date: "2026-05-26", narration: "Payment to Metro Office Supplies" },
];

export const gstSummary: GstSummary = {
  cgst: 487500,
  sgst: 487500,
  igst: 0,
  cess: 0,
};

export const cashBankHistory = [
  { month: "Dec 2025", bank: 18000000, cash: 18000 },
  { month: "Jan 2026", bank: 19200000, cash: 20000 },
  { month: "Feb 2026", bank: 20500000, cash: 22000 },
  { month: "Mar 2026", bank: 22000000, cash: 25000 },
  { month: "Apr 2026", bank: 22800000, cash: 28000 },
  { month: "May 2026", bank: 23580500, cash: 28450 },
];

export const cashFlowHistory = [
  { month: "Dec 2025", inflow: 11000000, outflow: 6000000 },
  { month: "Jan 2026", inflow: 12500000, outflow: 6500000 },
  { month: "Feb 2026", inflow: 13200000, outflow: 7000000 },
  { month: "Mar 2026", inflow: 14800000, outflow: 7500000 },
  { month: "Apr 2026", inflow: 14200000, outflow: 7200000 },
  { month: "May 2026", inflow: 16250000, outflow: 6840000 },
];

export const topExpenses = [
  { category: "Employee Benefits", amount: 2340000, percent: 34.2 },
  { category: "Rent & Utilities", amount: 1260000, percent: 18.4 },
  { category: "Professional Fees", amount: 875000, percent: 12.8 },
  { category: "Office Expenses", amount: 685000, percent: 10.0 },
  { category: "Travel & Conveyance", amount: 450000, percent: 6.6 },
  { category: "Others", amount: 1230000, percent: 18.0 },
];
