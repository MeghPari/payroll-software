import { tenantApi } from '@/lib/tenant-api';
import { useSessionStore } from '@/store/session-store';
import { RequestError } from '@/lib/api-client';
import type { EmployeeDocument,DOCUMENT_TYPES } from '@/domain/documents';
export function getEmployeeDocuments(employeeId:string){return tenantApi<EmployeeDocument[]>(`employees/documents?employeeId=${encodeURIComponent(employeeId)}`);}
export function reviewDocument(document:EmployeeDocument,status:'Verified'|'Rejected'|'Removed',reason:string){return tenantApi<{cleanupPending:boolean}>('employees/documents',{method:'PATCH',body:JSON.stringify({id:document.id,expectedVersion:document.version,status,reason})});}
export async function uploadDocument(employeeId:string,documentType:typeof DOCUMENT_TYPES[number],file:File){
 const companyId=useSessionStore.getState().companyId;if(!companyId)throw new Error('Select an authorized company.');
 const form=new FormData();form.set('employeeId',employeeId);form.set('documentType',documentType);form.set('file',file);
 const response=await fetch('/api/employees/documents',{method:'POST',headers:{'x-company-id':companyId},body:form,credentials:'same-origin',cache:'no-store'}),payload=await response.json();
 if(!response.ok)throw new RequestError(response.status,payload.error?.code??'UPLOAD_FAILED',payload.error?.message??'Upload failed.');return payload.data as {id:string};
}
export async function downloadDocument(document:EmployeeDocument){
 const companyId=useSessionStore.getState().companyId;if(!companyId)throw new Error('Select an authorized company.');
 const response=await fetch(`/api/employees/documents?id=${document.id}`,{headers:{'x-company-id':companyId},credentials:'same-origin',cache:'no-store'});
 if(!response.ok){const payload=await response.json();throw new Error(payload.error?.message??'Download failed.');}
 const url=URL.createObjectURL(await response.blob()),link=window.document.createElement('a');link.href=url;link.download=document.original_name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
