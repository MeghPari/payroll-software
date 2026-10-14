import { z } from 'zod';
import { tenant } from '@/server/auth';
import { body, databaseError, endpoint, result } from '@/server/http';
export const GET = endpoint(async request => {
  const { client, companyId } = await tenant(request, 'users.manage');
  const members=[];
  for(let offset=0;;offset+=500){
    const response = await client.from('user_company_roles').select('user_id,role,active,created_at').eq('company_id', companyId).order('user_id').range(offset,offset+499);
    databaseError(response.error);members.push(...(response.data??[]));if((response.data?.length??0)<500)break;
  }
  return result(members);
});
export const POST = endpoint(async request => {
  const { client, companyId } = await tenant(request, 'users.manage');
  const input = await body(request, z.object({ userId: z.string().uuid(), role: z.enum(['Super Admin','HR Admin','Payroll Admin','Finance','Manager','Employee']), active: z.boolean() }).strict());
  const response = await client.rpc('set_company_member', { c: companyId, target_user: input.userId, next_role: input.role, is_active: input.active });
  databaseError(response.error); return result({ updated: true });
});
