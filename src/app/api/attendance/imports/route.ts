import{z}from 'zod';import{tenant}from '@/server/auth';import{body,databaseError,endpoint,result}from '@/server/http';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'attendance.read');const response=await client.from('attendance_import_batches').select('id,actor_id,row_count,created_at').eq('company_id',companyId).order('created_at',{ascending:false}).limit(100);databaseError(response.error);
 return result(response.data?.map(row=>({id:row.id,fileName:'CSV attendance import',uploadedBy:row.actor_id,uploadedOn:row.created_at,recordsProcessed:row.row_count,status:'Completed'})));
});
export const POST=endpoint(async request=>{
 const{client,companyId,user}=await tenant(request,'attendance.write');const p=await body(request,z.object({reason:z.string().min(1).max(1000),rows:z.array(z.object({employeeId:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),status:z.enum(['Present','Absent','Paid Leave','Unpaid Leave','Half Day','Weekly Off','Holiday','Work From Home','Missing Punch']),shift:z.string().max(100),checkIn:z.string().max(8),checkOut:z.string().max(8),workMinutes:z.number().int().min(0).max(1440),overtimeMinutes:z.number().int().min(0).max(1440),leaveType:z.string().max(100),remarks:z.string().max(1000)}).strict()).min(1).max(1000)}).strict());
 const response=await client.rpc('import_attendance',{c:companyId,rows_json:p.rows,reason_text:p.reason});databaseError(response.error);
 return result({id:response.data,kind:'Attendance',fileName:'CSV attendance import',uploadedBy:user.id,uploadedOn:new Date().toISOString(),totalRows:p.rows.length,validRows:p.rows.length,errorRows:0,status:'Completed'},201);
});
