import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const database=new PGlite();
try{
 await database.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon,service_role;`);
 const directory=new URL('../supabase/migrations/',import.meta.url);
 for(const name of(await readdir(directory)).filter(name=>name.endsWith('.sql')&&name<'202610160042').sort())await database.exec((await readFile(new URL(name,directory),'utf8')).replace('create extension if not exists pgcrypto;',''));
 const definition=(await database.query("select pg_get_functiondef('public.validate_payroll_internal(uuid,date)'::regprocedure) definition")).rows[0].definition;
 const upgrade=await readFile(new URL('../supabase/upgrade-client-review.sql',import.meta.url),'utf8');
 assert.equal(upgrade,await readFile(new URL('../supabase/migrations/202610160042_payroll_review_members.sql',import.meta.url),'utf8'));
 for(const format of ['LF','CRLF','tabs and extra whitespace']){
  let formatted=definition.replace(/\r\n/g,'\n');
  if(format==='CRLF')formatted=formatted.replace(/\n/g,'\r\n');
  if(format==='tabs and extra whitespace')formatted=formatted.replace('  else\n   if stat.pf_applicable','\telse\r\n\t\tif  stat.pf_applicable');
  await database.exec(formatted);
  const stored=(await database.query("select pg_get_functiondef('public.validate_payroll_internal(uuid,date)'::regprocedure) definition")).rows[0].definition;
  if(format==='CRLF')assert.ok(stored.includes('\r\n'),'Fixture must actually retain Windows line endings');
  if(format!=='LF')assert.equal(stored.includes('  else\n   if stat.pf_applicable'),false,'Fixture reproduces the old exact-match failure');
  // Keep each trial isolated by stripping the package transaction boundaries.
  await database.exec('begin;savepoint formatting_trial;');
  await database.exec(upgrade.replace(/^begin;/,'').replace(/commit;\s*$/,''));
  const updated=(await database.query("select pg_get_functiondef('public.validate_payroll_internal(uuid,date)'::regprocedure) definition")).rows[0].definition;
  assert.match(updated,/end if; if true then if stat[.]pf_applicable/);
  assert.ok((await database.query("select to_regprocedure('public.list_company_members(uuid)')::text name")).rows[0].name);
  await database.exec('rollback;');
  console.log('PASS migration 042 with '+format+' in stored statutory function');
 }
}finally{await database.close();}
