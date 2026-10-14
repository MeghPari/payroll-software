import type { DisbursementBatch } from './disbursement';import { decimalMinor } from './accounting-reports';import { escapeCSV } from './csv';
export interface PaymentInstructionExporter{mode:'manual';prepare(batch:DisbursementBatch,retry?:{id:string;employeeId:string;amountMinor:number}):string}
export const manualInstructionExporter:PaymentInstructionExporter={mode:'manual',prepare(batch,retry){
 const selected=retry?batch.items.filter(item=>item.employeeId===retry.employeeId):batch.items;
 if(retry&&selected.length!==1)throw new Error('Retry employee is not in the prepared batch.');
 const rows=selected.filter(item=>Number(item.amountMinor)>Number(item.paidMinor)).map(item=>{
  const outstanding=Number(item.amountMinor)-Number(item.paidMinor),amount=retry?retry.amountMinor:outstanding;
  if(!Number.isSafeInteger(amount)||amount<=0||amount>outstanding)throw new Error('Retry exceeds the current outstanding salary.');
  if(!/^\d{6,30}$/.test(item.bank.accountNumber)||! /^[A-Z]{4}0[A-Z0-9]{6}$/.test(item.bank.ifscCode)||!item.bank.accountHolderName.trim())throw new Error('Captured verified bank instructions are unavailable.');
  return[item.employeeCode,item.employeeName,item.bank.accountHolderName,item.bank.accountNumber,item.bank.ifscCode,item.bank.bankName,decimalMinor(amount),retry?.id??`${batch.id}/${item.employeeId}`];
 });
 if(retry&&!rows.length)throw new Error('This salary is already fully recorded as paid.');
 return[['Employee Code','Employee Name','Account Holder','Account Number','IFSC','Bank Name','Instruction Amount INR','Instruction ID'],...rows].map(row=>row.map(escapeCSV).join(',')).join('\r\n');
}};
