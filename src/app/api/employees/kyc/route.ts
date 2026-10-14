import{z}from 'zod';import{tenant}from '@/server/auth';import{body,databaseError,endpoint,result}from '@/server/http';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'employees.sensitive');const id=z.string().uuid().parse(new URL(request.url).searchParams.get('employeeId'));
 const response=await client.from('employee_statutory_details').select('employee_id,pf_applicable,esi_applicable,pt_applicable,tds_applicable,pan_status,bank_status,tax_regime,declaration_status').eq('company_id',companyId).eq('employee_id',id).maybeSingle();databaseError(response.error);return result(response.data);
});
export const POST=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'employees.sensitive');const verification=z.enum(['Verified','Pending Verification','Rejected','Not Provided']);
 const p=await body(request,z.object({employeeId:z.string().uuid(),changes:z.object({pfApplicable:z.boolean().optional(),esiApplicable:z.boolean().optional(),ptApplicable:z.boolean().optional(),tdsApplicable:z.boolean().optional(),taxRegime:z.enum(['Old Regime','New Regime']).optional(),declarationStatus:z.enum(['Pending','Submitted','Verified']).optional(),panStatus:verification.optional(),bankStatus:verification.optional(),overridden:z.boolean().optional()}).strict()}).strict());
 const response=await client.rpc('save_employee_kyc',{c:companyId,e:p.employeeId,p:p.changes});databaseError(response.error);return result({updated:true});
});
