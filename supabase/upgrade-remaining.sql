-- Apply ONCE after setup.sql, upgrade.sql and upgrade-next.sql (001-020).
-- Adds private documents, employee profiles, administration, GST credit reviews and in-app notifications.
-- Existing records are retained. No payment, filing or email is initiated.
begin;
-- 202610120021_private_documents_profiles.sql
alter table public.employee_private_details add column blood_group text not null default '',add column marital_status text not null default '',add column nationality text not null default '',add column languages text[]not null default '{}';
create function public.save_employee_personal(c uuid,e uuid,expected_version integer,p jsonb)returns void language plpgsql security definer set search_path=''as $$declare emp public.employees;dob date;begin
 perform public.require_permission(c,'employees.sensitive');perform 1 from public.companies where id=c for update;
 select * into emp from public.employees where company_id=c and id=e for update;if not found then raise exception 'Employee not found'using errcode='P0002';end if;
 if expected_version is null or emp.version<>expected_version then raise exception 'Employee changed; refresh'using errcode='40001';end if;
 dob:=nullif(p->>'dateOfBirth','')::date;
 if length(coalesce(p->>'city',''))>100 or length(coalesce(p->>'nationality',''))>100 or(coalesce(p->>'personalEmail','')<>''and p->>'personalEmail'not like '%@%')or coalesce(p->>'pincode','')!~'^(?:[0-9]{6})?$'or jsonb_typeof(coalesce(p->'emergencyContact','{}'))<>'object'or length(coalesce(p->'emergencyContact','{}')::text)>1000 or exists(select 1 from jsonb_array_elements_text(coalesce(p->'languages','[]'))x where length(x)not between 1 and 60)or dob>(now()at time zone 'Asia/Kolkata')::date or length(coalesce(p->>'address',''))>1000 or length(coalesce(p->>'personalEmail',''))>254 or coalesce(p->>'gender','')not in('','Male','Female','Other')or coalesce(p->>'bloodGroup','')not in('','A+','A-','B+','B-','AB+','AB-','O+','O-')or coalesce(p->>'maritalStatus','')not in('','Single','Married','Divorced','Widowed')or jsonb_array_length(coalesce(p->'languages','[]'))>20 then raise exception 'Invalid personal details'using errcode='22023';end if;
 insert into public.employee_private_details(company_id,employee_id,personal_email,date_of_birth,gender,address,city,pincode,emergency_contact,blood_group,marital_status,nationality,languages)
 values(c,e,coalesce(p->>'personalEmail',''),dob,nullif(p->>'gender',''),coalesce(p->>'address',''),coalesce(p->>'city',''),coalesce(p->>'pincode',''),coalesce(p->'emergencyContact','{}'),coalesce(p->>'bloodGroup',''),coalesce(p->>'maritalStatus',''),coalesce(p->>'nationality',''),array(select jsonb_array_elements_text(coalesce(p->'languages','[]'))))
 on conflict(company_id,employee_id)do update set personal_email=excluded.personal_email,date_of_birth=excluded.date_of_birth,gender=excluded.gender,address=excluded.address,city=excluded.city,pincode=excluded.pincode,emergency_contact=excluded.emergency_contact,blood_group=excluded.blood_group,marital_status=excluded.marital_status,nationality=excluded.nationality,languages=excluded.languages;
 update public.employees set version=version+1,updated_at=now()where company_id=c and id=e;
 perform public.audit_event(c,'Employee Personal Details Updated','employee',e,'{}');
end $$;
create table public.employee_documents(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,employee_id uuid not null,document_type text not null check(document_type in('PAN Card','Aadhaar','Cancelled Cheque','Bank Proof','Offer Letter','Other Document')),
 original_name text not null check(length(original_name)between 1 and 200),object_path text not null unique,mime_type text not null check(mime_type in('application/pdf','image/png','image/jpeg')),byte_size integer not null check(byte_size between 1 and 10485760),sha256 text not null check(sha256~'^[0-9a-f]{64}$'),
 status text not null default 'Uploading'check(status in('Uploading','Pending Verification','Verified','Rejected','Removed')),version integer not null default 1,
 uploaded_by uuid not null references public.user_profiles(id),uploaded_at timestamptz not null default now(),reviewed_by uuid references public.user_profiles(id),reviewed_at timestamptz,review_reason text not null default '',
 unique(company_id,id),foreign key(company_id,employee_id)references public.employees(company_id,id)
);
create index document_employee on public.employee_documents(company_id,employee_id,uploaded_at desc,id);
create function public.can_read_employee_document(c uuid,e uuid)returns boolean language sql stable security definer set search_path=''as $$
 select public.is_member(c)and(public.has_permission(c,'employees.sensitive')or exists(select 1 from public.employees where company_id=c and id=e and user_id=auth.uid()))
$$;
create function public.document_object_allowed(path text,operation text)returns boolean language sql stable security definer set search_path=''as $$
 select exists(select 1 from public.employee_documents d where d.object_path=path and case operation
 when 'read'then(d.status='Removed'and public.has_permission(d.company_id,'employees.sensitive'))or(d.status in('Pending Verification','Verified','Rejected')and public.can_read_employee_document(d.company_id,d.employee_id))or(d.status='Uploading'and d.uploaded_by=auth.uid()and public.has_permission(d.company_id,'employees.sensitive'))
 when 'insert'then d.status='Uploading'and d.uploaded_by=auth.uid()and public.has_permission(d.company_id,'employees.sensitive')
 when 'delete'then d.status in('Uploading','Removed')and public.has_permission(d.company_id,'employees.sensitive')else false end)
$$;
create function public.reserve_employee_document(c uuid,e uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare d uuid:=gen_random_uuid();ext text;begin
 perform public.require_permission(c,'employees.sensitive');perform 1 from public.companies where id=c for update;
 if not exists(select 1 from public.employees where company_id=c and id=e)then raise exception 'Employee not found'using errcode='P0002';end if;
 if(select count(*)from public.employee_documents where company_id=c and employee_id=e and status='Uploading'and uploaded_at>now()-interval '1 hour')>=3 then raise exception 'Finish or cancel pending uploads first'using errcode='23514';end if;
 ext:=case p->>'mimeType'when 'application/pdf'then 'pdf'when 'image/png'then 'png'when 'image/jpeg'then 'jpg'else null end;
 if ext is null then raise exception 'Unsupported document type'using errcode='22023';end if;
 insert into public.employee_documents(id,company_id,employee_id,document_type,original_name,object_path,mime_type,byte_size,sha256,uploaded_by)
 values(d,c,e,p->>'documentType',p->>'fileName',c||'/'||e||'/'||d||'/document.'||ext,p->>'mimeType',(p->>'byteSize')::integer,p->>'sha256',auth.uid());
 perform public.audit_event(c,'Employee Document Upload Reserved','employee',e,jsonb_build_object('documentId',d,'documentType',p->>'documentType'));return d;
end $$;
create function public.finish_employee_document(c uuid,d uuid)returns void language plpgsql security definer set search_path=''as $$declare doc public.employee_documents;exists_object boolean;begin
 perform public.require_permission(c,'employees.sensitive');perform 1 from public.companies where id=c for update;
 select * into doc from public.employee_documents where company_id=c and id=d for update;
 if not found or doc.status<>'Uploading'or doc.uploaded_by<>auth.uid()then raise exception 'Pending upload not found'using errcode='23514';end if;
 if to_regclass('storage.objects')is null then raise exception 'Private storage unavailable'using errcode='23514';end if;
 execute 'select exists(select 1 from storage.objects where bucket_id=''employee-documents'' and name=$1 and (metadata->>''size'')::bigint=$2)'into exists_object using doc.object_path,doc.byte_size;
 if not exists_object then raise exception 'Uploaded file not found or size mismatch'using errcode='23514';end if;
 update public.employee_documents set status='Pending Verification',version=version+1 where id=d;
 perform public.audit_event(c,'Employee Document Uploaded','employee',doc.employee_id,jsonb_build_object('documentId',d,'sha256',doc.sha256));
end $$;
create function public.review_employee_document(c uuid,d uuid,expected_version integer,next_status text,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare doc public.employee_documents;begin
 perform public.require_permission(c,'employees.sensitive');perform 1 from public.companies where id=c for update;
 select * into doc from public.employee_documents where company_id=c and id=d for update;if not found then raise exception 'Document not found'using errcode='P0002';end if;
 if expected_version is null or doc.version<>expected_version then raise exception 'Document changed; refresh'using errcode='40001';end if;
 if next_status not in('Verified','Rejected','Removed')or length(trim(reason_text))not between 1 and 1000 or doc.status='Removed'or(doc.status='Uploading'and next_status<>'Removed')then raise exception 'Review status and reason required'using errcode='22023';end if;
 update public.employee_documents set status=next_status,version=version+1,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=reason_text where id=d;
 perform public.audit_event(c,'Employee Document Reviewed','employee',doc.employee_id,jsonb_build_object('documentId',d,'status',next_status,'reason',reason_text));
end $$;
alter table public.employee_documents enable row level security;
revoke all on public.employee_documents from anon,authenticated;grant select on public.employee_documents to authenticated;
create policy employee_document_read on public.employee_documents for select to authenticated using(public.can_read_employee_document(company_id,employee_id));
revoke all on function public.save_employee_personal(uuid,uuid,integer,jsonb),public.can_read_employee_document(uuid,uuid),public.document_object_allowed(text,text),public.reserve_employee_document(uuid,uuid,jsonb),public.finish_employee_document(uuid,uuid),public.review_employee_document(uuid,uuid,integer,text,text)from public,anon,authenticated;
grant execute on function public.save_employee_personal(uuid,uuid,integer,jsonb),public.can_read_employee_document(uuid,uuid),public.document_object_allowed(text,text),public.reserve_employee_document(uuid,uuid,jsonb),public.finish_employee_document(uuid,uuid),public.review_employee_document(uuid,uuid,integer,text,text)to authenticated;
do $$begin if to_regclass('storage.buckets')is not null then
 execute 'insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values(''employee-documents'',''employee-documents'',false,10485760,array[''application/pdf'',''image/png'',''image/jpeg''])on conflict(id)do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types';
 execute 'create policy payflow_document_insert on storage.objects for insert to authenticated with check(bucket_id=''employee-documents''and public.document_object_allowed(name,''insert''))';
 execute 'create policy payflow_document_read on storage.objects for select to authenticated using(bucket_id=''employee-documents''and public.document_object_allowed(name,''read''))';
 execute 'create policy payflow_document_cleanup on storage.objects for delete to authenticated using(bucket_id=''employee-documents''and public.document_object_allowed(name,''delete''))';
end if;end $$;

-- 202610120022_administration.sql
insert into public.permissions(code)values('announcements.write'),('support.manage'),('compliance.write');
insert into public.role_permissions(role,permission)values('Super Admin','announcements.write'),('HR Admin','announcements.write'),('Super Admin','support.manage'),('HR Admin','support.manage'),('Super Admin','compliance.write'),('Finance','compliance.write'),('Payroll Admin','compliance.write');
create table public.announcements(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),title text not null check(length(trim(title))between 1 and 200),body text not null check(length(trim(body))between 1 and 10000),pinned boolean not null default false,status text not null default 'Published'check(status in('Published','Archived')),version integer not null default 1,created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,id));
create function public.save_announcement(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare a uuid;v integer;begin
 perform public.require_permission(c,'announcements.write');perform 1 from public.companies where id=c for update;
 a:=nullif(p->>'id','')::uuid;
 if a is null then insert into public.announcements(company_id,title,body,pinned,created_by)values(c,p->>'title',p->>'body',coalesce((p->>'pinned')::boolean,false),auth.uid())returning id into a;
 else select version into v from public.announcements where company_id=c and id=a for update;if not found then raise exception 'Announcement not found'using errcode='P0002';end if;if v<>(p->>'expectedVersion')::integer or(p->>'expectedVersion')is null then raise exception 'Announcement changed; refresh'using errcode='40001';end if;
 update public.announcements set title=p->>'title',body=p->>'body',pinned=coalesce((p->>'pinned')::boolean,false),status=p->>'status',version=version+1,updated_at=now()where company_id=c and id=a;end if;
 perform public.audit_event(c,'Announcement Saved','announcement',a,jsonb_build_object('status',coalesce(p->>'status','Published')));return a;
end $$;
create table public.support_tickets(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),subject text not null check(length(trim(subject))between 1 and 200),status text not null default 'Open'check(status in('Open','In Progress','Resolved','Closed')),version integer not null default 1,created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,id));
create table public.support_messages(id uuid primary key default gen_random_uuid(),company_id uuid not null,ticket_id uuid not null,body text not null check(length(trim(body))between 1 and 10000),created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),foreign key(company_id,ticket_id)references public.support_tickets(company_id,id));
create function public.can_read_ticket(c uuid,t uuid)returns boolean language sql stable security definer set search_path=''as $$select public.is_member(c)and exists(select 1 from public.support_tickets where company_id=c and id=t and(created_by=auth.uid()or public.has_permission(c,'support.manage')))$$;
create function public.save_support_ticket(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare t uuid;ticket public.support_tickets;next_status text;begin
 if not public.is_member(c)then raise exception 'Company access denied'using errcode='42501';end if;perform 1 from public.companies where id=c for update;
 t:=nullif(p->>'id','')::uuid;
 if t is null then insert into public.support_tickets(company_id,subject,created_by)values(c,p->>'subject',auth.uid())returning id into t;
 else
 select * into ticket from public.support_tickets where company_id=c and id=t for update;if not found or not public.can_read_ticket(c,t)then raise exception 'Ticket access denied'using errcode='42501';end if;
 if ticket.version<>(p->>'expectedVersion')::integer or(p->>'expectedVersion')is null then raise exception 'Ticket changed; refresh'using errcode='40001';end if;
 next_status:=coalesce(p->>'status',ticket.status);
 if next_status not in('Open','In Progress','Resolved','Closed')or(next_status in('In Progress','Resolved')and not public.has_permission(c,'support.manage')and next_status<>ticket.status)then raise exception 'Ticket transition denied'using errcode='42501';end if;
 if ticket.status='Closed'and next_status='Closed'then raise exception 'Reopen the ticket before replying'using errcode='23514';end if;
 update public.support_tickets set status=next_status,version=version+1,updated_at=now()where company_id=c and id=t;
 end if;
 insert into public.support_messages(company_id,ticket_id,body,created_by)values(c,t,p->>'message',auth.uid());
 perform public.audit_event(c,'Support Ticket Updated','support_ticket',t,jsonb_build_object('status',coalesce(next_status,'Open')));return t;
end $$;
create table public.compliance_obligations(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),category text not null check(category in('PF','ESI','PT','TDS','GST','LWF','Other')),label text not null check(length(trim(label))between 1 and 200),period date not null check(extract(day from period)=1),due_date date not null,review_reference text not null check(length(trim(review_reference))between 1 and 1000),status text not null default 'Pending'check(status in('Pending','Recorded','Cancelled')),evidence_reference text not null default '',evidence_note text not null default '',recorded_date date,version integer not null default 1,created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),unique(company_id,id),unique(company_id,category,label,period));
create function public.save_compliance_obligation(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare o uuid;old public.compliance_obligations;s text;begin
 perform public.require_permission(c,'compliance.write');perform 1 from public.companies where id=c for update;
 o:=nullif(p->>'id','')::uuid;
 if o is null then insert into public.compliance_obligations(company_id,category,label,period,due_date,review_reference,created_by)values(c,p->>'category',p->>'label',(p->>'period')::date,(p->>'dueDate')::date,p->>'reviewReference',auth.uid())returning id into o;
 else select * into old from public.compliance_obligations where company_id=c and id=o for update;if not found then raise exception 'Obligation not found'using errcode='P0002';end if;
 if old.version<>(p->>'expectedVersion')::integer or(p->>'expectedVersion')is null then raise exception 'Obligation changed; refresh'using errcode='40001';end if;
 s:=p->>'status';if s not in('Pending','Recorded','Cancelled')or length(trim(coalesce(p->>'evidenceNote','')))not between 1 and 2000 then raise exception 'Evidence and status required'using errcode='22023';end if;
 if s='Recorded'and(length(trim(coalesce(p->>'evidenceReference','')))not between 1 and 200 or nullif(p->>'recordedDate','')is null or(p->>'recordedDate')::date>(now()at time zone 'Asia/Kolkata')::date)then raise exception 'Actual filing evidence and date required'using errcode='23514';end if;
 update public.compliance_obligations set status=s,evidence_reference=coalesce(p->>'evidenceReference',''),evidence_note=p->>'evidenceNote',recorded_date=nullif(p->>'recordedDate','')::date,version=version+1 where company_id=c and id=o;
 end if;
 perform public.audit_event(c,'Compliance Evidence Updated','compliance_obligation',o,jsonb_build_object('status',coalesce(s,'Pending'),'reference',coalesce(p->>'evidenceReference','')));return o;
end $$;
do $$declare t text;begin foreach t in array array['announcements','support_tickets','support_messages','compliance_obligations']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
create policy announcement_read on public.announcements for select to authenticated using(public.is_member(company_id)and(status='Published'or public.has_permission(company_id,'announcements.write')));
create policy ticket_read on public.support_tickets for select to authenticated using(public.can_read_ticket(company_id,id));
create policy ticket_message_read on public.support_messages for select to authenticated using(public.can_read_ticket(company_id,ticket_id));
create policy obligation_read on public.compliance_obligations for select to authenticated using(public.has_permission(company_id,'compliance.write')or public.has_permission(company_id,'accounting.read'));
revoke all on function public.save_announcement(uuid,jsonb),public.can_read_ticket(uuid,uuid),public.save_support_ticket(uuid,jsonb),public.save_compliance_obligation(uuid,jsonb)from public,anon,authenticated;
grant execute on function public.save_announcement(uuid,jsonb),public.can_read_ticket(uuid,uuid),public.save_support_ticket(uuid,jsonb),public.save_compliance_obligation(uuid,jsonb)to authenticated;

-- 202610120023_gst_credit_reviews.sql
create table public.gst_credit_reviews(company_id uuid not null,invoice_id uuid not null,cgst_minor bigint not null check(cgst_minor>=0),sgst_minor bigint not null check(sgst_minor>=0),igst_minor bigint not null check(igst_minor>=0),review_reference text not null check(length(trim(review_reference))between 1 and 1000),reviewed_by uuid not null references public.user_profiles(id),reviewed_at timestamptz not null default now(),version integer not null default 1,primary key(company_id,invoice_id),foreign key(company_id,invoice_id)references public.invoices(company_id,id));
create function public.review_gst_credit(c uuid,i uuid,expected_version integer,p jsonb)returns void language plpgsql security definer set search_path=''as $$declare inv public.invoices;review public.gst_credit_reviews;cg bigint;sg bigint;ig bigint;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into inv from public.invoices where company_id=c and id=i for update;
 if not found or inv.status<>'Posted'or inv.kind<>'Purchase'then raise exception 'Posted purchase invoice required'using errcode='23514';end if;
 select * into review from public.gst_credit_reviews where company_id=c and invoice_id=i;
 if expected_version is null or coalesce(review.version,0)<>expected_version then raise exception 'Credit review changed; refresh'using errcode='40001';end if;
 cg:=(p->>'cgstMinor')::bigint;sg:=(p->>'sgstMinor')::bigint;ig:=(p->>'igstMinor')::bigint;
 if cg is null or sg is null or ig is null or cg<0 or sg<0 or ig<0 or cg>inv.cgst_minor or sg>inv.sgst_minor or ig>inv.igst_minor then raise exception 'Reviewed credit exceeds invoice tax'using errcode='23514';end if;
 insert into public.gst_credit_reviews values(c,i,cg,sg,ig,p->>'reviewReference',auth.uid(),now(),1)
 on conflict(company_id,invoice_id)do update set cgst_minor=excluded.cgst_minor,sgst_minor=excluded.sgst_minor,igst_minor=excluded.igst_minor,review_reference=excluded.review_reference,reviewed_by=excluded.reviewed_by,reviewed_at=now(),version=gst_credit_reviews.version+1;
 perform public.audit_event(c,'GST Credit Reviewed','invoice',i,jsonb_build_object('cgstMinor',cg,'sgstMinor',sg,'igstMinor',ig,'reference',p->>'reviewReference'));
end $$;
alter table public.gst_credit_reviews enable row level security;revoke all on public.gst_credit_reviews from anon,authenticated;grant select on public.gst_credit_reviews to authenticated;
create policy gst_credit_read on public.gst_credit_reviews for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on function public.review_gst_credit(uuid,uuid,integer,jsonb)from public,anon,authenticated;grant execute on function public.review_gst_credit(uuid,uuid,integer,jsonb)to authenticated;

-- 202610120024_notifications.sql
create table public.notifications(id uuid primary key default gen_random_uuid(),company_id uuid not null,user_id uuid not null,title text not null check(length(title)between 1 and 300),href text not null check(href in('/announcements','/support','/payslips','/attendance')),event_key text not null,created_at timestamptz not null default now(),read_at timestamptz,unique(company_id,user_id,event_key),foreign key(company_id,user_id)references public.user_company_roles(company_id,user_id));
create index notifications_inbox on public.notifications(company_id,user_id,created_at desc);
alter table public.notifications enable row level security;revoke all on public.notifications from anon,authenticated;grant select on public.notifications to authenticated;
create policy notification_own on public.notifications for select to authenticated using(user_id=auth.uid()and public.is_member(company_id));
create function public.notify_member(c uuid,u uuid,message_text text,path text,event text)returns void language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from public.user_company_roles m join public.user_profiles p on p.id=m.user_id where m.company_id=c and m.user_id=u and m.active and p.active)then
 insert into public.notifications(company_id,user_id,title,href,event_key)values(c,u,message_text,path,event)on conflict(company_id,user_id,event_key)do nothing;end if;
end $$;
create function public.announcement_notifications()returns trigger language plpgsql security definer set search_path=''as $$declare u uuid;begin
 if new.status<>'Published'then return new;end if;if tg_op='UPDATE'and old.status='Published'then return new;end if;
 for u in select user_id from public.user_company_roles where company_id=new.company_id and active and user_id<>auth.uid()loop perform public.notify_member(new.company_id,u,'A company announcement was published','/announcements','announcement:'||new.id||':'||new.version);end loop;return new;
end $$;
create trigger announcement_notifications after insert or update on public.announcements for each row execute function public.announcement_notifications();
create function public.ticket_notifications()returns trigger language plpgsql security definer set search_path=''as $$declare t public.support_tickets;begin
 select * into t from public.support_tickets where company_id=new.company_id and id=new.ticket_id;
 if t.created_by<>new.created_by then perform public.notify_member(new.company_id,t.created_by,'A response was added to your support ticket','/support','support:'||new.id);end if;return new;
end $$;
create trigger ticket_notifications after insert on public.support_messages for each row execute function public.ticket_notifications();
create function public.payslip_notifications()returns trigger language plpgsql security definer set search_path=''as $$declare u uuid;begin
 if new.status<>'Published'then return new;end if;if tg_op='UPDATE'and old.status='Published'then return new;end if;
 select user_id into u from public.employees where company_id=new.company_id and id=new.employee_id;
 if u is not null then perform public.notify_member(new.company_id,u,'Your payslip for '||to_char(new.month,'YYYY-MM')||' is available','/payslips','payslip:'||new.id);end if;return new;
end $$;
create trigger payslip_notifications after insert or update on public.payslips for each row execute function public.payslip_notifications();
create function public.mark_notifications_read(c uuid,ids uuid[])returns integer language plpgsql security definer set search_path=''as $$declare n integer;begin
 if not public.is_member(c)then raise exception 'Company access denied'using errcode='42501';end if;
 if cardinality(ids)not between 1 and 100 then raise exception 'Select up to 100 notifications'using errcode='22023';end if;
 update public.notifications set read_at=now()where company_id=c and user_id=auth.uid()and id=any(ids)and read_at is null;get diagnostics n=row_count;return n;
end $$;
revoke all on function public.notify_member(uuid,uuid,text,text,text),public.announcement_notifications(),public.ticket_notifications(),public.payslip_notifications(),public.mark_notifications_read(uuid,uuid[])from public,anon,authenticated;
grant execute on function public.mark_notifications_read(uuid,uuid[])to authenticated;

-- 202610120025_company_calendar.sql
alter table public.companies add column version integer not null default 1,add column profile jsonb not null default '{}';
alter table public.company_settings add column version integer not null default 1;
create function public.save_company_profile(c uuid,expected_version integer,p jsonb)returns void language plpgsql security definer set search_path=''as $$declare v integer;begin
 perform public.require_permission(c,'settings.write');perform 1 from public.companies where id=c for update;select version into v from public.companies where id=c;
 if expected_version is null or v<>expected_version then raise exception 'Company changed; refresh'using errcode='40001';end if;
 if length(trim(coalesce(p->>'name','')))not between 1 and 160 or length(coalesce(p->>'address',''))>1000 or length(coalesce(p->>'email',''))>254 or coalesce(p->>'gstin','')!~'^(?:[A-Z0-9]{15})?$'then raise exception 'Invalid company profile'using errcode='22023';end if;
 update public.companies set name=p->>'name',profile=p-'name',version=version+1 where id=c;
 perform public.audit_event(c,'Company Profile Updated','company',c,'{}');
end $$;
create function public.save_versioned_company_settings(c uuid,p jsonb,expected_version integer)returns void language plpgsql security definer set search_path=''as $$declare v integer;begin
 perform public.require_permission(c,'settings.write');perform 1 from public.companies where id=c for update;select version into v from public.company_settings where company_id=c;
 if expected_version is null or v<>expected_version then raise exception 'Settings changed; refresh'using errcode='40001';end if;
 perform public.save_company_settings(c,p);update public.company_settings set version=version+1 where company_id=c;
end $$;
revoke all on function public.save_company_settings(uuid,jsonb)from authenticated;
create function public.set_employee_manager(c uuid,e uuid,manager uuid,expected_version integer)returns void language plpgsql security definer set search_path=''as $$declare v integer;begin
 perform public.require_permission(c,'employees.write');perform 1 from public.companies where id=c for update;select version into v from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found'using errcode='P0002';end if;if expected_version is null or v<>expected_version then raise exception 'Employee changed; refresh'using errcode='40001';end if;
 if manager=e or(manager is not null and not exists(select 1 from public.employees where company_id=c and id=manager and status not in('Exited','Inactive')))then raise exception 'Active company manager required'using errcode='23514';end if;
 if exists(with recursive chain as(select id,manager_id from public.employees where company_id=c and id=manager union select parent.id,parent.manager_id from public.employees parent join chain on parent.id=chain.manager_id where parent.company_id=c)select 1 from chain where id=e)then raise exception 'Reporting relationship cycle'using errcode='23514';end if;
 update public.employees set manager_id=manager,version=version+1,updated_at=now()where company_id=c and id=e;
 perform public.audit_event(c,'Reporting Manager Changed','employee',e,jsonb_build_object('managerId',manager));
end $$;
create table public.work_schedules(id uuid primary key default gen_random_uuid(),company_id uuid not null,employee_id uuid,effective_from date not null,effective_to date check(effective_to>=effective_from),working_days integer[]not null check(cardinality(working_days)between 1 and 7 and working_days<@array[0,1,2,3,4,5,6]),start_time time,review_reference text not null check(length(trim(review_reference))between 1 and 1000),created_by uuid not null references public.user_profiles(id),foreign key(company_id)references public.companies(id),foreign key(company_id,employee_id)references public.employees(company_id,id));
alter table public.holidays add column id uuid not null default gen_random_uuid()unique,add column review_reference text,add column created_by uuid references public.user_profiles(id),add column active boolean not null default true,add column version integer not null default 1;
alter table public.work_schedules add column active boolean not null default true,add column version integer not null default 1;
create function public.save_work_calendar(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid;e uuid;start_date date;end_date date;begin
 perform public.require_permission(c,'attendance.write');perform 1 from public.companies where id=c for update;
 if p->>'kind'='holiday'then insert into public.holidays(company_id,date,name,review_reference,created_by)values(c,(p->>'date')::date,p->>'name',p->>'reviewReference',auth.uid())on conflict(company_id,date)do update set name=excluded.name,review_reference=excluded.review_reference,created_by=excluded.created_by,active=true,version=holidays.version+1 where not holidays.active returning id into rid;if rid is null then raise exception 'Holiday already configured'using errcode='23505';end if;
 elsif p->>'kind'='schedule'then e:=nullif(p->>'employeeId','')::uuid;start_date:=(p->>'effectiveFrom')::date;end_date:=nullif(p->>'effectiveTo','')::date;
 if exists(select 1 from public.work_schedules where company_id=c and active and employee_id is not distinct from e and effective_from<=coalesce(end_date,'infinity'::date)and coalesce(effective_to,'infinity'::date)>=start_date)then raise exception 'Schedule periods overlap'using errcode='23514';end if;
 insert into public.work_schedules(company_id,employee_id,effective_from,effective_to,working_days,start_time,review_reference,created_by)values(c,e,start_date,end_date,array(select value::integer from jsonb_array_elements_text(p->'workingDays')),nullif(p->>'startTime','')::time,p->>'reviewReference',auth.uid())returning id into rid;
 else raise exception 'Unknown calendar operation'using errcode='22023';end if;
 perform public.audit_event(c,'Work Calendar Configured','calendar',rid,jsonb_build_object('kind',p->>'kind'));return rid;
end $$;
create function public.apply_nonworking_attendance(c uuid,m date)returns integer language plpgsql security definer set search_path=''as $$declare emp public.employees;d date;s public.work_schedules;holiday_name text;rows jsonb;affected integer:=0;begin
 perform public.require_permission(c,'attendance.write');perform 1 from public.companies where id=c for update;
 if extract(day from m)<>1 then raise exception 'Month start required'using errcode='22023';end if;
 for emp in select * from public.employees where company_id=c and status not in('Inactive','Salary Hold')and joining_date<=m+interval '1 month - 1 day'and(exit_date is null or exit_date>=m)loop
 rows:='[]';
 for d in select day::date from generate_series(greatest(m,emp.joining_date),least((m+interval '1 month - 1 day')::date,coalesce(emp.exit_date,(m+interval '1 month - 1 day')::date)),interval '1 day')day loop
 if exists(select 1 from public.attendance_records where company_id=c and employee_id=emp.id and date=d)then continue;end if;
 select name into holiday_name from public.holidays where company_id=c and active and date=d and review_reference is not null limit 1;
 select * into s from public.work_schedules where company_id=c and active and(employee_id is null or employee_id=emp.id)and effective_from<=d and(effective_to is null or effective_to>=d)order by(employee_id is not null)desc,effective_from desc limit 1;
 if holiday_name is not null or(s.id is not null and not(extract(dow from d)::integer=any(s.working_days)))then rows:=rows||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'date',d,'status',case when holiday_name is not null then 'Holiday'else 'Weekly Off'end,'remarks',coalesce(holiday_name,'Reviewed work schedule weekly off')));end if;
 end loop;
 if jsonb_array_length(rows)>0 then affected:=affected+public.save_attendance(c,rows,'Reviewed calendar nonworking days',false);end if;
 end loop;
 perform public.audit_event(c,'Nonworking Attendance Applied','attendance_period',null,jsonb_build_object('month',m,'rows',affected));return affected;
end $$;
alter table public.work_schedules enable row level security;alter table public.holidays enable row level security;
revoke all on public.work_schedules,public.holidays from anon,authenticated;grant select on public.work_schedules,public.holidays to authenticated;
create policy work_schedule_read on public.work_schedules for select to authenticated using(public.has_permission(company_id,'attendance.read')or public.has_permission(company_id,'attendance.write'));

revoke all on function public.save_company_profile(uuid,integer,jsonb),public.save_versioned_company_settings(uuid,jsonb,integer),public.set_employee_manager(uuid,uuid,uuid,integer),public.save_work_calendar(uuid,jsonb),public.apply_nonworking_attendance(uuid,date)from public,anon,authenticated;
grant execute on function public.save_company_profile(uuid,integer,jsonb),public.save_versioned_company_settings(uuid,jsonb,integer),public.set_employee_manager(uuid,uuid,uuid,integer),public.save_work_calendar(uuid,jsonb),public.apply_nonworking_attendance(uuid,date)to authenticated;
alter table public.attendance_records add column scheduled_start time;
create function public.capture_attendance_schedule()returns trigger language plpgsql security definer set search_path=''as $$begin
 select start_time into new.scheduled_start from public.work_schedules where company_id=new.company_id and active and(employee_id is null or employee_id=new.employee_id)and effective_from<=new.date and(effective_to is null or effective_to>=new.date)and extract(dow from new.date)::integer=any(working_days)order by(employee_id is not null)desc,effective_from desc limit 1;return new;
end $$;
create trigger capture_attendance_schedule before insert or update on public.attendance_records for each row execute function public.capture_attendance_schedule();
create or replace function public.payslip_notifications()returns trigger language plpgsql security definer set search_path=''as $$declare u uuid;enabled boolean;begin
 if new.status<>'Published'then return new;end if;if tg_op='UPDATE'and old.status='Published'then return new;end if;
 select coalesce((settings#>>'{notifications,payroll}')::boolean,true)into enabled from public.company_settings where company_id=new.company_id;if enabled is false then return new;end if;
 select user_id into u from public.employees where company_id=new.company_id and id=new.employee_id;if u is not null then perform public.notify_member(new.company_id,u,'Your payslip for '||to_char(new.month,'YYYY-MM')||' is available','/payslips','payslip:'||new.id);end if;return new;
end $$;
create function public.leave_decision_notifications()returns trigger language plpgsql security definer set search_path=''as $$declare u uuid;enabled boolean;begin
 if new.status=old.status or new.status='Pending'then return new;end if;
 select coalesce((settings#>>'{notifications,leave}')::boolean,true)into enabled from public.company_settings where company_id=new.company_id;if enabled is false then return new;end if;
 select user_id into u from public.employees where company_id=new.company_id and id=new.employee_id;if u is not null then perform public.notify_member(new.company_id,u,'Your leave request was '||lower(new.status),'/attendance','leave:'||new.id||':'||new.status);end if;return new;
end $$;
create trigger leave_decision_notifications after update on public.leave_requests for each row execute function public.leave_decision_notifications();
revoke all on function public.capture_attendance_schedule(),public.payslip_notifications(),public.leave_decision_notifications()from public,anon,authenticated;
create function public.retire_work_calendar(c uuid,kind text,r uuid,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare n integer;begin
 perform public.require_permission(c,'attendance.write');perform 1 from public.companies where id=c for update;
 if expected_version is null or length(trim(reason_text))not between 1 and 1000 then raise exception 'Version and reason required'using errcode='22023';end if;
 if kind='holiday'then update public.holidays set active=false,version=version+1 where company_id=c and id=r and active and version=expected_version;
 elsif kind='schedule'then update public.work_schedules set active=false,version=version+1 where company_id=c and id=r and active and version=expected_version;
 else raise exception 'Calendar kind required'using errcode='22023';end if;
 get diagnostics n=row_count;if n<>1 then raise exception 'Calendar changed; refresh'using errcode='40001';end if;
 perform public.audit_event(c,'Work Calendar Retired','calendar',r,jsonb_build_object('kind',kind,'reason',reason_text));
end $$;
revoke all on function public.retire_work_calendar(uuid,text,uuid,integer,text)from public,anon,authenticated;grant execute on function public.retire_work_calendar(uuid,text,uuid,integer,text)to authenticated;
do $$declare definition text;changed text;begin
 definition:=pg_get_functiondef('public.request_leave(uuid,uuid,uuid,date,date,text)'::regprocedure);changed:=replace(definition,'h.company_id=c and h.date=d::date','h.company_id=c and h.date=d::date and h.active');if changed=definition then raise exception 'Unexpected leave holiday query';end if;execute changed;
 definition:=pg_get_functiondef('public.apply_approved_leave()'::regprocedure);changed:=replace(definition,'where company_id=new.company_id and date=value::date','where company_id=new.company_id and date=value::date and active');if changed=definition then raise exception 'Unexpected approved leave holiday query';end if;execute changed;
end $$;

-- 202610120026_payroll_adjustments.sql
insert into public.salary_components(code,name,kind)values('overtime','Overtime','earning'),('arrears','Arrears','earning'),('reimbursement','Reimbursement','earning');
create table public.payroll_adjustments(id uuid primary key default gen_random_uuid(),company_id uuid not null,employee_id uuid not null,month date not null check(extract(day from month)=1),kind text not null check(kind in('overtime','arrears','reimbursement','bonus','otherDeduction')),amount_minor bigint not null check(amount_minor between 0 and 9000000000000),overtime_minutes integer not null default 0 check(overtime_minutes between 0 and 44640),reference text not null check(length(trim(reference))between 1 and 200),review_note text not null check(length(trim(review_note))between 1 and 2000),status text not null default 'Reviewed'check(status in('Reviewed','Cancelled')),version integer not null default 1,reviewed_by uuid not null references public.user_profiles(id),reviewed_at timestamptz not null default now(),unique(company_id,id),unique(company_id,employee_id,kind,reference),foreign key(company_id,employee_id)references public.employees(company_id,id));
create function public.save_payroll_adjustment(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare a uuid;e uuid;m date;v integer;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;a:=nullif(p->>'id','')::uuid;
 if a is not null then select employee_id,month,version into e,m,v from public.payroll_adjustments where company_id=c and id=a for update;if not found then raise exception 'Adjustment not found'using errcode='P0002';end if;
 if(p->>'expectedVersion')is null or v<>(p->>'expectedVersion')::integer then raise exception 'Adjustment changed; refresh'using errcode='40001';end if;
 else e:=(p->>'employeeId')::uuid;m:=(p->>'month')::date;end if;
 if exists(select 1 from public.payroll_runs where company_id=c and month=m and status in('Approved','Locked'))then raise exception 'Approved payroll adjustments are protected'using errcode='23514';end if;
 if not exists(select 1 from public.employees where company_id=c and id=e and joining_date<=m+interval '1 month - 1 day'and(exit_date is null or exit_date>=m))then raise exception 'Employee outside payroll employment period'using errcode='23514';end if;
 if a is null then
 if p->>'kind'<>'overtime'and coalesce((p->>'overtimeMinutes')::integer,0)<>0 then raise exception 'Overtime minutes require overtime adjustment'using errcode='22023';end if;
 insert into public.payroll_adjustments(company_id,employee_id,month,kind,amount_minor,overtime_minutes,reference,review_note,reviewed_by)values(c,e,m,p->>'kind',(p->>'amountMinor')::bigint,coalesce((p->>'overtimeMinutes')::integer,0),p->>'reference',p->>'reviewNote',auth.uid())returning id into a;
 else if length(trim(coalesce(p->>'reason','')))not between 1 and 2000 then raise exception 'Adjustment correction reason required'using errcode='22023';end if;update public.payroll_adjustments set status='Cancelled',version=version+1 where company_id=c and id=a and status='Reviewed';if not found then raise exception 'Adjustment already cancelled'using errcode='23514';end if;end if;
 perform public.audit_event(c,'Payroll Adjustment Reviewed','employee',e,jsonb_build_object('adjustmentId',a,'month',m,'kind',p->>'kind','reference',p->>'reference','reason',p->>'reason'));return a;
end $$;
alter table public.payroll_adjustments enable row level security;revoke all on public.payroll_adjustments from anon,authenticated;grant select on public.payroll_adjustments to authenticated;
create policy adjustment_read on public.payroll_adjustments for select to authenticated using(public.has_permission(company_id,'salary.read'));
create trigger adjustment_payroll_input_changed after insert or update on public.payroll_adjustments for each row execute function public.track_payroll_inputs();
create function public.payroll_round(c uuid,value numeric)returns numeric language sql stable security definer set search_path=''as $$select case when(select settings#>>'{payroll,rounding}'from public.company_settings where company_id=c)='down'then trunc(value)else round(value)end$$;
alter function public.validate_payroll(uuid,date)rename to validate_payroll_before_adjustments;revoke all on function public.validate_payroll_before_adjustments(uuid,date)from public,anon,authenticated;
create function public.validate_payroll(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$declare checks jsonb;issues jsonb;emp record;begin
 checks:=public.validate_payroll_before_adjustments(c,m);issues:=checks->'issues';
 for emp in select e.id,coalesce(sum(a.overtime_minutes),0)minutes from public.employees e left join public.attendance_records a on a.company_id=e.company_id and a.employee_id=e.id and a.date between greatest(m,e.joining_date)and least((m+interval '1 month - 1 day')::date,coalesce(e.exit_date,(m+interval '1 month - 1 day')::date))where e.company_id=c and e.status not in('Inactive','Salary Hold')and e.joining_date<=m+interval '1 month - 1 day'and(e.exit_date is null or e.exit_date>=m)group by e.id loop
 if emp.minutes<>(select coalesce(sum(overtime_minutes),0)from public.payroll_adjustments where company_id=c and employee_id=emp.id and month=m and kind='overtime'and status='Reviewed')then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Overtime Review','severity','Blocking Error','message','Review the recorded overtime minutes and period amount before calculating payroll. Reviewed minutes must match attendance.'));end if;end loop;
 return checks||jsonb_build_object('issues',issues,'blockingErrors',jsonb_array_length(issues),'passed',case when jsonb_array_length(issues)=0 then(checks->>'totalChecked')::integer else 0 end);
end $$;
do $$declare definition text;changed text;insertion text;begin
 definition:=pg_get_functiondef('public.calculate_payroll(uuid,date)'::regprocedure);
 insertion:=$patch$
  for item in select adjustment.kind,sum(adjustment.amount_minor)::bigint amount from public.payroll_adjustments adjustment where adjustment.company_id=c and adjustment.employee_id=emp.id and adjustment.month=m and adjustment.status='Reviewed'group by adjustment.kind loop
   if item.kind='otherDeduction'then deductions:=deductions||jsonb_build_object(item.kind,coalesce((deductions->>item.kind)::bigint,0)+item.amount);deduct:=deduct+item.amount;
   else amounts:=amounts||jsonb_build_object(item.kind,coalesce((amounts->>item.kind)::bigint,0)+item.amount);gross:=gross+item.amount;baseline_gross:=baseline_gross+item.amount;end if;
  end loop;
$patch$;
 changed:=replace(definition,'  select * into stat from public.employee_statutory_details where company_id=c and employee_id=emp.id;',insertion||'  select * into stat from public.employee_statutory_details where company_id=c and employee_id=emp.id;');if changed=definition then raise exception 'Unexpected payroll engine adjustment insertion point';end if;
 changed:=replace(changed,'round(','public.payroll_round(c,');
 changed:=replace(changed,'''salary'',salary_snapshot,''attendance'',attendance_snapshot','''adjustments'',(select coalesce(jsonb_agg(to_jsonb(a)order by a.id),''[]''::jsonb)from public.payroll_adjustments a where a.company_id=c and a.employee_id=emp.id and a.month=m and a.status=''Reviewed''),''salary'',salary_snapshot,''attendance'',attendance_snapshot');execute changed;
 definition:=pg_get_functiondef('public.validate_payroll_before_adjustments(uuid,date)'::regprocedure);changed:=replace(definition,'settings#>>''{payroll,rounding}''<>''half-up''','settings#>>''{payroll,rounding}''not in(''half-up'',''down'')');if changed=definition then raise exception 'Unexpected rounding validation';end if;changed:=replace(changed,'calendar-day proration and half-up rounding','calendar-day proration and half-up or down rounding');execute changed;
end $$;
revoke all on function public.save_payroll_adjustment(uuid,jsonb),public.payroll_round(uuid,numeric),public.validate_payroll(uuid,date)from public,anon,authenticated;
grant execute on function public.save_payroll_adjustment(uuid,jsonb),public.validate_payroll(uuid,date)to authenticated;
create function public.payroll_workflow_status(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$declare run public.payroll_runs;b public.disbursement_batches;published boolean:=false;paid boolean:=false;posted boolean:=false;begin
 perform public.require_permission(c,'payroll.run');select * into run from public.payroll_runs where company_id=c and month=m;
 if found then
 published:=exists(select 1 from public.payroll_run_employees where company_id=c and run_id=run.id)and not exists(select 1 from public.payroll_run_employees e where e.company_id=c and e.run_id=run.id and not exists(select 1 from public.payslips p where p.company_id=c and p.run_id=run.id and p.employee_id=e.employee_id and p.run_version=run.version and p.status='Published'));
 posted:=exists(select 1 from public.journal_entries where company_id=c and source_type='payroll'and source_id=run.id and status='Posted');
 select * into b from public.disbursement_batches where company_id=c and run_id=run.id and run_version=run.version and status='Prepared';
 if found then paid:=exists(select 1 from public.disbursement_items where company_id=c and batch_id=b.id)and not exists(select 1 from public.disbursement_items i where i.company_id=c and i.batch_id=b.id and i.amount_minor<>(select coalesce(sum(t.amount_minor),0)from public.disbursement_payments p join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where p.company_id=c and p.batch_id=b.id and p.employee_id=i.employee_id and t.status='Confirmed'));end if;
 end if;return jsonb_build_object('published',published,'disbursed',paid,'posted',posted);
end $$;
revoke all on function public.payroll_workflow_status(uuid,date)from public,anon,authenticated;grant execute on function public.payroll_workflow_status(uuid,date)to authenticated;

-- 202610120027_accounting_corrections.sql
alter table public.journal_entries drop constraint journal_entries_status_check;
alter table public.journal_entries add constraint journal_entries_status_check check(status in('Draft','Posted','Cancelled'));
alter table public.financial_years add column version integer not null default 1;
create table public.accounting_periods(company_id uuid not null references public.companies(id),month date not null check(extract(day from month)=1),closed_at timestamptz,closed_by uuid references public.user_profiles(id),version integer not null default 1,primary key(company_id,month));
create function public.edit_draft_journal(c uuid,j uuid,expected_version integer,p jsonb,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare entry public.journal_entries;item jsonb;n integer:=0;old_lines jsonb;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into entry from public.journal_entries where company_id=c and id=j for update;
 if not found then raise exception 'Journal not found'using errcode='P0002';end if;
 if expected_version is null or entry.version<>expected_version then raise exception 'Journal changed; refresh'using errcode='40001';end if;
 if entry.status<>'Draft'or entry.source_type<>'manual'or length(trim(reason_text))not between 1 and 1000 then raise exception 'Manual draft and correction reason required'using errcode='23514';end if;
 if jsonb_typeof(p->'lines')<>'array'or jsonb_array_length(p->'lines')not between 2 and 100 or length(trim(coalesce(p->>'voucherNumber','')))not between 1 and 80 or length(trim(coalesce(p->>'narration','')))not between 1 and 1000 then raise exception 'Draft fields and lines required'using errcode='22023';end if;
 select jsonb_agg(to_jsonb(l)order by l.line_no)into old_lines from public.journal_lines l where company_id=c and entry_id=j;
 update public.journal_entries set voucher_number=p->>'voucherNumber',date=(p->>'date')::date,type=p->>'type',narration=p->>'narration',version=version+1 where company_id=c and id=j;
 delete from public.journal_lines where company_id=c and entry_id=j;
 for item in select value from jsonb_array_elements(p->'lines')loop n:=n+1;
 if not exists(select 1 from public.ledger_accounts where company_id=c and id=(item->>'accountId')::uuid and status='Active')then raise exception 'Active company ledger required'using errcode='23514';end if;
 if coalesce(item->>'debitMinor','0')!~'^[0-9]+$'or coalesce(item->>'creditMinor','0')!~'^[0-9]+$'then raise exception 'Integer paise required'using errcode='22023';end if;
 insert into public.journal_lines values(c,j,n,(item->>'accountId')::uuid,coalesce((item->>'debitMinor')::bigint,0),coalesce((item->>'creditMinor')::bigint,0));end loop;
 perform public.audit_event(c,'Journal Draft Corrected','journal',j,jsonb_build_object('previous',to_jsonb(entry),'previousLines',old_lines,'next',p,'reason',reason_text));
end $$;
create function public.cancel_draft_journal(c uuid,j uuid,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if expected_version is null or length(trim(reason_text))not between 1 and 1000 then raise exception 'Version and reason required'using errcode='22023';end if;
 update public.journal_entries set status='Cancelled',version=version+1 where company_id=c and id=j and status='Draft'and source_type='manual'and version=expected_version;
 if not found then raise exception 'Draft changed or is already posted'using errcode='40001';end if;
 perform public.audit_event(c,'Journal Draft Cancelled','journal',j,jsonb_build_object('reason',reason_text));
end $$;
create function public.change_accounting_period(c uuid,m date,close_period boolean,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare period public.accounting_periods;finish date:=(m+interval '1 month - 1 day')::date;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if extract(day from m)<>1 or length(trim(reason_text))not between 1 and 1000 or expected_version is null then raise exception 'Month, version and reason required'using errcode='22023';end if;
 select * into period from public.accounting_periods where company_id=c and month=m for update;
 if coalesce(period.version,0)<>expected_version then raise exception 'Accounting period changed; refresh'using errcode='40001';end if;
 if close_period then
 if finish>(now()at time zone 'Asia/Kolkata')::date then raise exception 'Only completed accounting periods can close'using errcode='23514';end if;
 if not exists(select 1 from public.financial_years where company_id=c and start_date<=m and end_date>=finish and closed_at is null)then raise exception 'Open financial year required'using errcode='23514';end if;
 if exists(select 1 from public.journal_entries where company_id=c and status='Draft'and date between m and finish)or exists(select 1 from public.invoices where company_id=c and status='Draft'and date between m and finish)then raise exception 'Resolve draft documents before closing period'using errcode='23514';end if;
 if exists(select 1 from public.payroll_runs r where r.company_id=c and r.month=m and(r.status<>'Locked'or(exists(select 1 from public.payroll_run_employees e where e.company_id=c and e.run_id=r.id and(e.gross_minor>0 or e.employer_minor>0))and not exists(select 1 from public.journal_entries j where j.company_id=c and j.source_type='payroll'and j.source_id=r.id and j.status='Posted'))))then raise exception 'Complete payroll and its accrual before closing period'using errcode='23514';end if;
 end if;
 insert into public.accounting_periods(company_id,month,closed_at,closed_by)values(c,m,case when close_period then now()else null end,case when close_period then auth.uid()else null end)
 on conflict(company_id,month)do update set closed_at=excluded.closed_at,closed_by=excluded.closed_by,version=accounting_periods.version+1;
 perform public.audit_event(c,'Accounting Period Changed','accounting_period',null,jsonb_build_object('month',m,'closed',close_period,'reason',reason_text));
end $$;
create function public.change_financial_year(c uuid,y uuid,close_year boolean,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare year public.financial_years;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into year from public.financial_years where company_id=c and id=y for update;
 if not found then raise exception 'Financial year not found'using errcode='P0002';end if;if expected_version is null or year.version<>expected_version then raise exception 'Financial year changed; refresh'using errcode='40001';end if;
 if length(trim(reason_text))not between 1 and 1000 then raise exception 'Reason required'using errcode='22023';end if;
 if close_year and year.end_date>(now()at time zone 'Asia/Kolkata')::date then raise exception 'Only completed financial years can close'using errcode='23514';end if;
 if close_year and exists(select 1 from public.journal_entries where company_id=c and status='Draft'and date between year.start_date and year.end_date)then raise exception 'Resolve draft journals before closing year'using errcode='23514';end if;
 update public.financial_years set closed_at=case when close_year then now()else null end,closed_by=case when close_year then auth.uid()else null end,version=version+1 where company_id=c and id=y;
 perform public.audit_event(c,'Financial Year Changed','financial_year',y,jsonb_build_object('closed',close_year,'reason',reason_text));
end $$;
create function public.protect_accounting_period()returns trigger language plpgsql security definer set search_path=''as $$begin
 if new.status='Posted'and old.status='Draft'and exists(select 1 from public.accounting_periods where company_id=new.company_id and month=date_trunc('month',new.date)::date and closed_at is not null)then raise exception 'Accounting period closed; reopen with an audited reason'using errcode='23514';end if;return new;
end $$;
create trigger accounting_period_guard before update on public.journal_entries for each row execute function public.protect_accounting_period();
alter table public.accounting_periods enable row level security;revoke all on public.accounting_periods from anon,authenticated;grant select on public.accounting_periods to authenticated;
create policy accounting_period_read on public.accounting_periods for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on function public.edit_draft_journal(uuid,uuid,integer,jsonb,text),public.cancel_draft_journal(uuid,uuid,integer,text),public.change_accounting_period(uuid,date,boolean,integer,text),public.change_financial_year(uuid,uuid,boolean,integer,text),public.protect_accounting_period()from public,anon,authenticated;
grant execute on function public.edit_draft_journal(uuid,uuid,integer,jsonb,text),public.cancel_draft_journal(uuid,uuid,integer,text),public.change_accounting_period(uuid,date,boolean,integer,text),public.change_financial_year(uuid,uuid,boolean,integer,text)to authenticated;

-- 202610120028_bank_reconciliation.sql
create table public.bank_reconciliations(id uuid primary key default gen_random_uuid(),company_id uuid not null,bank_id uuid not null,from_date date not null,to_date date not null check(to_date>=from_date),opening_minor bigint not null check(abs(opening_minor)<=9000000000000),closing_minor bigint not null check(abs(closing_minor)<=9000000000000),reference text not null check(length(trim(reference))between 1 and 200),review_note text not null check(length(trim(review_note))between 1 and 2000),status text not null default 'Open'check(status in('Open','Reconciled','Cancelled')),version integer not null default 1,created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),reviewed_by uuid references public.user_profiles(id),reviewed_at timestamptz,unique(company_id,id),unique(company_id,bank_id,reference),foreign key(company_id,bank_id)references public.bank_accounts(company_id,id));
create table public.bank_statement_lines(company_id uuid not null,reconciliation_id uuid not null,line_no integer not null,date date not null,reference text not null check(length(trim(reference))between 1 and 200),amount_minor bigint not null check(amount_minor<>0 and abs(amount_minor)<=9000000000000),primary key(company_id,reconciliation_id,line_no),foreign key(company_id,reconciliation_id)references public.bank_reconciliations(company_id,id));
create table public.bank_reconciliation_matches(company_id uuid not null,reconciliation_id uuid not null,line_no integer not null,bank_id uuid not null,journal_id uuid not null,active boolean not null default true,matched_by uuid not null references public.user_profiles(id),matched_at timestamptz not null default now(),primary key(company_id,reconciliation_id,line_no),foreign key(company_id,reconciliation_id,line_no)references public.bank_statement_lines(company_id,reconciliation_id,line_no),foreign key(company_id,journal_id)references public.journal_entries(company_id,id),foreign key(company_id,bank_id)references public.bank_accounts(company_id,id));
create unique index bank_match_once on public.bank_reconciliation_matches(company_id,bank_id,journal_id)where active;
create function public.reconciliation_summary(c uuid,r uuid)returns jsonb language plpgsql security definer set search_path=''as $$declare rec public.bank_reconciliations;account uuid;opening numeric;closing numeric;statement_missing integer;book_missing integer;begin
 perform public.require_permission(c,'accounting.read');select * into rec from public.bank_reconciliations where company_id=c and id=r;if not found then raise exception 'Statement not found'using errcode='P0002';end if;
 select account_id into account from public.bank_accounts where company_id=c and id=rec.bank_id;
 select coalesce(sum(l.debit_minor-l.credit_minor)filter(where j.date<rec.from_date),0),coalesce(sum(l.debit_minor-l.credit_minor),0)into opening,closing from public.journal_lines l join public.journal_entries j on j.company_id=l.company_id and j.id=l.entry_id where l.company_id=c and l.account_id=account and j.status='Posted'and j.date<=rec.to_date;
 select count(*)into statement_missing from public.bank_statement_lines l where l.company_id=c and l.reconciliation_id=r and not exists(select 1 from public.bank_reconciliation_matches x where x.company_id=c and x.reconciliation_id=r and x.line_no=l.line_no and x.active);
 select count(*)into book_missing from(select j.id from public.journal_entries j join public.journal_lines l on l.company_id=j.company_id and l.entry_id=j.id where j.company_id=c and j.status='Posted'and j.date between rec.from_date and rec.to_date and l.account_id=account group by j.id having sum(l.debit_minor-l.credit_minor)<>0)books where not exists(select 1 from public.bank_reconciliation_matches x where x.company_id=c and x.bank_id=rec.bank_id and x.journal_id=books.id and x.active);
 return jsonb_build_object('bookOpeningMinor',opening,'bookClosingMinor',closing,'openingDifferenceMinor',rec.opening_minor-opening,'closingDifferenceMinor',rec.closing_minor-closing,'unmatchedStatementLines',statement_missing,'unmatchedBookEntries',book_missing,'ready',opening=rec.opening_minor and closing=rec.closing_minor and statement_missing=0 and book_missing=0);
end $$;
create function public.import_bank_statement(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare r uuid;item jsonb;n integer:=0;total numeric:=0;start_date date:=(p->>'fromDate')::date;end_date date:=(p->>'toDate')::date;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if end_date>(now()at time zone 'Asia/Kolkata')::date or end_date<start_date or jsonb_typeof(p->'lines')<>'array'or jsonb_array_length(p->'lines')not between 1 and 1000 or not exists(select 1 from public.bank_accounts where company_id=c and id=(p->>'bankId')::uuid and kind='Bank')then raise exception 'Actual company bank statement and dated lines required'using errcode='23514';end if;
 insert into public.bank_reconciliations(company_id,bank_id,from_date,to_date,opening_minor,closing_minor,reference,review_note,created_by)values(c,(p->>'bankId')::uuid,start_date,end_date,(p->>'openingMinor')::bigint,(p->>'closingMinor')::bigint,p->>'reference',p->>'reviewNote',auth.uid())returning id into r;
 for item in select value from jsonb_array_elements(p->'lines')loop n:=n+1;
 if(item->>'date')::date not between start_date and end_date then raise exception 'Statement line outside date range'using errcode='23514';end if;
 insert into public.bank_statement_lines values(c,r,n,(item->>'date')::date,item->>'reference',(item->>'amountMinor')::bigint);total:=total+(item->>'amountMinor')::bigint;end loop;
 if(p->>'openingMinor')::bigint+total<>(p->>'closingMinor')::bigint then raise exception 'Statement opening plus movements must equal closing'using errcode='23514';end if;
 perform public.audit_event(c,'Bank Statement Imported','bank_reconciliation',r,jsonb_build_object('bankId',p->>'bankId','reference',p->>'reference','rows',n));return r;
end $$;
create function public.match_bank_statement(c uuid,r uuid,expected_version integer,line integer,journal uuid,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare rec public.bank_reconciliations;item public.bank_statement_lines;account uuid;amount numeric;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into rec from public.bank_reconciliations where company_id=c and id=r for update;
 if not found then raise exception 'Statement not found'using errcode='P0002';end if;if expected_version is null or rec.version<>expected_version then raise exception 'Statement changed; refresh'using errcode='40001';end if;
 if rec.status<>'Open'or length(trim(reason_text))not between 1 and 1000 then raise exception 'Open statement and matching reason required'using errcode='23514';end if;
 select * into item from public.bank_statement_lines where company_id=c and reconciliation_id=r and line_no=line;if not found then raise exception 'Statement line not found'using errcode='P0002';end if;
 if journal is null then update public.bank_reconciliation_matches set active=false where company_id=c and reconciliation_id=r and line_no=line and active;if not found then raise exception 'Match not found'using errcode='P0002';end if;
 else
 if exists(select 1 from public.bank_reconciliation_matches where company_id=c and reconciliation_id=r and line_no=line and active)then raise exception 'Unmatch the existing entry first'using errcode='23514';end if;
 select account_id into account from public.bank_accounts where company_id=c and id=rec.bank_id;
 select sum(l.debit_minor-l.credit_minor)into amount from public.journal_lines l join public.journal_entries j on j.company_id=l.company_id and j.id=l.entry_id where l.company_id=c and l.entry_id=journal and l.account_id=account and j.status='Posted'and j.date between rec.from_date and rec.to_date;
 if amount is null or amount<>item.amount_minor then raise exception 'Posted bank movement must match statement amount'using errcode='23514';end if;
 insert into public.bank_reconciliation_matches values(c,r,line,rec.bank_id,journal,true,auth.uid(),now())on conflict(company_id,reconciliation_id,line_no)do update set journal_id=excluded.journal_id,active=true,matched_by=auth.uid(),matched_at=now();end if;
 update public.bank_reconciliations set version=version+1 where company_id=c and id=r;
 perform public.audit_event(c,'Bank Statement Match Changed','bank_reconciliation',r,jsonb_build_object('line',line,'journalId',journal,'reason',reason_text));
end $$;
create function public.transition_bank_reconciliation(c uuid,r uuid,expected_version integer,next_status text,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare rec public.bank_reconciliations;summary jsonb;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into rec from public.bank_reconciliations where company_id=c and id=r for update;
 if not found then raise exception 'Statement not found'using errcode='P0002';end if;if expected_version is null or rec.version<>expected_version then raise exception 'Statement changed; refresh'using errcode='40001';end if;
 if rec.status='Cancelled'or next_status not in('Open','Reconciled','Cancelled')or length(trim(reason_text))not between 1 and 1000 then raise exception 'Reconciliation status and review reason required'using errcode='22023';end if;
 if next_status='Reconciled'then summary:=public.reconciliation_summary(c,r);if(summary->>'ready')::boolean is not true then raise exception 'Resolve bank differences and unmatched entries before reconciling'using errcode='23514';end if;end if;
 update public.bank_reconciliations set status=next_status,version=version+1,reviewed_by=auth.uid(),reviewed_at=now()where company_id=c and id=r;
 if next_status='Cancelled'then update public.bank_reconciliation_matches set active=false where company_id=c and reconciliation_id=r;end if;
 perform public.audit_event(c,'Bank Reconciliation Reviewed','bank_reconciliation',r,jsonb_build_object('status',next_status,'reason',reason_text));
end $$;
do $$declare t text;begin foreach t in array array['bank_reconciliations','bank_statement_lines','bank_reconciliation_matches']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('create policy reconciliation_read on public.%I for select to authenticated using(public.has_permission(company_id,''accounting.read''))',t);end loop;end $$;
revoke all on function public.reconciliation_summary(uuid,uuid),public.import_bank_statement(uuid,jsonb),public.match_bank_statement(uuid,uuid,integer,integer,uuid,text),public.transition_bank_reconciliation(uuid,uuid,integer,text,text)from public,anon,authenticated;
grant execute on function public.reconciliation_summary(uuid,uuid),public.import_bank_statement(uuid,jsonb),public.match_bank_statement(uuid,uuid,integer,integer,uuid,text),public.transition_bank_reconciliation(uuid,uuid,integer,text,text)to authenticated;

-- 202610120029_document_audit.sql
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

-- 202610140030_employee_account_links.sql
create function public.link_employee_account(c uuid,e uuid,u uuid,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare previous_user uuid;v integer;begin
 perform public.require_permission(c,'users.manage');perform public.require_permission(c,'employees.write');
 perform 1 from public.companies where id=c for update;
 select user_id,version into previous_user,v from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found'using errcode='P0002';end if;
 if expected_version is null or v<>expected_version then raise exception 'Employee changed; refresh'using errcode='40001';end if;
 if reason_text is null or length(trim(reason_text))not between 1 and 1000 then raise exception 'Account link reason required'using errcode='22023';end if;
 if u is not null and not exists(select 1 from public.user_company_roles m join public.user_profiles p on p.id=m.user_id join auth.users a on a.id=p.id where m.company_id=c and m.user_id=u and m.active and p.active and a.email_confirmed_at is not null)then raise exception 'Confirmed active company account required'using errcode='23514';end if;
 if u is not null and exists(select 1 from public.employees where company_id=c and user_id=u and id<>e)then raise exception 'Account already linked to another employee'using errcode='23505';end if;
 if previous_user is not distinct from u then return;end if;
 update public.employees set user_id=u,version=version+1,updated_at=now()where company_id=c and id=e;
 perform public.audit_event(c,'Employee Account Link Changed','employee',e,jsonb_build_object('previousUserId',previous_user,'userId',u,'reason',trim(reason_text)));
end $$;
revoke all on function public.link_employee_account(uuid,uuid,uuid,integer,text)from public,anon,authenticated;
grant execute on function public.link_employee_account(uuid,uuid,uuid,integer,text)to authenticated;

-- 202610140031_invoice_notes.sql
alter table public.invoices add column adjustment_minor bigint not null default 0;
create table public.invoice_notes(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,invoice_id uuid not null,
 kind text not null check(kind in('Credit','Debit')),number text not null check(length(trim(number))between 1 and 80),date date not null,
 taxable_minor bigint not null check(taxable_minor>=0),cgst_minor bigint not null check(cgst_minor>=0),sgst_minor bigint not null check(sgst_minor>=0),igst_minor bigint not null check(igst_minor>=0),
 total_minor bigint not null check(total_minor>0 and total_minor=taxable_minor+cgst_minor+sgst_minor+igst_minor and total_minor<=9000000000000),
 reason text not null check(length(trim(reason))between 1 and 1000),review_reference text not null check(length(trim(review_reference))between 1 and 1000),
 status text not null default 'Posted'check(status in('Posted','Reversed')),version integer not null default 1,journal_id uuid not null,
 created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,number),foreign key(company_id,invoice_id)references public.invoices(company_id,id),foreign key(company_id,journal_id)references public.journal_entries(company_id,id)
);
alter table public.invoice_notes enable row level security;
create policy invoice_notes_read on public.invoice_notes for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on public.invoice_notes from anon,authenticated;grant select on public.invoice_notes to authenticated;
create function public.post_invoice_note(c uuid,i uuid,expected_version integer,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$
declare invoice public.invoices;n uuid:=gen_random_uuid();j uuid;direction integer;base bigint;cg bigint;sg bigint;ig bigint;total bigint;paid numeric;amounts record;lines jsonb;debit boolean;remaining record;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 select * into invoice from public.invoices where company_id=c and id=i for update;
 if not found then raise exception 'Invoice not found'using errcode='P0002';end if;
 if expected_version is null or invoice.version<>expected_version then raise exception 'Invoice changed; refresh'using errcode='40001';end if;
 if invoice.status<>'Posted'or p->>'kind'not in('Credit','Debit')or p->>'kind'is null or(p->>'date')::date<invoice.date or(p->>'date')::date>(now()at time zone 'Asia/Kolkata')::date then raise exception 'Posted invoice and valid note date required'using errcode='22023';end if;
 base:=(p->>'taxableMinor')::bigint;cg:=(p->>'cgstMinor')::bigint;sg:=(p->>'sgstMinor')::bigint;ig:=(p->>'igstMinor')::bigint;
 if base is null or cg is null or sg is null or ig is null or least(base,cg,sg,ig)<0 or greatest(base,cg,sg,ig)>9000000000000 then raise exception 'Valid reviewed note amounts required'using errcode='22023';end if;
 total:=base+cg+sg+ig;direction:=case when p->>'kind'='Credit'then -1 else 1 end;
 if total<=0 or total>9000000000000 or length(trim(coalesce(p->>'number','')))not between 1 and 80 or length(trim(coalesce(p->>'reason','')))not between 1 and 1000 or length(trim(coalesce(p->>'reviewReference','')))not between 1 and 1000 then raise exception 'Note number, amounts, reason and review required'using errcode='22023';end if;
 if(invoice.tax_mode='None'and cg+sg+ig<>0)or(invoice.tax_mode='IGST'and cg+sg<>0)or(invoice.tax_mode='CGST_SGST'and ig<>0)then raise exception 'Note tax mode must match invoice'using errcode='23514';end if;
 select invoice.taxable_minor+coalesce(sum(case when kind='Credit'then -taxable_minor else taxable_minor end),0)as base,invoice.cgst_minor+coalesce(sum(case when kind='Credit'then -cgst_minor else cgst_minor end),0)as cg,invoice.sgst_minor+coalesce(sum(case when kind='Credit'then -sgst_minor else sgst_minor end),0)as sg,invoice.igst_minor+coalesce(sum(case when kind='Credit'then -igst_minor else igst_minor end),0)as ig into remaining from public.invoice_notes where company_id=c and invoice_id=i and status='Posted';
 if direction=-1 and(base>remaining.base or cg>remaining.cg or sg>remaining.sg or ig>remaining.ig)then raise exception 'Credit exceeds remaining invoice components'using errcode='23514';end if;
 if invoice.kind='Purchase'and exists(select 1 from public.gst_credit_reviews where company_id=c and invoice_id=i and(cgst_minor>remaining.cg+direction*cg or sgst_minor>remaining.sg+direction*sg or igst_minor>remaining.ig+direction*ig))then raise exception 'Correct purchase credit eligibility before posting note'using errcode='23514';end if;
 select coalesce(sum(t.amount_minor),0)into paid from public.invoice_payments x join public.bank_transactions t on t.company_id=x.company_id and t.id=x.transaction_id where x.company_id=c and x.invoice_id=i and t.status='Confirmed';
 if invoice.total_minor+invoice.adjustment_minor+direction*total<paid or invoice.total_minor+invoice.adjustment_minor+direction*total>9000000000000 then raise exception 'Note would overpay or exceed invoice amount limit'using errcode='23514';end if;
 debit:=(invoice.kind='Sales')=(direction=1);
 lines:=jsonb_build_array(jsonb_build_object('accountId',invoice.control_account_id,'debitMinor',case when debit then total else 0 end,'creditMinor',case when debit then 0 else total end));
 for amounts in select * from(values(invoice.base_account_id,base),(invoice.cgst_account_id,cg),(invoice.sgst_account_id,sg),(invoice.igst_account_id,ig))as pair(account_id,amount)loop
  if amounts.amount>0 then if amounts.account_id is null then raise exception 'Tax ledger required'using errcode='23514';end if;lines:=lines||jsonb_build_array(jsonb_build_object('accountId',amounts.account_id,'debitMinor',case when debit then 0 else amounts.amount end,'creditMinor',case when debit then amounts.amount else 0 end));end if;
 end loop;
 j:=public.create_journal(c,jsonb_build_object('voucherNumber','NOTE-'||(p->>'number'),'date',p->>'date','type','Journal','narration',(p->>'kind')||' note for '||invoice.invoice_number||': '||(p->>'reason'),'lines',lines));
 update public.journal_entries set source_type='invoice_note',source_id=n where company_id=c and id=j;perform public.post_journal(c,j,1);
 insert into public.invoice_notes(id,company_id,invoice_id,kind,number,date,taxable_minor,cgst_minor,sgst_minor,igst_minor,total_minor,reason,review_reference,journal_id,created_by)values(n,c,i,p->>'kind',trim(p->>'number'),(p->>'date')::date,base,cg,sg,ig,total,trim(p->>'reason'),trim(p->>'reviewReference'),j,auth.uid());
 update public.invoices set adjustment_minor=adjustment_minor+direction*total,version=version+1 where company_id=c and id=i;
 perform public.audit_event(c,'Invoice Note Posted','invoice-note',n,jsonb_build_object('invoiceId',i,'journalId',j));return n;
end $$;
create function public.reverse_invoice_note(c uuid,n uuid,expected_version integer,reversal_date date,reason_text text)returns uuid language plpgsql security definer set search_path=''as $$declare note public.invoice_notes;invoice public.invoices;paid numeric;direction integer;remaining record;j uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 select * into note from public.invoice_notes where company_id=c and id=n for update;if not found then raise exception 'Note not found'using errcode='P0002';end if;
 if expected_version is null or note.version<>expected_version then raise exception 'Note changed; refresh'using errcode='40001';end if;
 if note.status<>'Posted'or reversal_date is null or reversal_date<note.date or reversal_date>(now()at time zone 'Asia/Kolkata')::date or reason_text is null or length(trim(reason_text))not between 1 and 1000 then raise exception 'Posted note, date and correction reason required'using errcode='22023';end if;
 select * into invoice from public.invoices where company_id=c and id=note.invoice_id for update;direction:=case when note.kind='Credit'then 1 else -1 end;
 select coalesce(sum(t.amount_minor),0)into paid from public.invoice_payments x join public.bank_transactions t on t.company_id=x.company_id and t.id=x.transaction_id where x.company_id=c and x.invoice_id=invoice.id and t.status='Confirmed';
 if invoice.total_minor+invoice.adjustment_minor+direction*note.total_minor<paid or invoice.total_minor+invoice.adjustment_minor+direction*note.total_minor>9000000000000 then raise exception 'Correct payment entries before reversing debit note'using errcode='23514';end if;
 select invoice.cgst_minor+coalesce(sum(case when kind='Credit'then -cgst_minor else cgst_minor end),0)as cg,invoice.sgst_minor+coalesce(sum(case when kind='Credit'then -sgst_minor else sgst_minor end),0)as sg,invoice.igst_minor+coalesce(sum(case when kind='Credit'then -igst_minor else igst_minor end),0)as ig into remaining from public.invoice_notes where company_id=c and invoice_id=invoice.id and status='Posted'and id<>n;
 if exists(select 1 from public.gst_credit_reviews where company_id=c and invoice_id=invoice.id and(cgst_minor>remaining.cg or sgst_minor>remaining.sg or igst_minor>remaining.ig))then raise exception 'Correct purchase credit eligibility before posting note'using errcode='23514';end if;
 if exists(select 1 from public.invoice_notes where company_id=c and invoice_id=invoice.id and status='Posted'and id<>n having invoice.taxable_minor+coalesce(sum(case when kind='Credit'then -taxable_minor else taxable_minor end),0)<0 or invoice.cgst_minor+coalesce(sum(case when kind='Credit'then -cgst_minor else cgst_minor end),0)<0 or invoice.sgst_minor+coalesce(sum(case when kind='Credit'then -sgst_minor else sgst_minor end),0)<0 or invoice.igst_minor+coalesce(sum(case when kind='Credit'then -igst_minor else igst_minor end),0)<0)then raise exception 'Reverse dependent credit notes first'using errcode='23514';end if;
 j:=public.reverse_journal_internal(c,note.journal_id,reversal_date,reason_text);
 update public.invoice_notes set status='Reversed',version=version+1 where company_id=c and id=n;
 update public.invoices set adjustment_minor=adjustment_minor+direction*note.total_minor,version=version+1 where company_id=c and id=invoice.id;
 perform public.audit_event(c,'Invoice Note Reversed','invoice-note',n,jsonb_build_object('reason',reason_text));return j;
end $$;
-- Preserve the source payment workflow while accounting for reviewed notes.
do $$declare definition text;begin
 select pg_get_functiondef('public.record_invoice_payment(uuid,uuid,uuid,bigint,date,text,text)'::regprocedure)into definition;
 if position('paid+amount>invoice.total_minor' in definition)=0 then raise exception 'Payment migration anchor missing';end if;
 execute replace(definition,'paid+amount>invoice.total_minor','paid+amount>invoice.total_minor+invoice.adjustment_minor');
 select pg_get_functiondef('public.cancel_invoice(uuid,uuid,integer,date,text)'::regprocedure)into definition;
 if position('if invoice.status=' in definition)=0 then raise exception 'Invoice cancellation anchor missing';end if;
 definition:=replace(definition,'if invoice.status=',E'if exists(select 1 from public.invoice_notes where company_id=c and invoice_id=i and status=''Posted'')then raise exception ''Reverse invoice notes before cancelling invoice''using errcode=''23514'';end if;\n if invoice.status=');execute definition;
 select pg_get_functiondef('public.review_gst_credit(uuid,uuid,integer,jsonb)'::regprocedure)into definition;
 if position('select * into review from' in definition)=0 then raise exception 'GST review anchor missing';end if;
 definition:=replace(definition,'select * into review from',E'select inv.cgst_minor+coalesce(sum(case when kind=''Credit''then -cgst_minor else cgst_minor end),0),inv.sgst_minor+coalesce(sum(case when kind=''Credit''then -sgst_minor else sgst_minor end),0),inv.igst_minor+coalesce(sum(case when kind=''Credit''then -igst_minor else igst_minor end),0)into inv.cgst_minor,inv.sgst_minor,inv.igst_minor from public.invoice_notes where company_id=c and invoice_id=i and status=''Posted'';\n select * into review from');execute definition;
end $$;
revoke all on function public.post_invoice_note(uuid,uuid,integer,jsonb),public.reverse_invoice_note(uuid,uuid,integer,date,text)from public,anon,authenticated;
grant execute on function public.post_invoice_note(uuid,uuid,integer,jsonb),public.reverse_invoice_note(uuid,uuid,integer,date,text)to authenticated;

commit;
