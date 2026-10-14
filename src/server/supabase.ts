import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getEnv } from './env';
import { providerFetch } from '@/lib/provider-fetch';

// New client per request. Only the user's verified JWT reaches Postgres; no service role.
export async function db(signal?:AbortSignal) {
  const env = getEnv();
  const jar = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global:{fetch:providerFetch(signal)},
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: env.APP_URL.startsWith('https://'), path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => { for (const { name, value, options } of values) jar.set(name, value, options); },
    },
  });
}
