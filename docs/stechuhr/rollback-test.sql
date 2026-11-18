begin;
\ir ../../supabase/migrations/20261118080742_kc_dp_stempel_manager_session.sql
\ir ../../supabase/migrations/20261118083053_kc_dp_stempel_event_pairing.sql
do $test$
declare member text; person text; user_id uuid; payload jsonb; result jsonb; n integer; rejected boolean;
begin
  select mitgliedsnummer,person_id into member,person from public.kc_core_personen
    where org_id='KC_WERNE' and mitgliedsnummer is not null limit 1;
  if member is null then raise exception 'Probezuordnung fehlt'; end if;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  payload:=jsonb_build_array(jsonb_build_object('id','ZEIT-PROBE-20261118','credential',member,
    'eventId','KC-TEST-ROLLBACK','kind','in','effectiveAt','2099-01-01T09:00:00Z','recordedAt','2099-01-01T09:00:00Z'));
  result:=public.kc_dp_stempel_kasse_melden('KC_WERNE',payload);
  perform public.kc_dp_stempel_kasse_melden('KC_WERNE',payload);
  select count(*) into n from public.kc_dp_stempel where kasse_event_id='KC_WERNE:ZEIT-PROBE-20261118';
  if n<>1 then raise exception 'Doppelbuchung'; end if;
  select count(*) into n from public.kc_dp_stempel_paare where event_id='KC-TEST-ROLLBACK' and status='missing_end';
  if n<>1 then raise exception 'Fehlendes Gehen nicht sichtbar'; end if;
  insert into public.kc_dp_stempel(org_id,event_id,person_id,member_no,art,zeit,quelle,erstellt_von)
    values('KC_WERNE','KC-TEST-ROLLBACK',person,member,'out','2099-01-01T13:00:00Z','app','ROLLBACK-PROBE');
  select count(*) into n from public.kc_dp_stempel_paare where event_id='KC-TEST-ROLLBACK'
    and status='complete' and quelle_kommen='kasse' and quelle_gehen='app';
  if n<>1 then raise exception 'Gemischtes Zeitpaar fehlt'; end if;
  perform public.kc_dp_stempel_kasse_melden('KC_WERNE',
    jsonb_build_array((payload->0)||jsonb_build_object('voidedAt','2099-01-01T14:00:00Z')));
  perform public.kc_dp_stempel_kasse_melden('KC_WERNE',payload);
  select count(*) into n from public.kc_dp_stempel where kasse_event_id='KC_WERNE:ZEIT-PROBE-20261118' and storniert_am is not null;
  if n<>1 then raise exception 'Storno durch Wiederholung aufgehoben'; end if;
  rejected:=false;
  begin
    perform public.kc_dp_stempel_kasse_melden('KC_WERNE',jsonb_build_array((payload->0)||jsonb_build_object('effectiveAt','2099-01-01T11:00:00Z')));
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'Geänderte Kennung überschrieben'; end if;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  rejected:=false;
  begin perform public.kc_dp_stempel_kasse_melden('KC_WERNE',payload);
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'Unbefugter Upload'; end if;
  rejected:=false;
  begin perform public.kc_dp_stempel_paare_liste('KC_WERNE','KC-TEST-ROLLBACK','2099-01-01','2099-01-02');
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'Unbefugtes Lesen'; end if;
end $test$;

rollback;