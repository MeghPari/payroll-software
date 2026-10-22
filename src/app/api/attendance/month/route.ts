import {z} from 'zod';
import {tenant} from '@/server/auth';
import {ApiError,body,databaseError,endpoint,result} from '@/server/http';
const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'attendance.delete');
 const value=month.parse(new URL(request.url).searchParams.get('month'));
 const response=await client.rpc('attendance_month_delete_preview',{c:companyId,m:value+'-01'});databaseError(response.error);return result(response.data);
});
export const DELETE=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'attendance.delete');
 const input=await body(request,z.object({month,confirmedMonth:month,expectedRevision:z.string().regex(/^(?:\d{1,20}|[a-f0-9]{32})$/),expectedCount:z.number().int().nonnegative().max(2147483647),reason:z.string().trim().min(3).max(1000),acknowledgePayrollReset:z.boolean().default(false)}).strict().refine(value=>value.month===value.confirmedMonth,{message:'Type the selected month to confirm deletion.',path:['confirmedMonth']}));
 const response=await client.rpc('reset_attendance_payroll_month',{c:companyId,m:input.month+'-01',expected_revision:input.expectedRevision,expected_count:input.expectedCount,remark:input.reason,confirm_payroll:input.acknowledgePayrollReset});
 if(response.error?.code==='P0050')throw new ApiError(409,'ATTENDANCE_PROTECTED',response.error.message);
 if(response.error?.code==='40001')throw new ApiError(409,'DELETION_PREVIEW_CHANGED','Attendance or payroll inputs changed. Close this dialog and review the deletion again.');
 databaseError(response.error);return result({deleted:response.data});
});
