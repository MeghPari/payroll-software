import {z} from 'zod';
import {employeeDatasetInput} from '@/domain/client-employee';
import {tenant} from '@/server/auth';
import {body,databaseError,endpoint,result,ApiError} from '@/server/http';
export const POST=endpoint(async request=>{
 const{client,companyId,user}=await tenant(request,'employees.write');
 const input=await body(request,z.object({rows:z.array(employeeDatasetInput).min(1).max(500),updateExisting:z.boolean().default(false),expectedVersions:z.record(z.number().int().positive()).default({})}).strict(),1_000_000);
 const response=await client.rpc('import_employee_dataset',{c:companyId,rows_json:input.rows,update_existing:input.updateExisting,expected_versions:input.expectedVersions});
 if(response.error?.code==='P0051')throw new ApiError(422,'DATASET_REVIEW_REQUIRED',response.error.message);
 if(response.error?.code==='23505')throw new ApiError(409,'EMPLOYEE_EXISTS','An employee code, salary revision date or statutory identifier conflicts with a saved record. Review the file and update settings. No rows were imported.');
 if(response.error?.code==='22023'&&response.error.message==='Reporting manager must uniquely match an active company employee code or full name')throw new ApiError(422,'MANAGER_NOT_RESOLVED','Reporting Manager must match one active employee in this company or import file. Use their exact employee code if names are duplicated. No rows were imported.');
 if(response.error?.code==='23514'&&response.error.message==='Structured gross does not match components')throw new ApiError(422,'STRUCTURED_GROSS_MISMATCH','S. Gross must equal the structured Basic, DA, HRA and Other Allowance amounts. No rows were imported.');
 databaseError(response.error);
 return result({id:response.data,fileName:'Client employee template',kind:'Employee',uploadedBy:user.id,uploadedOn:new Date().toISOString(),totalRows:input.rows.length,validRows:input.rows.length,errorRows:0,status:'Completed'},201);
});
