-- KC-STAND-BRUECKE (KS-04, 13.11.2026, Betreiber: „Tablet -> Mini-PC -> Supabase -> PC-Manager zuhause“)
--
-- Briefkasten zwischen dem Mini-PC am Stand (Stand-Brücke im Manager-Dienst) und dem PC-Manager zu Hause.
--   Stand -> Zuhause: Live-Ereignisse (Verkauf, Storno, Ausverkauft, Abschluss, Stempeln …) und „Spiegel“
--                     der Übersichten, die der PC-Manager liest.
--   Zuhause -> Stand: „Aufträge“ (Stammdaten senden, Ausverkauft setzen, Dienstplan, Geld-Übergabe …),
--                     die der Stand abholt, ausführt und quittiert.
-- Sicherheit:
--   • Tabellen haben RLS ohne Richtlinien – Zugriff ausschließlich über die Funktionen unten.
--   • Der Stand meldet sich mit Stand-ID + Stand-Geheimnis (gespeichert nur als SHA-256-Hash). Er kann
--     nur eigene Ereignisse/Spiegel melden und eigene Aufträge abholen/quittieren.
--   • Lesen, Aufträge anlegen, Stände anlegen/abmelden: nur angemeldete Manager-Admins des eigenen Vereins
--     (kc_manager_memberships, gleiche Prüfung wie kc_zeiterfassung_zugaenge).
--   • Aufträge und Spiegel nur für eine feste Liste von Pfaden. Keine Personendaten: übertragen wird nur,
--     was der PC-Manager heute schon lokal vom Manager-Dienst sieht (Pseudonyme, keine Klarnamen).
-- Rückweg: siehe Ende der Datei.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.kc_stand (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  name text not null,
  geheimnis_hash text not null,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  erstellt_von uuid,
  zuletzt_gemeldet timestamptz,
  info jsonb not null default '{}'::jsonb
);

create table if not exists public.kc_stand_ereignis (
  id bigserial primary key,
  stand_id uuid not null references public.kc_stand(id) on delete cascade,
  quelle_id bigint not null,
  art text not null,
  kasse text,
  payload jsonb not null default '{}'::jsonb,
  zeitpunkt timestamptz,
  empfangen timestamptz not null default now(),
  unique (stand_id, quelle_id)
);
create index if not exists kc_stand_ereignis_stand_id_idx on public.kc_stand_ereignis (stand_id, id);

create table if not exists public.kc_stand_spiegel (
  stand_id uuid not null references public.kc_stand(id) on delete cascade,
  pfad text not null,
  inhalt jsonb not null,
  stand_zeit timestamptz not null default now(),
  primary key (stand_id, pfad)
);

create table if not exists public.kc_stand_auftrag (
  id bigserial primary key,
  stand_id uuid not null references public.kc_stand(id) on delete cascade,
  pfad text not null,
  koerper jsonb not null default '{}'::jsonb,
  erstellt_am timestamptz not null default now(),
  erstellt_von uuid,
  abgeholt_am timestamptz,
  erledigt_am timestamptz,
  status_code integer,
  antwort jsonb
);
create index if not exists kc_stand_auftrag_offen_idx on public.kc_stand_auftrag (stand_id, id) where erledigt_am is null;

alter table public.kc_stand enable row level security;
alter table public.kc_stand_ereignis enable row level security;
alter table public.kc_stand_spiegel enable row level security;
alter table public.kc_stand_auftrag enable row level security;
revoke all on public.kc_stand, public.kc_stand_ereignis, public.kc_stand_spiegel, public.kc_stand_auftrag from public, anon, authenticated;

-- Erlaubte Pfade (Manager-Dienst, Port 47392)
create or replace function public.kc_stand__spiegel_pfade() returns text[]
language sql immutable set search_path = '' as $$
  select array['/kassen-verbindungen', '/sold-out-status-alle', '/abschluesse/liste', '/gutscheine/liste',
    '/zeiterfassung/liste', '/cash-transfer-confirmations', '/gelduebergaben-bestaetigungen-abholen',
    '/bargeld/uebergaben', '/bargeld/protokolle', '/verbindungsqualitaet', '/kassen/startprotokoll', '/live-event-log']
$$;
create or replace function public.kc_stand__auftrag_pfade() returns text[]
language sql immutable set search_path = '' as $$
  select array['/master-data/push', '/dienstplan/push', '/sold-out-status/setzen', '/remote-command/queue',
    '/kassen/kopplung-widerrufen', '/api/v1/cash-transfer/queue', '/api/v1/finance-transfer/queue',
    '/bargeld/uebergabe', '/bargeld/protokoll', '/fernseher/tv-paket', '/fernseher/tv-programm']
$$;

-- Verein des angemeldeten Admins (oder null)
create or replace function public.kc_stand__admin_org() returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org text;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then return null; end if;
  select m.org_id into v_org from public.kc_manager_memberships m
    where m.user_id = v_uid and m.active is true and m.role in ('admin', 'superadmin') limit 1;
  return v_org;
end $$;

-- Stand prüfen (Stand-Seite). Wirft 28000, wenn Stand unbekannt, abgemeldet oder Geheimnis falsch.
create or replace function public.kc_stand__pruefe(p_stand uuid, p_geheimnis text) returns public.kc_stand
language plpgsql stable security definer set search_path = '' as $$
declare v public.kc_stand;
begin
  select * into v from public.kc_stand s
    where s.id = p_stand and s.aktiv is true
      and s.geheimnis_hash = encode(extensions.digest(coalesce(p_geheimnis, ''), 'sha256'), 'hex');
  if v.id is null then raise exception 'stand_unbekannt_oder_geheimnis_falsch' using errcode = '28000'; end if;
  return v;
end $$;

-- ===================== Admin (PC-Manager, angemeldet) =====================

create or replace function public.kc_stand_anlegen(p_name text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_org text := public.kc_stand__admin_org(); v_geheimnis text; v_id uuid;
begin
  if v_org is null then raise exception 'nur_fuer_admins' using errcode = '42501'; end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 80 then raise exception 'name_ungueltig' using errcode = '22023'; end if;
  v_geheimnis := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.kc_stand (org_id, name, geheimnis_hash, erstellt_von)
    values (v_org, trim(p_name), encode(extensions.digest(v_geheimnis, 'sha256'), 'hex'), auth.uid())
    returning id into v_id;
  return jsonb_build_object('standId', v_id, 'geheimnis', v_geheimnis, 'name', trim(p_name));
end $$;

create or replace function public.kc_stand_liste() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_org text := public.kc_stand__admin_org();
begin
  if v_org is null then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'standId', s.id, 'name', s.name, 'erstelltAm', s.erstellt_am, 'zuletztGemeldet', s.zuletzt_gemeldet,
      'sekundenSeitMeldung', case when s.zuletzt_gemeldet is null then null else floor(extract(epoch from now() - s.zuletzt_gemeldet))::int end,
      'info', s.info) order by s.zuletzt_gemeldet desc nulls last, s.erstellt_am desc)
    from public.kc_stand s where s.org_id = v_org and s.aktiv is true), '[]'::jsonb);
end $$;

create or replace function public.kc_stand_abmelden(p_stand uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_org text := public.kc_stand__admin_org(); v_n int;
begin
  if v_org is null then raise exception 'nur_fuer_admins' using errcode = '42501'; end if;
  update public.kc_stand set aktiv = false where id = p_stand and org_id = v_org;
  get diagnostics v_n = row_count;
  return jsonb_build_object('abgemeldet', v_n > 0);
end $$;

-- Ereignisse ab einer ID (p_nach_id null: nur die aktuelle letzte ID liefern, als Startpunkt)
create or replace function public.kc_stand_ereignisse(p_stand uuid, p_nach_id bigint default null, p_limit integer default 200) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_org text := public.kc_stand__admin_org(); v_s public.kc_stand; v_liste jsonb; v_letzte bigint;
begin
  if v_org is null then raise exception 'nur_fuer_admins' using errcode = '42501'; end if;
  select * into v_s from public.kc_stand where id = p_stand and org_id = v_org;
  if v_s.id is null then raise exception 'stand_unbekannt' using errcode = '22023'; end if;
  select coalesce(max(id), 0) into v_letzte from public.kc_stand_ereignis where stand_id = p_stand;
  if p_nach_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'art', e.art, 'kasse', e.kasse, 'payload', e.payload, 'zeitpunkt', e.zeitpunkt) order by e.id), '[]'::jsonb)
      into v_liste
      from (select * from public.kc_stand_ereignis
            where stand_id = p_stand and id > p_nach_id order by id limit least(greatest(coalesce(p_limit, 200), 1), 500)) e;
  end if;
  return jsonb_build_object('ereignisse', coalesce(v_liste, '[]'::jsonb), 'letzteId', v_letzte,
    'zuletztGemeldet', v_s.zuletzt_gemeldet, 'info', v_s.info,
    'sekundenSeitMeldung', case when v_s.zuletzt_gemeldet is null then null else floor(extract(epoch from now() - v_s.zuletzt_gemeldet))::int end);
end $$;

create or replace function public.kc_stand_spiegel(p_stand uuid, p_pfad text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_org text := public.kc_stand__admin_org(); v_s public.kc_stand; v_z public.kc_stand_spiegel;
begin
  if v_org is null then raise exception 'nur_fuer_admins' using errcode = '42501'; end if;
  select * into v_s from public.kc_stand where id = p_stand and org_id = v_org;
  if v_s.id is null then raise exception 'stand_unbekannt' using errcode = '22023'; end if;
  select * into v_z from public.kc_stand_spiegel where stand_id = p_stand and pfad = p_pfad;
  return jsonb_build_object('vorhanden', v_z.pfad is not null, 'inhalt', v_z.inhalt, 'standZeit', v_z.stand_zeit,
    'sekundenAlt', case when v_z.stand_zeit is null then null else floor(extract(epoch from now() - v_z.stand_zeit))::int end,
    'zuletztGemeldet', v_s.zuletzt_gemeldet,
    'sekundenSeitMeldung', case when v_s.zuletzt_gemeldet is null then null else floor(extract(epoch from now() - v_s.zuletzt_gemeldet))::int end);
end $$;

create or replace function public.kc_stand_auftrag_anlegen(p_stand uuid, p_pfad text, p_koerper jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_org text := public.kc_stand__admin_org(); v_id bigint;
begin
  if v_org is null then raise exception 'nur_fuer_admins' using errcode = '42501'; end if;
  if not exists (select 1 from public.kc_stand where id = p_stand and org_id = v_org and aktiv is true) then
    raise exception 'stand_unbekannt' using errcode = '22023'; end if;
  if not (p_pfad = any(public.kc_stand__auftrag_pfade())) then raise exception 'pfad_nicht_erlaubt' using errcode = '22023'; end if;
  if octet_length(coalesce(p_koerper, '{}'::jsonb)::text) > 8 * 1024 * 1024 then raise exception 'auftrag_zu_gross' using errcode = '22023'; end if;
  insert into public.kc_stand_auftrag (stand_id, pfad, koerper, erstellt_von)
    values (p_stand, p_pfad, coalesce(p_koerper, '{}'::jsonb), auth.uid()) returning id into v_id;
  return jsonb_build_object('auftragId', v_id);
end $$;

create or replace function public.kc_stand_auftrag(p_auftrag bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_org text := public.kc_stand__admin_org(); v public.kc_stand_auftrag;
begin
  if v_org is null then raise exception 'nur_fuer_admins' using errcode = '42501'; end if;
  select a.* into v from public.kc_stand_auftrag a join public.kc_stand s on s.id = a.stand_id
    where a.id = p_auftrag and s.org_id = v_org;
  if v.id is null then raise exception 'auftrag_unbekannt' using errcode = '22023'; end if;
  return jsonb_build_object('auftragId', v.id,
    'status', case when v.erledigt_am is not null then 'erledigt' when v.abgeholt_am is not null then 'abgeholt' else 'wartet' end,
    'statusCode', v.status_code, 'antwort', v.antwort, 'erstelltAm', v.erstellt_am, 'erledigtAm', v.erledigt_am);
end $$;

-- ===================== Stand (Stand-Brücke mit Stand-Geheimnis) =====================

-- Ein Aufruf für alles: Ereignisse + Spiegel hochladen, Lebenszeichen setzen, offene Aufträge abholen.
create or replace function public.kc_stand_melden(p_stand uuid, p_geheimnis text, p_ereignisse jsonb default '[]'::jsonb,
  p_spiegel jsonb default '{}'::jsonb, p_info jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_s public.kc_stand; v_e jsonb; v_bis bigint := null; v_pfad text; v_auftraege jsonb;
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
  update public.kc_stand set zuletzt_gemeldet = now(),
    info = case when jsonb_typeof(p_info) = 'object' and p_info <> '{}'::jsonb and octet_length(p_info::text) < 16384 then p_info else info end
    where id = p_stand;
  -- offene Aufträge abholen (älteste zuerst)
  select coalesce(jsonb_agg(jsonb_build_object('auftragId', a.id, 'pfad', a.pfad, 'koerper', a.koerper, 'erstelltAm', a.erstellt_am) order by a.id), '[]'::jsonb)
    into v_auftraege
    from (select * from public.kc_stand_auftrag where stand_id = p_stand and erledigt_am is null order by id limit 20) a;
  update public.kc_stand_auftrag set abgeholt_am = now() where stand_id = p_stand and erledigt_am is null and abgeholt_am is null
    and id in (select (x ->> 'auftragId')::bigint from jsonb_array_elements(v_auftraege) x);
  -- Aufräumen: Ereignisse nach 60 Tagen, erledigte Aufträge nach 14 Tagen
  delete from public.kc_stand_ereignis where id in (select id from public.kc_stand_ereignis where stand_id = p_stand and empfangen < now() - interval '60 days' limit 1000);
  delete from public.kc_stand_auftrag where id in (select id from public.kc_stand_auftrag where stand_id = p_stand and erledigt_am < now() - interval '14 days' limit 1000);
  return jsonb_build_object('angenommenBis', v_bis, 'auftraege', v_auftraege, 'serverZeit', now());
end $$;

create or replace function public.kc_stand_auftrag_erledigt(p_stand uuid, p_geheimnis text, p_auftrag bigint, p_status integer, p_antwort jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_n int;
begin
  perform public.kc_stand__pruefe(p_stand, p_geheimnis);
  update public.kc_stand_auftrag set erledigt_am = now(), status_code = p_status,
      antwort = case when octet_length(coalesce(p_antwort, 'null'::jsonb)::text) <= 1048576 then p_antwort else jsonb_build_object('hinweis', 'antwort_zu_gross') end
    where id = p_auftrag and stand_id = p_stand and erledigt_am is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('quittiert', v_n > 0);
end $$;

-- Rechte
revoke all on function public.kc_stand__spiegel_pfade(), public.kc_stand__auftrag_pfade(), public.kc_stand__admin_org(),
  public.kc_stand__pruefe(uuid, text) from public, anon, authenticated;
revoke all on function public.kc_stand_anlegen(text), public.kc_stand_liste(), public.kc_stand_abmelden(uuid),
  public.kc_stand_ereignisse(uuid, bigint, integer), public.kc_stand_spiegel(uuid, text),
  public.kc_stand_auftrag_anlegen(uuid, text, jsonb), public.kc_stand_auftrag(bigint),
  public.kc_stand_melden(uuid, text, jsonb, jsonb, jsonb), public.kc_stand_auftrag_erledigt(uuid, text, bigint, integer, jsonb) from public;
grant execute on function public.kc_stand_anlegen(text), public.kc_stand_liste(), public.kc_stand_abmelden(uuid),
  public.kc_stand_ereignisse(uuid, bigint, integer), public.kc_stand_spiegel(uuid, text),
  public.kc_stand_auftrag_anlegen(uuid, text, jsonb), public.kc_stand_auftrag(bigint) to authenticated;
grant execute on function public.kc_stand_melden(uuid, text, jsonb, jsonb, jsonb),
  public.kc_stand_auftrag_erledigt(uuid, text, bigint, integer, jsonb) to anon, authenticated;

-- Rückweg:
--   drop function if exists public.kc_stand_melden(uuid, text, jsonb, jsonb, jsonb), public.kc_stand_auftrag_erledigt(uuid, text, bigint, integer, jsonb),
--     public.kc_stand_anlegen(text), public.kc_stand_liste(), public.kc_stand_abmelden(uuid), public.kc_stand_ereignisse(uuid, bigint, integer),
--     public.kc_stand_spiegel(uuid, text), public.kc_stand_auftrag_anlegen(uuid, text, jsonb), public.kc_stand_auftrag(bigint),
--     public.kc_stand__pruefe(uuid, text), public.kc_stand__admin_org(), public.kc_stand__spiegel_pfade(), public.kc_stand__auftrag_pfade();
--   drop table if exists public.kc_stand_auftrag, public.kc_stand_spiegel, public.kc_stand_ereignis, public.kc_stand;
