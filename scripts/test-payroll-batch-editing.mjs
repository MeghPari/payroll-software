import{PGlite}from'@electric-sql/pglite';import{readFile,readdir}from'node:fs/promises';import assert from'node:assert/strict';
const db=new PGlite();try{
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;`);
for(const n of(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec((await readFile('supabase/migrations/'+n,'utf8')).replace('create extension if not exists pgcrypto;',''));
const c='67000000-0000-4000-8000-000000000011',u='67000000-0000-4000-8000-000000000001';await db.exec(`insert into auth.users values('${u}','batch-edit@example.invalid',now());insert into public.user_profiles(id)values('${u}');insert into public.companies(id,name)values('${c}','35 employee company');insert into public.user_company_roles(company_id,user_id,role)values('${c}','${u}','Super Admin');set role authenticated;select set_config('request.jwt.claim.sub','${u}',false);`);
const employees=[];for(let i=0;i<35;i++){const e=(await db.query('select public.save_employee($1,$2::jsonb) id',[c,JSON.stringify({employeeCode:'SCOPE-'+i,firstName:'Scope',lastName:'Employee '+i,email:'',joiningDate:'2026-03-01'})])).rows[0].id;employees.push(e);const v=(await db.query('select version from public.employees where id=$1',[e])).rows[0].version;await db.query(`select public.save_employee_salary_components($1,$2,'2026-03-01','{"basic":3100000}','{}',$3,'Fixture salary')`,[c,e,v]);}
const attendance=employees.slice(0,10).flatMap(employeeId=>Array.from({length:31},(_,d)=>({employeeId,date:'2026-03-'+String(d+1).padStart(2,'0'),status:'P'})));
await db.query(`select public.import_attendance($1,$2::jsonb,'Ten full employees')`,[c,JSON.stringify(attendance)]);
const calculate=async()=>(await db.query(`select public.calculate_payroll($1,'2026-03-01') id`,[c])).rows[0].id;
const r=await calculate(),version=async()=>(await db.query('select version from public.payroll_runs where id=$1',[r])).rows[0].version;
const affected=async()=>(await db.query('select employee_id from public.payroll_run_employees where run_id=$1 order by employee_id',[r])).rows.map(row=>row.employee_id);
assert.deepEqual(await affected(),employees.slice(0,10).sort());assert.equal(Number((await db.query('select count(*) n from public.employees where company_id=$1',[c])).rows[0].n),35);
const transition=async(action,v)=>db.query('select public.transition_payroll_batch($1,$2,$3,$4,$5)',[c,r,action,v??await version(),'']);
await transition('approve');await transition('lock');assert.equal((await affected()).length,10);
assert.equal((await db.query(`select public.month_employee_payroll_status($1,'2026-03-01') s`,[c])).rows[0].s.length,10);
await db.exec(`reset role;update public.attendance_periods set finalized_at=now()where company_id='${c}'and month='2026-03-01';set role authenticated;`);
await db.query(`select public.save_attendance($1,$2::jsonb,'Pending employee still editable',true)`,[c,JSON.stringify([{employeeId:employees[20],date:'2026-03-01',status:'P'}])]);
const reopen=async(reason,v)=>db.query('select public.reopen_payroll_batch($1,$2,$3,$4) n',[c,r,v??await version(),reason]);
await assert.rejects(reopen(''),e=>e.code==='22023');await assert.rejects(reopen('Reviewed correction',1),e=>e.code==='40001');
await db.query(`select public.generate_payslips($1,'2026-03-01')`,[c]);
let scope=(await db.query(`select public.attendance_import_scope($1,'2026-03-01') s`,[c])).rows[0].s;assert.ok(scope.finalized_at);assert.equal(scope.protectedEmployees.length,10);assert.equal(scope.hasPayroll,true);
const oldVersion=await version();assert.equal((await reopen('Correct one employee attendance')).rows[0].n,10);await assert.rejects(transition('lock',oldVersion),e=>e.code==='40001');assert.equal((await affected()).length,0);scope=(await db.query(`select public.attendance_import_scope($1,'2026-03-01') s`,[c])).rows[0].s;assert.equal(scope.protectedEmployees.length,0);assert.equal(scope.hasPayroll,true);
assert.equal((await db.query('select jsonb_array_length(snapshot->\'employees\') n from public.payroll_batch_edit_history where run_id=$1',[r])).rows[0].n,10);
assert.equal(Number((await db.query('select count(*) n from public.attendance_records where company_id=$1',[c])).rows[0].n),311);
await db.query(`select public.save_attendance($1,$2::jsonb,'Correct absence',true)`,[c,JSON.stringify([{employeeId:employees[0],date:'2026-03-01',status:'A'}])]);assert.equal(await calculate(),r);assert.equal((await affected()).length,10);
assert.equal(Number((await db.query('select net_minor from public.payroll_run_employees where run_id=$1 and employee_id=$2',[r,employees[0]])).rows[0].net_minor),3000000);
await transition('approve');await transition('lock');await db.query(`select public.generate_payslips($1,'2026-03-01')`,[c]);await db.query(`select public.publish_payslips($1,'2026-03-01')`,[c]);await assert.rejects(reopen('Try changing published payroll'),e=>e.code==='P0053');assert.equal((await affected()).length,10);
await assert.rejects(db.query('select public.reopen_payroll_batch($1,$2,$3,$4)',['67000000-0000-4000-8000-000000000099',r,await version(),'Cross-company attempt']),e=>e.code==='42501');
console.log('PASS 35 employees / 10 attendance: only 10 calculated, approved and locked; other 25 editable/pending; reason/version checked batch reopening, archived salary snapshots, retained attendance, exact recalculation and published/cross-company protection.');
}finally{await db.close();}
