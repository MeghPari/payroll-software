import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const db = new PGlite();
const rollbackPath = new URL('../supabase/rollback-client-changes.sql', import.meta.url);
const functions = async () => (await db.query(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,
 coalesce((select jsonb_agg(jsonb_build_object('role',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'grantable',a.is_grantable)order by a.grantee)from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a where a.privilege_type='EXECUTE'),'[]') grants
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by signature`)).rows;
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon,service_role;`);
 for (const name of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')&&!n.includes('employee_dataset_salaries')&&!n.includes('clear_month_attendance')&&!n.includes('reset_attendance_payroll_month')&&!n.includes('manual_salary_optional_imports_kyc')).sort()) {
  await db.exec((await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;',''));
 }
 const before = await functions();
 // Real fixtures exercise restored designation assignments, imports and payroll.
 const fixture=(await readFile(new URL('../supabase/tests/department_designations.sql',import.meta.url),'utf8'))
  .replaceAll('48000000-','59000000-').replaceAll('departments@example.invalid','retained@example.invalid').replace(/rollback;\s*$/,'commit;');
 await db.exec(fixture);
 const tables=['employees','employee_salary_assignments','employee_salary_component_values','attendance_records','payroll_runs','payroll_run_employees','payroll_run_components','payslips','audit_logs'];
 const snapshot=async()=>{
  const data={};for(const table of tables){
   if((await db.query('select to_regclass($1) name',['public.'+table])).rows[0].name)
    data[table]=(await db.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows;
  }return data;
 };
 await db.exec(execFileSync('git',['show','3eadd39:supabase/migrations/202610210049_employee_master_authority.sql'],{encoding:'utf8'}));
 await db.exec(execFileSync('git',['show','7a93fd3:supabase/migrations/202610210050_delete_month_attendance.sql'],{encoding:'utf8'}));
 const after = await functions();
 const previous=new Map(before.map(f=>[f.signature,f]));
 let sql=`-- Restore application behavior from migrations 001-048 after running 049 and 050.
-- Run the ENTIRE file in Supabase SQL Editor as the project owner.
-- Retains employees, attendance, salaries, audit and financial history.
-- Extra master-history tables/columns remain for preservation, with app access disabled.
-- Existing designation presets are reactivated; earlier individual inactive states
-- were overwritten by 049 and cannot be reconstructed without a prior backup.
-- Does not recreate attendance that was actually deleted, or undo uploaded salaries.
begin;
select pg_advisory_xact_lock(210049050);
lock table public.companies in share row exclusive mode;
`;
 for(const f of after){
  const old=previous.get(f.signature);
  if(old&&(old.definition!==f.definition||JSON.stringify(old.grants)!==JSON.stringify(f.grants))){
   sql+='\n'+old.definition+';\n';
   sql+=`revoke all on function public.${old.signature} from public,anon,authenticated,service_role;\n`;
   for(const g of old.grants.filter(g=>['PUBLIC','anon','authenticated','service_role'].includes(g.role)))
    sql+=`grant execute on function public.${old.signature} to ${g.role}${g.grantable?' with grant option':''};\n`;
  }else if(!old){
   sql+=`\nrevoke all on function public.${f.signature} from public,anon,authenticated,service_role;\n`;
  }
 }
 sql+=`\n-- Restore earlier preset visibility without replacing amounts or assignments.
grant select on public.designation_salary_presets to authenticated;
update public.salary_structures s set status='Active'
where s.status='Archived' and exists(select 1 from public.designation_salary_presets p where p.company_id=s.company_id and p.structure_id=s.id);
update public.designation_salary_presets set active=true where not active;
revoke all on public.employee_master_revisions,public.attendance_master_matches from public,anon,authenticated;
delete from public.role_permissions where permission='attendance.delete';
notify pgrst,'reload schema';
commit;
`;
 if(process.argv.includes('--generate'))await writeFile(rollbackPath,sql);
 else assert.equal(await readFile(rollbackPath,'utf8'),sql,'Rollback differs from reproducible original definitions');
 const retained=await snapshot();
 await db.exec(sql);
 assert.deepEqual(await snapshot(),retained,'Rollback modified business history');
 const restored=new Map((await functions()).map(f=>[f.signature,f]));
 for(const f of before)assert.deepEqual(restored.get(f.signature),f,'Function or grant not restored: '+f.signature);
 for(const f of after.filter(f=>!previous.has(f.signature))){
  const check=await db.query(`select has_function_privilege('authenticated',$1,'execute') allowed`,[f.signature]);
  assert.equal(check.rows[0].allowed,false,'New endpoint still exposed: '+f.signature);
 }
 await db.exec(sql); // Repeat safely.
 assert.deepEqual(await snapshot(),retained,'Repeat rollback modified business history');
 await db.exec(await readFile(new URL('../supabase/tests/department_designations.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/tests/designation_salaries.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/tests/attendance_new_employees.sql',import.meta.url),'utf8'));
 console.log('PASS rollback restores every changed function and grant, disables new endpoints, retains history, is repeatable, and passes prior designation/payroll and attendance-import workflows.');
}finally{await db.close();}
