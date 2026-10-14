import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { providerFetch } from '@/lib/provider-fetch';
import { authenticationFailure } from '@/domain/authentication-errors';
import { localSignoutCookie } from '@/lib/session-cookie';

// Navigation/session guard only. API handlers independently authorize all data.
export async function proxy(request: NextRequest) {
  const projectUrl = process.env.SUPABASE_URL?.trim();
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!projectUrl || !publicKey) {
    const redirect = NextResponse.redirect(new URL('/login', request.url));
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  }
  if(request.cookies.get(localSignoutCookie(projectUrl))?.value==='1'){const redirect=NextResponse.redirect(new URL('/login',request.url));redirect.headers.set('Cache-Control','private, no-store');return redirect;}
  let response = NextResponse.next({ request });
  const client = createServerClient(projectUrl, publicKey, {
    global:{fetch:providerFetch(request.signal)},
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.APP_URL?.startsWith('https://') ?? false, path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: values => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
      },
    },
  });
  const { data, error } = await client.auth.getUser();
  if(error&&authenticationFailure(error,'session').status!==401){
    const failure=authenticationFailure(error,'session'),unavailable=new NextResponse(failure.message,{status:failure.status,headers:{'Cache-Control':'private, no-store','Content-Type':'text/plain; charset=utf-8','Retry-After':'30'}});
    for(const cookie of response.cookies.getAll())unavailable.cookies.set(cookie);return unavailable;
  }
  if (error || !data.user) {
    const redirect = NextResponse.redirect(new URL('/login', request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: ['/((?!api(?:/|$)|auth(?:/|$)|login(?:/|$)|_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
};
