import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
const db=new PGlite();
const dataset='20261021090826_employee_dataset_salaries.sql',migration='20261022075846_clear_month_attendance.sql';
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon,service_role;`);
 const directory=new URL('../supabase/migrations/',import.meta.url);
 for(const name of(await readdir(directory)).filter(n=>n.endsWith('.sql')&&n<dataset).sort())await db.exec((await readFile(new URL(name,directory),'utf8')).replace('create extension if not exists pgcrypto;',''));
 if(process.argv.includes('--after-rollback')){
  await db.exec(execFileSync('git',['show','3eadd39:supabase/migrations/202610210049_employee_master_authority.sql'],{encoding:'utf8'}));
  await db.exec(execFileSync('git',['show','7a93fd3:supabase/migrations/202610210050_delete_month_attendance.sql'],{encoding:'utf8'}));
  await db.exec(await readFile(new URL('../supabase/rollback-client-changes.sql',import.meta.url),'utf8'));
 }
 await db.exec(await readFile(new URL(dataset,directory),'utf8'));
 const sql=await readFile(new URL(migration,directory),'utf8');
 assert.equal(sql,await readFile(new URL('../supabase/upgrade-clear-month-attendance.sql',import.meta.url),'utf8'));
 await db.exec(sql);await db.exec(sql);
 const tests=await readFile(new URL('../supabase/tests/clear_month_attendance.sql',import.meta.url),'utf8');
 await db.exec(tests);
 await db.exec(tests.split('set local role authenticated;')[0]+'commit;');
 const c='50000000-0000-4000-8000-000000000011',user='50000000-0000-4000-8000-000000000001';
 const hasMarkers=(await db.query("select to_regclass('public.attendance_master_matches')is not null present")).rows[0].present;
 if(hasMarkers)await db.exec(`insert into public.attendance_master_matches(company_id,batch_id,employee_id,date)values('${c}','50000000-0000-4000-8000-000000000041','50000000-0000-4000-8000-000000000021','2026-05-01'),('${c}','50000000-0000-4000-8000-000000000041','50000000-0000-4000-8000-000000000021','2026-06-01');`);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`);
 const out=new URL('../.test-output/clear-attendance-api/',import.meta.url);await mkdir(out,{recursive:true});
 async function compile(path,name,replacements={}){let source=(path==='src/app/api/attendance/month/route.ts'?execFileSync('git',['show','1033e29:'+path],{encoding:'utf8'}):await readFile(new URL('../'+path,import.meta.url),'utf8')).replace("import 'server-only';",'');for(const[from,to]of Object.entries(replacements))source=source.replaceAll(from,to);await writeFile(new URL(name,out),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText);}
 globalThis.clearAttendanceDb=db;
 await compile('src/server/http.ts','http.mjs',{'./env':'./env.mjs'});
 await writeFile(new URL('env.mjs',out),"export function getEnv(){return{APP_URL:'http://localhost:3000'}}");
 await writeFile(new URL('auth.mjs',out),`import {ApiError}from './http.mjs';
 export async function tenant(request,permission){const c=request.headers.get('x-company-id');if(!c)throw new ApiError(401,'UNAUTHENTICATED','Sign in');const db=globalThis.clearAttendanceDb;if(!(await db.query('select public.has_permission($1,$2) ok',[c,permission])).rows[0].ok)throw new ApiError(403,'FORBIDDEN','Permission denied');return{companyId:c,client:{async rpc(name,p){try{let sql,args;if(name==='attendance_month_delete_preview'){sql='select public.attendance_month_delete_preview($1,$2::date) value';args=[p.c,p.m];}else if(name==='delete_month_attendance'){sql='select public.delete_month_attendance($1,$2::date,$3,$4,$5) value';args=[p.c,p.m,p.expected_revision,p.expected_count,p.reason_text];}else throw Error('Unexpected RPC');return{data:(await db.query(sql,args)).rows[0].value,error:null};}catch(e){return{data:null,error:{code:e.code,message:e.message}}}}}}}
 `);
 await compile('src/app/api/attendance/month/route.ts','route.mjs',{'@/server/auth':'./auth.mjs','@/server/http':'./http.mjs'});
 const route=await import(new URL('route.mjs',out));
 const request=(method,body,company=c,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/attendance/month?month=2026-05',{method,headers:{'content-type':'application/json','x-company-id':company,origin},...(body?{body:JSON.stringify(body)}:{})});
 const preview=await route.GET(request('GET'));assert.equal(preview.status,200);const p=(await preview.json()).data;
 assert.equal(p.count,2);
 const body={month:'2026-05',confirmedMonth:'2026-05',expectedRevision:p.revision,expectedCount:2,reason:'Replace incorrect file'};
 for(const reason of ['', '   ', 'ab'])assert.equal((await route.DELETE(request('DELETE',{...body,reason}))).status,422);
 assert.equal((await route.DELETE(request('DELETE',{...body,confirmedMonth:'2026-06'}))).status,422);
 assert.equal((await route.DELETE(request('DELETE',{...body,expectedCount:1}))).status,409);
 assert.equal((await route.DELETE(request('DELETE',body,c,'https://other.example.invalid'))).status,403);
 assert.equal((await route.DELETE(request('DELETE',body,'50000000-0000-4000-8000-000000000012'))).status,403);
 assert.equal((await db.query('select count(*)::int count from public.attendance_records where company_id=$1 and date<$2',[c,'2026-06-01'])).rows[0].count,2);
 const removed=await route.DELETE(request('DELETE',body));assert.equal(removed.status,200);assert.equal((await removed.json()).data.deleted,2);
 assert.equal((await db.query('select count(*)::int count from public.attendance_records where company_id=$1 and date=$2',[c,'2026-06-01'])).rows[0].count,1);
 assert.equal((await db.query('select status from public.payroll_runs where company_id=$1',[c])).rows[0].status,'Draft');
 if(hasMarkers){await db.exec('reset role');assert.equal((await db.query('select count(*)::int count from public.attendance_master_matches where company_id=$1',[c])).rows[0].count,1);}
 console.log('PASS month clear: mandatory audited remark, month confirmation, stale/count/tenant/origin denial, finalized/financial protection, exact boundaries, preview reset and optional legacy markers. Actual Route Handlers and Postgres; auth/REST transport are fixtures.');
}finally{await db.close();delete globalThis.clearAttendanceDb;}
