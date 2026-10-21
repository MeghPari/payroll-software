"use client";
import {EmployeeMasterDatabase} from '@/components/employees/employee-master-database';
import type {Employee,SalaryProfile} from '@/types';
export function SalaryPanel({employee}:{employee:Employee;salary:SalaryProfile|undefined;onChanged:()=>void}){return <EmployeeMasterDatabase employeeId={employee.id}/>;}
