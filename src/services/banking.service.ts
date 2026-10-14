import { tenantApi } from '@/lib/tenant-api';
export interface BankData {accounts:{id:string;account_id:string;kind:'Bank'|'Cash';name:string;bank_name:string;account_number:string;ifsc:string;balanceMinor:number}[];transactions:{id:string;bank_id:string;date:string;direction:'Inflow'|'Outflow';amount_minor:number;reference:string;status:'Confirmed'|'Reversed';confirmed_at:string}[];cashFlow:{month:string;inflow:number;outflow:number}[]}
export function getBanking(){return tenantApi<BankData>('banking');}
