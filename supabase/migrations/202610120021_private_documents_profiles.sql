begin;
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
commit;
