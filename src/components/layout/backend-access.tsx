'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, RequestError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useSessionStore, type SessionData } from '@/store/session-store';

// Until a module is integrated, do not render its demo financial or employee data.
export function BackendAccess({ children }: { children: ReactNode }) {
  const path = usePathname().replace(/\/+$/, '') || '/';
  const router = useRouter();
  const [state, setState] = useState('Checking your session…');
  const session = useSessionStore(s => s.session);
  const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0),[retrying,setRetrying]=useState(false);
  useEffect(() => {
    if (path === '/login') return;
    let cancelled = false;const controller=new AbortController();
    api<SessionData>('auth/session',{signal:controller.signal}).then(session => { if (!cancelled) { useSessionStore.getState().setSession(session);setFailed(false);setState(session.memberships.length?'Access verified.':'Your account has no active company access. Contact an administrator.'); } }).catch(error => {
      if (cancelled) return;
      setFailed(true);
      if (error instanceof RequestError && [401,403].includes(error.status))useSessionStore.getState().setSession(null);
      if (error instanceof RequestError && error.status === 401) { router.replace('/login'); return; }
      setState(error instanceof Error ? error.message : 'Unable to verify access.');
    }).finally(()=>{if(!cancelled)setRetrying(false);});
    return () => { cancelled = true;controller.abort(); };
  }, [path, router,retry]);
  if (path === '/login') return children;
  if ((['/','/dashboard','/user-roles','/ledgers','/financial-reports','/payroll-reports','/audit-trail','/employees','/salary-structures','/payroll','/attendance','/settings','/payslips','/chart-of-accounts','/journal-entries','/payroll-accounting','/accounting','/gst','/compliance','/announcements','/support','/customers','/vendors','/sales-invoices','/purchase-invoices','/banking','/disbursement'].includes(path)||path.startsWith('/employees/')) && session&&session.memberships.length>0&&!failed) return children;
  return <div className="rounded-xl border bg-card p-6"><h1 className="mb-2 text-xl font-semibold">PayFlow access</h1><p role="status" className="text-sm text-muted-foreground">{state}</p><Button variant="outline" className="mt-4 mr-3" disabled={retrying} onClick={()=>{setRetrying(true);setRetry(value=>value+1);}}>Retry</Button><Button variant="outline" className="mt-4" onClick={async () => { try { await api('auth/logout', { method: 'POST' }); useSessionStore.getState().setSession(null); router.replace('/login'); router.refresh(); } catch (error) { setState(error instanceof Error ? error.message : 'Sign out failed.'); } }}>Sign out</Button></div>;
}
