import { tenantApi } from '@/lib/tenant-api';
import type { EmployeeKYC } from "@/types";


export async function getEmployeeKYC(employeeId: string): Promise<EmployeeKYC | undefined> {
  const row=await tenantApi<{requirements?:{aadhaarStatus:EmployeeKYC['aadhaarStatus'];complete:boolean};pf_applicable:boolean|null;esi_applicable:boolean|null;pt_applicable:boolean|null;tds_applicable:boolean|null;pan_status:EmployeeKYC['panStatus'];bank_status:EmployeeKYC['bankStatus'];tax_regime:EmployeeKYC['taxRegime']|null;declaration_status:EmployeeKYC['declarationStatus']}|null>(`employees/kyc?employeeId=${encodeURIComponent(employeeId)}`);
  return {employeeId,applicabilityConfigured:{pfApplicable:row?.pf_applicable!=null,esiApplicable:row?.esi_applicable!=null,ptApplicable:row?.pt_applicable!=null,tdsApplicable:row?.tds_applicable!=null},taxRegimeConfigured:row?.tax_regime!=null,pfApplicable:row?.pf_applicable??false,esiApplicable:row?.esi_applicable??false,ptApplicable:row?.pt_applicable??false,tdsApplicable:row?.tds_applicable??false,panStatus:row?.pan_status??'Not Provided',bankStatus:row?.bank_status??'Not Provided',aadhaarStatus:row?.requirements?.aadhaarStatus??'Not Provided',kycComplete:row?.requirements?.complete??false,taxRegime:row?.tax_regime??'New Regime',declarationStatus:row?.declaration_status??'Pending',documents:[]};
}


export async function updateEmployeeKYC(employeeId: string, data: Partial<EmployeeKYC>): Promise<EmployeeKYC> {
  await tenantApi('employees/kyc',{method:'POST',body:JSON.stringify({employeeId,changes:data})});
  const result=await getEmployeeKYC(employeeId);if(!result)throw new Error('Unable to reload KYC.');return result;
}
