import{z}from 'zod';import{tenant}from '@/server/auth';import{body,databaseError,endpoint,result}from '@/server/http';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request);const responses=await Promise.all([
  client.from('leave_requests').select('id,employee_id,from_date,to_date,days,reason,status,applied_at,leave_types(name)').eq('company_id',companyId).order('applied_at',{ascending:false}).limit(1000),
  client.from('leave_types').select('*').eq('company_id',companyId).order('name'),
  client.from('employee_leave_balances').select('employee_id,type_id,period_start,period_end,allocated_days,used_days,leave_types(name)').eq('company_id',companyId).limit(1000),
 ]);for(const response of responses)databaseError(response.error);return result({requests:responses[0].data,types:responses[1].data,balances:responses[2].data});
});
const uuid=z.string().uuid(),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const POST=endpoint(async request=>{
 const{client,companyId}=await tenant(request);const input=await body(request,z.discriminatedUnion('action',[
  z.object({action:z.literal('request'),employeeId:uuid,typeId:uuid,from:date,to:date,reason:z.string().trim().min(1).max(1000)}).strict(),
  z.object({action:z.literal('decision'),id:uuid,status:z.enum(['Approved','Rejected'])}).strict(),
  z.object({action:z.literal('policy'),name:z.enum(['Casual Leave','Sick Leave','Earned Leave','Maternity Leave','Unpaid Leave']),paid:z.boolean(),workingDays:z.array(z.number().int().min(1).max(7)).min(1).max(7)}).strict(),
  z.object({action:z.literal('allocate'),employeeId:uuid,typeId:uuid,from:date,to:date,days:z.number().int().min(0).max(366)}).strict(),
 ]));
 let response;
 if(input.action==='request')response=await client.rpc('request_leave',{c:companyId,e:input.employeeId,t:input.typeId,start_date:input.from,end_date:input.to,reason_text:input.reason});
 else if(input.action==='decision')response=await client.rpc('decide_leave',{c:companyId,r:input.id,next_status:input.status});
 else if(input.action==='policy')response=await client.rpc('save_leave_policy',{c:companyId,name_text:input.name,is_paid:input.paid,weekdays:input.workingDays});
 else response=await client.rpc('allocate_leave',{c:companyId,e:input.employeeId,t:input.typeId,start_date:input.from,end_date:input.to,days_value:input.days});
 databaseError(response.error);return result({id:response.data,updated:true});
});
