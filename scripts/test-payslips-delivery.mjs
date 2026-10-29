import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir}from'node:fs/promises';
import ts from'typescript';
import{PDFDocument}from'pdf-lib';
const out=new URL('../.test-output/payslips-module/',import.meta.url);await mkdir(out,{recursive:true});
async function compile(path,name,replacements={}){let source=await readFile(new URL('../'+path,import.meta.url),'utf8');source=source.replace("import 'server-only';",'');for(const[from,to]of Object.entries(replacements))source=source.replaceAll(from,to);await writeFile(new URL(name,out),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);}
await compile('src/server/payslip-pdf.ts','pdf.mjs');await compile('src/server/payslip-email.ts','email.mjs');await compile('src/server/payslip-zip.ts','zip.mjs');
const{payslipPdf}=await import(new URL('pdf.mjs',out)),{sendPayslipEmail}=await import(new URL('email.mjs',out)),{payslipZip}=await import(new URL('zip.mjs',out));
const content={companyName:'SVS Corporate Services',companyProfile:{address:'Sample Office, Delhi, India',email:'payroll@example.invalid'},employeeName:'Alok Kumar',employeeCode:'ALOK-TEST',department:'Administration',designation:'Admin Executive',joiningDate:'2026-03-22',workLocation:'Delhi',month:'2026-03-01',calendarDays:31,paidDays:10,proration:'calendar',prorationDays:31,salary:{structure:'Employee dataset salary'},attendance:{present:8,weeklyOff:2,paidLeave:0,holidays:0,lopDays:0,halfDays:0},grossMinor:967742,deductionMinor:120000,netMinor:847742,earnings:{basic:600000,da:100000,hra:200000,other:67742},deductions:{pf:60000,esi:10000,tds:50000},employer:{}};
const id='78000000-0000-4000-8000-000000000001',date='2026-03-31T12:00:00Z';const pdf=await payslipPdf(content,id,'Published',date);assert.equal(Buffer.from(pdf).subarray(0,5).toString(),'%PDF-');const loaded=await PDFDocument.load(pdf);assert.ok(loaded.getPageCount()>=1);assert.equal(loaded.getTitle(),'Payslip ALOK-TEST 2026-03-01');await writeFile(new URL('example.pdf',out),pdf);
const long=await payslipPdf({...content,employeeName:'Long Employee Name '.repeat(12),earnings:Object.fromEntries(Array.from({length:90},(_,i)=>['Allowance '+i,100]))},id,'Draft',date);assert.ok((await PDFDocument.load(long)).getPageCount()>1);await writeFile(new URL('multipage.pdf',out),long);
const zip=payslipZip([{name:'example.pdf',bytes:pdf},{name:'crc.txt',bytes:new TextEncoder().encode('123456789')}]);assert.equal(Buffer.from(zip).readUInt32LE(),0x04034b50);assert.ok(Buffer.from(zip).includes(Buffer.from('example.pdf')));assert.ok(Buffer.from(zip).includes(Buffer.from([0x26,0x39,0xf4,0xcb])));await writeFile(new URL('example.zip',out),zip);
const originalFetch=globalThis.fetch,oldKey=process.env.RESEND_API_KEY,oldFrom=process.env.PAYSLIP_FROM_EMAIL;let requests=0;
try{
 process.env.RESEND_API_KEY='fixture-no-network';process.env.PAYSLIP_FROM_EMAIL='Payroll <payroll@example.invalid>';
 const input={attemptId:id,recipient:'alok@example.invalid',employeeName:content.employeeName,companyName:content.companyName,month:content.month,pdf};
 globalThis.fetch=async(url,options)=>{requests++;assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers['Idempotency-Key'],'payflow-payslip/'+id);const body=JSON.parse(options.body);assert.equal(body.to[0],input.recipient);assert.equal(body.attachments[0].content,Buffer.from(pdf).toString('base64'));return Response.json({id:'provider-fixture'});};
 assert.equal((await sendPayslipEmail(input)).status,'Sent');assert.equal(requests,1);
 globalThis.fetch=async()=>Response.json({}, {status:422});assert.equal((await sendPayslipEmail(input)).status,'Failed');
 globalThis.fetch=async()=>Response.json({}, {status:429});assert.equal((await sendPayslipEmail(input)).errorCode,'EMAIL_RATE_LIMITED');
 globalThis.fetch=async()=>Response.json({}, {status:503});assert.equal((await sendPayslipEmail(input)).status,'Unconfirmed');
 globalThis.fetch=async()=>{throw new DOMException('timeout','TimeoutError');};assert.equal((await sendPayslipEmail(input)).status,'Unconfirmed');
 delete process.env.RESEND_API_KEY;assert.equal((await sendPayslipEmail(input)).errorCode,'EMAIL_PROVIDER_NOT_CONFIGURED');
}finally{globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey;if(oldFrom===undefined)delete process.env.PAYSLIP_FROM_EMAIL;else process.env.PAYSLIP_FROM_EMAIL=oldFrom;}
// Exercise the actual HTTP handlers with inert auth/provider transports.
await writeFile(new URL('env.mjs',out),"export function getEnv(){return{APP_URL:'http://localhost:3000'}}");
await compile('src/server/http.ts','http.mjs',{'./env':'./env.mjs'});
await writeFile(new URL('auth.mjs',out),`import{ApiError}from'./http.mjs';export async function tenant(request,permission){if(request.headers.get('x-company-id')!=='fixture'||globalThis.payslipFixture.denied)throw new ApiError(403,'FORBIDDEN','Denied');globalThis.payslipFixture.permission=permission;return{companyId:'fixture',client:globalThis.payslipFixture.client};}`);
const map={'@/server/auth':'./auth.mjs','@/server/http':'./http.mjs','@/server/payslip-pdf':'./pdf.mjs','@/server/payslip-zip':'./zip.mjs','@/server/payslip-email':'./email.mjs'};
await compile('src/app/api/payslips/dashboard/route.ts','dashboard.mjs',map);await compile('src/app/api/payslips/manage/route.ts','manage.mjs',map);await compile('src/app/api/payslips/zip/route.ts','zip-route.mjs',map);await compile('src/app/api/payslips/email/route.ts','email-route.mjs',map);
const calls=[];globalThis.payslipFixture={denied:false,permission:'',client:{rpc:async(name,args)=>{calls.push({name,args});return{data:name==='payslip_module_dashboard'?{items:[],canManage:true}:1,error:null};},from(){const query={select(){return query},eq(){return query},in(){return Promise.resolve({data:[],error:null})}};return query;}}};
const request=(path,input,origin='http://localhost:3000',company='fixture')=>new Request('http://localhost:3000/api/payslips/'+path,{method:input?'POST':'GET',headers:{origin,'x-company-id':company,'content-type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});
try{
 const dashboard=await import(new URL('dashboard.mjs',out)),manage=await import(new URL('manage.mjs',out)),zipRoute=await import(new URL('zip-route.mjs',out)),emailRoute=await import(new URL('email-route.mjs',out));
 let response=await dashboard.GET(request('dashboard?month=2026-03-01'));assert.equal(response.status,200);assert.equal(calls.at(-1).args.c,'fixture');
 response=await manage.POST(request('manage',{action:'generate',month:'2026-03-01',ids:[id]}));assert.equal(response.status,200);assert.equal(calls.at(-1).name,'payslip_module_generate');assert.equal(globalThis.payslipFixture.permission,'payroll.run');
 response=await manage.POST(request('manage',{action:'publish',month:'2026-03-01',ids:[id]}));assert.equal(response.status,200);assert.equal(calls.at(-1).name,'payslip_module_publish');assert.equal(globalThis.payslipFixture.permission,'payroll.approve');
 const count=calls.length;response=await manage.POST(request('manage',{action:'generate',month:'2026-03-01',ids:[id]},'https://foreign.invalid'));assert.equal(response.status,403);assert.equal(calls.length,count);
 response=await manage.POST(request('manage',{action:'generate',month:'2026-03-01',ids:[id]},'http://localhost:3000','foreign'));assert.equal(response.status,403);
 response=await manage.POST(request('manage',{action:'generate',month:'2026-03-01',ids:[]}));assert.equal(response.status,422);
 response=await zipRoute.POST(request('zip',{ids:[id]}));assert.equal(response.status,404);
 response=await emailRoute.POST(request('email',{ids:[id],requestKey:id}));assert.equal(response.status,503);assert.equal((await response.json()).error.code,'EMAIL_PROVIDER_NOT_CONFIGURED');
 const beforeProviderFetch=globalThis.fetch,beforeKey=process.env.RESEND_API_KEY,beforeFrom=process.env.PAYSLIP_FROM_EMAIL;
 try{
  process.env.RESEND_API_KEY='fixture-no-network';process.env.PAYSLIP_FROM_EMAIL='Payroll <payroll@example.invalid>';
  const slipRow={id,status:'Published',content,generated_at:date};
  globalThis.payslipFixture.client.from=()=>{const query={select(){return query},eq(){return query},maybeSingle(){return Promise.resolve({data:slipRow,error:null})},in(){return Promise.resolve({data:[slipRow],error:null})}};return query;};
  globalThis.payslipFixture.client.rpc=async(name,args)=>{calls.push({name,args});return{data:name==='payslip_email_claim'?{id,acquired:true,recipient:'alok@example.invalid'}:null,error:null};};
  globalThis.fetch=async()=>Response.json({id:'provider-route-fixture'});
  response=await emailRoute.POST(request('email',{ids:[id],requestKey:id}));assert.equal(response.status,200);assert.equal((await response.json()).data.results[0].status,'Sent');assert.equal(calls.at(-1).name,'payslip_email_complete');assert.equal(calls.at(-1).args.outcome,'Sent');
  globalThis.fetch=async()=>Response.json({}, {status:422});response=await emailRoute.POST(request('email',{ids:[id],requestKey:id}));assert.equal(response.status,200);assert.equal((await response.json()).data.results[0].status,'Failed');assert.equal(calls.at(-1).args.outcome,'Failed');
  globalThis.fetch=async()=>{throw new DOMException('timeout','TimeoutError');};response=await emailRoute.POST(request('email',{ids:[id],requestKey:id}));assert.equal((await response.json()).data.results[0].status,'Unconfirmed');assert.equal(calls.at(-1).args.outcome,'Unconfirmed');
  response=await zipRoute.POST(request('zip',{ids:[id]}));assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/zip');assert.equal(Buffer.from(await response.arrayBuffer()).readUInt32LE(),0x04034b50);assert.equal(calls.at(-1).name,'record_private_download');
 }finally{globalThis.fetch=beforeProviderFetch;if(beforeKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=beforeKey;if(beforeFrom===undefined)delete process.env.PAYSLIP_FROM_EMAIL;else process.env.PAYSLIP_FROM_EMAIL=beforeFrom;}

}finally{delete globalThis.payslipFixture;}
console.log('PASS actual payslip HTTP handlers: scoped permissions, tenant/origin validation, bounded selections, missing ZIP record denial, no fake email success.');
console.log('PASS professional PDF, long-name multipage layout, valid ZIP headers/CRC, email attachment/idempotency request, failure/timeout classification. No real emails sent.');
