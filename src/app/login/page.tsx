'use client';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const reset = new URLSearchParams(window.location.search).get('reset') === '1';
      await api(reset ? 'auth/password' : 'auth/login', { method: 'POST', body: JSON.stringify(reset ? { password } : { email, password }) });
      window.location.assign(reset ? '/login' : '/dashboard');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  async function recover() {
    setBusy(true); setMessage('');
    try { const response = await api<{ message: string }>('auth/reset-password', { method: 'POST', body: JSON.stringify({ email }) }); setMessage(response.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to request recovery.'); }
    finally { setBusy(false); }
  }
  return <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
    <h1 className="mb-2 text-2xl font-semibold">PayFlow</h1>
    <p className="mb-6 text-sm text-muted-foreground">Sign in with your authorized account. For password recovery, enter your new password after opening the email link.</p>
    <form onSubmit={submit} className="space-y-4">
      <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></div>
      <div><Label htmlFor="password">Password</Label><Input id="password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
      {message && <p role="status" className="text-sm">{message}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Please wait…' : 'Continue'}</Button>
      <Button type="button" variant="outline" disabled={busy || !email} onClick={recover} className="w-full">Send password reset email</Button>
    </form>
  </div>;
}
