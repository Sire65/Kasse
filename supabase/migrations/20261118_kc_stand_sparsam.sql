-- KC-KASSE-SPARSAM (18.11.2026, Freigabe Hansi: „ja setze alles so um, auch Kasse“ – Supabase-Abfragen einsparen)
--
-- Stand-Brücke (20261113_kc_stand_bruecke.sql), Funktion kc_stand_melden – gezielt geändert, sonst wörtlich übernommen:
--   1. Aufräumen (Ereignisse > 60 Tage, erledigte Aufträge > 14 Tage) NICHT mehr bei jedem Aufruf (bisher alle 5 s,
--      ohne passenden Index), sondern einmal täglich als pg_cron-Auftrag „kc-stand-aufraeumen“ um 03:15 UTC
--      (außerhalb von Neon-Spiegel 4:05–4:45 und Sicherungen 0:35–3:00). Kein zusätzlicher Index: eine Durchsicht
--      am Tag ist auch ohne Index billig, ein Index kostet bei jedem Einfügen.
--   2. zuletzt_gemeldet/info nur schreiben, wenn die letzte Meldung älter als 20 s ist oder sich an info mehr als die
--      Uhrzeiten (gemeldetUm, letzteAktivitaet) geändert hat (z. B. Version, Rückstand). 20 s statt 30 s, damit die
--      Anzeige zu Hause („zuletzt gemeldet vor … s“) bei 30-s-Takt des Stands unter 60 s bleibt (sonst gelb).
--   3. Offene Aufträge nur ausliefern, wenn noch nicht abgeholt oder die Abholung länger als 60 s her ist
--      (bisher bei JEDER Meldung erneut samt Inhalt, bis 8 MB). abgeholt_am wird bei jeder Auslieferung gesetzt.
-- Keine neue Tabelle, Rechte wie in der Ursprungsmigration, security definer bleibt.
-- Erst einspielen, wenn die Programmänderungen (Stand-Brücke am Mini-PC) gebündelt eingespielt werden – die Funktion ist
-- aber mit alter und neuer Stand-Brücke verträglich (gleiche Aufrufparameter, gleiche Antwortform).

create or replace function public.kc_stand_melden(p_stand uuid, p_geheimnis text, p_ereignisse jsonb default '[]'::jsonb,
  p_spiegel jsonb default '{}'::jsonb, p_info jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_s public.kc_stand; v_e jsonb; v_bis bigint := null; v_pfad text; v_auftraege jsonb; v_info_neu jsonb;
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
    v_bis := greatest(coalesce(v_bis, 0), (v_e ->> 'quelleId')::bigint);
  end loop;
  if jsonb_typeof(coalesce(p_spiegel, '{}'::jsonb)) = 'object' then
    for v_pfad in select jsonb_object_keys(coalesce(p_spiegel, '{}'::jsonb)) loop
      if not (v_pfad = any(public.kc_stand__spiegel_pfade())) then continue; end if;
      if octet_length((p_spiegel -> v_pfad)::text) > 2 * 1024 * 1024 then continue; end if;
      insert into public.kc_stand_spiegel (stand_id, pfad, inhalt, stand_zeit) values (p_stand, v_pfad, p_spiegel -> v_pfad, now())
        on conflict (stand_id, pfad) do update set inhalt = excluded.inhalt, stand_zeit = excluded.stand_zeit;
    end loop;
  end if;
  -- SPARSAM 2: Lebenszeichen nur schreiben, wenn älter als 20 s oder info inhaltlich geändert
  v_info_neu := case when jsonb_typeof(p_info) = 'object' and p_info <> '{}'::jsonb and octet_length(p_info::text) < 16384 then p_info else v_s.info end;
  if v_s.zuletzt_gemeldet is null or v_s.zuletzt_gemeldet < now() - interval '20 seconds'
     or (v_info_neu - 'gemeldetUm' - 'letzteAktivitaet') is distinct from (v_s.info - 'gemeldetUm' - 'letzteAktivitaet') then
    update public.kc_stand set zuletzt_gemeldet = now(), info = v_info_neu where id = p_stand;
  end if;
  -- offene Aufträge abholen (älteste zuerst) – SPARSAM 3: nur neue oder seit 60 s nicht quittierte
  select coalesce(jsonb_agg(jsonb_build_object('auftragId', a.id, 'pfad', a.pfad, 'koerper', a.koerper, 'erstelltAm', a.erstellt_am) order by a.id), '[]'::jsonb)
    into v_auftraege
    from (select * from public.kc_stand_auftrag where stand_id = p_stand and erledigt_am is null
            and (abgeholt_am is null or abgeholt_am < now() - interval '60 seconds')
          order by id limit 20) a;
  if jsonb_array_length(v_auftraege) > 0 then
    update public.kc_stand_auftrag set abgeholt_am = now() where stand_id = p_stand and erledigt_am is null
      and id in (select (x ->> 'auftragId')::bigint from jsonb_array_elements(v_auftraege) x);
  end if;
  -- SPARSAM 1: Aufräumen läuft jetzt täglich über pg_cron (kc-stand-aufraeumen, siehe unten)
  return jsonb_build_object('angenommenBis', v_bis, 'auftraege', v_auftraege, 'serverZeit', now());
end $$;

-- Aufräumen (vorher in kc_stand_melden): nur für den Zeitplan, nicht von außen aufrufbar
create or replace function public.kc_stand__aufraeumen() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_e int; v_a int;
begin
  delete from public.kc_stand_ereignis where empfangen < now() - interval '60 days';
  get diagnostics v_e = row_count;
  delete from public.kc_stand_auftrag where erledigt_am < now() - interval '14 days';
  get diagnostics v_a = row_count;
  return jsonb_build_object('ereignisse', v_e, 'auftraege', v_a);
end $$;

-- Rechte (wie Ursprungsmigration: kc_stand_melden für anon/authenticated, Hilfsfunktion für niemanden)
revoke all on function public.kc_stand_melden(uuid, text, jsonb, jsonb, jsonb) from public;
grant execute on function public.kc_stand_melden(uuid, text, jsonb, jsonb, jsonb) to anon, authenticated;
revoke all on function public.kc_stand__aufraeumen() from public, anon, authenticated;

-- Täglicher Zeitplan 03:15 UTC (wiederholbar). Ohne pg_cron: Hinweis, Rest der Migration gilt trotzdem.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'kc-stand-aufraeumen') then
      perform cron.unschedule('kc-stand-aufraeumen');
    end if;
    perform cron.schedule('kc-stand-aufraeumen', '15 3 * * *', 'select public.kc_stand__aufraeumen()');
  else
    raise warning 'pg_cron fehlt: kc-stand-aufraeumen nicht angelegt – alte Stand-Ereignisse werden nicht mehr gelöscht';
  end if;
end $$;

-- Rückweg (Verhalten wie 20261113_kc_stand_bruecke.sql):
--   1. select cron.unschedule('kc-stand-aufraeumen');
--   2. drop function if exists public.kc_stand__aufraeumen();
--   3. Die Funktion public.kc_stand_melden aus supabase/migrations/20261113_kc_stand_bruecke.sql erneut einspielen
--      (create or replace … bis „end $$;“) und die Rechte-Zeilen von dort für kc_stand_melden wiederholen.
