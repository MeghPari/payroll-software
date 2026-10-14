import 'server-only';
import { z } from 'zod';
import { db } from './supabase';
import { authenticated } from './auth';
import { ApiError, body, databaseError, endpoint, result } from './http';
import { getEnv } from './env';
import { authenticationFailure } from '@/domain/authentication-errors';
import { cookies } from 'next/headers';
import { localSignoutCookie } from '@/lib/session-cookie';
async function markSignedOut(value:boolean){(await cookies()).set(localSignoutCookie(getEnv().SUPABASE_URL),value?'1':'',{path:'/',httpOnly:true,sameSite:'lax',secure:new URL(getEnv().APP_URL).protocol==='https:',maxAge:value?34560000:0});}

export const login = endpoint(async request => {
  const input = await body(request, z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).strict());
  const client = await db(request.signal);
  const { error } = await client.auth.signInWithPassword(input);
  if (error) {
    console.error('Sign-in provider rejected request',{name:error.name,status:error.status});
    const failure = authenticationFailure(error);
    throw new ApiError(failure.status, failure.code, failure.message);
  }
  await markSignedOut(false);
  try { await authenticated(request.signal); } catch (error) { if(error instanceof ApiError&&[401,403].includes(error.status)){await markSignedOut(true);await client.auth.signOut();}throw error; }
  return result({ signedIn: true });
});
export const logout = endpoint(async () => {
 const jar=await cookies(),base=`sb-${new URL(getEnv().SUPABASE_URL).hostname.split('.')[0]}-auth-token`;let confirmed=false;
 await markSignedOut(true);
 try{const client=await db(),response=await client.auth.signOut();confirmed=!response.error;}catch{confirmed=false;}
 for(const cookie of jar.getAll())if(cookie.name===base||cookie.name.startsWith(base+'.')||cookie.name===base+'-code-verifier'||cookie.name.startsWith(base+'-code-verifier.'))jar.set(cookie.name,'',{path:'/',httpOnly:true,sameSite:'lax',secure:getEnv().APP_URL.startsWith('https://'),maxAge:0});
 return result({signedOut:true,remoteRevocationConfirmed:confirmed});
});
export const session = endpoint(async request => {
  const { client, user } = await authenticated(request.signal,false);
  const context=await client.rpc('session_context');
  if(!context.error)return result({user:{id:user.id,email:user.email},...context.data});
  if(!['PGRST202','42883'].includes(context.error.code)){if(context.error.code==='42501'&&context.error.message==='Account inactive or not provisioned')throw new ApiError(403,'ACCOUNT_INACTIVE','Your account is inactive or has not been provisioned.');databaseError(context.error);}
  const profile=await client.from('user_profiles').select('active').eq('id',user.id).maybeSingle();databaseError(profile.error);if(!profile.data?.active)throw new ApiError(403,'ACCOUNT_INACTIVE','Your account is inactive or has not been provisioned.');
  const memberships = await client.from('user_company_roles').select('company_id,role,companies(id,name)').eq('user_id', user.id).eq('active', true);
  databaseError(memberships.error);
  const permissions = await client.from('role_permissions').select('role,permission');
  databaseError(permissions.error);
  return result({ user: { id: user.id, email: user.email }, memberships: memberships.data, permissions: permissions.data });
});
export const resetPassword = endpoint(async request => {
  const { email } = await body(request, z.object({ email: z.string().email().max(254) }).strict());
  const client = await db(request.signal);
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: new URL('/login?reset=1', getEnv().APP_URL).href });
  if (error && error.status === 429) throw new ApiError(429, 'RATE_LIMITED', 'Please wait before requesting another email.');
  if (error) throw new ApiError(502, 'AUTH_PROVIDER_ERROR', 'The email request could not be processed.');
  return result({ message: 'If the account is eligible, a password reset email will be sent.' });
});
export const updatePassword = endpoint(async request => {
  if((await cookies()).get(localSignoutCookie(getEnv().SUPABASE_URL))?.value==='1')throw new ApiError(401,'UNAUTHENTICATED','Open a valid recovery link first.');
  const { password } = await body(request, z.object({ password: z.string().min(12).max(200) }).strict());
  const client = await db(request.signal);
  const verified = await client.auth.getUser();
  if(verified.error){const failure=authenticationFailure(verified.error,'session');if(failure.status!==401)throw new ApiError(failure.status,failure.code,failure.message);}
  if (verified.error || !verified.data.user) throw new ApiError(401, 'UNAUTHENTICATED', 'Open a valid recovery link first.');
  const { error } = await client.auth.updateUser({ password });
  if(error){const failure=authenticationFailure(error,'session');if(failure.status!==401)throw new ApiError(failure.status,failure.code,failure.message);}
  if (error) throw new ApiError(422, 'PASSWORD_REJECTED', 'Password does not meet the authentication policy.');
  const signedOut = await client.auth.signOut({ scope: 'global' });
  await markSignedOut(true);
  if (signedOut.error) throw new ApiError(502, 'LOGOUT_FAILED', 'Password changed, but session revocation failed. Contact your administrator.');
  return result({ updated: true });
});
