import {tenant} from '@/server/auth';
import {ApiError,endpoint,result} from '@/server/http';
import {DEPARTMENT_DESIGNATIONS} from '@/domain/department-designations';
export const GET=endpoint(async request=>{
 const namesOnly=new URL(request.url).searchParams.get('namesOnly')==='true';
 await tenant(request,namesOnly?'employees.read':'salary.read');
 return result(namesOnly?DEPARTMENT_DESIGNATIONS:[]);
});
export const POST=endpoint(async request=>{
 await tenant(request,'salary.write');
 throw new ApiError(410,'DATASET_SALARY_REQUIRED','Upload the employee dataset to save salary components. Designation salary presets are disabled.');
});
