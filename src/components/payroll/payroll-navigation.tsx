'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, Calculator, Banknote, House } from 'lucide-react';
import { permitted } from '@/lib/tenant-api';
const links=[{href:'/dashboard',label:'Payroll Home',icon:House,permission:'payroll.run'},{href:'/attendance',label:'Attendance',icon:CalendarCheck},{href:'/payroll',label:'Calculate Salaries',icon:Calculator,permission:'payroll.run'},{href:'/disbursement',label:'Salary Payments',icon:Banknote,permission:'disbursements.write'}];
export function PayrollNavigation(){const path=usePathname();return <nav aria-label="Monthly payroll workflow" className="mb-5 flex flex-wrap gap-2">{links.filter(link=>!link.permission||permitted(link.permission)).map(link=><Link key={link.href} href={link.href} aria-current={path===link.href?'page':undefined} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${path===link.href?'border-primary bg-primary text-white':'bg-card hover:bg-muted'}`}><link.icon className="h-4 w-4"/>{link.label}</Link>)}</nav>;}
