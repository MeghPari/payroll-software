import 'server-only';
import { z } from 'zod';

const schema = z.object({
  SUPABASE_URL: z.string().trim().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(20),
  APP_URL: z.string().trim().url(),
});
export function getEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) throw new Error('BACKEND_NOT_CONFIGURED');
  return result.data;
}
