export interface DisbursementBatch {
 id:string;runId:string;runVersion:number;bankId:string;preparedAt:string;
 items:{employeeId:string;employeeCode:string;employeeName:string;amountMinor:number;paidMinor:number;bank:{accountHolderName:string;accountNumber:string;ifscCode:string;bankName:string}}[];
 payments:{employeeId:string;transactionId:string;amountMinor:number;date:string;reference:string;status:'Confirmed'|'Reversed'}[];
}
