import {employeeSetupWarnings} from '@/domain/payroll-setup';
import { tenantApi } from '@/lib/tenant-api';
import { useSessionStore } from '@/store/session-store';
import { monthKey,monthLabel } from '@/domain/dates';
import type { Payslip } from '@/types';
interface Row{id:string;employee_id:string;month:string;status:'Draft'|'Published';published_at:string|null;content:{setupWarnings?:unknown;employeeName:string;employeeCode:string;grossMinor:number;deductionMinor:number;netMinor:number;earnings:Record<string,number>;deductions:Record<string,number>}}
export async function getPayslips(month?:string,employeeId?:string):Promise<Payslip[]>{
 const params=new URLSearchParams();if(month)params.set('month',`${monthKey(month)}-01`);if(employeeId)params.set('employeeId',employeeId);
 return(await tenantApi<Row[]>(`payslips?${params}`)).map(row=>({id:row.id,setupWarnings:employeeSetupWarnings(row.content.setupWarnings,row.employee_id),employeeId:row.employee_id,employeeName:row.content.employeeName,employeeCode:row.content.employeeCode,department:'',month:monthLabel(row.month.slice(0,7)),status:row.status==='Draft'?'Generated':'Published',publishedOn:row.published_at??undefined,grossSalary:row.content.grossMinor/100,totalDeductions:row.content.deductionMinor/100,netPayable:row.content.netMinor/100,earnings:Object.entries(row.content.earnings).map(([name,value])=>({name,amount:value/100})),deductions:Object.entries(row.content.deductions).map(([name,value])=>({name,amount:value/100}))}));
}
export async function getPayslipById(id:string){return(await getPayslips()).find(row=>row.id===id);}
export async function payslipAction(month:string,action:'generate'|'publish'){return tenantApi<{count:number}>('payslips',{method:'POST',body:JSON.stringify({month:`${monthKey(month)}-01`,action})});}
export async function publishPayslips(ids:string[]):Promise<Payslip[]>{void ids;throw new Error('Publish payslips through the reviewed payroll month workflow.');}
export async function reprocessFailedPayslips():Promise<number>{throw new Error('Select the locked payroll month and generate its payslips.');}
export async function downloadPayslip(id:string){
 const companyId=useSessionStore.getState().companyId;if(!companyId)throw new Error('Select an authorized company.');
 const response=await fetch(`/api/payslips/pdf?id=${encodeURIComponent(id)}`,{headers:{'x-company-id':companyId},credentials:'same-origin',cache:'no-store'});
 if(!response.ok){const payload=await response.json();throw new Error(payload.error?.message??'Unable to download payslip.');}
 const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=`payslip-${id}.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export async function getPayslipDashboard(month:string,signal?:AbortSignal){return tenantApi<import('@/domain/payslips-module').PayslipDashboard>(`payslips/dashboard?month=${monthKey(month)}-01`,{signal});}
export function managePayslips(month:string,action:'generate'|'regenerate'|'publish',ids:string[]){return tenantApi<{count:number}>('payslips/manage',{method:'POST',body:JSON.stringify({month:`${monthKey(month)}-01`,action,ids})});}
export function emailPayslips(ids:string[],requestKey:string){return tenantApi<{results:{id:string;status:string;message?:string}[]}>('payslips/email',{method:'POST',body:JSON.stringify({ids,requestKey})});}
export function getPayslipHistory(id:string){return tenantApi<{emails:import('@/domain/payslips-module').PayslipEmailAttempt[];revisions:import('@/domain/payslips-module').PayslipRevision[]}>(`payslips/manage?id=${encodeURIComponent(id)}`);}
export async function payslipFile(path:string,ids?:string[]){
 const companyId=useSessionStore.getState().companyId;if(!companyId)throw new Error('Select an authorized company.');
 const response=await fetch(`/api/payslips/${path}`,{method:ids?'POST':'GET',headers:{'x-company-id':companyId,...(ids?{'Content-Type':'application/json'}:{})},body:ids?JSON.stringify({ids}):undefined,credentials:'same-origin',cache:'no-store'});
 if(!response.ok){const payload=await response.json();throw new Error(payload.error?.message??'Unable to create payslip download.');}return response.blob();
}
export function savePayslipFile(blob:Blob,name:string){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
