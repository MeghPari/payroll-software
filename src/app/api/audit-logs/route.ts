import { z } from 'zod';
import { tenant } from '@/server/auth';
import { databaseError, endpoint, result } from '@/server/http';
export const GET = endpoint(async request => {
  const { client, companyId } = await tenant(request, 'audit.read');
  const page = z.coerce.number().int().min(1).parse(new URL(request.url).searchParams.get('page') ?? 1);
  const response = await client.from('audit_logs').select('id,actor_id,action,entity_type,entity_id,metadata,created_at', { count: 'exact' }).eq('company_id', companyId).order('created_at', { ascending: false }).order('id').range((page - 1) * 50, page * 50 - 1);
  databaseError(response.error); return result({ items: response.data, total: response.count, page });
});
