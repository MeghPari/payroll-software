import 'server-only';
import { requestBucket } from '@/domain/request-bucket';
let missingLimitNotice=false;
import { z } from 'zod';
import { db } from './supabase';
import { ApiError, databaseError } from './http';
import { authenticationFailure } from '@/domain/authentication-errors';
import { cookies } from 'next/headers';
import { localSignoutCookie } from '@/lib/session-cookie';
import { getEnv } from './env';

export async function authenticated(signal?:AbortSignal,verifyProfile=true) {
  if((await cookies()).get(localSignoutCookie(getEnv().SUPABASE_URL))?.value==='1')throw new ApiError(401,'UNAUTHENTICATED','Sign in to continue.');
  const client = await db(signal);
  // getUser verifies with Auth, including revoked sessions; never trust getSession.
  const { data, error } = await client.auth.getUser();
  if(error){const failure=authenticationFailure(error,'session');throw new ApiError(failure.status,failure.code,failure.message);}
  if (!data.user) throw new ApiError(401,'UNAUTHENTICATED','Sign in to continue.');
  if(verifyProfile){const profile = await client.from('user_profiles').select('active').eq('id',data.user.id).maybeSingle();
  databaseError(profile.error);
  if (!profile.data?.active) throw new ApiError(403,'ACCOUNT_INACTIVE','Your account is inactive or has not been provisioned.');
  }
  return { client, user: data.user };
}
export async function tenant(request: Request, permission?: string) {
  const { client, user } = await authenticated(request.signal,false);
  const companyId = z.string().uuid().parse(request.headers.get('x-company-id')).toLowerCase();
  const access=await client.rpc('authorize_company_request',{c:companyId,permission_code:permission??null,bucket_name:requestBucket(request)});
  if(!access.error){if(access.data?.allowed!==true)throw new ApiError(429,'RATE_LIMITED','Too many requests. Wait briefly and retry.',Number(access.data?.retrySeconds??60));return{client,user,companyId,role:access.data.role as string};}
  if(!['PGRST202','42883'].includes(access.error.code))databaseError(access.error);
  // Compatibility until migration 040 is applied: retain all existing checks.
  const profile=await client.from('user_profiles').select('active').eq('id',user.id).maybeSingle();databaseError(profile.error);if(!profile.data?.active)throw new ApiError(403,'ACCOUNT_INACTIVE','Your account is inactive or has not been provisioned.');
  const membership = await client.from('user_company_roles').select('role').eq('company_id',companyId).eq('user_id',user.id).eq('active',true).maybeSingle();
  databaseError(membership.error);
  if (!membership.data) throw new ApiError(403,'NOT_A_MEMBER','Company access is not allowed.');
  if (permission) {
    const check = await client.rpc('has_permission',{ c:companyId, permission_code:permission });
    databaseError(check.error);
    if (check.data !== true) throw new ApiError(403,'FORBIDDEN','Permission denied.');
  }
  const limited=await client.rpc('consume_application_request',{c:companyId,bucket_name:requestBucket(request)});
  if(limited.error&&['PGRST202','42883'].includes(limited.error.code)){if(!missingLimitNotice){console.warn('Application request limits await migration 034.');missingLimitNotice=true;}}
  else{databaseError(limited.error);if(limited.data?.allowed!==true)throw new ApiError(429,'RATE_LIMITED','Too many requests. Wait briefly and retry.',Number(limited.data?.retrySeconds??60));}
  return { client, user, companyId, role: membership.data.role as string };
}
