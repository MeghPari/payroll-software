import {tenant}from '@/server/auth';
import {ApiError,body,databaseError,endpoint,result}from '@/server/http';
import {employeeSalaryInput}from '@/domain/employee-salary-input';
export const POST=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'salary.write');
 const p=await body(request,employeeSalaryInput);
 const response=await client.rpc('save_employee_salary_components',{c:companyId,e:p.employeeId,effective:p.effectiveFrom,amounts:p.amounts,reference_values:p.references,expected_version:p.expectedVersion,remarks_text:p.remarks});
 if(response.error?.code==='P0051'||response.error?.code==='23505')throw new ApiError(422,'SALARY_REVISION_REVIEW',response.error.code==='P0051'?response.error.message:'A salary already uses this date. Choose a new revision date.');
 databaseError(response.error);return result({id:response.data},201);
});
