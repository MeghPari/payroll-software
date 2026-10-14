begin;
alter table public.invoices add column company_snapshot jsonb;
create function public.capture_invoice_company()returns trigger language plpgsql security definer set search_path=''as $$begin
 if tg_op='INSERT'or old.status='Draft'then select jsonb_build_object('name',name,'profile',profile)into new.company_snapshot from public.companies where id=new.company_id;end if;return new;
end $$;
create trigger invoice_company_snapshot before insert or update on public.invoices for each row execute function public.capture_invoice_company();
create function public.record_private_download(c uuid,kind text,r uuid)returns void language plpgsql security definer set search_path=''as $$declare e uuid;begin
 if kind='employee-document'then select employee_id into e from public.employee_documents where company_id=c and id=r and status in('Pending Verification','Verified','Rejected');if not found or not public.can_read_employee_document(c,e)then raise exception 'Document access denied'using errcode='42501';end if;
 elsif kind='invoice'then perform public.require_permission(c,'accounting.read');if not exists(select 1 from public.invoices where company_id=c and id=r)then raise exception 'Invoice not found'using errcode='P0002';end if;
 elsif kind='payslip'then select employee_id into e from public.payslips where company_id=c and id=r;if not found then raise exception 'Payslip not found'using errcode='P0002';end if;
 if not public.is_member(c)or not(public.has_permission(c,'payslips.read')or public.has_permission(c,'payroll.run')or exists(select 1 from public.employees where company_id=c and id=e and user_id=auth.uid()))then raise exception 'Payslip access denied'using errcode='42501';end if;
 elsif kind='salary-instructions'then perform public.require_permission(c,'disbursements.write');if not exists(select 1 from public.disbursement_batches where company_id=c and id=r and status='Prepared')then raise exception 'Instructions not found'using errcode='P0002';end if;
 else raise exception 'Download kind required'using errcode='22023';end if;
 perform public.audit_event(c,'Private Document Downloaded',kind,r,'{}');
end $$;
revoke all on function public.capture_invoice_company(),public.record_private_download(uuid,text,uuid)from public,anon,authenticated;grant execute on function public.record_private_download(uuid,text,uuid)to authenticated;
commit;
