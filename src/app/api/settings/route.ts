import { z } from 'zod';
import { tenant } from '@/server/auth';
import { body, databaseError, endpoint, result } from '@/server/http';
const schema = z.object({ expectedVersion:z.number().int().positive(),payroll: z.object({ proration: z.enum(['calendar','working']), rounding: z.enum(['half-up','down']), currency: z.literal('INR') }).strict(), notifications: z.object({ payroll: z.boolean(), leave: z.boolean() }).strict() }).strict();
export const GET = endpoint(async request => {
  const { client, companyId } = await tenant(request, 'settings.write');
  const response = await client.from('company_settings').select('settings,updated_at,version').eq('company_id', companyId).single();
  databaseError(response.error); return result(response.data);
});
export const PUT = endpoint(async request => {
  const { client, companyId } = await tenant(request, 'settings.write');
  const input = await body(request, schema);
  const response = await client.rpc('save_versioned_company_settings', { c: companyId, p: {payroll:input.payroll,notifications:input.notifications},expected_version:input.expectedVersion });
  databaseError(response.error); return result({ updated: true });
});
