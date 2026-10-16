import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
const out=new URL('../.test-output/payroll-views/',import.meta.url);await mkdir(out,{recursive:true});
async function compile(path,name,replacements={}){let source=await readFile(new URL('../'+path,import.meta.url),'utf8');for(const [from,to]of Object.entries(replacements))source=source.replaceAll(from,to);await writeFile(new URL(name,out),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);}
await compile('src/domain/dates.ts','dates.mjs');
await compile('src/domain/payroll-setup.ts','setup.mjs');
await compile('src/domain/attendance-import-date.ts','import-date.mjs');
await compile('src/domain/daily-attendance-roster.ts','daily-roster.mjs');
await compile('src/domain/attendance-completeness.ts','completeness.mjs');
await compile('src/domain/csv.ts','csv.mjs');
await compile('src/domain/attendance-input.ts','attendance-input.mjs');
await writeFile(new URL('fixtures.mjs',out),`export async function getPayrollRun(){globalThis.viewFixture.runReads++;return globalThis.viewFixture.run;}export async function payrollAction(){throw Error('Read-only fixture');}export const componentCodes=['basic'];export async function getEmployees(){globalThis.viewFixture.employeeReads++;return globalThis.viewFixture.employees;}export async function tenantApi(path,options){if(options?.method==='POST'){globalThis.viewFixture.saved=JSON.parse(options.body);return{status:'Completed'};}return {items:globalThis.viewFixture.attendance,total:globalThis.viewFixture.attendance.length};}export async function getAuditTrail(){return [];}export function getSalaryStructures(){}export function getSalaryStructureById(){}export function updateSalaryStructure(){}export function createSalaryStructure(){}`);
await compile('src/services/payroll.service.ts','payroll.mjs',{'./payroll-run.service':'./fixtures.mjs','./salary-structure.service':'./fixtures.mjs','@/domain/dates':'./dates.mjs','@/domain/payroll-setup':'./setup.mjs'});
await compile('src/services/attendance.service.ts','attendance.mjs',{'@/lib/tenant-api':'./fixtures.mjs','@/domain/dates':'./dates.mjs','./employee.service':'./fixtures.mjs','./audit.service':'./fixtures.mjs','@/domain/attendance-completeness':'./completeness.mjs','@/domain/attendance-import-date':'./import-date.mjs'});
const fixture={runReads:0,employeeReads:0,run:{attendanceFinalized:true,run:{id:'fixture',version:7,status:'Locked',locked_at:'2026-09-30'},workflow:{posted:true,published:true,disbursed:false},snapshots:[{employee_id:'employee',gross_minor:50002,deduction_minor:10001,net_minor:40001,employer_minor:0,snapshot:{baselineGrossMinor:100003,earnings:{basic:50002},deductions:{pf:10001},employer:{},salary:{effectiveFrom:'2026-09-01',structure:'fixture',amounts:{basic:100003}},attendance:{payableDays:15,lopDays:15}}}]},employees:[{id:'employee',status:'Active',joiningDate:'2026-09-29',exitDate:'2026-09-30'}],attendance:[{id:'first',employee_id:'employee',date:'2026-09-29',status:'Half Day',work_minutes:240,overtime_minutes:0},{id:'second',employee_id:'employee',date:'2026-09-30',status:'Missing Punch',work_minutes:0,overtime_minutes:0}]};globalThis.viewFixture=fixture;
try{
 const {dailyAttendanceRoster}=await import(new URL('daily-roster.mjs',out));
 const rosterEmployee={id:'first',joiningDate:'2026-09-01',status:'Active'};
 const roster=dailyAttendanceRoster([rosterEmployee,{...rosterEmployee,id:'second'},{...rosterEmployee,id:'future',joiningDate:'2026-10-01'},{...rosterEmployee,id:'exited',exitDate:'2026-08-31'},{...rosterEmployee,id:'inactive',status:'Inactive'}],[{employeeId:'first',date:'2026-09-29',status:'Present'},{employeeId:'second',date:'2026-09-28',status:'Absent'}],'2026-09-29');
 assert.equal(roster.length,2);assert.equal(roster[0].record.status,'Present');assert.equal(roster[1].record,undefined);assert.equal(roster[1].employee.id,'second');
 console.log('PASS daily roster includes unmarked employees without inventing absence/presence, ignores other dates and respects employment eligibility.');
 const {payrollReviewFromData,payrollPeriodFromData,getPayrollReview}=await import(new URL('payroll.mjs',out));
 const rows=payrollReviewFromData(fixture.run,'2026-09'),period=payrollPeriodFromData(fixture.run,'2026-09');
 assert.equal(fixture.runReads,0);assert.equal(rows[0].adjustedGross,500.02);assert.equal(rows[0].totalDeductions,100.01);assert.equal(rows[0].netPayable,400.01);assert.equal(period.version,7);assert.equal(period.approved,true);assert.equal(period.posted,true);assert.equal(period.disbursed,false);assert.equal(period.status,'Locked');
 assert.deepEqual(await getPayrollReview('2026-09'),rows);assert.equal(fixture.runReads,1);
 const {dailyAttendanceCounts,getEmployeeAttendanceMonth,getMonthlyAttendanceRegister,getEmployeeMonthAttendance,validateAttendanceImport,bulkImportAttendance}=await import(new URL('attendance.mjs',out));const register=await getMonthlyAttendanceRegister('2026-09',fixture.employees);
 assert.equal(fixture.employeeReads,0);assert.equal(register.length,1);assert.equal(register[0].summary.payrollDays,2);assert.equal(register[0].summary.payableDays,.5);assert.equal(register[0].summary.lopDays,.5);assert.equal(register[0].summary.missing,1);assert.equal((await getEmployeeMonthAttendance('employee','2026-09')).length,2);
 const profileMonth=await getEmployeeAttendanceMonth(fixture.employees[0],'2026-09');assert.equal(profileMonth.records.length,2);assert.equal(profileMonth.records[0].date,'2026-09-30');assert.equal(profileMonth.summary.payableDays,.5);assert.equal(fixture.employeeReads,0);
 console.log('PASS employee profile attendance uses saved rows and the same summary, employment filtering and no directory refetch.');
 const dailyCounts=dailyAttendanceCounts(fixture.employees,[{employeeId:'employee',date:'2026-09-29',status:'Present'},{employeeId:'foreign',date:'2026-09-29',status:'Absent'},{employeeId:'employee',date:'2026-09-30',status:'Absent'}],'2026-09-29');assert.equal(dailyCounts.total,1);assert.equal(dailyCounts.present,1);assert.equal(dailyCounts.absent,0);assert.equal(dailyCounts.late,null);
 const {normalizeAttendanceImportDate}=await import(new URL('import-date.mjs',out));
 assert.equal(normalizeAttendanceImportDate('05-10-2026'),'2026-10-05');assert.equal(normalizeAttendanceImportDate('5/10/2026'),'2026-10-05');assert.equal(normalizeAttendanceImportDate('2026-10-05'),'2026-10-05');assert.equal(normalizeAttendanceImportDate('31-02-2026'),null);assert.equal(normalizeAttendanceImportDate('29-02-2024'),'2024-02-29');
 fixture.attendance=[];
 const upload={employeeId:'employee',date:'29-09-2026',shift:'General',checkIn:'09:00',checkOut:'17:00',workHours:'8',status:'Present',leaveType:'',overtime:'0',remarks:'Fixture'};
 let validation=await validateAttendanceImport([upload],'2026-09');assert.equal(validation[0].status,'Valid');assert.equal(validation[0].data.date,'2026-09-29');
 validation=await validateAttendanceImport([{...upload,date:'05-10-2026'}],'2026-09');assert.match(validation[0].issues.join(' '),/outside the selected/);
 validation=await validateAttendanceImport([{...upload,date:'31-02-2026'}],'2026-09');assert.match(validation[0].issues.join(' '),/Invalid date/);
 validation=await validateAttendanceImport([upload,{...upload,date:'2026-09-29'}],'2026-09');assert.equal(validation[1].status,'Error');
 await bulkImportAttendance([upload],'2026-09');assert.equal(fixture.saved.rows[0].date,'2026-09-29');
 console.log('PASS ISO/Indian date normalization, invalid leap/day rejection, true month mismatches, mixed-format duplicate denial and canonical date submission.');
 console.log('PASS salary view preserves captured paise, versions and payment state without duplicate run reads; attendance reuses supplied employees and respects employment dates, half days and missing punches.');
 const {parseCSV}=await import(new URL('csv.mjs',out)),{attendanceInput}=await import(new URL('attendance-input.mjs',out));
 const sample=parseCSV(await readFile(new URL('../public/samples/attendance-sample-october-2026.csv',import.meta.url),'utf8'));
 assert.equal(sample.length,7);
 const browserSample=JSON.parse(await readFile(new URL('../src/data/attendance-sample.json',import.meta.url),'utf8'));
 assert.deepEqual(browserSample,sample.map(row=>Object.values(row)),'Browser download must match the standalone CSV sample');
 attendanceInput.parse({rows:sample.map(row=>({employeeId:'00000000-0000-4000-8000-000000000001',date:row.Date,shift:row.Shift,checkIn:row['Check-In'],checkOut:row['Check-Out'],workMinutes:Number(row['Work Hours'])*60,status:row['Attendance Status'],leaveType:row['Leave Type'],overtimeMinutes:Number(row.Overtime)*60,remarks:row.Remarks}))});
 console.log('PASS sample CSV parses into seven rows and passes the real attendance input schema after replacing its employee-code placeholder.');
 console.log('Read transports are fixtures. No live attendance or salary records were changed.');
}finally{delete globalThis.viewFixture;}

// Render actual blocker guidance with inert link/button transports.
await writeFile(new URL('ui.mjs',out),"import{createElement}from 'react';export default function Link({href,children}){return createElement('a',{href},children)}export function Button({children}){return createElement('button',null,children)}");
await compile('src/components/payroll/payroll-blockers.tsx','blockers.mjs',{'next/link':'./ui.mjs','@/components/ui/button':'./ui.mjs'});
const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{PayrollBlockers}=await import(new URL('blockers.mjs',out));
const markup=renderToStaticMarkup(React.createElement(PayrollBlockers,{employees:[{id:'employee',fullName:'Fixture Name',employeeCode:'EMP1'}],issues:[...['No Salary Assigned','Missing Bank Details','Statutory Configuration'].map(check=>({employeeId:'employee',check,severity:'Blocking Error',message:'Fixture issue'})),{employeeId:'employee',check:'Passed',severity:'Passed',message:'hidden-passed-check'}],onReviewOvertime(){}}));
assert.ok(markup.includes('Fixture Name (EMP1)'));assert.ok(markup.includes('/employees/employee?tab=salary'));assert.ok(markup.includes('/employees/employee?tab=kyc'));assert.ok(!markup.includes('hidden-passed-check'));console.log('PASS real payroll blocker component shows named issues and links salary/bank/statutory fixes to the correct employee tabs.');
