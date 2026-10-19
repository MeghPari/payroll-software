import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const database=new PGlite();
try{
 await database.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon,service_role;`);
 for(const name of ['202610080001_foundation.sql','202610090002_foundation_hardening.sql']){
  const sql=await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
  await database.exec(sql.replace('create extension if not exists pgcrypto;',''));
 }
 await database.exec(`insert into public.companies(id,name)values('30000000-0000-4000-8000-000000000011','Existing company fixture');`);
 await database.exec(await readFile(new URL('../supabase/upgrade.sql',import.meta.url),'utf8'));
 const result=await database.query(`select name from public.companies where id='30000000-0000-4000-8000-000000000011'`);
 if(result.rows[0]?.name!=='Existing company fixture')throw new Error('Existing company changed during upgrade.');
 console.log('PASS packaged additive upgrade preserves existing company records.');
 await database.exec(`
 insert into auth.users values('30000000-0000-4000-8000-000000000012','upgrade-fixture@example.invalid',now());
 insert into public.user_profiles(id,display_name)values('30000000-0000-4000-8000-000000000012','Existing operator fixture');
 insert into public.user_company_roles(company_id,user_id,role)values('30000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000012','Super Admin');
 insert into public.employees(id,company_id,user_id,employee_code,first_name,last_name,email,joining_date)values('30000000-0000-4000-8000-000000000013','30000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000012','UPGRADE01','Existing','Employee','employee-fixture@example.invalid','2026-09-01');
 insert into public.employee_bank_details(company_id,employee_id,account_holder_name,account_number,ifsc_code)values('30000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000013','Existing Employee','1234567890','TEST0001234');
 insert into public.employee_statutory_details(company_id,employee_id,bank_status)values('30000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000013','Verified');
 `);
 const preservedTables=['user_profiles','user_company_roles','employees','employee_bank_details','employee_statutory_details'];
 const before=[];
 for(const table of preservedTables)before.push((await database.query(`select to_jsonb(row) as record from public.${table} row`)).rows);
 await database.exec(await readFile(new URL('../supabase/upgrade-next.sql',import.meta.url),'utf8'));
 const after=await database.query(`select name from public.companies where id='30000000-0000-4000-8000-000000000011'`);
 if(after.rows[0]?.name!=='Existing company fixture')throw new Error('Existing company changed during next upgrade.');
 const tables=await database.query(`select to_regclass('public.disbursement_batches')::text as batches,to_regclass('public.invoices')::text as invoices`);
 if(!tables.rows[0]?.batches||!tables.rows[0]?.invoices)throw new Error('Additional upgrade tables missing.');
 for(let index=0;index<preservedTables.length;index++){
  const afterRows=(await database.query(`select to_jsonb(row) as record from public.${preservedTables[index]} row`)).rows;
  if(JSON.stringify(afterRows)!==JSON.stringify(before[index]))throw new Error(`Upgrade changed existing ${preservedTables[index]} records.`);
 }
 console.log('PASS next upgrade applies atomically after the original package and preserves the company.');
 console.log('PASS existing operator, membership, employee, bank details and verification are preserved.');
 await database.exec(await readFile(new URL('../supabase/upgrade-remaining.sql',import.meta.url),'utf8'));
 for(let index=0;index<preservedTables.length;index++){
  const rows=(await database.query(`select to_jsonb(row) as record from public.${preservedTables[index]} row`)).rows;
  if(JSON.stringify(rows)!==JSON.stringify(before[index]))throw new Error(`Remaining upgrade changed existing ${preservedTables[index]} records.`);
 }
 console.log('PASS remaining upgrade preserves existing identities, memberships, employees and verified bank records. Storage service is not present in this upgrade fixture.');

 await database.exec(`select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000012',false);
 insert into public.payroll_runs(id,company_id,month,status,version)values('30000000-0000-4000-8000-000000000014','30000000-0000-4000-8000-000000000011','2026-09-01','Locked',4);
 insert into public.payroll_run_employees(company_id,run_id,employee_id,gross_minor,deduction_minor,net_minor,employer_minor,snapshot)values('30000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000014','30000000-0000-4000-8000-000000000013',10000,1000,9000,500,'{"employeeCode":"UPGRADE01","employeeName":"Existing Employee","month":"2026-09-01","calendarDays":30,"paidDays":30,"earnings":{"basic":10000},"deductions":{"loan":1000},"employer":{"employerOther":500},"salary":{"effectiveFrom":"2026-09-01","structure":"Fixture","amounts":{"basic":10000}},"attendance":{"payrollDays":30,"payableDays":30},"baselineGrossMinor":10000}');
 select public.generate_payslips('30000000-0000-4000-8000-000000000011','2026-09-01');select public.publish_payslips('30000000-0000-4000-8000-000000000011','2026-09-01');
 do $$declare c uuid:='30000000-0000-4000-8000-000000000011';g uuid;receivable uuid;sales uuid;bankledger uuid;party uuid;invoice uuid;bank uuid;begin
 g:=public.save_account(c,'{"kind":"group","name":"Preserved Assets","type":"Asset"}');receivable:=public.save_account(c,jsonb_build_object('kind','ledger','name','Receivable','code','AR','groupId',g));bankledger:=public.save_account(c,jsonb_build_object('kind','ledger','name','Bank','code','BANK','groupId',g));g:=public.save_account(c,'{"kind":"group","name":"Preserved Income","type":"Income"}');sales:=public.save_account(c,jsonb_build_object('kind','ledger','name','Sales','code','SALES','groupId',g));
 perform public.configure_financial_year(c,'2026-04-01','2027-03-31');bank:=public.save_bank_account(c,jsonb_build_object('kind','Bank','name','Preserved Bank','accountId',bankledger));party:=public.save_party(c,'{"kind":"Customer","name":"Preserved Customer"}');
 invoice:=public.create_invoice(c,jsonb_build_object('kind','Sales','partyId',party,'invoiceNumber','PRESERVED-INV','date','2026-09-01','dueDate','2026-09-30','taxMode','None','controlAccountId',receivable,'baseAccountId',sales,'items',jsonb_build_array(jsonb_build_object('description','Preserved sale','quantity','1','unitPriceMinor',10000,'discountMinor',0,'taxBasisPoints',0))));perform public.post_invoice(c,invoice,1);perform public.record_invoice_payment(c,invoice,bank,5000,'2026-09-02','PRESERVED-RECEIPT','Reviewed fixture receipt');end $$;`);
 const financialTables=['payroll_runs','payroll_run_employees','payslips','journal_entries','journal_lines','invoices','invoice_items','invoice_payments','bank_transactions'];const financialBefore=[];
 for(const table of financialTables)financialBefore.push((await database.query(`select to_jsonb(row) record from public.${table} row`)).rows);
 await database.exec(await readFile(new URL('../supabase/upgrade-followup.sql',import.meta.url),'utf8'));
 for(let index=0;index<financialTables.length;index++){const rows=(await database.query(`select to_jsonb(row) record from public.${financialTables[index]} row`)).rows;if(JSON.stringify(rows)!==JSON.stringify(financialBefore[index]))throw new Error('Followup changed existing financial records in '+financialTables[index]);}
 console.log('PASS locked payroll, published payslips, posted invoice/journals and partial payment records preserved exactly.');
 for(let index=0;index<preservedTables.length;index++){const rows=(await database.query(`select to_jsonb(row) as record from public.${preservedTables[index]} row`)).rows;if(JSON.stringify(rows)!==JSON.stringify(before[index]))throw new Error('Followup upgrade changed existing '+preservedTables[index]+' records.');}
 console.log('PASS followup upgrade applies after 001-031 and preserves existing identities and verified bank records.');
 const beforeCorrections=[];for(const table of financialTables)beforeCorrections.push((await database.query(`select to_jsonb(row) record from public.${table} row`)).rows);
 await database.exec(await readFile(new URL('../supabase/upgrade-payroll-finance.sql',import.meta.url),'utf8'));
 for(let index=0;index<financialTables.length;index++){const rows=(await database.query(`select to_jsonb(row) record from public.${financialTables[index]} row`)).rows;if(JSON.stringify(rows)!==JSON.stringify(beforeCorrections[index]))throw new Error('Payroll/finance upgrade changed existing '+financialTables[index]);}
 console.log('PASS payroll/finance upgrade preserves locked payroll, published payslips, posted journals/invoices and payment evidence exactly.');
 await database.exec(await readFile(new URL('../supabase/upgrade-optional-payroll-setup.sql',import.meta.url),'utf8'));
 await database.exec(await readFile(new URL('../supabase/upgrade-client-review.sql',import.meta.url),'utf8'));
 for(let index=0;index<financialTables.length;index++){const rows=(await database.query(`select to_jsonb(row) as record from public.${financialTables[index]} row`)).rows;if(JSON.stringify(rows)!==JSON.stringify(financialBefore[index]))throw Error('Client review upgrade rewrote '+financialTables[index]);}
 console.log('PASS optional setup and client-review packages preserve locked payroll, published payslips and posted/paid financial history.');
 await database.exec(await readFile(new URL('../supabase/upgrade-client-templates.sql',import.meta.url),'utf8'));
 for(let index=0;index<financialTables.length;index++){const rows=(await database.query(`select to_jsonb(row) record from public.${financialTables[index]} row`)).rows;if(JSON.stringify(rows)!==JSON.stringify(financialBefore[index]))throw Error('Client templates upgrade rewrote '+financialTables[index]);}
 await database.exec(await readFile(new URL('../supabase/upgrade-attendance-new-employees.sql',import.meta.url),'utf8'));
 for(let index=0;index<financialTables.length;index++){const rows=(await database.query(`select to_jsonb(row) record from public.${financialTables[index]} row`)).rows;if(JSON.stringify(rows)!==JSON.stringify(financialBefore[index]))throw Error('New attendance upgrade rewrote '+financialTables[index]);}
 await database.exec(await readFile(new URL('../supabase/upgrade-salary-all-months.sql',import.meta.url),'utf8'));
 for(let index=0;index<financialTables.length;index++){const rows=(await database.query(`select to_jsonb(row) record from public.${financialTables[index]} row`)).rows;if(JSON.stringify(rows)!==JSON.stringify(financialBefore[index]))throw Error('Salary carry upgrade rewrote '+financialTables[index]);}
 console.log('PASS client-template, attendance onboarding and salary carry upgrades preserve all protected financial fixtures.');
}catch(error){console.error('Upgrade test failed',{message:error.message,code:error.code});process.exitCode=1;}finally{await database.close();}
