import {PGlite}from'@electric-sql/pglite';import{readFile,readdir}from'node:fs/promises';import assert from'node:assert/strict';
const db=new PGlite();try{
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;`);
for(const name of(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec((await readFile('supabase/migrations/'+name,'utf8')).replace('create extension if not exists pgcrypto;',''));
const c='66000000-0000-4000-8000-000000000011',u='66000000-0000-4000-8000-000000000001';await db.exec(`insert into auth.users values('${u}','batch@example.invalid',now());insert into public.user_profiles(id)values('${u}');insert into public.companies(id,name)values('${c}','Incremental payroll');insert into public.user_company_roles(company_id,user_id,role)values('${c}','${u}','Super Admin');set role authenticated;select set_config('request.jwt.claim.sub','${u}',false);`);

const e=(await db.query('select public.save_employee($1,$2::jsonb) id',[c,JSON.stringify({employeeCode:'ALOK-MAR',firstName:'Alok',lastName:'Kumar',email:'',joiningDate:'2026-03-22'})])).rows[0].id;
const dates=Array.from({length:10},(_,i)=>'2026-03-'+(22+i));
const rows=dates.map(date=>({employeeId:e,date,status:new Date(date+'T00:00:00Z').getUTCDay()===0?'Weekly Off':'Present'}));
await db.query('select public.import_attendance($1,$2::jsonb,$3)',[c,JSON.stringify(rows),'Alok joining-date regression']);
const validate=async()=>(await db.query("select public.validate_payroll($1,'2026-03-01') data",[c])).rows[0].data;
let checks=await validate();assert.equal(checks.readyCount,0);assert.ok(checks.pendingReasons.some(i=>i.employeeId===e&&i.check==='No Salary Assigned'));assert.ok(!checks.pendingReasons.some(i=>i.check==='Attendance Missing'));
const v=(await db.query('select version from public.employees where id=$1',[e])).rows[0].version;
await db.query(`select public.save_employee_salary_components($1,$2,'2026-10-01','{"basic":3000000}','{}',$3,'Initial manual salary')`,[c,e,v]);
checks=await validate();assert.equal(checks.readyCount,1);assert.equal(checks.pendingReasons.length,0);
const first=(await db.query("select public.calculate_payroll($1,'2026-03-01') id",[c])).rows[0].id;
const saved=(await db.query('select * from public.payroll_run_employees where employee_id=$1',[e])).rows[0];assert.equal(saved.net_minor,967742);assert.equal(saved.snapshot.attendance.payableDays,10);assert.equal(saved.snapshot.attendance.present,8);assert.equal(saved.snapshot.attendance.weeklyOff,2);assert.equal(saved.snapshot.attendance.payrollDays,10);assert.ok(saved.snapshot.salary);
let version=(await db.query('select version from public.payroll_runs where id=$1',[first])).rows[0].version;
await db.query("select public.transition_payroll_batch($1,$2,'approve',$3,'')",[c,first,version]);version=(await db.query('select version from public.payroll_runs where id=$1',[first])).rows[0].version;
await db.query("select public.transition_payroll_batch($1,$2,'lock',$3,'')",[c,first,version]);
const later=(await db.query('select public.save_employee($1,$2::jsonb) id',[c,JSON.stringify({employeeCode:'LATER-MAR',firstName:'Later',lastName:'Joiner',email:'',joiningDate:'2026-03-22'})])).rows[0].id;
const laterVersion=(await db.query('select version from public.employees where id=$1',[later])).rows[0].version;
await db.query(`select public.save_employee_salary_components($1,$2,'2026-03-22','{"basic":3000000}','{}',$3,'Later salary')`,[c,later,laterVersion]);
await db.query('select public.import_attendance($1,$2::jsonb,$3)',[c,JSON.stringify(rows.map(row=>({...row,employeeId:later}))),'Later employee']);
assert.equal((await validate()).readyCount,1);const second=(await db.query("select public.calculate_payroll($1,'2026-03-01') id",[c])).rows[0].id;assert.notEqual(first,second);assert.equal((await db.query('select status from public.payroll_runs where id=$1',[first])).rows[0].status,'Locked');
assert.equal((await db.query('select net_minor from public.payroll_run_employees where employee_id=$1',[e])).rows[0].net_minor,967742);
console.log('PASS Alok March22 joining: missing salary reason, initial salary carry-back, 8 present+2 paid Sundays, 10/31 exact pay, later batch after lock, retained earlier salaries.');
}catch(error){console.error(error);process.exitCode=1;}finally{await db.close();}
