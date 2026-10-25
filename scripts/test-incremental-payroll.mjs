import {PGlite}from'@electric-sql/pglite';import{readFile,readdir}from'node:fs/promises';import assert from'node:assert/strict';
const db=new PGlite();try{
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;`);
for(const name of(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec((await readFile('supabase/migrations/'+name,'utf8')).replace('create extension if not exists pgcrypto;',''));
const c='66000000-0000-4000-8000-000000000011',u='66000000-0000-4000-8000-000000000001';await db.exec(`insert into auth.users values('${u}','batch@example.invalid',now());insert into public.user_profiles(id)values('${u}');insert into public.companies(id,name)values('${c}','Incremental payroll');insert into public.user_company_roles(company_id,user_id,role)values('${c}','${u}','Super Admin');set role authenticated;select set_config('request.jwt.claim.sub','${u}',false);`);
const employees=[];for(let i=0;i<3;i++){
const e=(await db.query(`select public.save_employee($1,$2::jsonb) id`,[c,JSON.stringify({employeeCode:'BATCH-'+i,firstName:'Batch',lastName:'Employee '+i,email:'',joiningDate:i===2?'2026-03-16':'2026-03-01'})])).rows[0].id;
const v=(await db.query('select version from public.employees where id=$1',[e])).rows[0].version;await db.query(`select public.save_employee_salary_components($1,$2,'2026-03-16','{"basic":3100000}','{}',$3,'Sample')`,[c,e,v]);employees.push(e);}
await db.exec(`do $$declare eg uuid;lg uuid;ag uuid;expense uuid;payable uuid;ledger uuid;begin
 eg:=public.save_account('${c}','{"kind":"group","name":"Expenses","type":"Expense"}');lg:=public.save_account('${c}','{"kind":"group","name":"Liabilities","type":"Liability"}');ag:=public.save_account('${c}','{"kind":"group","name":"Assets","type":"Asset"}');
 expense:=public.save_account('${c}',jsonb_build_object('kind','ledger','name','Salary expense','code','SAL','groupId',eg));payable:=public.save_account('${c}',jsonb_build_object('kind','ledger','name','Salary payable','code','PAY','groupId',lg));ledger:=public.save_account('${c}',jsonb_build_object('kind','ledger','name','Bank','code','BANK','groupId',ag));perform public.save_bank_account('${c}',jsonb_build_object('kind','Bank','accountId',ledger,'name','Company bank'));perform public.configure_financial_year('${c}','2025-04-01','2026-03-31');perform public.configure_financial_year('${c}','2026-04-01','2027-03-31');perform public.save_payroll_accounts('${c}',jsonb_build_object('salaryExpense',expense,'netPayable',payable));end $$;reset role;`);
for(const e of employees){await db.query(`insert into public.employee_bank_details(company_id,employee_id,account_holder_name,account_number,ifsc_code)values($1,$2,'Sample employee','1234567890','TEST0123456')on conflict(company_id,employee_id)do update set account_holder_name=excluded.account_holder_name,account_number=excluded.account_number,ifsc_code=excluded.ifsc_code`,[c,e]);await db.query(`insert into public.employee_statutory_details(company_id,employee_id,bank_status)values($1,$2,'Verified')on conflict(company_id,employee_id)do update set bank_status='Verified'`,[c,e]);}
await db.exec('set role authenticated');
const bank=(await db.query('select id from public.bank_accounts where company_id=$1',[c])).rows[0].id;
const postAndPrepare=async(run)=>{const v=(await db.query('select version from public.payroll_runs where id=$1',[run])).rows[0].version;await db.query('select public.post_payroll_batch($1,$2,$3)',[c,run,v]);return(await db.query('select public.prepare_disbursement_for_run($1,$2,$3) id',[c,run,bank])).rows[0].id;};
const attendance=async(i,days=31)=>db.query('select public.import_attendance($1,$2::jsonb,$3)',[c,JSON.stringify(Array.from({length:days-(i===2?15:0)},(_,d)=>({employeeId:employees[i],date:'2026-03-'+String(d+1+(i===2?15:0)).padStart(2,'0'),status:'P'}))),'Batch attendance']);
await attendance(0);await attendance(1,30);
const validate=async()=>(await db.query(`select public.validate_payroll($1,'2026-03-01') data`,[c])).rows[0].data;
assert.equal((await validate()).readyCount,1);assert.equal((await validate()).blockingErrors,0);
const calculate=async()=>(await db.query(`select public.calculate_payroll($1,'2026-03-01') id`,[c])).rows[0].id;
const first=await calculate();assert.equal(Number((await db.query('select count(*) n from public.payroll_run_employees')).rows[0].n),1);assert.equal(await calculate(),first);
const transition=async(action)=>{const v=(await db.query('select version from public.payroll_runs where company_id=$1 order by batch_number desc limit 1',[c])).rows[0].version;await db.query(`select public.transition_payroll($1,'2026-03-01',$2,$3,'')`,[c,action,v]);};
// Unrelated employee attendance must not invalidate the first batch's approval.
await db.query(`select public.import_attendance($1,$2::jsonb,'Finish second employee')`,[c,JSON.stringify([{employeeId:employees[1],date:'2026-03-31',status:'A'}])]);
await transition('approve');await assert.rejects(calculate(),e=>e.code==='P0052');await transition('lock');await db.query(`select public.generate_payslips($1,'2026-03-01')`,[c]);await db.query(`select public.publish_payslips($1,'2026-03-01')`,[c]);
const firstPaymentBatch=await postAndPrepare(first);
await db.query(`select public.record_salary_payment($1,$2,$3,1000000,'2026-03-31','FIRST-PART','Actual sample bank confirmation')`,[c,firstPaymentBatch,employees[0]]);
const oldPayment=(await db.query('select public.disbursement_batch_by_id($1,$2) b',[c,firstPaymentBatch])).rows[0].b;
const old=(await db.query('select to_jsonb(p) data from public.payroll_run_employees p where run_id=$1',[first])).rows[0].data;
const second=await calculate();assert.notEqual(second,first);assert.equal(Number((await db.query('select count(*) n from public.payroll_run_employees')).rows[0].n),2);assert.deepEqual((await db.query('select to_jsonb(p) data from public.payroll_run_employees p where run_id=$1',[first])).rows[0].data,old);
await assert.rejects(db.query(`select public.save_attendance($1,$2::jsonb,'Correction',true)`,[c,JSON.stringify([{employeeId:employees[0],date:'2026-03-01',status:'A'}])]),e=>e.code==='23514');
await transition('approve');await transition('lock');const secondPaymentBatch=await postAndPrepare(second);
assert.equal((await db.query(`select public.list_month_payment_batches($1,'2026-03-01') batches`,[c])).rows[0].batches.length,2);
assert.deepEqual((await db.query('select public.disbursement_batch_by_id($1,$2) b',[c,firstPaymentBatch])).rows[0].b,oldPayment);
assert.equal(Number((await db.query('select public.disbursement_batch_by_id($1,$2) b',[c,secondPaymentBatch])).rows[0].b.items[0].paidMinor),0);
await db.query(`select public.record_salary_payment($1,$2,$3,2100000,'2026-04-01','FIRST-REST','Actual remaining bank confirmation')`,[c,firstPaymentBatch,employees[0]]);
await assert.rejects(db.query(`select public.record_salary_payment($1,$2,$3,1,'2026-04-01','EXCESS','Must reject duplicate payment')`,[c,firstPaymentBatch,employees[0]]),e=>e.code==='23514');
await attendance(2);const third=await calculate();assert.notEqual(third,second);assert.equal(Number((await db.query('select net_minor from public.payroll_run_employees where employee_id=$1',[employees[2]])).rows[0].net_minor),1600000);
assert.equal((await db.query(`select public.month_employee_payroll_status($1,'2026-03-01') s`,[c])).rows[0].s.length,3);assert.equal((await validate()).readyCount,0);assert.equal(await calculate(),third);
const foreign='66000000-0000-4000-8000-000000000099';await assert.rejects(db.query(`select public.month_employee_payroll_status($1,'2026-03-01')`,[foreign]),e=>e.code==='42501');
await assert.rejects(db.query('select public.disbursement_batch_by_id($1,$2)',[foreign,firstPaymentBatch]),e=>e.code==='42501');
assert.equal((await db.query(`select public.payroll_workflow_status($1,'2026-03-01') s`,[c])).rows[0].s.disbursed,false);
assert.equal((await db.query(`select has_function_privilege('authenticated','public.employee_payroll_fingerprint(uuid,uuid,date)','EXECUTE') allowed`)).rows[0].allowed,false);
const currentVersion=(await db.query('select version from public.payroll_runs where id=$1',[third])).rows[0].version;
await db.query(`select public.import_client_payroll_costs($1,'2026-03-01',$2,$3::jsonb,'Reviewed costs across batches')`,[c,currentVersion,JSON.stringify(employees.slice(0,2).map(employeeId=>({employeeId,expectedVersion:0,amounts:{insurance:100}})))]);
assert.equal(Number((await db.query('select count(*) n from public.payroll_client_costs where company_id=$1',[c])).rows[0].n),2);
const preview=(await db.query(`select public.attendance_month_delete_preview($1,'2026-03-01') p`,[c])).rows[0].p;assert.equal(preview.counts.salaryRows,3);assert.equal(preview.counts.payslips,1);assert.equal(preview.counts.payments,2);assert.ok(preview.counts.journals>=4);
await db.query(`select public.reset_attendance_payroll_month($1,'2026-03-01',$2,$3,'Reset all sample batches',true)`,[c,preview.revision,preview.count]);assert.equal(Number((await db.query('select count(*) n from public.payroll_runs')).rows[0].n),0);
console.log('PASS incremental payroll: full individual attendance, partial/no attendance excluded, repeat idempotence, later locked/published batches, exact join-date proration, employee markers, unchanged earlier snapshots, attendance protection separate accruals/payment batches, preserved partial payments, later settlement/overpayment denial and whole-month reset.');
}finally{await db.close();}
