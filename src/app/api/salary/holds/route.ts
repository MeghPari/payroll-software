import {z}from 'zod';import{tenant}from '@/server/auth';import{body,databaseError,endpoint,result}from '@/server/http';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'salary.read');const id=z.string().uuid().parse(new URL(request.url).searchParams.get('employeeId'));
 const response=await client.from('salary_holds').select('*').eq('company_id',companyId).eq('employee_id',id).order('held_at',{ascending:false});databaseError(response.error);
 return result(response.data?.map(row=>({id:row.id,employeeId:row.employee_id,month:row.month.slice(0,7),reason:row.reason,remarks:row.remarks,heldBy:row.held_by,heldOn:row.held_at,releasedBy:row.released_by,releasedOn:row.released_at,releaseRemarks:row.release_remarks,status:row.released_at?'Released':'Held'})));
});
export const POST=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'salary.write');const p=await body(request,z.object({employeeId:z.string().uuid(),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),release:z.boolean(),reason:z.string().trim().min(1).max(1000),remarks:z.string().max(1000)}).strict());
 const response=await client.rpc('salary_hold',{c:companyId,e:p.employeeId,m:`${p.month}-01`,release_hold:p.release,reason_text:p.reason,remarks_text:p.remarks});databaseError(response.error);return result({updated:true});
});
