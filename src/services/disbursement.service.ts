import { tenantApi } from '@/lib/tenant-api';
import { monthKey } from '@/domain/dates';
import { useSessionStore } from '@/store/session-store';
import type { DisbursementBatch } from '@/domain/disbursement';
export function getDisbursement(month:string){return tenantApi<DisbursementBatch|null>(`disbursements?month=${monthKey(month)}-01`);}
export async function downloadPaymentInstructions(month:string,retryId?:string){
 const response=await fetch(`/api/disbursements?month=${monthKey(month)}-01&export=csv${retryId?"&retryId="+encodeURIComponent(retryId):""}`,{headers:{'x-company-id':useSessionStore.getState().companyId},credentials:'same-origin',cache:'no-store'});
 if(!response.ok){const body=await response.json();throw new Error(body.error?.message??'Unable to download payment instructions.');}
 const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=`payment-instructions-${monthKey(month)}.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
}
