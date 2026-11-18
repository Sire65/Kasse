
-- KC_DP_STEMPEL_KASSE_V1. Prepared contract: execute as a reviewed migration.
-- All event writes and acknowledgements happen in one database transaction.
create or replace function public.kc_dp_stempel_kasse_melden(p_org_id text, p_ereignisse jsonb)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $body$
declare
  e jsonb;
  v_person text;
  v_member text;
  v_key text;
  v_event text;
  v_art text;
  v_dienst text;
  v_spontan boolean;
  v_zeit timestamptz;
  v_recorded timestamptz;
  v_void timestamptz;
  old_row public.kc_dp_stempel%rowtype;
  accepted jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Dienstzugang erforderlich'; end if;
  if p_org_id is null or jsonb_typeof(p_ereignisse) <> 'array'
     or jsonb_array_length(p_ereignisse) > 100 then raise exception 'Ungültiger Auftrag'; end if;
  for e in select value from jsonb_array_elements(p_ereignisse) loop
    if coalesce(e->>'id','') = '' or length(e->>'id') > 80
       or coalesce(e->>'kind','') not in ('in','out') then raise exception 'Ungültige Zeitbuchung'; end if;
    v_member := upper(trim(e->>'credential'));
    select person_id into strict v_person from public.kc_core_personen
      where org_id = p_org_id and mitgliedsnummer = v_member;
    v_event := case when e->>'eventId' = 'WM-2026' then 'KC-WM-2026' else e->>'eventId' end;
    if coalesce(v_event,'') = '' then raise exception 'Veranstaltung fehlt'; end if;
    v_art := e->>'kind';
    v_zeit := (e->>'effectiveAt')::timestamptz;
    v_recorded := (e->>'recordedAt')::timestamptz;
    v_void := nullif(e->>'voidedAt','')::timestamptz;
    if v_zeit is null or v_recorded is null then raise exception 'Uhrzeit fehlt'; end if;
    v_key := p_org_id || ':' || (e->>'id');
    perform pg_advisory_xact_lock(hashtextextended(v_key,0));
    select * into old_row from public.kc_dp_stempel where kasse_event_id = v_key for update;
    if found then
      if old_row.org_id <> p_org_id or old_row.person_id <> v_person
         or old_row.event_id is distinct from v_event or old_row.art <> v_art
         or old_row.zeit <> v_zeit or old_row.erfasst_am <> v_recorded then
        raise exception 'Ereigniskennung bereits mit anderen Werten belegt';
      end if;
      -- A stale replay can never restore a cancelled booking.
      if v_void is not null and old_row.storniert_am is null then
        update public.kc_dp_stempel set storniert_am = v_void, storniert_von = 'KC_MANAGER'
          where id = old_row.id;
      end if;
    else
      select case when count(*)=1 then min(source_shift_id) end, count(*)=0
        into v_dienst,v_spontan from public.kc_dp_plan_published
        where org_id=p_org_id and event_id=v_event and person_id=v_person
          and status='published' and work_date=timezone('Europe/Berlin',v_zeit)::date;
      insert into public.kc_dp_stempel
        (org_id,event_id,person_id,member_no,art,zeit,erfasst_am,quelle,geraet,grund,
         erstellt_von,kasse_event_id,storniert_am,storniert_von,dienst_ref,spontan)
      values
        (p_org_id,v_event,v_person,v_member,v_art,v_zeit,v_recorded,'kasse',
         left(e->>'registerId',64),
         left(coalesce(nullif(e->>'shiftReason',''),e->>'correctionReason'),120),
         'KC_MANAGER',v_key,v_void,case when v_void is not null then 'KC_MANAGER' end,v_dienst,v_spontan);
    end if;
    accepted := accepted || jsonb_build_array(e->>'id');
  end loop;
  return jsonb_build_object('ok',true,'contract','KC_DP_STEMPEL_KASSE_V1','accepted',accepted);
end
$body$;
revoke all on function public.kc_dp_stempel_kasse_melden(text,jsonb) from public,anon,authenticated;
grant execute on function public.kc_dp_stempel_kasse_melden(text,jsonb) to service_role;

create or replace function public.kc_dp_stempel_paare_liste(p_org_id text,p_event_id text,p_von date,p_bis date)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp
as $body$
begin
  if auth.uid() is null or not exists (
    select 1 from public.kc_dp_memberships m
    where m.user_id=auth.uid() and m.org_id=p_org_id and m.active is true
      and m.role in ('admin','planner')
  ) then raise exception 'Planer-Anmeldung erforderlich'; end if;
  if p_von is null or p_bis is null or p_bis < p_von or p_bis-p_von > 400
     or coalesce(p_event_id,'')='' then raise exception 'Zeitraum oder Veranstaltung ungültig'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(p) order by work_date,kommen,gehen)
      from public.kc_dp_stempel_paare p
      where org_id=p_org_id and event_id=p_event_id and work_date between p_von and p_bis
  ),'[]'::jsonb);
end
$body$;
revoke all on function public.kc_dp_stempel_paare_liste(text,text,date,date) from public,anon;
grant execute on function public.kc_dp_stempel_paare_liste(text,text,date,date) to authenticated;

create or replace function public.kc_dp_stempel_kasse_stand(p_org_id text)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp
as $body$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Dienstzugang erforderlich'; end if;
  return jsonb_build_object('ok',true,'contract','KC_DP_STEMPEL_KASSE_V1','events',coalesce((
    select jsonb_agg(to_jsonb(latest) order by member_no,event_id)
    from (
      select distinct on (member_no,event_id) member_no,event_id,id,art,zeit,erfasst_am,quelle
      from public.kc_dp_stempel
      where org_id=p_org_id and storniert_am is null and member_no is not null
        and zeit >= now()-interval '36 hours' and zeit <= now()+interval '5 minutes'
      order by member_no,event_id,zeit desc,erfasst_am desc,id desc
    ) latest
  ),'[]'::jsonb));
end
$body$;
revoke all on function public.kc_dp_stempel_kasse_stand(text) from public,anon,authenticated;
grant execute on function public.kc_dp_stempel_kasse_stand(text) to service_role;
