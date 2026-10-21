import assert from 'node:assert/strict';import {readFile,writeFile,mkdir,access} from 'node:fs/promises';import ts from 'typescript';import {readSheet} from 'read-excel-file/node';
const out=new URL('../.test-output/client-templates-test/',import.meta.url);await mkdir(out,{recursive:true});
async function compile(path,name,replacements={}){let source=await readFile(new URL('../'+path,import.meta.url),'utf8');for(const[from,to]of Object.entries(replacements))source=source.replaceAll(from,to);await writeFile(new URL(name,out),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);}
await compile('src/domain/attendance-import-date.ts','date.mjs');await compile('src/domain/currency.ts','currency.mjs');await compile('src/domain/client-template-columns.ts','columns.mjs');await compile('src/domain/spreadsheet-import.ts','spreadsheet.mjs',{'./attendance-import-date':'./date.mjs'});await compile('src/domain/client-attendance.ts','attendance.mjs',{'./spreadsheet-import':'./spreadsheet.mjs','./client-template-columns':'./columns.mjs'});await compile('src/domain/client-employee.ts','employee.mjs',{'./currency':'./currency.mjs','./attendance-import-date':'./date.mjs','./spreadsheet-import':'./spreadsheet.mjs'});await compile('src/domain/client-salary-sheet.ts','salary.mjs',{'./client-template-columns':'./columns.mjs'});await compile('src/domain/csv.ts','csv.mjs');
await compile('src/domain/client-cost-import.ts','cost-import.mjs',{'./currency':'./currency.mjs','./spreadsheet-import':'./spreadsheet.mjs','./client-template-columns':'./columns.mjs'});
const{clientCostImport}=await import(new URL('cost-import.mjs',out));
const{CLIENT_EMPLOYEE_COLUMNS,CLIENT_SALARY_COLUMNS}=await import(new URL('columns.mjs',out)),{spreadsheetDate,sheetRecords,assertSafeXlsx}=await import(new URL('spreadsheet.mjs',out)),{clientAttendanceRows,clientAttendanceTemplate}=await import(new URL('attendance.mjs',out)),{parseClientEmployee}=await import(new URL('employee.mjs',out)),{clientSalaryValues,suggestedServiceCharge,suggestedInvoiceValue}=await import(new URL('salary.mjs',out)),{parseCSVMatrix,parseCSV}=await import(new URL('csv.mjs',out));
assert.equal(spreadsheetDate(46296),'2026-10-01');assert.equal(spreadsheetDate('01-Oct-2026'),'2026-10-01');assert.equal(spreadsheetDate('31-Feb-2026'),null);assert.equal(spreadsheetDate(new Date('2026-10-01T00:00:00Z')),'2026-10-01');assert.equal(spreadsheetDate(60),null);
const grid=[['Employee Code','Employee Name','Counter Code','Counter Name','Location','State','Function','Thu','Fri','Sat','Sun','Present','WFH','Half Day','Leave','Absent'],['','','','','','','',46296,46297,46298,46299],['CL1','Fixture Person','C1','Counter','Delhi','Delhi','Operations','P','WFH','HD','L',1,1,1,1,0]];
assert.throws(()=>clientAttendanceRows(grid,'2026-10',{}),/Choose whether L/);let rows=clientAttendanceRows(grid,'2026-10',{leave:'Paid Leave'});assert.deepEqual(rows.map(row=>row.status),['Present','Work From Home','Half Day','Paid Leave']);assert.equal(rows[0].date,'2026-10-01');assert.throws(()=>clientAttendanceRows(grid,'2026-09',{leave:'Paid Leave'}),/do not match/);
const holiday=structuredClone(grid);holiday[2][10]='H';assert.throws(()=>clientAttendanceRows(holiday,'2026-10',{}),/Choose whether H/);holiday[2][14]='';assert.equal(clientAttendanceRows(holiday,'2026-10',{holiday:'Weekly Off'})[3].status,'Weekly Off');
const blank=structuredClone(grid);blank[2][7]='';blank[2][11]=0;assert.equal(clientAttendanceRows(blank,'2026-10',{leave:'Unpaid Leave'}).length,3);const badSummary=structuredClone(grid);badSummary[2][11]=9;assert.throws(()=>clientAttendanceRows(badSummary,'2026-10',{leave:'Paid Leave'}),/summary does not match/);
assert.equal(parseCSVMatrix('A,A\n1,2')[0].length,2);assert.throws(()=>parseCSV('A,A\n1,2'),/unique/);assert.throws(()=>sheetRecords([['Code','Code'],['1','2']]),/Duplicate/);
const record=Object.fromEntries(CLIENT_EMPLOYEE_COLUMNS.map(key=>[key,'']));Object.assign(record,{'Employee Code':'CL1','Employee Name':'Fixture Person','Date of Birth (DOB)':'1-Jan-1995','Date of Joining (DOJ)':'1-Sep-2026',Status:'Active','Account Number':'0123456789','IFSC Code':'TEST0123456','Structured Basic':'10000','S. DA':'2000','S. HRA':'3000','S. Other Allowance':'1000','S. Gross':'16000','S. PF':'1200','S. ESI':'120','Total CTC':'18000'});
const employee=parseClientEmployee({record,salaryEffectiveFrom:'joining'});assert.equal(employee.amounts.da,200000);assert.equal(employee.accountNumber,'0123456789');assert.equal(employee.salaryReference.pfMinor,120000);assert.equal(employee.joiningDate,'2026-09-01');assert.throws(()=>parseClientEmployee({record:{...record,'S. Gross':'15999'},salaryEffectiveFrom:'joining'}),/S. Gross/);assert.throws(()=>parseClientEmployee({record,salaryEffectiveFrom:''}),/salary effective date/);assert.throws(()=>parseClientEmployee({record:{...record,Status:'Left'},salaryEffectiveFrom:'joining'}),/leaving date/);
const snapshot={employee_id:'one',gross_minor:1775000,deduction_minor:35000,net_minor:1740000,employer_minor:0,snapshot:{employeeCode:'CL1',employeeName:'Fixture',earnings:{basic:1000000,da:200000,hra:300000,other:100000,sunday:100000,overtime:50000,incentive:25000},deductions:{uniformAdvance:20000,vehicleDamage:10000,recovery:5000},employer:{},attendance:{present:30,absent:0}}};
const identity={id:'one',joining_date:'2026-09-01',work_location:'Delhi',state:'Delhi',accountNumber:'0123456789'};
const values=clientSalaryValues(snapshot,identity,undefined,5);assert.equal(values.length,40);assert.equal(values[16],'2000.00');assert.equal(values[19],'1750.00');assert.equal(values[20],'17750.00');assert.equal(values[38],'17400.00');assert.equal(values[34],'');assert.match(values[39],/need review/);
const reviewed=clientSalaryValues(snapshot,identity,{payroll_version:5,amounts:{invoiceValue:2500000,serviceCharge:79875}},5);assert.equal(reviewed[34],'25000.00');assert.equal(reviewed[31],'798.75');assert.equal(clientSalaryValues(snapshot,identity,{payroll_version:4,amounts:{invoiceValue:2500000}},5)[34],'');
const supplied=Object.fromEntries(CLIENT_SALARY_COLUMNS.map((header,index)=>[header,reviewed[index]]));supplied['Advance Salary Paid']='';const parsedCost=clientCostImport({record:supplied},[{employeeId:'one',employeeName:'Fixture',values, cost:null}]);assert.equal(parsedCost.amounts.invoiceValue,2500000);assert.equal(parsedCost.amounts.serviceCharge,79875);assert.throws(()=>clientCostImport({record:{...supplied,'Final Net Pay':'1'}},[{employeeId:'one',employeeName:'Fixture',values,cost:null}]),/differs from saved payroll/);
assert.equal(suggestedServiceCharge(1775000),79875);assert.equal(suggestedInvoiceValue(1775000,10000,{employerEpf:10000,employerEps:5000,edli:1000,pfAdmin:1000,insurance:2000,serviceCharge:79875,gratuity:3000}),1886875);assert.throws(()=>suggestedInvoiceValue(100,0,{}),/Enter all/);
assert.throws(()=>assertSafeXlsx(new ArrayBuffer(20)),/Invalid XLSX/);
// Optional local acceptance: the user's originals remain outside the repository.
for(const name of ['Salary_Structure.xlsx','Employee_Database.xlsx','Attendance_Template.xlsx']){
 const path=(process.env.CLIENT_TEMPLATE_DIR??'C:/Users/parih/Downloads')+'/'+name;try{await access(path);}catch{continue;}
 const bytes=await readFile(path);assertSafeXlsx(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));const actual=await readSheet(path);
 if(name==='Salary_Structure.xlsx')assert.deepEqual(actual[0],CLIENT_SALARY_COLUMNS);
 if(name==='Employee_Database.xlsx')assert.deepEqual(actual[0],CLIENT_EMPLOYEE_COLUMNS);
 if(name==='Attendance_Template.xlsx'){assert.equal(spreadsheetDate(actual[1][7]),'2026-10-01');assert.equal(actual[0].length,43);assert.throws(()=>clientAttendanceRows(actual,'2026-10',{}),/no marked dates/);}
 console.log('PASS actual client workbook read and header/date compatibility: '+name);
}
console.log('PASS client templates: Excel/day-first dates, monthly code mappings, summary checks, blanks, exact salary components, leading-zero identifiers, duplicate-header denial, 40-column salary mapping and stale-cost exclusion. No live records imported.');

const{parseEmployeeDataset}=await import(new URL('employee.mjs',out));
assert.equal(parseEmployeeDataset({record,salaryEffectiveFrom:'joining'}).amounts.basic,1000000);
assert.throws(()=>parseEmployeeDataset({record:{...record,'S. DA':''},salaryEffectiveFrom:'joining'}),/S. DA is required/);
assert.equal(parseEmployeeDataset({record:{...record,'S. DA':'0','S. Gross':'14000'},salaryEffectiveFrom:'joining'}).amounts.da,0);
console.log('PASS employee dataset requires explicit components, accepts zero and retains exact paise.');

await compile('src/domain/dates.ts','month-dates.mjs');await compile('src/domain/salary-structure-month.ts','structure-month.mjs',{'./dates':'./month-dates.mjs'});
const{salaryStructureMonth,structureDisplayName}=await import(new URL('structure-month.mjs',out));
const structures=[{id:'s1',name:'Sample monthly salary - September 2026'},{id:'s2',name:'Other structure'}];
const employees=[{id:'e1',joiningDate:'2026-09-01'},{id:'e2',joiningDate:'2026-10-15'},{id:'e3',joiningDate:'2026-08-01',exitDate:'2026-09-15'}];
const revisions=[{employeeId:'e1',structureId:'s1',effectiveFrom:'2026-09-01',revisedGross:70000},{employeeId:'e1',structureId:'s2',effectiveFrom:'2026-10-01',revisedGross:80000},{employeeId:'e1',structureId:'s1',effectiveFrom:'2026-11-01',revisedGross:90000},{employeeId:'e2',structureId:'s1',effectiveFrom:'2026-10-15',revisedGross:60000},{employeeId:'e3',structureId:'s1',effectiveFrom:'2026-08-01',revisedGross:50000}];
const september=salaryStructureMonth(structures,employees,revisions,'September 2026'),october=salaryStructureMonth(structures,employees,revisions,'October 2026');
assert.equal(september.structures[0].employeeCount,2);assert.equal(september.assignments.e1.gross,70000);assert.equal(september.assignments.e2,undefined);
assert.equal(october.structures[0].employeeCount,1);assert.equal(october.structures[1].employeeCount,1);assert.equal(october.assignments.e1.gross,80000);assert.equal(october.assignments.e3,undefined);assert.equal(salaryStructureMonth(structures,employees,revisions,'2026-08').assignments.e1,undefined);
assert.equal(salaryStructureMonth(structures,[{...employees[0],joiningDate:'2026-07-01'}],revisions,'2026-07').assignments.e1.gross,70000);
assert.equal(salaryStructureMonth(structures,employees,revisions,'2026-12').assignments.e1.gross,90000);
assert.equal(structureDisplayName(structures[0].name),'Sample monthly salary');assert.equal(structureDisplayName('September union agreement'),'September union agreement');assert.equal(structures[0].name,'Sample monthly salary - September 2026');
assert.equal(salaryStructureMonth(structures,employees,revisions,'2024-02').endDate,'2024-02-29');
console.log('PASS selected-month salary structures: September/October revisions, future and exited employees, exact counts, stable structure IDs, carry-forward and neutral sample display without changing saved names.');

await compile('src/components/salary/client-template-fields.tsx','template-fields.mjs',{'@/domain/client-template-columns':'./columns.mjs'});
const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{ClientTemplateFields}=await import(new URL('template-fields.mjs',out));
const html=renderToStaticMarkup(React.createElement(ClientTemplateFields));
const renderedFields=[...html.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map(match=>match[1]).filter((_,index)=>index%2===0);
assert.deepEqual(renderedFields,[...CLIENT_SALARY_COLUMNS]);
for(const extra of ['Bonus','Conveyance','Variable Pay','Special Allowance'])assert.ok(!renderedFields.includes(extra));
console.log('PASS actual salary structure field table renders all 40 workbook labels in exact order without generic extra earnings.');

for(const month of ['2026-02','2026-06','2026-10']){const template=clientAttendanceTemplate(month);assert.equal(template.headers.length,43);assert.equal(template.rows[0].length,43);assert.equal(template.headers[38],'Present');assert.equal(template.headers[42],'Absent');}
const{createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(await readFile(new URL('../public/templates/Attendance_Template.xlsx',import.meta.url))).digest('hex'),'da1ff398ada3327c20d6f5f7b5b769fb30067d65300a6b5a6410f961e4a09ec3');console.log('PASS original XLSX byte identity and fixed client CSV grid columns for 28/30/31-day months.');
