"use client";
import {EmployeeMasterDatabase} from '@/components/employees/employee-master-database';
import {PayrollNavigation} from '@/components/payroll/payroll-navigation';
import {useSessionStore} from '@/store/session-store';
export default function SalaryStructuresPage(){const company=useSessionStore(state=>state.companyId);return <div key={company}><PayrollNavigation/><EmployeeMasterDatabase/></div>;}
