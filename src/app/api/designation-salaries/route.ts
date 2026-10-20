import {z} from 'zod';
import {tenant} from '@/server/auth';
import {ApiError,body,databaseError,endpoint,result} from '@/server/http';
const money=z.number().int().nonnegative().max(9000000000000);
export const GET=endpoint(async request=>{
 const namesOnly=new URL(request.url).searchParams.get('namesOnly')==='true';
 const{client,companyId}=await tenant(request,namesOnly?'employees.read':'salary.read');
 if(namesOnly){const response=await client.rpc('list_designation_salary_names',{c:companyId});databaseError(response.error);return result(response.data);}
 const response=await client.from('designation_salary_presets').select('id,designation_name,structure_id,amounts,active,version').eq('company_id',companyId).order('designation_name');databaseError(response.error);return result(response.data);
});
export const POST=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'salary.write');
 const p=await body(request,z.discriminatedUnion('action',[
  z.object({action:z.literal('initialize')}).strict(),
  z.object({action:z.literal('apply')}).strict(),
  z.object({action:z.literal('use'),employeeId:z.string().uuid(),effectiveDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),expectedVersion:z.number().int().positive()}).strict(),
  z.object({action:z.literal('save'),id:z.string().uuid(),expectedVersion:z.number().int().positive(),name:z.string().trim().min(1).max(100),active:z.boolean(),amounts:z.object({basic:money,da:money,hra:money,other:money}).strict()}).strict()
 ]));
 const response=p.action==='initialize'?await client.rpc('initialize_designation_presets',{c:companyId}):p.action==='apply'?await client.rpc('apply_designation_salaries',{c:companyId}):p.action==='use'?await client.rpc('use_employee_designation_salary',{c:companyId,e:p.employeeId,effective:p.effectiveDate,expected_version:p.expectedVersion}):await client.rpc('save_designation_salary_preset',{c:companyId,preset:p.id,expected_version:p.expectedVersion,title:p.name,amounts_json:p.amounts,is_active:p.active});
 if(response.error?.code==='22023'&&response.error.message==='No active preset matches this designation. Use Other / Custom salary.')throw new ApiError(422,'DESIGNATION_NOT_CONFIGURED',response.error.message);
 if(response.error?.code==='23505')throw new ApiError(409,'SALARY_CONFLICT','A salary revision or designation with this date/name already exists. Review the saved salary history before retrying.');
 databaseError(response.error);return result({affected:p.action==='apply'?response.data:undefined,id:p.action==='use'?response.data:undefined});
});
