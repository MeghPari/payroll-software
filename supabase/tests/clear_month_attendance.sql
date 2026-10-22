begin;
insert into auth.users(id,email,email_confirmed_at)values('50000000-0000-4000-8000-000000000001','delete@example.invalid',now());
insert into public.user_profiles(id)values('50000000-0000-4000-8000-000000000001');
insert into public.companies(id,name)values('50000000-0000-4000-8000-000000000011','Delete fixture'),('50000000-0000-4000-8000-000000000012','Other tenant');
insert into public.user_company_roles(company_id,user_id,role)values('50000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000001','Super Admin');
insert into public.employees(id,company_id,employee_code,first_name,last_name,email,joining_date)values('50000000-0000-4000-8000-000000000021','50000000-0000-4000-8000-000000000011','DEL1','Delete','Fixture','','2026-01-01'),('50000000-0000-4000-8000-000000000022','50000000-0000-4000-8000-000000000012','DEL1','Other','Tenant','','2026-01-01');
insert into public.attendance_records(company_id,employee_id,date,status,source,modified_by)values
('50000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000021','2026-05-01','Present','CSV','50000000-0000-4000-8000-000000000001'),
('50000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000021','2026-05-31','Paid Leave','Manual','50000000-0000-4000-8000-000000000001'),
('50000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000021','2026-06-01','Absent','CSV','50000000-0000-4000-8000-000000000001'),
('50000000-0000-4000-8000-000000000012','50000000-0000-4000-8000-000000000022','2026-05-01','Present','CSV','50000000-0000-4000-8000-000000000001');
insert into public.attendance_periods(company_id,month)values('50000000-0000-4000-8000-000000000011','2026-05-01');
insert into public.payroll_runs(id,company_id,month,status)values('50000000-0000-4000-8000-000000000031','50000000-0000-4000-8000-000000000011','2026-05-01','Calculated');
insert into public.payroll_run_employees(company_id,run_id,employee_id,gross_minor,deduction_minor,net_minor,employer_minor,snapshot)values('50000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000031','50000000-0000-4000-8000-000000000021',100,0,100,0,'{}');
insert into public.attendance_import_batches(id,company_id,actor_id,row_count)values('50000000-0000-4000-8000-000000000041','50000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000001',2);
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
do $$declare c uuid:='50000000-0000-4000-8000-000000000011';p jsonb;n integer;begin
 p:=public.attendance_month_delete_preview(c,'2026-05-01');
 begin perform public.delete_month_attendance(c,'2026-05-01',p->>'revision',2,'   ');raise exception 'FAIL blank remark';exception when invalid_parameter_value then null;end;
 begin perform public.delete_month_attendance(c,'2026-05-01',p->>'revision',2,E'\n\t ');raise exception 'FAIL whitespace remark';exception when invalid_parameter_value then null;end;
 begin perform public.delete_month_attendance(c,'2026-05-01',p->>'revision',2,'ab');raise exception 'FAIL short remark';exception when invalid_parameter_value then null;end;
 if(p->>'count')::integer<>2 or not(p->>'resetsPayrollPreview')::boolean then raise exception 'FAIL preview';end if;
 begin perform public.delete_month_attendance(c,'2026-05-01',p->>'revision',1,'Test mismatch');raise exception 'FAIL count mismatch';exception when serialization_failure then null;end;
 begin perform public.attendance_month_delete_preview('50000000-0000-4000-8000-000000000012','2026-05-01');raise exception 'FAIL other company';exception when insufficient_privilege then null;end;
 begin perform public.attendance_month_delete_preview(c,'2026-05-02');raise exception 'FAIL invalid month';exception when invalid_parameter_value then null;end;
end $$;
-- A concurrent attendance write invalidates the reviewed preview.
reset role;
create temp table deletion_preview as select public.attendance_month_delete_preview('50000000-0000-4000-8000-000000000011','2026-05-01')p;
update public.attendance_records set status='Absent'where company_id='50000000-0000-4000-8000-000000000011'and date='2026-05-01';
do $$declare c uuid:='50000000-0000-4000-8000-000000000011';p jsonb;begin
 select d.p into p from deletion_preview d;
 begin perform public.delete_month_attendance(c,'2026-05-01',p->>'revision',2,'Reviewed deletion');raise exception 'FAIL stale preview';exception when serialization_failure then null;end;
 update public.attendance_periods set finalized_at=now()where company_id=c and month='2026-05-01';
 p:=public.attendance_month_delete_preview(c,'2026-05-01');begin perform public.delete_month_attendance(c,'2026-05-01',p->>'revision',2,'Reviewed deletion');raise exception 'FAIL finalized deletion';exception when sqlstate 'P0050'then null;end;
 update public.attendance_periods set finalized_at=null where company_id=c and month='2026-05-01';
 p:=public.attendance_month_delete_preview(c,'2026-05-01');
 if public.delete_month_attendance(c,'2026-05-01',p->>'revision',2,'Replace incorrect file')<>2 then raise exception 'FAIL deletion count';end if;
 if exists(select 1 from public.attendance_records where company_id=c and date between '2026-05-01'and'2026-05-31')then raise exception 'FAIL month not cleared';end if;
 if(select count(*)from public.attendance_records where date='2026-06-01')<>1 or(select count(*)from public.attendance_records where company_id='50000000-0000-4000-8000-000000000012')<>1 then raise exception 'FAIL month/tenant scope';end if;
 if(select status from public.payroll_runs where company_id=c and month='2026-05-01')<>'Draft'or exists(select 1 from public.payroll_run_employees where company_id=c)then raise exception 'FAIL preview reset';end if;
 if not exists(select 1 from public.audit_logs where company_id=c and action='Month Attendance Deleted'and metadata->>'reason'='Replace incorrect file')then raise exception 'FAIL deletion audit';end if;
 update public.payroll_runs set status='Locked'where company_id=c and month='2026-05-01';
 p:=public.attendance_month_delete_preview(c,'2026-05-01');if p->>'blockedReason'is null then raise exception 'FAIL protected payroll';end if;
 begin perform public.delete_month_attendance(c,'2026-05-01',p->>'revision',0,'Protected month');raise exception 'FAIL locked deletion';exception when sqlstate 'P0050'then null;end;
end $$;
update public.user_company_roles set role='Employee'where company_id='50000000-0000-4000-8000-000000000011';
set local role authenticated;
do $$begin begin perform public.attendance_month_delete_preview('50000000-0000-4000-8000-000000000011','2026-06-01');raise exception 'FAIL forbidden role';exception when insufficient_privilege then null;end;end $$;
rollback;
