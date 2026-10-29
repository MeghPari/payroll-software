-- Payslips only. Does not recalculate payroll or alter payment workflows.
begin;
create index payslip_module_month on public.payslips(company_id,month,employee_id);
create table public.payslip_revisions(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),payslip_id uuid not null,
 run_version integer not null,content jsonb not null,status text not null,generated_at timestamptz not null,
 archived_at timestamptz not null default now(),archived_by uuid references public.user_profiles(id)
);
create index payslip_revision_history on public.payslip_revisions(company_id,payslip_id,archived_at desc);
alter table public.payslip_revisions enable row level security;
revoke all on public.payslip_revisions from public,anon,authenticated;
grant select on public.payslip_revisions to authenticated;
create policy payslip_revision_read on public.payslip_revisions for select to authenticated using(public.has_permission(company_id,'payslips.read'));
create table public.payslip_email_attempts(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),payslip_id uuid not null,
 request_key uuid not null,recipient text not null,month date not null,employee_code text not null,
 status text not null default 'Sending' check(status in('Sending','Sent','Failed','Unconfirmed')),
 provider_id text,error_code text,created_at timestamptz not null default now(),completed_at timestamptz,
 actor_id uuid not null references public.user_profiles(id),unique(company_id,payslip_id,request_key)
);
create index payslip_email_history on public.payslip_email_attempts(company_id,payslip_id,created_at desc);
alter table public.payslip_email_attempts enable row level security;
revoke all on public.payslip_email_attempts from public,anon,authenticated;
grant select on public.payslip_email_attempts to authenticated;
create policy payslip_email_read on public.payslip_email_attempts for select to authenticated using(public.has_permission(company_id,'payslips.read'));

create function public.archive_payslip_revision()returns trigger language plpgsql security definer set search_path=''as $$begin
 if old.content is distinct from new.content or old.generated_at is distinct from new.generated_at then
  if old.status='Published' then raise exception 'Published payslip content is immutable'using errcode='23514';end if;
  insert into public.payslip_revisions(company_id,payslip_id,run_version,content,status,generated_at,archived_by)
  values(old.company_id,old.id,old.run_version,old.content,old.status,old.generated_at,auth.uid());
 end if;return new;end $$;
create trigger payslip_revision_archive before update on public.payslips for each row execute function public.archive_payslip_revision();
revoke all on function public.archive_payslip_revision()from public,anon,authenticated,service_role;

create function public.payslip_source_valid(s jsonb,g bigint,d bigint,n bigint)returns boolean language plpgsql immutable set search_path=''as $$begin
 if s is null or jsonb_typeof(s->'salary')is distinct from 'object' or jsonb_typeof(s->'attendance')is distinct from 'object' or jsonb_typeof(s#>'{salary,amounts}')is distinct from 'object' or nullif(s#>>'{salary,effectiveFrom}','')is null
 or jsonb_typeof(s->'earnings')is distinct from 'object' or jsonb_typeof(s->'deductions')is distinct from 'object'
 or nullif(s->>'employeeName','')is null or nullif(s->>'employeeCode','')is null
 or g is null or d is null or n is null or g<0 or d<0 or n<0 or g-d<>n then return false;end if;
 if not(s#>'{salary,amounts}'?'basic')or coalesce(s->>'calendarDays','')!~'^(28|29|30|31)$'
 or coalesce(s->>'paidDays','')!~'^[0-9]+(\.[0-9]+)?$'or coalesce(s#>>'{attendance,payableDays}','')!~'^[0-9]+(\.[0-9]+)?$'then return false;end if;
 if(s->>'paidDays')::numeric>(s->>'calendarDays')::numeric or(s->>'paidDays')::numeric<>(s#>>'{attendance,payableDays}')::numeric then return false;end if;
 if exists(select 1 from jsonb_each_text(s->'earnings')v where value is null or value!~'^-?[0-9]+$')
 or exists(select 1 from jsonb_each_text(s->'deductions')v where value is null or value!~'^[0-9]+$')then return false;end if;
 return coalesce((select sum(value::numeric)from jsonb_each_text(s->'earnings')),0)=g
 and coalesce((select sum(value::numeric)from jsonb_each_text(s->'deductions')),0)=d;
end $$;
revoke all on function public.payslip_source_valid(jsonb,bigint,bigint,bigint)from public,anon,authenticated,service_role;

create function public.payslip_module_dashboard(c uuid,m date)returns jsonb language plpgsql stable security definer set search_path=''as $$declare items jsonb;admin boolean;begin
 if not public.is_member(c)then raise exception 'Permission denied'using errcode='42501';end if;if m is null or extract(day from m)<>1 then raise exception 'First day required'using errcode='22023';end if;
 admin:=public.has_permission(c,'payslips.read');
 select coalesce(jsonb_agg(jsonb_build_object(
 'employeeId',e.id,'employeeName',coalesce(p.content->>'employeeName',s.snapshot->>'employeeName',e.first_name||' '||e.last_name),
 'employeeCode',coalesce(p.content->>'employeeCode',s.snapshot->>'employeeCode',e.employee_code),
 'department',coalesce(p.content->>'department',dep.name,''),'email',case when admin then e.email else ''end,
 'grossMinor',coalesce((p.content->>'grossMinor')::bigint,s.gross_minor),'netMinor',coalesce((p.content->>'netMinor')::bigint,s.net_minor),
 'payslipId',p.id,'status',case when p.status='Published'then 'Published'when p.id is not null then 'Generated'else 'Not generated'end,
 'runStatus',r.status,'batchNumber',r.batch_number,'generatedAt',p.generated_at,'publishedAt',p.published_at,
 'canGenerate',r.status='Locked'and public.payslip_source_valid(s.snapshot,s.gross_minor,s.deduction_minor,s.net_minor),
 'reason',case when s.employee_id is null then 'Calculate salary first.'when r.status<>'Locked'then 'Approve and lock this employee payroll batch first.'
 when not public.payslip_source_valid(s.snapshot,s.gross_minor,s.deduction_minor,s.net_minor)then 'Saved salary or attendance details are incomplete. Review the payroll source.'else ''end,
 'emailStatus',coalesce(a.status,'Not sent'),'emailAttemptId',a.id,'emailError',a.error_code,
 'emailsSent',exists(select 1 from public.payslip_email_attempts x where x.company_id=c and x.payslip_id=p.id and x.status='Sent')
 )order by e.employee_code),'[]')into items
 from public.employees e left join public.payroll_run_employees s on s.company_id=c and s.employee_id=e.id and s.payroll_month=m
 left join public.payroll_runs r on r.company_id=c and r.id=s.run_id
 left join public.payslips p on p.company_id=c and p.employee_id=e.id and p.month=m
 left join public.departments dep on dep.company_id=c and dep.id=coalesce((s.snapshot->>'departmentId')::uuid,e.department_id)
 left join lateral(select * from public.payslip_email_attempts x where x.company_id=c and x.payslip_id=p.id order by x.created_at desc,x.id desc limit 1)a on admin
 where e.company_id=c and((e.joining_date<m+interval '1 month'and(e.exit_date is null or e.exit_date>=m)and e.status<>'Inactive')or p.id is not null)
 and(admin or(e.user_id=auth.uid()and p.status='Published'));
 return jsonb_build_object('items',items,'canManage',admin);
end $$;

create function public.payslip_module_generate(c uuid,m date,employee_ids uuid[],regenerate boolean default false)returns integer language plpgsql security definer set search_path=''as $$
declare e uuid;src record;prior public.payslips;company public.companies;payload jsonb;n integer:=0;begin
 perform public.require_permission(c,'payroll.run');perform public.require_permission(c,'payslips.read');
 select * into company from public.companies where id=c for update;
 if m is null or extract(day from m)<>1 or coalesce(cardinality(employee_ids),0)not between 1 and 100 then raise exception 'Select 1 to 100 employees'using errcode='22023';end if;
 for e in select distinct unnest(employee_ids)loop
  select s.*,r.version,r.status,emp.email,emp.joining_date,emp.work_location,dep.name department,des.name designation into src
  from public.payroll_run_employees s join public.payroll_runs r on r.company_id=c and r.id=s.run_id
  join public.employees emp on emp.company_id=c and emp.id=s.employee_id
  left join public.departments dep on dep.company_id=c and dep.id=coalesce((s.snapshot->>'departmentId')::uuid,emp.department_id)
  left join public.designations des on des.company_id=c and des.id=emp.designation_id
  where s.company_id=c and s.employee_id=e and s.payroll_month=m for update of s,r;
  if not found or src.status<>'Locked'then raise exception 'Select employees with locked payroll'using errcode='23514';end if;
  select * into prior from public.payslips where company_id=c and run_id=src.run_id and employee_id=e for update;
  if prior.id is not null and(prior.status='Published'or not regenerate)then continue;end if;
  if not public.payslip_source_valid(src.snapshot,src.gross_minor,src.deduction_minor,src.net_minor)then raise exception 'Incomplete saved payroll details'using errcode='23514';end if;
  payload:=src.snapshot||jsonb_build_object('companyName',company.name,'companyProfile',company.profile,'department',coalesce(src.department,''),'designation',coalesce(src.designation,''),'joiningDate',src.joining_date,'workLocation',src.work_location,
   'grossMinor',src.gross_minor,'deductionMinor',src.deduction_minor,'netMinor',src.net_minor,'employerMinor',src.employer_minor);
  if prior.id is null then
   insert into public.payslips(company_id,run_id,employee_id,month,run_version,content,generated_by)values(c,src.run_id,e,m,src.version,payload,auth.uid());
  else update public.payslips set content=payload,run_version=src.version,generated_at=clock_timestamp(),generated_by=auth.uid()where id=prior.id and company_id=c;end if;n:=n+1;
 end loop;
 perform public.audit_event(c,'Payslips Generated','payslip',null,jsonb_build_object('month',m,'count',n,'regeneration',regenerate));return n;
end $$;

create function public.payslip_module_publish(c uuid,slip_ids uuid[])returns integer language plpgsql security definer set search_path=''as $$declare p public.payslips;n integer:=0;begin
 perform public.require_permission(c,'payroll.approve');perform public.require_permission(c,'payslips.read');perform 1 from public.companies where id=c for update;
 if coalesce(cardinality(slip_ids),0)not between 1 and 100 then raise exception 'Select 1 to 100 payslips'using errcode='22023';end if;
 for p in select * from public.payslips where company_id=c and id=any(slip_ids)for update loop
  if not exists(select 1 from public.payroll_runs where company_id=c and id=p.run_id and version=p.run_version and status='Locked')then raise exception 'Payslip payroll version changed'using errcode='40001';end if;
  if p.status='Draft'then update public.payslips set status='Published',published_by=auth.uid(),published_at=now()where company_id=c and id=p.id;n:=n+1;end if;
 end loop;
 if(select count(distinct id)from public.payslips where company_id=c and id=any(slip_ids))<>(select count(distinct x)from unnest(slip_ids)x)then raise exception 'Payslip not found'using errcode='P0002';end if;
 perform public.audit_event(c,'Payslips Published','payslip',null,jsonb_build_object('count',n));return n;
end $$;

create function public.payslip_email_claim(c uuid,slip uuid,request_key uuid)returns jsonb language plpgsql security definer set search_path=''as $$declare p public.payslips;a public.payslip_email_attempts;recipient text;begin
 perform public.require_permission(c,'payroll.approve');perform public.require_permission(c,'payslips.read');perform 1 from public.companies where id=c for update;
 select * into p from public.payslips where company_id=c and id=slip for update;
 if not found or p.status<>'Published'then raise exception 'Publish the payslip before emailing'using errcode='23514';end if;
 select * into a from public.payslip_email_attempts x where x.company_id=c and x.payslip_id=slip and x.request_key=payslip_email_claim.request_key;
 if found then return to_jsonb(a)||jsonb_build_object('acquired',false);end if;
 if exists(select 1 from public.payslip_email_attempts where company_id=c and payslip_id=slip and status in('Sent','Sending','Unconfirmed'))then raise exception 'Email is already sent or its outcome needs review'using errcode='23514';end if;
 select trim(email)into recipient from public.employees where company_id=c and id=p.employee_id;
 if coalesce(recipient,'')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'then raise exception 'Employee work email is required'using errcode='22023';end if;
 insert into public.payslip_email_attempts(company_id,payslip_id,request_key,recipient,month,employee_code,actor_id)
 values(c,slip,request_key,recipient,p.month,p.content->>'employeeCode',auth.uid())returning * into a;
 perform public.audit_event(c,'Payslip Email Requested','payslip',slip,jsonb_build_object('attemptId',a.id));return to_jsonb(a)||jsonb_build_object('acquired',true);
end $$;
create function public.payslip_email_complete(c uuid,attempt uuid,outcome text,provider_reference text,failure_code text)returns void language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'payroll.approve');perform public.require_permission(c,'payslips.read');
 if outcome not in('Sent','Failed','Unconfirmed')or length(coalesce(provider_reference,''))>200 or length(coalesce(failure_code,''))>100 then raise exception 'Invalid email result'using errcode='22023';end if;
 update public.payslip_email_attempts set status=outcome,provider_id=provider_reference,error_code=failure_code,completed_at=now()where company_id=c and id=attempt and actor_id=auth.uid()and status='Sending';
 if not found then raise exception 'Email attempt changed'using errcode='40001';end if;
 perform public.audit_event(c,'Payslip Email Result','payslip',null,jsonb_build_object('attemptId',attempt,'outcome',outcome));
end $$;
revoke all on function public.payslip_module_dashboard(uuid,date),public.payslip_module_generate(uuid,date,uuid[],boolean),public.payslip_module_publish(uuid,uuid[]),public.payslip_email_claim(uuid,uuid,uuid),public.payslip_email_complete(uuid,uuid,text,text,text)from public,anon,authenticated,service_role;
grant execute on function public.payslip_module_dashboard(uuid,date),public.payslip_module_generate(uuid,date,uuid[],boolean),public.payslip_module_publish(uuid,uuid[]),public.payslip_email_claim(uuid,uuid,uuid),public.payslip_email_complete(uuid,uuid,text,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
