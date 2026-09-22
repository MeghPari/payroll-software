import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Users,
  Layers,
  CalendarCheck,
  PlayCircle,
  FileText,
  Send,
  ShieldCheck,
  BarChart3,
  LayoutDashboard,
  Network,
  BookOpen,
  Users2,
  Truck,
  ReceiptText,
  ShoppingCart,
  Landmark,
  Percent,
  PieChart,
  FileSpreadsheet,
  Megaphone,
  UserCog,
  Settings,
  LifeBuoy,
  BookText,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Payroll",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
      { label: "Employees", href: "/employees", icon: Users },
      { label: "Salary Structures", href: "/salary-structures", icon: Layers },
      { label: "Attendance & Leave", href: "/attendance", icon: CalendarCheck },
      { label: "Payroll Run", href: "/payroll", icon: PlayCircle },
      { label: "Payslips", href: "/payslips", icon: FileText },
      { label: "Disbursement", href: "/disbursement", icon: Send },
      { label: "Compliance", href: "/compliance", icon: ShieldCheck },
      { label: "Payroll Reports", href: "/payroll-reports", icon: BarChart3 },
    ],
  },
  {
    label: "Accounts",
    items: [
      { label: "Accounting Dashboard", href: "/accounting", icon: LayoutDashboard },
      { label: "Chart of Accounts", href: "/chart-of-accounts", icon: Network },
      { label: "Journal Entries", href: "/journal-entries", icon: BookText },
      { label: "Ledgers", href: "/ledgers", icon: BookOpen },
      { label: "Customers", href: "/customers", icon: Users2 },
      { label: "Vendors", href: "/vendors", icon: Truck },
      { label: "Sales Invoices", href: "/sales-invoices", icon: ReceiptText },
      { label: "Purchase Invoices", href: "/purchase-invoices", icon: ShoppingCart },
      { label: "Banking & Cash", href: "/banking", icon: Landmark },
      { label: "GST", href: "/gst", icon: Percent },
      { label: "Financial Reports", href: "/financial-reports", icon: PieChart },
      { label: "Payroll Accounting Entries", href: "/payroll-accounting", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "Announcements", href: "/announcements", icon: Megaphone },
      { label: "User Roles", href: "/user-roles", icon: UserCog },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
  {
    label: "Support",
    items: [{ label: "Support", href: "/support", icon: LifeBuoy }],
  },
];
