import { readFile } from 'node:fs/promises';
const lines = (await readFile(new URL('../.env.local', import.meta.url), 'utf8')).split(/\r?\n/);
const values = Object.fromEntries(lines.filter(line => /^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)=/.test(line)).map(line => { const index = line.indexOf('='); return [line.slice(0,index),line.slice(index+1).trim()]; }));
const response = await fetch(new URL('/auth/v1/settings', values.SUPABASE_URL), { headers: { apikey: values.SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(15000) });
console.log(`Supabase Auth connectivity HTTP ${response.status}`);
if (!response.ok) process.exitCode = 1;
