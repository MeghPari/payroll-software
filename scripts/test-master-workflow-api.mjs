// Actual application handlers and PostgreSQL, with fixture Auth/REST transports.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const out=new URL('../.test-output/master-workflow/',import.meta.url);await mkdir(out,{recursive:true});
const db=new PGlite(),company='59000000-0000-4000-8000-000000000011',user='59000000-0000-4000-8000-000000000001';
globalThis.masterFixture={db,company,user};
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;`);
 for(const name of(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort())await db.exec((await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;',''));
 await db.exec(`insert into auth.users values('${user}','master-api@example.invalid',now());insert into public.user_profiles(id)values('${user}');insert into public.companies(id,name)values('${company}','Master API fixture');insert into public.user_company_roles(company_id,user_id,role)values('${company}','${user}','Super Admin');set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`);
 async function compile(path,name,replacements={}){let source=(await readFile(new URL('../'+path,import.meta.url),'utf8')).replace("import 'server-only';",'');for(const[from,to]of Object.entries(replacements))source=source.replaceAll(from,to);await writeFile(new URL(name,out),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText);}
 await writeFile(new URL('env.mjs',out),"export function getEnv(){return{APP_URL:'http://localhost:3000'}}");
 await compile('src/server/http.ts','http.mjs',{'./env':'./env.mjs'});
 await compile('src/server/paging.ts','paging.mjs',{'./http':'./http.mjs'});
 await compile('src/domain/currency.ts','currency.mjs');await compile('src/domain/attendance-import-date.ts','date.mjs');
 await compile('src/domain/spreadsheet-import.ts','spreadsheet.mjs',{'./attendance-import-date':'./date.mjs'});
 await compile('src/domain/client-employee.ts','employee.mjs',{'./currency':'./currency.mjs','./attendance-import-date':'./date.mjs','./spreadsheet-import':'./spreadsheet.mjs'});
 await compile('src/domain/attendance-input.ts','attendance.mjs');await compile('src/domain/csv.ts','csv.mjs');await compile('src/domain/master-payroll-output.ts','output.mjs');
 await writeFile(new URL('auth.mjs',out),`
 import{ApiError}from './http.mjs';const{db,company,user}=globalThis.masterFixture;
 const signatures={attendance_month_delete_preview:['c','m'],delete_month_attendance:['c','m','expected_revision','expected_count','reason_text'],has_permission:['c','permission_code'],import_employee_master:['c','rows_json','update_existing','expected_versions'],import_attendance:['c','rows_json','reason_text'],validate_payroll:['c','m'],calculate_payroll:['c','m'],payroll_master_reconciliation:['c','m'],reconcile_saved_master_attendance:['c','m','reason_text'],transition_payroll:['c','m','action_text','expected_version','reason_text']};
 const client={async rpc(name,input){const keys=signatures[name];if(!keys)throw Error('Unexpected RPC '+name);try{return{data:(await db.query('select public.'+name+'('+keys.map((key,index)=>'$'+(index+1)).join(',')+') value',keys.map(key=>typeof input[key]==='object'?JSON.stringify(input[key]):input[key]))).rows[0].value,error:null};}catch(error){return{data:null,error:{code:error.code,message:error.message}}}},from(table){
 if(!['employee_master_revisions','payroll_runs','payroll_run_employees','payroll_calculation_methods'].includes(table))throw Error('Unexpected table '+table);
 const filters=[],args=[],orders=[];let columns='*',limit=250,offset=0,single=false;
 const query={select(value){columns=value;return query},eq(key,value){filters.push(key+'=$'+args.push(value));return query},in(key,value){filters.push(key+'=any($'+args.push(value)+'::uuid[])');return query},order(key,opts){orders.push(key+(opts?.ascending===false?' desc':' asc'));return query},limit(value){limit=value;return query},range(first,last){offset=first;limit=last-first+1;return query},maybeSingle(){single=true;return query},async then(resolve){try{const result=await db.query('select '+columns+' from public.'+table+(filters.length?' where '+filters.join(' and '):'')+(orders.length?' order by '+orders.join(','):'')+' limit '+limit+' offset '+offset,args);return resolve({data:single?result.rows[0]??null:result.rows,error:null});}catch(error){return resolve({data:null,error:{code:error.code,message:error.message}})}}};return query;}};
 export async function tenant(request,permission){if(request.headers.get('x-company-id')!==company)throw new ApiError(403,'NOT_A_MEMBER','Company denied.');const allowed=await db.query('select public.has_permission($1,$2)allowed',[company,permission]);if(!allowed.rows[0].allowed)throw new ApiError(403,'FORBIDDEN','Permission denied.');return{client,companyId:company,user:{id:user}};}
 `);
 const aliases={'@/server/auth':'./auth.mjs','@/server/http':'./http.mjs','@/server/paging':'./paging.mjs','@/domain/client-employee':'./employee.mjs','@/domain/attendance-input':'./attendance.mjs','@/domain/master-payroll-output':'./output.mjs','@/domain/csv':'./csv.mjs'};
 for(const[path,name]of [['src/app/api/employees/client-import/route.ts','master'],['src/app/api/attendance/imports/route.ts','imports'],['src/app/api/payroll/route.ts','payroll'],['src/app/api/payroll/master-output/route.ts','export'],['src/app/api/payroll/reconciliation/route.ts','matching'],['src/app/api/designation-salaries/route.ts','retired'],['src/app/api/payroll/illustration/route.ts','estimate'],['src/app/api/attendance/month/route.ts','delete-month']])await compile(path,name+'.mjs',aliases);
 const master=await import(new URL('master.mjs',out)),attendance=await import(new URL('imports.mjs',out)),payroll=await import(new URL('payroll.mjs',out)),output=await import(new URL('export.mjs',out)),matching=await import(new URL('matching.mjs',out)),retired=await import(new URL('retired.mjs',out));
 const request=(payload,query='',id=company)=>new Request('http://localhost:3000/api/test'+query,{method:payload?'POST':'GET',headers:{origin:'http://localhost:3000','content-type':'application/json','x-company-id':id},...(payload?{body:JSON.stringify(payload)}:{})});
 async function post(handler,payload,status){const response=await handler(request(payload)),json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data??json;}
 const p={employeeCode:'API1',employeeName:'Duplicate Name',gender:'',dateOfBirth:'',maritalStatus:'',phone:'',aadhaar:'',pan:'',uan:'',esicNumber:'',joiningDate:'2026-05-01',exitDate:'',clientStatus:'Active',counterCode:'',counterName:'',reportingManager:'',workLocation:'Delhi',state:'Delhi',department:'Client Team',designation:'Client Role',accountNumber:'',ifscCode:'',amounts:{basic:1000000,da:200000,hra:300000,other:100000},salaryEffectiveFrom:'2026-05-01',salaryReference:{grossMinor:1600000,pfMinor:100000,esiMinor:12000,ctcMinor:1800000}};
 await post(payroll.POST,{action:'calculate',month:'2026-05-01'},422);
 await post(master.POST,{rows:[p,{...p,employeeCode:'API2',amounts:{basic:2000000,da:100000,hra:500000,other:400000},salaryReference:{grossMinor:3000000,pfMinor:0,esiMinor:0,ctcMinor:3000000}}]},201);
 await post(master.POST,{rows:[p]},422);await post(master.POST,{rows:[{...p,amounts:null}]},422);
 const employees=(await db.query('select employee_code,id,version from public.employees where company_id=$1 order by employee_code',[company])).rows;
 await post(master.POST,{rows:[p],mode:'update',expectedVersions:{API1:employees[0].version}},201);
 assert.equal((await db.query('select count(*)::integer n from public.employee_salary_assignments where company_id=$1',[company])).rows[0].n,2);
 const row=(employee,date,status='P')=>({employeeId:employee.id,date,status,shift:'',checkIn:'',checkOut:'',workMinutes:0,overtimeMinutes:0,leaveType:'',remarks:''});
 await post(attendance.POST,{reason:'Unknown master',rows:[row({id:'59000000-0000-4000-8000-000000000099'},'2026-05-01')]},422);
 await post(attendance.POST,{reason:'Reviewed first dates',rows:employees.map(employee=>row(employee,'2026-05-01'))},201);
 await post(attendance.POST,{reason:'Duplicate',rows:[row(employees[0],'2026-05-01')]},409);
 await post(payroll.POST,{action:'calculate',month:'2026-05-01'},422);
 await db.exec('reset role;delete from public.attendance_master_matches;set role authenticated;');await post(matching.POST,{month:'2026-05',reason:'Reviewed legacy uploaded CSV records'},200);
 const report=await(await matching.GET(request(null,'?month=2026-05'))).json();assert.equal(report.data.rows.length,2);assert.equal(report.data.rows[0].recordedDays,1);assert.equal(report.data.rows[0].expectedDays,31);
 const remaining=employees.flatMap(employee=>Array.from({length:30},(_,i)=>row(employee,'2026-05-'+String(i+2).padStart(2,'0'),employee.employee_code==='API1'&&i===0?'A':'P')));
 await post(attendance.POST,{reason:'Reviewed remaining dates',rows:remaining},201);await db.query('select public.finalize_attendance($1,$2)',[company,'2026-05-01']);
 const runId=await post(payroll.POST,{action:'calculate',month:'2026-05-01'},200);assert.ok(runId);
 let run=(await db.query('select version from public.payroll_runs where id=$1',[runId])).rows[0];await post(payroll.POST,{action:'approve',month:'2026-05-01',expectedVersion:run.version},200);run=(await db.query('select version from public.payroll_runs where id=$1',[runId])).rows[0];await post(payroll.POST,{action:'lock',month:'2026-05-01',expectedVersion:run.version},200);
 const json=await(await output.GET(request(null,'?month=2026-05'))).json(),csv=await(await output.GET(request(null,'?month=2026-05&export=csv'))).text();const{parseCSVMatrix}=await import(new URL('csv.mjs',out));assert.deepEqual(parseCSVMatrix(csv),[json.data.columns,...json.data.rows]);assert.equal(json.data.rows.find(row=>row[0]==='API1')[18],'15483.87');assert.equal(json.data.rows.find(row=>row[0]==='API2')[18],'30000.00');
 const version=(await db.query('select version from public.employees where id=$1',[employees[0].id])).rows[0].version;
 await post(master.POST,{mode:'update',expectedVersions:{API1:version},rows:[{...p,salaryEffectiveFrom:'2026-06-01',amounts:{basic:1100000,da:200000,hra:300000,other:100000},salaryReference:{grossMinor:1700000,pfMinor:100000,esiMinor:12000,ctcMinor:1900000}}]},201);
 assert.equal(await(await output.GET(request(null,'?month=2026-05&export=csv'))).text(),csv);
 assert.equal((await output.GET(request(null,'?month=2026-05','59000000-0000-4000-8000-000000000099'))).status,403);await post(retired.POST,{action:'initialize'},410);const estimate=await import(new URL('estimate.mjs',out));assert.equal((await estimate.GET(request(null,'?month=2026-05'))).status,410);
 const deletion=await import(new URL('delete-month.mjs',out));
 const lockedPreview=await(await deletion.GET(request(null,'?month=2026-05'))).json();assert.match(lockedPreview.data.blockedReason,/approval/);
 async function clear(payload,status,id=company){const req=new Request(request(payload,'',id),{method:'DELETE'});const response=await deletion.DELETE(req);const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json;}
 await clear({month:'2026-05',confirmedMonth:'2026-05',expectedRevision:lockedPreview.data.revision,expectedCount:62,reason:'Protected month'},409);
 await post(attendance.POST,{reason:'June fixture',rows:[row(employees[0],'2026-06-01')]},201);
 let deletionPreview=(await(await deletion.GET(request(null,'?month=2026-06'))).json()).data;
 await clear({month:'2026-06',confirmedMonth:'2026-05',expectedRevision:deletionPreview.revision,expectedCount:1,reason:'Wrong month'},422);
 await post(attendance.POST,{reason:'Concurrent June fixture',rows:[row(employees[0],'2026-06-02')]},201);
 await clear({month:'2026-06',confirmedMonth:'2026-06',expectedRevision:deletionPreview.revision,expectedCount:1,reason:'Stale review'},409);
 deletionPreview=(await(await deletion.GET(request(null,'?month=2026-06'))).json()).data;
 const deletionPayload={month:'2026-06',confirmedMonth:'2026-06',expectedRevision:deletionPreview.revision,expectedCount:2,reason:'Replace incorrect attendance file'};
 await clear(deletionPayload,403,'59000000-0000-4000-8000-000000000099');assert.equal((await clear(deletionPayload,200)).data.deleted,2);
 assert.equal((await db.query('select count(*)::integer n from public.attendance_records where company_id=$1 and date between $2 and $3',[company,'2026-06-01','2026-06-30'])).rows[0].n,0);
 assert.equal(await(await output.GET(request(null,'?month=2026-05&export=csv'))).text(),csv);
 console.log('PASS actual month deletion handler: typed month, stale review, tenant denial, protected locked payroll, exact deletion and preserved other-month exports.');
 console.log('PASS actual handlers: master import/update, canonical code identity, different salaries/same names, unknown attendance rejection, duplicates, reconciliation, incomplete-payroll denial, calculation/approval/locking and snapshot CSV equality after a later salary revision.');
 console.log('Auth and REST transports are fixtures. No live client records were changed.');
}catch(error){console.error('Master API workflow failed',{message:error.message,code:error.code,where:error.where});process.exitCode=1;}finally{await db.close();delete globalThis.masterFixture;}
