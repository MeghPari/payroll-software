import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try{
 await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;");
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const name of(await readdir(dir)).filter(name=>name.endsWith('.sql')).sort())await db.exec((await readFile(new URL(name,dir),'utf8')).replace('create extension if not exists pgcrypto;',''));
 await db.exec("insert into auth.users values('df0c63ac-ce98-4430-bb6f-9e018fc4220d','fixture@example.invalid',now());insert into public.user_profiles(id)values('df0c63ac-ce98-4430-bb6f-9e018fc4220d');insert into public.companies(id,name)values('28007669-1a91-4d80-b409-447cfa66f12e','SVS fixture');insert into public.user_company_roles(company_id,user_id,role)values('28007669-1a91-4d80-b409-447cfa66f12e','df0c63ac-ce98-4430-bb6f-9e018fc4220d','Super Admin');insert into public.employees(id,company_id,employee_code,first_name,last_name,email,joining_date)values('00000000-0000-4000-8000-000000000001','28007669-1a91-4d80-b409-447cfa66f12e','EMP-CF5297CC','Adarsh','Mishra','first@example.invalid','2026-08-01'),('00000000-0000-4000-8000-000000000002','28007669-1a91-4d80-b409-447cfa66f12e','EMP-5A2A7495','Harsh','Swami','second@example.invalid','2026-09-13');");
 const script=await readFile(new URL('../supabase/sample-salary-setup.sql',import.meta.url),'utf8');
 await db.exec(script);
 const query="select e.employee_code,a.effective_from::text,sum(v.amount_minor)::text gross from public.employee_salary_assignments a join public.employees e on e.id=a.employee_id join public.employee_salary_component_values v on v.assignment_id=a.id group by e.employee_code,a.effective_from order by e.employee_code";
 const result=await db.query(query);
 assert.equal(result.rows.length,2);assert.equal(result.rows[0].gross,'8000000');assert.equal(result.rows[0].effective_from,'2026-09-13');assert.equal(result.rows[1].gross,'7000000');assert.equal(result.rows[1].effective_from,'2026-09-01');
 assert.equal((await db.query("select count(*)::int n from public.audit_logs where action='Salary Revised'")).rows[0].n,2);
 const before=JSON.stringify(result.rows);await assert.rejects(db.exec(script),/will not overwrite/);await db.exec('rollback');assert.equal(JSON.stringify((await db.query(query)).rows),before);
 console.log('PASS one-time sample salaries: exact components, employment-aware effective dates, audit and rerun protection. No live data changed.');
}finally{await db.close();}
