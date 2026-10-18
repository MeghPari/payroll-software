import type {PayrollSnapshot} from '../services/payroll-run.service';
import {CLIENT_SALARY_COLUMNS} from './client-template-columns';
export const CLIENT_COST_FIELDS={employerEpf:'Employer EPF (client label 8.33%)',employerEps:'Employer EPS (client label 3.67%)',edli:'EDLI Contribution',pfAdmin:'PF Admin Charges',insurance:'Insurance',serviceCharge:'Service Charge',gratuity:'Gratuity',invoiceValue:'Total Invoice Value'} as const;
export function suggestedServiceCharge(grossMinor:number){if(!Number.isSafeInteger(grossMinor)||grossMinor<0)throw new Error('Invalid saved gross amount');return Number((BigInt(grossMinor)*BigInt(450)+BigInt(5000))/BigInt(10000));}
export interface ClientCostReview{employee_id:string;amounts:Partial<Record<keyof typeof CLIENT_COST_FIELDS,number>>;payroll_version:number;version:number;review_note:string}
export interface ClientSheetIdentity{id:string;employee_code:string;first_name:string;last_name:string;joining_date:string;work_location:string;state:string;counter_code:string;counter_name:string;departments:{name:string}|null;designations:{name:string}|null;dateOfBirth?:string;accountNumber?:string;ifscCode?:string;uan?:string}
export function clientSalaryValues(row:PayrollSnapshot,identity:ClientSheetIdentity,cost:ClientCostReview|undefined,version:number):string[]{
 const snapshot=row.snapshot,earn=snapshot.earnings,ded=snapshot.deductions,employer=snapshot.employer,attendance=snapshot.attendance;
 const amount=(minor:number|undefined)=>minor===undefined?'':(Number(minor)/100).toFixed(2),sum=(codes:string[])=>codes.reduce((sum,code)=>sum+Number(earn[code]??0),0);
 const reviewed=cost?.payroll_version===version?cost.amounts:{};
 const notes:string[]=[];
 if(snapshot.setupWarnings&&Array.isArray(snapshot.setupWarnings)&&snapshot.setupWarnings.some((warning:{employeeId?:string;check?:string})=>warning.employeeId===row.employee_id&&warning.check==='Statutory Configuration'))notes.push('Provisional statutory setup');
 if(!cost||cost.payroll_version!==version)notes.push('Client costs need review');
 const additional=Object.keys(earn).filter(code=>!['basic','da','hra','special','conveyance','other','sunday','overtime','incentive'].includes(code)&&Number(earn[code])!==0);
 if(additional.length)notes.push('Additional earnings in gross: '+additional.join(', '));
 // Net and gross always come from the saved payroll, never from worksheet guesses.
 const values=[snapshot.employeeCode,snapshot.employeeName,identity.dateOfBirth??'',identity.joining_date,identity.accountNumber??'',identity.ifscCode??'',identity.uan??'',identity.designations?.name??'',identity.work_location,identity.state,identity.departments?.name??'',String(attendance.present??''),String(attendance.absent??''),amount(earn.sunday??0),amount(earn.overtime??0),amount(earn.basic??0),amount(earn.da??0),amount(earn.hra??0),amount(sum(['special','conveyance','other'])),amount(sum(['incentive','sunday','overtime'])),amount(row.gross_minor),amount(ded.esi??0),amount(ded.pf??0),amount(ded.pt??0),amount(row.deduction_minor),amount(employer.esi??0),amount(reviewed.employerEpf),amount(reviewed.employerEps),amount(reviewed.edli),amount(reviewed.pfAdmin),amount(reviewed.insurance),amount(reviewed.serviceCharge),'',amount(reviewed.gratuity),amount(reviewed.invoiceValue),amount(ded.uniformAdvance??0),amount(ded.vehicleDamage??0),amount(ded.recovery??0),amount(row.net_minor),notes.join('; ')||'Calculated'];
 if(values.length!==CLIENT_SALARY_COLUMNS.length)throw new Error('Client salary column mapping mismatch');return values;
}

export function suggestedInvoiceValue(grossMinor:number,employerEsiMinor:number,amounts:ClientCostReview['amounts']){
 const keys=['employerEpf','employerEps','edli','pfAdmin','insurance','serviceCharge','gratuity'] as const;
 if(keys.some(key=>amounts[key]===undefined))throw new Error('Enter all employer costs and client charges first; use zero where reviewed as not applicable.');
 const values=[grossMinor,employerEsiMinor,...keys.map(key=>amounts[key]!)];
 if(values.some(value=>!Number.isSafeInteger(value)||value<0))throw new Error('Invalid client cost amount.');
 const total=values.reduce((sum,value)=>sum+BigInt(value),BigInt(0));if(total>BigInt(9000000000000))throw new Error('Invoice total exceeds the supported amount.');return Number(total);
}
