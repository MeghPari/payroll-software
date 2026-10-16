import Link from 'next/link';
import type {PayrollSetupWarning} from '@/domain/payroll-setup';
import {hasUnconfiguredStatutory} from '@/domain/payroll-setup';

export function PayrollSetupNotice({warnings,showEmployeeLinks=false}:{warnings:readonly PayrollSetupWarning[];showEmployeeLinks?:boolean}){
 const unique=Array.from(new Map(warnings.map(warning=>[warning.employeeId+'/'+warning.check,warning])).values());
 if(!unique.length)return null;
 return <section role="status" aria-label="Saved payroll setup warnings" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><h2 className="font-semibold">{hasUnconfiguredStatutory(unique)?'Provisional net pay - statutory setup needs review':'Bank setup can be completed before payment'}</h2><p className="mt-1">{hasUnconfiguredStatutory(unique)?'These saved salaries exclude unconfigured statutory deductions. Review the employee settings and recalculate before treating the amounts as final take-home pay.':'Missing bank details do not prevent salary calculation. Complete and verify them before preparing bank instructions.'}</p>{showEmployeeLinks&&<p className="mt-2"><Link href="/employees" className="font-medium text-primary underline">Review employee setup</Link></p>}</section>;
}
