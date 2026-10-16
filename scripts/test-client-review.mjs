import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
const out=new URL('../.test-output/client-review/',import.meta.url);await mkdir(out,{recursive:true});
async function compile(path,name,replacements={}){let source=await readFile(new URL('../'+path,import.meta.url),'utf8');for(const[from,to]of Object.entries(replacements))source=source.replaceAll(from,to);await writeFile(new URL(name,out),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);}
await compile('src/domain/payroll-comparison.ts','comparison.mjs');
await compile('src/domain/payroll-setup.ts','setup.mjs');
const {comparePayroll,previousPayrollMonth}=await import(new URL('comparison.mjs',out));
const {employeeSetupWarnings,hasUnconfiguredStatutory}=await import(new URL('setup.mjs',out));
assert.equal(previousPayrollMonth('2026-01'),'2025-12');assert.equal(previousPayrollMonth('2026-10'),'2026-09');assert.throws(()=>previousPayrollMonth('2026-13'));
const entry=(netMinor,employeeId='one')=>({employeeId,netMinor,paidDays:30});
assert.equal(comparePayroll([entry(8400000)],[entry(7000000)])[0].needsReview,true);
assert.equal(comparePayroll([entry(7000001)],[entry(7000000)])[0].needsReview,false);
assert.equal(comparePayroll([entry(0)],[entry(7000000)])[0].changePercent,-100);
assert.equal(comparePayroll([entry(100000)],[entry(0)])[0].needsReview,true);
assert.equal(comparePayroll([entry(10000)],[entry(0)])[0].needsReview,false);
assert.equal(comparePayroll([entry(7000000)],[])[0].previousNetMinor,null);
assert.equal(comparePayroll([entry(7000000)],[entry(7000000,'foreign')])[0].needsReview,false);
assert.throws(()=>comparePayroll([entry(1.2)],[]),/Invalid saved/);
const warnings=[{employeeId:'one',check:'Statutory Configuration',severity:'Warning',message:'Unknown flags'},{employeeId:'other',check:'Statutory Configuration',severity:'Warning',message:'Foreign warning'},{employeeId:'one',check:'Bank',severity:'Passed',message:'hidden'},null];
assert.deepEqual(employeeSetupWarnings(warnings,'one'),[warnings[0]]);assert.equal(hasUnconfiguredStatutory(employeeSetupWarnings(warnings,'one')),true);assert.deepEqual(employeeSetupWarnings({},'one'),[]);
console.log('PASS pay comparison month boundaries, exact threshold/zero/no-baseline handling and employee-scoped saved warnings.');

await writeFile(new URL('env.mjs',out),"export function getEnv(){return {APP_URL:'http://localhost:3000'}}");
await compile('src/server/http.ts','http.mjs',{'./env':'./env.mjs',"import 'server-only';":''});
await writeFile(new URL('auth.mjs',out),`
import {ApiError}from './http.mjs';
export async function tenant(request,permission){if(request.headers.get('x-company-id')!=='fixture'||globalThis.reviewFixture.denied)throw new ApiError(403,'FORBIDDEN','Denied');if(permission&&permission!=='users.manage')throw Error('Unexpected permission');return{companyId:'fixture',client:globalThis.reviewFixture.client};}
`);
await compile('src/app/api/users/route.ts','users.mjs',{'@/server/auth':'./auth.mjs','@/server/http':'./http.mjs'});
await compile('src/app/api/payslips/route.ts','payslips.mjs',{'@/server/auth':'./auth.mjs','@/server/http':'./http.mjs','@/domain/payroll-setup':'./setup.mjs'});
const rpcCalls=[];
globalThis.reviewFixture={denied:false,client:{
 rpc(name,args){rpcCalls.push({name,args});if(name==='list_company_members')return{order(){return this},range(){return Promise.resolve({data:[{user_id:'one',email:'client@example.invalid',display_name:'Client'}],error:null})}};return Promise.resolve({data:null,error:args.email_text==='missing@example.invalid'?{code:'P0002',message:'not found'}:null});},
 from(table){assert.equal(table,'payslips');const filters=[];const query={select(){return query},eq(key,value){filters.push([key,value]);return query},order(){return query},range(){return query},then(resolve){assert.ok(filters.some(([key,value])=>key==='company_id'&&value==='fixture'));return Promise.resolve(resolve({data:[{id:'slip',employee_id:'one',content:{setupWarnings:warnings}}],error:null}));}};return query;}
}};
try{
 const users=await import(new URL('users.mjs',out)),payslips=await import(new URL('payslips.mjs',out));
 const request=(path,input,company='fixture')=>new Request('http://localhost:3000/api/'+path,{method:input?'POST':'GET',headers:{'x-company-id':company,origin:'http://localhost:3000','content-type':'application/json'},...input?{body:JSON.stringify(input)}:{}});
 let response=await users.POST(request('users',{email:'client@example.invalid',role:'Payroll Admin',active:true}));assert.equal(response.status,200);assert.equal(rpcCalls.at(-1).name,'set_company_member_by_email');assert.equal(rpcCalls.at(-1).args.c,'fixture');
 response=await users.POST(request('users',{email:'missing@example.invalid',role:'Employee',active:true}));assert.equal(response.status,404);assert.equal((await response.json()).error.code,'ACCOUNT_NOT_READY');
 response=await users.POST(request('users',{userId:'00000000-0000-4000-8000-000000000001',email:'client@example.invalid',role:'Employee',active:true}));assert.equal(response.status,422);
 const count=rpcCalls.length;response=await users.POST(request('users',{email:'client@example.invalid',role:'Super Admin',active:true},'foreign'));assert.equal(response.status,403);assert.equal(rpcCalls.length,count);
 response=await users.GET(request('users'));assert.equal(response.status,200);assert.equal((await response.json()).data[0].display_name,'Client');
 response=await payslips.GET(request('payslips'));assert.equal(response.status,200);assert.deepEqual((await response.json()).data[0].content.setupWarnings,[warnings[0]]);
 console.log('PASS actual user/payslip handlers: email-only assignment, named member reads, unknown-account guidance, ambiguous-input/tenant denial and no other employee warnings in payslip responses.');
}finally{delete globalThis.reviewFixture;}

await writeFile(new URL('link.mjs',out),"import{createElement}from 'react';export default function Link({href,children}){return createElement('a',{href},children)}");
await compile('src/components/payroll/payroll-setup-notice.tsx','notice.mjs',{'next/link':'./link.mjs','@/domain/payroll-setup':'./setup.mjs'});
const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{PayrollSetupNotice}=await import(new URL('notice.mjs',out));
const markup=renderToStaticMarkup(React.createElement(PayrollSetupNotice,{warnings:employeeSetupWarnings(warnings,'one')}));assert.match(markup,/Provisional net pay/);assert.ok(!markup.includes('Foreign warning'));assert.equal(renderToStaticMarkup(React.createElement(PayrollSetupNotice,{warnings:[]})),'');
console.log('PASS saved warning notice remains explicit about provisional net pay without inventing warnings for fully configured payroll.');
