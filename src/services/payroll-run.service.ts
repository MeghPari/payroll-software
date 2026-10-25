import { tenantApi } from '@/lib/tenant-api';
import { monthKey } from '@/domain/dates';
import type { AttendanceSummary } from '@/types';
export interface PayrollSnapshot {
 run_id?:string;payrollStatus?:string;batchNumber?:number;employee_id:string;gross_minor:number;deduction_minor:number;net_minor:number;employer_minor:number;
 snapshot:{setupWarnings?:unknown;employeeCode:string;employeeName:string;calendarDays:number;proration?:string;prorationDays?:number;paidDays:number;earnings:Record<string,number>;deductions:Record<string,number>;employer:Record<string,number>;ruleVersions:Record<string,string>;baselineGrossMinor:number;salary:{effectiveFrom:string;structure:string;amounts:Record<string,number>};attendance:AttendanceSummary};
}
export interface PayrollRunData {
 workflow?:{published:boolean;disbursed:boolean;posted:boolean}|null;
 run:null|{id:string;month:string;status:'Draft'|'Calculated'|'Approved'|'Locked';version:number;calculated_at:string;approved_at:string|null;locked_at:string|null};
 attendanceFinalized:boolean;snapshots:PayrollSnapshot[];
}
export interface PayrollChecks {issues:{employeeId:string;check:string;severity:'Passed'|'Warning'|'Blocking Error';message:string}[];readyCount?:number;calculatedCount?:number;blockingErrors:number;totalChecked:number;passed:number;warnings:number}
export function getPayrollRun(month:string){return tenantApi<PayrollRunData>(`payroll?month=${monthKey(month)}-01`);}
export function payrollAction<T=unknown>(month:string,action:'validate'|'calculate'|'approve'|'lock'|'unlock',expectedVersion?:number,reason=''){
 return tenantApi<T>('payroll',{method:'POST',body:JSON.stringify({month:`${monthKey(month)}-01`,action,expectedVersion,reason})});
}
