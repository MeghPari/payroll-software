import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const db=new PGlite();
const migration='20261021090826_employee_dataset_salaries.sql';
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon,service_role;`);
 const directory=new URL('../supabase/migrations/',import.meta.url);
 for(const name of(await readdir(directory)).filter(n=>n.endsWith('.sql')&&n!==migration).sort())await db.exec((await readFile(new URL(name,directory),'utf8')).replace('create extension if not exists pgcrypto;',''));
 const fixture=(await readFile(new URL('../supabase/tests/department_designations.sql',import.meta.url),'utf8')).replaceAll('48000000-','59000000-').replace(/rollback;\s*$/,'commit;');
 await db.exec(fixture);
 const snapshot=async()=>(await db.query(`select jsonb_build_object('employees',(select jsonb_agg(to_jsonb(e)order by id)from employees e),'attendance',(select jsonb_agg(to_jsonb(a)order by id)from attendance_records a),'payroll',(select jsonb_agg(to_jsonb(r)order by id)from payroll_runs r),'calculated',(select jsonb_agg(to_jsonb(e)order by employee_id)from payroll_run_employees e)) data`)).rows[0].data;
 if(process.argv.includes('--after-rollback')){
  await db.exec(execFileSync('git',['show','3eadd39:supabase/migrations/202610210049_employee_master_authority.sql'],{encoding:'utf8'}));
  await db.exec(execFileSync('git',['show','7a93fd3:supabase/migrations/202610210050_delete_month_attendance.sql'],{encoding:'utf8'}));
  await db.exec(await readFile(new URL('../supabase/rollback-client-changes.sql',import.meta.url),'utf8'));
 }
 const before=await snapshot();
 const sql=await readFile(new URL(migration,directory),'utf8');
 assert.equal(sql,await readFile(new URL('../supabase/upgrade-employee-dataset-salaries.sql',import.meta.url),'utf8'));
 await db.exec(sql);assert.deepEqual(await snapshot(),before);
 // Verify the same upgrade also works after the applied 049/050 rollback.
 await db.exec(await readFile(new URL('../supabase/tests/employee_dataset.sql',import.meta.url),'utf8'));
 const out=new URL('../.test-output/employee-dataset-api/',import.meta.url);await mkdir(out,{recursive:true});
 async function compile(path,name,replacements={}){
  let source=(await readFile(new URL('../'+path,import.meta.url),'utf8')).replace("import 'server-only';",'');
  for(const[from,to]of Object.entries(replacements))source=source.replaceAll(from,to);
  await writeFile(new URL(name,out),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText);
 }
 globalThis.datasetApiDb=db;
 await compile('src/server/http.ts','http.mjs',{'./env':'./env.mjs'});
 await writeFile(new URL('env.mjs',out),"export function getEnv(){return{APP_URL:'http://localhost:3000'}}");
 await compile('src/domain/currency.ts','currency.mjs');
 await compile('src/domain/attendance-import-date.ts','date.mjs');
 await compile('src/domain/spreadsheet-import.ts','spreadsheet.mjs',{'./attendance-import-date':'./date.mjs'});
 await compile('src/domain/client-employee.ts','employee.mjs',{'./currency':'./currency.mjs','./attendance-import-date':'./date.mjs','./spreadsheet-import':'./spreadsheet.mjs'});
 await writeFile(new URL('auth.mjs',out),`import {ApiError}from './http.mjs';
 export async function tenant(request,permission){const c=request.headers.get('x-company-id');if(!c)throw new ApiError(401,'UNAUTHENTICATED','Sign in');const db=globalThis.datasetApiDb;if(!(await db.query('select public.has_permission($1,$2) ok',[c,permission])).rows[0].ok)throw new ApiError(403,'FORBIDDEN','Permission denied');return{companyId:c,user:{id:'59000000-0000-4000-8000-000000000001'},client:{async rpc(name,p){if(name!=='import_employee_dataset')throw Error('Unexpected RPC');try{return{data:(await db.query('select public.import_employee_dataset($1,$2::jsonb,$3,$4::jsonb) id',[p.c,JSON.stringify(p.rows_json),p.update_existing,JSON.stringify(p.expected_versions)])).rows[0].id,error:null};}catch(e){return{data:null,error:{code:e.code,message:e.message}}}}}}}
 `);
 await compile('src/app/api/employees/client-import/route.ts','route.mjs',{'@/domain/client-employee':'./employee.mjs','@/server/auth':'./auth.mjs','@/server/http':'./http.mjs'});
 const {POST}=await import(new URL('route.mjs',out));
 const employeeSource=await readFile(new URL('../supabase/tests/employee_dataset.sql',import.meta.url),'utf8');
 const p=JSON.parse(employeeSource.match(/p:='([^']+)'/)[1]);p.employeeCode='API_DATASET';
 const company='59000000-0000-4000-8000-000000000011';
 await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','59000000-0000-4000-8000-000000000001',false)");
 const request=(body,c=company,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/employees/client-import',{method:'POST',headers:{'content-type':'application/json','x-company-id':c,origin},body:JSON.stringify(body)});
 assert.equal((await POST(request({rows:[{...p,amounts:null}]}))).status,422);
 assert.equal((await POST(request({rows:[p]},company,'https://other.example.invalid'))).status,403);
 assert.equal((await POST(request({rows:[p]},'51000000-0000-4000-8000-000000000012'))).status,403);
 assert.equal((await POST(request({rows:[p]}))).status,201);
 const e=(await db.query('select id,version from public.employees where company_id=$1 and employee_code=$2',[company,p.employeeCode])).rows[0];
 assert.equal((await POST(request({rows:[p]}))).status,422);
 assert.equal((await POST(request({rows:[p],updateExisting:true,expectedVersions:{API_DATASET:999}}))).status,409);
 assert.equal((await POST(request({rows:[p],updateExisting:true,expectedVersions:{API_DATASET:e.version}}))).status,201);
 console.log('PASS actual dataset Route Handler: required components, create/update, stale version, origin and tenant denial with real PostgreSQL RPC. Auth/REST transport are fixtures.');
 console.log('PASS dataset salary import, updates, exact attendance payroll, revision history, no presets, permissions, atomic rollback and preservation of prior payroll.');
}finally{await db.close();}
