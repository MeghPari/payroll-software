begin;
alter function public.save_attendance(uuid,jsonb,text,boolean)rename to save_attendance_before_aliases;
revoke all on function public.save_attendance_before_aliases(uuid,jsonb,text,boolean)from public,anon,authenticated;
create function public.save_attendance(c uuid,rows_json jsonb,reason_text text,allow_update boolean default true)returns integer
language plpgsql security definer set search_path=''as $$declare normalized jsonb;begin
 perform public.require_permission(c,'attendance.write');
 if rows_json is null or jsonb_typeof(rows_json)<>'array'or jsonb_array_length(rows_json)not between 1 and 1000 then raise exception 'Invalid attendance rows'using errcode='22023';end if;
 select jsonb_agg(item||jsonb_build_object('status',case upper(trim(item->>'status'))when 'P'then 'Present'when 'A'then 'Absent'when 'WFH'then 'Work From Home'when 'HD'then 'Half Day'when 'L'then 'Paid Leave'when 'H'then 'Holiday'else item->>'status'end)order by ordinal)
 into normalized from jsonb_array_elements(rows_json)with ordinality r(item,ordinal);
 return public.save_attendance_before_aliases(c,normalized,reason_text,allow_update);
end $$;
revoke all on function public.save_attendance(uuid,jsonb,text,boolean)from public,anon,authenticated;
grant execute on function public.save_attendance(uuid,jsonb,text,boolean)to authenticated;
commit;
