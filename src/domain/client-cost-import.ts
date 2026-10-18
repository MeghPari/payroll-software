import {toMinor} from './currency';import {spreadsheetDate} from './spreadsheet-import';import {CLIENT_SALARY_COLUMNS} from './client-template-columns';
import type {ClientCostReview,CLIENT_COST_FIELDS} from './client-salary-sheet';
export interface ClientCostSheetRow{record:Record<string,string>;employeeId?:string;expectedVersion?:number;amounts?:Partial<Record<keyof typeof CLIENT_COST_FIELDS,number>>}
export interface SavedClientSheetRow{employeeId:string;employeeName:string;values:string[];cost:ClientCostReview|null}
const costColumns:Record<string,keyof typeof CLIENT_COST_FIELDS>={'Employer EPF 8.33%':'employerEpf','Employer EPS 3.67%':'employerEps','EDLI Contribution 0.5%':'edli','PF Admin Charges 0.5%':'pfAdmin',Insurance:'insurance','Service Charge 4.5% (on Total Gross)':'serviceCharge',Gratuity:'gratuity','Total Invoice Value':'invoiceValue'};
export function clientCostImport(row:ClientCostSheetRow,saved:readonly SavedClientSheetRow[]):ClientCostSheetRow{
 const code=(row.record['Employee Code']??'').trim(),employee=saved.find(item=>item.values[0]===code);if(!employee)throw new Error('Employee Code is not in this calculated payroll.');
 const amounts:Partial<Record<keyof typeof CLIENT_COST_FIELDS,number>>={};
 for(const[column,key]of Object.entries(costColumns)){const value=(row.record[column]??'').trim();if(value!=='')amounts[key]=toMinor(value);}
 if(!Object.keys(amounts).length)throw new Error('No client-cost amounts were supplied.');
 for(let index=0;index<CLIENT_SALARY_COLUMNS.length;index++){
  const column=CLIENT_SALARY_COLUMNS[index],value=(row.record[column]??'').trim();if(!value||column in costColumns||column==='Status')continue;
  if(column==='Advance Salary Paid')throw new Error('Advance Salary Paid needs its payment-data mapping confirmed. Review advances separately.');
  const expected=employee.values[index]??'';
  if(index>=13&&index<=25||index>=35&&index<=38){if(toMinor(value)!==toMinor(expected||'0'))throw new Error(`${column} differs from saved payroll. Correct the payroll inputs and recalculate first.`);}
  else if(index===2||index===3){if(spreadsheetDate(value)!==expected)throw new Error(`${column} differs from the employee record.`);}
  else if(index===11||index===12){if(!/^\d+(\.5)?$/.test(value)||Number(value)!==Number(expected))throw new Error(`${column} differs from saved attendance.`);}
  else if(value.replace(/\s+/g,' ').toLowerCase()!==expected.trim().replace(/\s+/g,' ').toLowerCase())throw new Error(`${column} differs from the employee record. Review that record first.`);
 }
 return{record:row.record,employeeId:employee.employeeId,expectedVersion:employee.cost?.version??0,amounts};
}
