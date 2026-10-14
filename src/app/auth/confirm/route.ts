import { z } from 'zod';
import { db } from '@/server/supabase';
import { endpoint,ApiError } from '@/server/http';
import { authenticationFailure } from '@/domain/authentication-errors';
import { getEnv } from '@/server/env';
import { cookies } from 'next/headers';
import { localSignoutCookie } from '@/lib/session-cookie';

export const GET = endpoint(async request => {
  const url = new URL(request.url);
  const token = z.string().min(1).max(2048).parse(url.searchParams.get('token_hash'));
  const client = await db(request.signal);
  const { error } = await client.auth.verifyOtp({ token_hash: token, type: 'recovery' });
  if(error){const failure=authenticationFailure(error,'session');if(failure.status!==401)throw new ApiError(failure.status,failure.code,failure.message);}
  if(!error)(await cookies()).set(localSignoutCookie(getEnv().SUPABASE_URL),'',{path:'/',httpOnly:true,sameSite:'lax',secure:new URL(getEnv().APP_URL).protocol==='https:',maxAge:0});
  return Response.redirect(new URL(error ? '/login?error=recovery' : '/login?reset=1', getEnv().APP_URL), 303);
});
