export interface PayrollSetupWarning {
 employeeId:string;
 check:string;
 severity:'Warning';
 message:string;
}

// Migration 041 captured the validation list in every employee snapshot.
// Restrict it to this employee before exposing an individual salary/payslip.
export function employeeSetupWarnings(value:unknown,employeeId:string):PayrollSetupWarning[]{
 if(!Array.isArray(value))return [];
 return value.filter((item):item is PayrollSetupWarning=>!!item&&typeof item==='object'&&item.employeeId===employeeId&&item.severity==='Warning'&&typeof item.check==='string'&&typeof item.message==='string');
}
export function hasUnconfiguredStatutory(warnings:readonly PayrollSetupWarning[]){
 return warnings.some(warning=>warning.check==='Statutory Configuration');
}
