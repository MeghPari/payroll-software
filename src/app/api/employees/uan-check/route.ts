import { z } from 'zod';
import { tenant } from '@/server/auth';
import { databaseError, endpoint, result } from '@/server/http';
export const GET = endpoint(async request => {
  const {client,companyId} = await tenant(request,'employees.sensitive');
  const params = new URL(request.url).searchParams;
  const uan = z.string().regex(/^[0-9]{12}$/).parse(params.get('uan'));
  let query = client.from('employee_statutory_details').select('employee_id').eq('company_id',companyId).eq('uan',uan);
  if (params.has('exclude')) query=query.neq('employee_id',z.string().uuid().parse(params.get('exclude')));
  const response = await query.maybeSingle(); databaseError(response.error);
  return result(response.data);
});
