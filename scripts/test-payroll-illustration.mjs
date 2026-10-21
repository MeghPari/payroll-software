import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
const out=new URL('../.test-output/illustration/',import.meta.url);await mkdir(out,{recursive:true});
async function compile(path,name,replacements={}){let source=(await readFile(new URL('../'+path,import.meta.url),'utf8')).replace("import 'server-only';",'');for(const [from,to]of Object.entries(replacements))source=source.replaceAll(from,to);await writeFile(new URL(name,out),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);}
await compile('src/domain/money.ts','money.mjs');
await compile('src/domain/attendance-completeness.ts','completeness.mjs');
await compile('src/domain/payroll-illustration.ts','illustration.mjs',{'./money':'./money.mjs','./attendance-completeness':'./completeness.mjs'});
const {payrollIllustration}=await import(new URL('illustration.mjs',out));
const employee={id:'employee',employee_code:'TEST1',first_name:'Test',last_name:'Employee',joining_date:'2026-09-01',exit_date:null,status:'Active'};
const salary={employee_id:'employee',effective_from:'2026-09-01',employee_salary_component_values:[{component_code:'basic',amount_minor:7000000}]};
const attendance=Array.from({length:30},(_,index)=>({employee_id:'employee',date:'2026-09-'+String(index+1).padStart(2,'0'),status:'Present'}));
let rows=payrollIllustration('2026-09',[employee],[salary],attendance,[]);assert.equal(rows[0].baseEarningsMinor,7000000);assert.equal(rows[0].netMinor,null);
assert.equal(payrollIllustration('2026-09',[employee],[salary],attendance.slice(1),[])[0].baseEarningsMinor,null);
assert.equal(payrollIllustration('2026-09',[employee],[],attendance,[])[0].paidDays,30);
assert.equal(payrollIllustration('2026-09',[employee],[],attendance,[])[0].baseEarningsMinor,null);
assert.equal(payrollIllustration('2026-09',[employee],[salary],attendance,['employee'])[0].baseEarningsMinor,null);
assert.equal(payrollIllustration('2026-09',[{...employee,joining_date:'2026-09-16'}],[salary],attendance,[])[0].baseEarningsMinor,3500000);
const revision={...salary,effective_from:'2026-09-16',employee_salary_component_values:[{component_code:'basic',amount_minor:8000000}]};
assert.equal(payrollIllustration('2026-09',[employee],[salary,revision],attendance,[])[0].baseEarningsMinor,7500000);
const october=Array.from({length:31},(_,index)=>({employee_id:'employee',date:'2026-10-'+String(index+1).padStart(2,'0'),status:'Half Day'}));
assert.equal(payrollIllustration('2026-10',[employee],[{...salary,employee_salary_component_values:[{component_code:'basic',amount_minor:100003}]}],october,[])[0].baseEarningsMinor,50002);
assert.equal(payrollIllustration('2026-09',[employee],[salary],attendance.map(row=>({...row,status:'Absent'})),[])[0].baseEarningsMinor,0);
assert.equal(payrollIllustration('2026-09',[employee],[{...salary,effective_from:'2026-11-01'}, {...revision,effective_from:'2026-12-01'}],attendance,[])[0].baseEarningsMinor,7000000);
console.log('PASS exact calendar illustration, effective revisions, joining dates, half-day ties, missing-input/hold denial and unknown final net.');
await writeFile(new URL('env.mjs',out),"export function getEnv(){return {APP_URL:'http://localhost:3000'}}");
await compile('src/server/http.ts','http.mjs',{'./env':'./env.mjs'});
await writeFile(new URL('auth.mjs',out),`
import {ApiError} from './http.mjs';
export async function tenant(request,permission){if(request.headers.get('x-company-id')!=='fixture')throw new ApiError(403,'FORBIDDEN','Fixture membership denied');if(permission!=='payroll.run')throw Error('Wrong permission');
return{companyId:'fixture',client:{
async rpc(name){if(name!=='has_permission')throw Error('Business write RPC forbidden in this test');return{data:globalThis.illustrationFixture.readAllowed,error:null};},
from(table){const fixture=globalThis.illustrationFixture,filters=[];let start=0,end=499;
const q={select(){return q},eq(key,value){filters.push(row=>row[key]===value);return q},gte(key,value){filters.push(row=>row[key]>=value);return q},lt(key,value){filters.push(row=>row[key]<value);return q},is(key,value){filters.push(row=>row[key]===value);return q},order(){return q},range(a,b){start=a;end=b;return q},then(resolve){return Promise.resolve(resolve({data:fixture.tables[table].filter(row=>filters.every(filter=>filter(row))).slice(start,end+1),error:null}));}};return q;}
}};}
`);
await compile('src/app/api/payroll/illustration/route.ts','route.mjs',{'@/server/auth':'./auth.mjs','@/server/http':'./http.mjs','@/domain/payroll-illustration':'./illustration.mjs'});
const {GET}=await import(new URL('route.mjs',out));
globalThis.illustrationFixture={readAllowed:true,tables:{employees:[{...employee,company_id:'fixture'},{...employee,id:'foreign',first_name:'FOREIGN',company_id:'other'}],employee_salary_assignments:[{...salary,company_id:'fixture',dataset_salary:true},{...salary,company_id:'fixture',dataset_salary:false,employee_salary_component_values:[{component_code:'basic',amount_minor:99999999}]}],attendance_records:attendance.map(row=>({...row,company_id:'fixture'})),salary_holds:[]}};
try{
 const request=company=>new Request('http://localhost:3000/api/payroll/illustration?month=2026-09',{headers:{'x-company-id':company}});
 const before=JSON.stringify(globalThis.illustrationFixture.tables);const response=await GET(request('fixture'));assert.equal(response.status,200);
 const payload=(await response.json()).data;assert.equal(payload.persisted,false);assert.equal(payload.netCalculated,false);assert.equal(payload.rows.length,1);assert.equal(payload.rows[0].baseEarningsMinor,7000000);assert.equal(JSON.stringify(globalThis.illustrationFixture.tables),before);
 assert.equal((await GET(request('other'))).status,403);globalThis.illustrationFixture.readAllowed=false;assert.equal((await GET(request('fixture'))).status,403);
 console.log('PASS real read-only preview handler: company filtering, salary/attendance permission denial, no business writes and no fabricated bank/statutory records.');
}finally{delete globalThis.illustrationFixture;}
