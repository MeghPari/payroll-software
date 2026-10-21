// Real Route Handlers + PostgreSQL RPCs; Auth/session and PostgREST transport are fixtures.
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const output=new URL('../.test-output/attendance-api/',import.meta.url);
await mkdir(output,{recursive:true});
const database=new PGlite();
const company='20000000-0000-4000-8000-000000000011',employee='20000000-0000-4000-8000-000000000021',user='20000000-0000-4000-8000-000000000001';
globalThis.attendanceFixture={database,company};
try {
 await database.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;`);
 const migrations=new URL('../supabase/migrations/',import.meta.url);
 for(const name of(await readdir(migrations)).filter(name=>name.endsWith('.sql')).sort())await database.exec((await readFile(new URL(name,migrations),'utf8')).replace('create extension if not exists pgcrypto;',''));
 await database.exec(`insert into auth.users values('${user}','attendance-api@example.invalid',now());insert into public.user_profiles(id)values('${user}');insert into public.companies(id,name)values('${company}','API fixture');insert into public.user_company_roles(company_id,user_id,role)values('${company}','${user}','Super Admin');insert into public.employees(id,company_id,employee_code,first_name,last_name,email,joining_date)values('${employee}','${company}','FIXTURE','API','Employee','employee@example.invalid','2026-09-03');set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`);
 const master={employeeCode:'FIXTURE',employeeName:'API Employee',gender:'',dateOfBirth:'',maritalStatus:'',phone:'',aadhaar:'',pan:'',uan:'',esicNumber:'',joiningDate:'2026-09-03',exitDate:'',clientStatus:'Active',counterCode:'',counterName:'',reportingManager:'',workLocation:'',state:'',department:'',designation:'',accountNumber:'',ifscCode:'',amounts:{basic:0,da:0,hra:0,other:0},salaryEffectiveFrom:'2026-09-03',salaryReference:{grossMinor:0,pfMinor:0,esiMinor:0,ctcMinor:0}};
 await database.query('select public.import_employee_master($1,$2::jsonb,true,$3::jsonb)',[company,JSON.stringify([master]),JSON.stringify({FIXTURE:1})]);
 async function compile(path,name,replacements={}){
  let source=(await readFile(new URL(`../${path}`,import.meta.url),'utf8')).replace("import 'server-only';",'');
  for(const[from,to]of Object.entries(replacements))source=source.replaceAll(from,to);
  await writeFile(new URL(name,output),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText);
 }
 await compile('src/server/http.ts','http.mjs',{'./env':'./env.mjs'});
 await writeFile(new URL('env.mjs',output),"export function getEnv(){return {APP_URL:'http://localhost:3000'}}");
 await compile('src/domain/attendance-input.ts','attendance-input.mjs');
 await compile('src/domain/attendance-completeness.ts','attendance-completeness.mjs');
 await compile('src/domain/dates.ts','dates.mjs');
 await writeFile(new URL('auth.mjs',output),`
 import {ApiError}from './http.mjs';
 const{database,company}=globalThis.attendanceFixture;
 const client={
  async rpc(name,input){try{let sql,args;
   if(name==='save_attendance'){sql='select public.save_attendance($1,$2::jsonb,$3,$4) value';args=[input.c,JSON.stringify(input.rows_json),input.reason_text,input.allow_update];}
   else if(name==='import_attendance_with_employees'){sql='select public.import_attendance_with_employees($1,$2::jsonb,$3::jsonb,$4) value';args=[input.c,JSON.stringify(input.rows_json),JSON.stringify(input.new_employees),input.reason_text];}
   else if(name==='import_attendance'){sql='select public.import_attendance($1,$2::jsonb,$3) value';args=[input.c,JSON.stringify(input.rows_json),input.reason_text];}
   else if(name==='finalize_attendance'){sql='select public.finalize_attendance($1,$2::date,$3,$4) value';args=[input.c,input.m,input.reopen,input.reason_text];}
   else throw new Error('Unexpected fixture RPC');
   return{data:(await database.query(sql,args)).rows[0].value,error:null};
  }catch(error){return{data:null,error:{code:error.code,message:error.message}}}},
  from(table){if(!['employees','attendance_records'].includes(table))throw new Error('Unexpected fixture table');
   const filters=[],args=[];let columns='*',order='id',limit=1000,offset=0;
   const query={in(k,values){filters.push(k+'=any($'+args.push(values)+'::uuid[])');return query},select(value){columns=value;return query},eq(k,v){filters.push(k+'=$'+(args.push(v)));return query},gte(k,v){filters.push(k+'>=$'+args.push(v));return query},lte(k,v){filters.push(k+'<=$'+args.push(v));return query},lt(k,v){filters.push(k+'<$'+args.push(v));return query},not(k,op,v){if(k!=='status'||op!=='in')throw new Error('Unexpected fixture filter');filters.push("status not in('Inactive','Salary Hold')");return query},order(value){order=value;return query},range(start,end){offset=start;limit=end-start+1;return query},async then(resolve,reject){try{const result=await database.query('select '+columns+' from public.'+table+' where '+filters.join(' and ')+' order by '+order+' limit '+limit+' offset '+offset,args);return resolve({data:result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value instanceof Date?value.toISOString().slice(0,10):value]))),error:null})}catch(error){return resolve({data:null,error:{code:error.code,message:error.message}})}}};return query;}
 };
 export async function tenant(request,permission){const id=request.headers.get('x-company-id');if(!id)throw new ApiError(403,'NOT_A_MEMBER','Company access is not allowed.');const allowed=await database.query('select public.has_permission($1,$2) allowed',[id,permission??'attendance.write']);if(!allowed.rows[0].allowed)throw new ApiError(403,'FORBIDDEN','Permission denied.');return{client,companyId:id,user:{id:'${user}'}};}
 `);
 const replacements={'@/server/auth':'./auth.mjs','@/server/http':'./http.mjs','@/domain/attendance-input':'./attendance-input.mjs','@/domain/attendance-completeness':'./attendance-completeness.mjs','@/domain/dates':'./dates.mjs'};
 await compile('src/app/api/attendance/route.ts','attendance.mjs',replacements);
 await compile('src/app/api/attendance/period/route.ts','period.mjs',replacements);
 await compile('src/app/api/attendance/imports/route.ts','imports.mjs',replacements);
 const attendance=await import(new URL('attendance.mjs',output)),period=await import(new URL('period.mjs',output));
 const row={employeeId:employee,date:'2026-09-03',status:'Present',shift:'',checkIn:'',checkOut:'',workMinutes:0,overtimeMinutes:0,leaveType:'',remarks:''};
 const request=(payload,id=company,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/attendance',{method:'POST',headers:{'content-type':'application/json','x-company-id':id,origin},body:JSON.stringify(payload)});
 async function check(handler,payload,status,code,id=company,origin){const response=await handler(request(payload,id,origin));assert.equal(response.status,status);const json=await response.json();if(code)assert.equal(json.error.code,code);return json;}
 await check(attendance.POST,{rows:[{...row,status:'P'}]},200);assert.equal((await database.query('select status from public.attendance_records where employee_id=$1 and date=$2',[employee,row.date])).rows[0].status,'Present');
 await check(attendance.POST,{rows:[{...row,status:'Absent'}]},409,'ATTENDANCE_EXISTS');
 await check(attendance.POST,{allowUpdate:true,rows:[row]},422,'VALIDATION_ERROR');
 await check(attendance.POST,{allowUpdate:true,reason:'Approved correction',rows:[{...row,status:'Half Day'}]},200);
 await check(attendance.POST,{rows:[{...row,date:'2026-02-30'}]},422,'VALIDATION_ERROR');
 await check(attendance.POST,{rows:[row]},403,'INVALID_ORIGIN',company,'https://untrusted.example.invalid');
 await check(attendance.POST,{rows:[row]},403,'FORBIDDEN','20000000-0000-4000-8000-000000000099');
 const missing=await check(period.POST,{month:'2026-09'},422,'ATTENDANCE_INCOMPLETE');
 assert.match(missing.error.message,/FIXTURE: 27 incomplete/);assert.match(missing.error.message,/2026-09-04/);assert.doesNotMatch(missing.error.message,/2026-09-01/);assert.ok(missing.error.message.length<350);assert.match(missing.error.message,/View dates/);
 const imports=await import(new URL('imports.mjs',output));
 const invalidEmployment=await check(imports.POST,{reason:'Pre-joining fixture',rows:[{...row,date:'2026-07-01'}]},422,'EMPLOYMENT_DATE_INVALID');assert.match(invalidEmployment.error.message,/FIXTURE: 2026-07-01 is before joining date 2026-09-03/);
 await check(imports.POST,{reason:'Bad time fixture',rows:[{...row,checkIn:'29:00'}]},422,'VALIDATION_ERROR');
 const newPerson={employeeCode:'OUTSIDE_API',employeeName:'Outside Person',joiningDate:'2026-09-03',counterCode:'C1',counterName:'Counter',workLocation:'Delhi',state:'Delhi',department:'Operations'};
 await check(imports.POST,{reason:'Retired onboarding',newEmployees:[newPerson],rows:[{...row,employeeId:'OUTSIDE_API'}]},422,'VALIDATION_ERROR');
 await check(imports.POST,{reason:'Unknown Employee Code',rows:[{...row,employeeId:'MISSING_API'}]},422,'VALIDATION_ERROR');
 assert.equal((await database.query("select count(*)::integer n from public.employees where company_id=$1 and employee_code='OUTSIDE_API'",[company])).rows[0].n,0);
 const remaining=Array.from({length:27},(_,index)=>({...row,date:'2026-09-'+String(index+4).padStart(2,'0'),status:(index+4)%7===0?'Weekly Off':'Present'}));
 await check(attendance.POST,{rows:remaining},200);
 await check(period.POST,{month:'2026-09'},200);
 await check(attendance.POST,{allowUpdate:true,reason:'Correction',rows:[row]},409,'ATTENDANCE_LOCKED');
 await check(imports.POST,{reason:'Locked onboarding',newEmployees:[{...newPerson,employeeCode:'LOCKED_API'}],rows:[{...row,employeeId:'LOCKED_API'}]},422,'VALIDATION_ERROR');
 assert.equal((await database.query("select count(*)::integer n from public.employees where company_id=$1 and employee_code='LOCKED_API'",[company])).rows[0].n,0);
 await check(period.POST,{month:'2026-09',reopen:true,reason:'Approved correction'},200);
 assert.equal((await database.query('select status from public.attendance_records where employee_id=$1 and date=$2',[employee,'2026-09-03'])).rows[0].status,'Half Day');
 assert.equal((await database.query("select count(*)::integer n from public.audit_logs where company_id=$1 and action='Attendance Modified' and entity_id=$2",[company,employee])).rows[0].n,29);
 console.log('PASS attendance Route Handlers: initial entry, duplicate protection, correction reason, exact employment-date diagnosis, range entry, finalization/reopening, locked editing, origin and tenant denial, atomic audit.');
 console.log('Auth and PostgREST transport are fixtures. No live user records were changed.');
}finally{await database.close();delete globalThis.attendanceFixture;}
