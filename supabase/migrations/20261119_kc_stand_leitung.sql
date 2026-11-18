-- KC-STAND-LEITUNG (19.11.2026, Freigabe Hansi: „so viel wie möglich über die direkte Leitung, DB-Abfragen minimieren“)
--
-- Stand-Brücke, Fernmodus und Stempel an die direkte Leitung (Supabase Realtime, Broadcast – nie Postgres-Changes).
-- Gleiches Muster wie KC-RT-PROGRAMME (20261011_kc_rt_programme.sql): die Datenbank sendet nur ein SIGNAL (Art, beim
-- Auftrag dazu die Auftrags-ID) – nie Inhalte. Den Inhalt holt jedes Programm wie bisher über seinen gesicherten Weg.
--   • Stand-Kanal je Stand = HMAC(vorhandenes Club-Geheimnis aus dem Vault, „stand:<Stand-ID>“) → nicht erratbar, getrennt
--     von Personen- und Programm-Kanälen. Kein neues Geheimnis. Den Kanalnamen bekommt nur der Stand selbst (Antwort von
--     kc_stand_melden, also erst nach der Prüfung Stand-ID + Stand-Geheimnis).
--       „auftrag“ (+ id)   neuer Auftrag von zu Hause → Stand meldet sich sofort statt im Takt
--   • Manager-Kanal (vorhanden, kc_rt_programm_kanal('manager')) des Vereins des Stands:
--       „stand“            kc_stand_melden hat neue Ereignisse gespeichert (Live-Monitor zu Hause holt sie)
--       „stand-spiegel“    kc_stand_melden hat Übersichten (Spiegel) geändert
--       „auftrag-erledigt“ kc_stand_auftrag_erledigt hat einen Auftrag quittiert (Fernmodus holt die Antwort)
--       „stempel“          neue/geänderte Stempelbuchung in kc_dp_stempel (Stempel-Abgleich holt den Anmeldestand)
--   • Gemeinsamer Monatszähler kc_club_rt_zaehler (Kontingent 2 Mio./Monat): die häufigen Signale „stand“ und
--     „stand-spiegel“ ab 70 % nicht mehr, alle anderen ab 95 % nicht mehr (wie kc_club_rt_klingeln / kc_rt_programm_melden).
--   • Fehler im Signal stören nie das eigentliche Speichern (exception when others). Ohne Leitung arbeiten Stand-Brücke
--     und PC-Manager wie vorher im Takt – es geht nichts verloren.
-- Baut auf 20261113_kc_stand_bruecke.sql + 20261118_kc_stand_sparsam.sql auf (kc_stand_melden: Fassung aus 20261118,
-- nur gezielt ergänzt). Keine neue Tabelle. Rückweg: siehe Ende der Datei.

-- ===================== interne Hilfsfunktionen (nur Datenbank / service_role) =====================

-- Kanalname des Stands (nur intern; der Stand bekommt ihn in der Antwort von kc_stand_melden)
create or replace function public.kc_stand__kanal(p_stand uuid) returns text
language sql stable security definer set search_path = '' as $$
  select 'kc-rt-' || left(encode(extensions.hmac('stand:' || p_stand::text,
    (select decrypted_secret from vault.decrypted_secrets where name = 'kc_club_rt_geheimnis'), 'sha256'), 'hex'), 32)
$$;

-- Zähler: true = Signal darf raus (unter der Grenze), zählt dann mit. Zähler gestört → Signal trotzdem erlaubt.
create or replace function public.kc_stand__zaehlen(p_anzahl integer, p_grenze bigint) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_monat text := to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM'); v_n bigint;
begin
  begin
    select anzahl into v_n from public.kc_club_rt_zaehler where monat = v_monat;
    if coalesce(v_n, 0) >= p_grenze then return false; end if;
    insert into public.kc_club_rt_zaehler (monat, anzahl) values (v_monat, p_anzahl)
      on conflict (monat) do update set anzahl = public.kc_club_rt_zaehler.anzahl + excluded.anzahl, geaendert_am = now();
  exception when others then null;
  end;
  return true;
end $$;

-- Signal an den Manager-Kanal des Vereins (häufige Arten mit 70-%-Bremse, sonst wie kc_rt_programm_melden mit 95 %)
create or replace function public.kc_stand__signal_manager(p_org text, p_art text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_org is null then return; end if;
  begin
    if p_art in ('stand', 'stand-spiegel') then
      if not public.kc_stand__zaehlen(1, 1400000) then return; end if;
      perform realtime.send(jsonb_build_object('art', p_art), 'neu', public.kc_rt_programm_kanal_intern('manager', p_org), false);
    else
      perform public.kc_rt_programm_melden(array['manager'], p_org, p_art);
    end if;
  exception when others then null;
  end;
end $$;

-- Trigger: neuer Auftrag → Signal „auftrag“ (+ Auftrags-ID, kein Inhalt) an den Stand-Kanal
create or replace function public.kc_stand__auftrag_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    if public.kc_stand__zaehlen(1, 1900000) then
      perform realtime.send(jsonb_build_object('art', 'auftrag', 'id', new.id), 'neu', public.kc_stand__kanal(new.stand_id), false);
    end if;
  exception when others then null;
  end;
  return null;
end $$;

drop trigger if exists kc_rt_stand_auftrag on public.kc_stand_auftrag;
create trigger kc_rt_stand_auftrag after insert on public.kc_stand_auftrag
  for each row execute function public.kc_stand__auftrag_signal();

-- Trigger: Stempelbuchungen → Signal „stempel“ an den Manager-Kanal. kc_dp_stempel_kasse_melden schreibt bis zu 100 Buchungen
-- einzeln in EINER Transaktion – darum höchstens EIN Signal je Verein und Transaktion (Merker in einer Transaktions-Einstellung).
create or replace function public.kc_stand__stempel_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o text; v_schon text;
begin
  begin
    for o in select distinct org_id from neu where org_id is not null loop
      v_schon := coalesce(current_setting('kc.stempel_signal', true), '');
      if position('|' || o || '|' in v_schon) > 0 then continue; end if;
      perform set_config('kc.stempel_signal', coalesce(nullif(v_schon, ''), '|') || o || '|', true);
      perform public.kc_rt_programm_melden(array['manager'], o, 'stempel');
    end loop;
  exception when others then null;
  end;
  return null;
end $$;

do $$
begin
  if to_regclass('public.kc_dp_stempel') is not null then
    drop trigger if exists kc_rt_stempel_neu on public.kc_dp_stempel;
    create trigger kc_rt_stempel_neu after insert on public.kc_dp_stempel
      referencing new table as neu for each statement execute function public.kc_stand__stempel_signal();
    drop trigger if exists kc_rt_stempel_geaendert on public.kc_dp_stempel;
    create trigger kc_rt_stempel_geaendert after update on public.kc_dp_stempel
      referencing new table as neu for each statement execute function public.kc_stand__stempel_signal();
  else
    raise warning 'kc_dp_stempel fehlt: Signal „stempel“ nicht angelegt (Stempel-Abgleich fragt wie bisher im Takt nach)';
  end if;
end $$;

-- ===================== Stand (Stand-Brücke mit Stand-Geheimnis) =====================

-- Fassung aus 20261118_kc_stand_sparsam.sql; NEU: zählt eingefügte Ereignisse / geänderte Spiegel, sendet „stand“ /
-- „stand-spiegel“ an den Manager-Kanal und liefert dem Stand seinen Kanalnamen („kanal“).
create or replace function public.kc_stand_melden(p_stand uuid, p_geheimnis text, p_ereignisse jsonb default '[]'::jsonb,
  p_spiegel jsonb default '{}'::jsonb, p_info jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_s public.kc_stand; v_e jsonb; v_bis bigint := null; v_pfad text; v_auftraege jsonb; v_info_neu jsonb;
  v_neu int := 0; v_n int; v_spiegel_neu boolean := false; v_kanal text;
begin
  v_s := public.kc_stand__pruefe(p_stand, p_geheimnis);
  if jsonb_typeof(coalesce(p_ereignisse, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_ereignisse, '[]'::jsonb)) > 500 then
    raise exception 'ereignisse_ungueltig' using errcode = '22023'; end if;
  for v_e in select * from jsonb_array_elements(coalesce(p_ereignisse, '[]'::jsonb)) loop
    if (v_e ->> 'quelleId') is null or (v_e ->> 'art') is null then continue; end if;
    if octet_length(coalesce(v_e -> 'payload', '{}'::jsonb)::text) > 65536 then continue; end if;
    insert into public.kc_stand_ereignis (stand_id, quelle_id, art, kasse, payload, zeitpunkt)
      values (p_stand, (v_e ->> 'quelleId')::bigint, left(v_e ->> 'art', 60), left(v_e ->> 'kasse', 40),
              coalesce(v_e -> 'payload', '{}'::jsonb), nullif(v_e ->> 'zeitpunkt', '')::timestamptz)
      on conflict (stand_id, quelle_id) do nothing;
    get diagnostics v_n = row_count;
    v_neu := v_neu + v_n;
    v_bis := greatest(coalesce(v_bis, 0), (v_e ->> 'quelleId')::bigint);
  end loop;
  if jsonb_typeof(coalesce(p_spiegel, '{}'::jsonb)) = 'object' then
    for v_pfad in select jsonb_object_keys(coalesce(p_spiegel, '{}'::jsonb)) loop
      if not (v_pfad = any(public.kc_stand__spiegel_pfade())) then continue; end if;
      if octet_length((p_spiegel -> v_pfad)::text) > 2 * 1024 * 1024 then continue; end if;
      insert into public.kc_stand_spiegel (stand_id, pfad, inhalt, stand_zeit) values (p_stand, v_pfad, p_spiegel -> v_pfad, now())
        on conflict (stand_id, pfad) do update set inhalt = excluded.inhalt, stand_zeit = excluded.stand_zeit;
      v_spiegel_neu := true;
    end loop;
  end if;
  -- Lebenszeichen nur schreiben, wenn älter als 20 s oder info inhaltlich geändert (20261118)
  v_info_neu := case when jsonb_typeof(p_info) = 'object' and p_info <> '{}'::jsonb and octet_length(p_info::text) < 16384 then p_info else v_s.info end;
  if v_s.zuletzt_gemeldet is null or v_s.zuletzt_gemeldet < now() - interval '20 seconds'
     or (v_info_neu - 'gemeldetUm' - 'letzteAktivitaet') is distinct from (v_s.info - 'gemeldetUm' - 'letzteAktivitaet') then
    update public.kc_stand set zuletzt_gemeldet = now(), info = v_info_neu where id = p_stand;
  end if;
  -- offene Aufträge abholen (älteste zuerst) – nur neue oder seit 60 s nicht quittierte (20261118)
  select coalesce(jsonb_agg(jsonb_build_object('auftragId', a.id, 'pfad', a.pfad, 'koerper', a.koerper, 'erstelltAm', a.erstellt_am) order by a.id), '[]'::jsonb)
    into v_auftraege
    from (select * from public.kc_stand_auftrag where stand_id = p_stand and erledigt_am is null
            and (abgeholt_am is null or abgeholt_am < now() - interval '60 seconds')
          order by id limit 20) a;
  if jsonb_array_length(v_auftraege) > 0 then
    update public.kc_stand_auftrag set abgeholt_am = now() where stand_id = p_stand and erledigt_am is null
      and id in (select (x ->> 'auftragId')::bigint from jsonb_array_elements(v_auftraege) x);
  end if;
  -- NEU (20261119): Signale an den Manager-Kanal, Kanalname für den Stand
  if v_neu > 0 then perform public.kc_stand__signal_manager(v_s.org_id, 'stand'); end if;
  if v_spiegel_neu then perform public.kc_stand__signal_manager(v_s.org_id, 'stand-spiegel'); end if;
  begin v_kanal := public.kc_stand__kanal(p_stand); exception when others then v_kanal := null; end;
  return jsonb_build_object('angenommenBis', v_bis, 'auftraege', v_auftraege, 'serverZeit', now(), 'kanal', v_kanal);
end $$;

-- Fassung aus 20261113_kc_stand_bruecke.sql; NEU: Signal „auftrag-erledigt“ an den Manager-Kanal
create or replace function public.kc_stand_auftrag_erledigt(p_stand uuid, p_geheimnis text, p_auftrag bigint, p_status integer, p_antwort jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_n int; v_s public.kc_stand;
begin
  v_s := public.kc_stand__pruefe(p_stand, p_geheimnis);
  update public.kc_stand_auftrag set erledigt_am = now(), status_code = p_status,
      antwort = case when octet_length(coalesce(p_antwort, 'null'::jsonb)::text) <= 1048576 then p_antwort else jsonb_build_object('hinweis', 'antwort_zu_gross') end
    where id = p_auftrag and stand_id = p_stand and erledigt_am is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then perform public.kc_stand__signal_manager(v_s.org_id, 'auftrag-erledigt'); end if;
  return jsonb_build_object('quittiert', v_n > 0);
end $$;

-- ===================== Rechte =====================
-- neue interne Funktionen: niemand außer Datenbank / service_role
revoke all on function public.kc_stand__kanal(uuid), public.kc_stand__zaehlen(integer, bigint), public.kc_stand__signal_manager(text, text),
  public.kc_stand__auftrag_signal(), public.kc_stand__stempel_signal() from public, anon, authenticated;
grant execute on function public.kc_stand__kanal(uuid), public.kc_stand__zaehlen(integer, bigint), public.kc_stand__signal_manager(text, text)
  to service_role;
-- Stand-Funktionen wie in der Ursprungsmigration (Stand meldet ohne Anmeldung, geschützt durch Stand-ID + Stand-Geheimnis)
revoke all on function public.kc_stand_melden(uuid, text, jsonb, jsonb, jsonb), public.kc_stand_auftrag_erledigt(uuid, text, bigint, integer, jsonb) from public;
grant execute on function public.kc_stand_melden(uuid, text, jsonb, jsonb, jsonb),
  public.kc_stand_auftrag_erledigt(uuid, text, bigint, integer, jsonb) to anon, authenticated;

-- Prüfregister (KC-SECURITY-DEFINER-REGISTER): kc_stand_melden / kc_stand_auftrag_erledigt bleiben für anon + authenticated
-- ausführbar – geprüft 19.11.2026: erst kc_stand__pruefe (Stand-ID + 256-Bit-Geheimnis); neu ist nur das Signal (Art, ohne
-- Inhalt) an den Manager-Kanal des eigenen Vereins und der Kanalname des eigenen Stands. Wiederholbar, legt nichts doppelt an.
do $$
begin
  if to_regclass('public.kc_security_reviewed_exceptions') is null then return; end if;
  insert into public.kc_security_reviewed_exceptions (object_schema, object_name, object_type, finding_code, decision, reason, reviewed_at, review_after, active)
  select 'public', v.name, 'function', v.code, 'accepted_required', 'KC-STAND-LEITUNG 19.11.2026: ' || v.grund, now(), now() + interval '6 months', true
    from (values
      ('kc_stand_melden', 'security_definer_anon_execute', 'Kasse am Stand meldet ohne Anmeldung; erst kc_stand__pruefe (Stand-ID + 256-Bit-Geheimnis, SHA-256-Vergleich, nur aktive Stände), schreibt nur in den eigenen Stand, Größen begrenzt; liefert nur den eigenen Stand-Kanal, Signal ohne Inhalt.'),
      ('kc_stand_melden', 'security_definer_authenticated_execute', 'wie anon: erst kc_stand__pruefe (Stand-ID + 256-Bit-Geheimnis).'),
      ('kc_stand_auftrag_erledigt', 'security_definer_anon_execute', 'Kasse am Stand quittiert Aufträge; erst kc_stand__pruefe (Stand-ID + 256-Bit-Geheimnis), nur Aufträge des eigenen Stands, Antwort ≤ 1 MB; Signal ohne Inhalt.'),
      ('kc_stand_auftrag_erledigt', 'security_definer_authenticated_execute', 'wie anon: erst kc_stand__pruefe (Stand-ID + 256-Bit-Geheimnis).')
    ) as v(name, code, grund)
   where not exists (select 1 from public.kc_security_reviewed_exceptions r
                      where r.object_schema = 'public' and r.object_name = v.name and r.finding_code = v.code and r.active);
end $$;

-- Rückweg:
--   drop trigger if exists kc_rt_stand_auftrag on public.kc_stand_auftrag;
--   drop trigger if exists kc_rt_stempel_neu on public.kc_dp_stempel; drop trigger if exists kc_rt_stempel_geaendert on public.kc_dp_stempel;
--   kc_stand_melden aus 20261118_kc_stand_sparsam.sql und kc_stand_auftrag_erledigt aus 20261113_kc_stand_bruecke.sql erneut einspielen
--   (jeweils create or replace … bis „end $$;“ und die Rechte-Zeilen), danach:
--   drop function if exists public.kc_stand__auftrag_signal(), public.kc_stand__stempel_signal(), public.kc_stand__signal_manager(text, text),
--     public.kc_stand__zaehlen(integer, bigint), public.kc_stand__kanal(uuid);
--   Die Programme fallen ohne Signale von selbst auf den Takt aus Stufe A zurück.
