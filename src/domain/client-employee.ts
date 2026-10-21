import {z} from 'zod';
import {toMinor} from './currency';
import {normalizeAttendanceImportDate} from './attendance-import-date';
import {spreadsheetDate} from './spreadsheet-import';
const date=z.string().refine(value=>normalizeAttendanceImportDate(value)===value,'Use a valid YYYY-MM-DD date.');
const optionalDate=z.union([date,z.literal('')]);
const money=z.number().int().nonnegative().max(9000000000000);
export const clientEmployeeInput=z.object({
 employeeCode:z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),employeeName:z.string().trim().min(1).max(200),
 gender:z.enum(['Male','Female','Other','']),dateOfBirth:optionalDate,maritalStatus:z.enum(['Single','Married','Divorced','Widowed','']),phone:z.string().regex(/^(?:[0-9]{10})?$/),
 aadhaar:z.string().regex(/^(?:[0-9]{12})?$/),pan:z.string().regex(/^(?:[A-Z]{5}[0-9]{4}[A-Z])?$/),uan:z.string().regex(/^(?:[0-9]{12})?$/),esicNumber:z.string().max(30),
 joiningDate:date,exitDate:optionalDate,clientStatus:z.enum(['Active','Left','Rejoined']),counterCode:z.string().max(80),counterName:z.string().max(160),reportingManager:z.string().max(200),workLocation:z.string().max(160),state:z.string().max(100),department:z.string().max(100),designation:z.string().max(100),
 accountNumber:z.string().regex(/^(?:[0-9]{6,34})?$/),ifscCode:z.string().regex(/^(?:[A-Z]{4}0[A-Z0-9]{6})?$/),
 amounts:z.object({basic:money,da:money,hra:money,other:money}).strict().nullable(),salaryEffectiveFrom:optionalDate,
 salaryReference:z.object({grossMinor:money.nullable(),pfMinor:money.nullable(),esiMinor:money.nullable(),ctcMinor:money.nullable()}).strict()
}).strict().superRefine((row,ctx)=>{
 const parts=row.employeeName.split(/\s+/);if(parts[0].length>100||parts.slice(1).join(' ').length>100)ctx.addIssue({code:'custom',message:'First name and remaining name must each fit 100 characters.'});
 if(row.exitDate&&row.exitDate<row.joiningDate)ctx.addIssue({code:'custom',message:'Leaving date must not precede joining date.'});
 if(row.clientStatus==='Left'&&!row.exitDate)ctx.addIssue({code:'custom',message:'Left employees need a leaving date.'});
 if(row.clientStatus!=='Left'&&row.exitDate)ctx.addIssue({code:'custom',message:'Only Left employees may have a leaving date in this import.'});
 if(row.dateOfBirth&&row.dateOfBirth>=row.joiningDate)ctx.addIssue({code:'custom',message:'DOB must precede joining date.'});
 if(row.amounts){
  if(!row.salaryEffectiveFrom||row.salaryEffectiveFrom<row.joiningDate||row.exitDate&&row.salaryEffectiveFrom>row.exitDate)ctx.addIssue({code:'custom',message:'Choose a salary effective date within employment.'});
  const gross=Object.values(row.amounts).reduce((sum,value)=>sum+value,0);
  if(!Number.isSafeInteger(gross)||row.salaryReference.grossMinor!==null&&row.salaryReference.grossMinor!==gross)ctx.addIssue({code:'custom',message:'S. Gross must equal Structured Basic + S. DA + S. HRA + S. Other Allowance.'});
 }else if(row.salaryReference.grossMinor!==null)ctx.addIssue({code:'custom',message:'Supply the structured component split as well as S. Gross.'});
});
export type ClientEmployeeInput=z.infer<typeof clientEmployeeInput>;
export const employeeDatasetInput=clientEmployeeInput.superRefine((row,ctx)=>{
 if(!row.amounts)ctx.addIssue({code:'custom',message:'Supply Structured Basic, S. DA, S. HRA and S. Other Allowance. Enter 0 where a component does not apply.'});
});
export function parseEmployeeDataset(row:ClientEmployeeRow):ClientEmployeeInput{
 for(const key of ['Structured Basic','S. DA','S. HRA','S. Other Allowance']){
  if(!(row.record[key]??'').trim())throw new Error(`${key} is required. Enter 0 if it does not apply.`);
 }
 return employeeDatasetInput.parse(parseClientEmployee(row));
}
export interface ClientEmployeeRow{record:Record<string,string>;salaryEffectiveFrom:string}
export function parseClientEmployee(row:ClientEmployeeRow):ClientEmployeeInput{
 const r=row.record,value=(key:string)=>{const raw=(r[key]??'').trim();return ['Date of Birth (DOB)','Date of Joining (DOJ)','Date of Leaving (DOL)'].includes(key)&&raw?spreadsheetDate(raw)??raw:raw;},amount=(key:string)=>value(key)===''?null:toMinor(value(key));
 const hasSalary=['Structured Basic','S. DA','S. HRA','S. Other Allowance'].some(key=>value(key)!=='');
 return clientEmployeeInput.parse({employeeCode:value('Employee Code'),employeeName:value('Employee Name'),gender:value('Gender'),dateOfBirth:value('Date of Birth (DOB)'),maritalStatus:value('Marital Status'),phone:value('Phone Number'),aadhaar:value('Aadhaar No'),pan:value('PAN').toUpperCase(),uan:value('UAN'),esicNumber:value('ESI No'),joiningDate:value('Date of Joining (DOJ)'),exitDate:value('Date of Leaving (DOL)'),clientStatus:value('Status')||'Active',counterCode:value('Counter Code'),counterName:value('Counter Name'),reportingManager:value('Reporting Manager'),workLocation:value('Location'),state:value('State'),department:value('Function'),designation:value('Designation'),accountNumber:value('Account Number'),ifscCode:value('IFSC Code').toUpperCase(),amounts:hasSalary?{basic:amount('Structured Basic')??0,da:amount('S. DA')??0,hra:amount('S. HRA')??0,other:amount('S. Other Allowance')??0}:null,salaryEffectiveFrom:row.salaryEffectiveFrom==='joining'?value('Date of Joining (DOJ)'):row.salaryEffectiveFrom,salaryReference:{grossMinor:amount('S. Gross'),pfMinor:amount('S. PF'),esiMinor:amount('S. ESI'),ctcMinor:amount('Total CTC')}});
}
