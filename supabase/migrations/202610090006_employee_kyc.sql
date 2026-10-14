begin;
alter table public.employee_statutory_details add column pan_status text not null default 'Not Provided'check(pan_status in('Verified','Pending Verification','Rejected','Not Provided'));
alter table public.employee_statutory_details add column bank_status text not null default 'Not Provided'check(bank_status in('Verified','Pending Verification','Rejected','Not Provided'));
alter table public.employee_statutory_details add column tax_regime text check(tax_regime in('Old Regime','New Regime'));
alter table public.employee_statutory_details add column declaration_status text not null default 'Pending'check(declaration_status in('Pending','Submitted','Verified'));
create function public.save_employee_kyc(c uuid,e uuid,p jsonb)returns void
language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'employees.sensitive');perform 1 from public.companies where id=c for update;
 perform 1 from public.employees where company_id=c and id=e for update;if not found then raise exception 'Employee not found'using errcode='P0002';end if;
 insert into public.employee_statutory_details(company_id,employee_id)values(c,e)on conflict do nothing;
 if p ? 'pfApplicable'then update public.employee_statutory_details set pf_applicable=(p->>'pfApplicable')::boolean where company_id=c and employee_id=e;end if;
 if p ? 'esiApplicable'then update public.employee_statutory_details set esi_applicable=(p->>'esiApplicable')::boolean where company_id=c and employee_id=e;end if;
 if p ? 'ptApplicable'then update public.employee_statutory_details set pt_applicable=(p->>'ptApplicable')::boolean where company_id=c and employee_id=e;end if;
 if p ? 'tdsApplicable'then update public.employee_statutory_details set tds_applicable=(p->>'tdsApplicable')::boolean where company_id=c and employee_id=e;end if;
 if p ? 'taxRegime'then update public.employee_statutory_details set tax_regime=p->>'taxRegime'where company_id=c and employee_id=e;end if;
 if p ? 'declarationStatus'then update public.employee_statutory_details set declaration_status=p->>'declarationStatus'where company_id=c and employee_id=e;end if;
 if p ? 'panStatus'then
  if p->>'panStatus'='Verified'and not exists(select 1 from public.employee_statutory_details where company_id=c and employee_id=e and pan is not null)then raise exception 'PAN required for manual verification'using errcode='23514';end if;
  update public.employee_statutory_details set pan_status=p->>'panStatus'where company_id=c and employee_id=e;
 end if;
 if p ? 'bankStatus'then
  if p->>'bankStatus'='Verified'and not exists(select 1 from public.employee_bank_details where company_id=c and employee_id=e and account_number<>''and ifsc_code<>'')then raise exception 'Bank details required for manual verification'using errcode='23514';end if;
  update public.employee_statutory_details set bank_status=p->>'bankStatus'where company_id=c and employee_id=e;
 end if;
 perform public.audit_event(c,'KYC Updated','employee',e,jsonb_build_object('verificationSource','manual','fields',(select jsonb_agg(key)from jsonb_object_keys(p)key)));
end $$;
revoke all on function public.save_employee_kyc(uuid,uuid,jsonb)from public,anon,authenticated;grant execute on function public.save_employee_kyc(uuid,uuid,jsonb)to authenticated;
commit;
