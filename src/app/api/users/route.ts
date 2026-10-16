import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError, body, databaseError, endpoint, result } from '@/server/http';
export const GET = endpoint(async request => {
  const { client, companyId } = await tenant(request, 'users.manage');
  const members=[];
  for(let offset=0;;offset+=500){
    let response = await client.rpc('list_company_members',{c:companyId}).order('user_id').range(offset,offset+499);
    if(response.error&&['PGRST202','42883'].includes(response.error.code))response=await client.from('user_company_roles').select('user_id,role,active,created_at').eq('company_id',companyId).order('user_id').range(offset,offset+499);
    databaseError(response.error);members.push(...(response.data??[]));if((response.data?.length??0)<500)break;
  }
  return result(members);
});
export const POST = endpoint(async request => {
  const { client, companyId } = await tenant(request, 'users.manage');
  const input = await body(request, z.object({ userId: z.string().uuid().optional(), email:z.string().trim().email().max(254).optional(),role: z.enum(['Super Admin','HR Admin','Payroll Admin','Finance','Manager','Employee']), active: z.boolean() }).strict().refine(value=>!!value.userId!==!!value.email,{message:'Provide either an account email or user ID.'}));
  const response = input.email?await client.rpc('set_company_member_by_email',{c:companyId,email_text:input.email,next_role:input.role,is_active:input.active}):await client.rpc('set_company_member', { c: companyId, target_user: input.userId!, next_role: input.role, is_active: input.active });
  if(response.error?.code==='P0002')throw new ApiError(404,'ACCOUNT_NOT_READY','Confirmed account not found. Create or invite the user in Supabase Authentication first, then assign access here.');
  if(response.error?.code==='22023')throw new ApiError(422,'MEMBERSHIP_INVALID','You cannot change your own company access. Ask another authorized administrator.');
  databaseError(response.error); return result({ updated: true });
});
