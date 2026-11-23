-- KC-STAND-KASSEN-QR (23.11.2026, Wunsch Hansi): die QR-Codes der Tablet-Kassen (KASSE-01/02/03) zusätzlich im
-- Adminbereich der Club-App, damit der Admin sie am Handy hat (z. B. Tablet tauschen, Zettel nicht zur Hand).
-- Der QR enthält den Kassen-Schlüssel (gilt nur im Stand-WLAN). Darum:
--   * Schreiben nur der Mini-PC selbst (Stand-ID + 256-Bit-Geheimnis, kc_stand__pruefe), nur für den eigenen Stand.
--   * Lesen nur der Club-Server (service_role) nach Admin-Prüfung - keine Rechte für anon/authenticated, RLS an.
--   * „Gerät verloren“ im PC-Manager erneuert den Schlüssel; der Mini-PC meldet den neuen Code, der alte ist ungültig.
create table if not exists public.kc_stand_kassen_qr (
  stand_id uuid not null references public.kc_stand(id) on delete cascade,
  kasse text not null check (kasse ~ '^[A-Z0-9-]{2,20}$'),
  url text not null check (length(url) between 10 and 600 and url ~ '^http://'),
  port integer,
  zettel text,
  gemeldet_am timestamptz not null default now(),
  primary key (stand_id, kasse)
);
alter table public.kc_stand_kassen_qr enable row level security;
revoke all on public.kc_stand_kassen_qr from public, anon, authenticated;
grant select, insert, update, delete on public.kc_stand_kassen_qr to service_role;

-- Der Mini-PC meldet den vollständigen Satz (ersetzt die bisherigen Codes des Stands).
create or replace function public.kc_stand_kassen_qr_melden(p_stand uuid, p_geheimnis text, p_kassen jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.kc_stand; n integer := 0; k jsonb;
begin
  v := public.kc_stand__pruefe(p_stand, p_geheimnis);
  if jsonb_typeof(coalesce(p_kassen, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_kassen, '[]'::jsonb)) > 10 then
    raise exception 'kassen_ungueltig' using errcode = '22023';
  end if;
  delete from public.kc_stand_kassen_qr where stand_id = v.id;
  for k in select * from jsonb_array_elements(coalesce(p_kassen, '[]'::jsonb)) loop
    insert into public.kc_stand_kassen_qr (stand_id, kasse, url, port, zettel)
      values (v.id, upper(k->>'kasse'), k->>'url', nullif(k->>'port', '')::integer, left(k->>'zettel', 30));
    n := n + 1;
  end loop;
  return jsonb_build_object('gespeichert', n);
end $$;
revoke all on function public.kc_stand_kassen_qr_melden(uuid, text, jsonb) from public;
grant execute on function public.kc_stand_kassen_qr_melden(uuid, text, jsonb) to anon, authenticated, service_role;

do $$
begin
  if to_regclass('public.kc_security_reviewed_exceptions') is null then return; end if;
  insert into public.kc_security_reviewed_exceptions (object_schema, object_name, object_type, finding_code, decision, reason, reviewed_at, review_after, active)
  select 'public', v.name, 'function', v.code, 'accepted_required', 'KC-STAND-KASSEN-QR 23.11.2026: ' || v.grund, now(), now() + interval '6 months', true
    from (values
      ('kc_stand_kassen_qr_melden', 'security_definer_anon_execute', 'Mini-PC am Stand meldet die Kassen-QR-Codes ohne Anmeldung; erst kc_stand__pruefe (Stand-ID + 256-Bit-Geheimnis, SHA-256-Vergleich, nur aktive Stände), schreibt nur den eigenen Stand, höchstens 10 Kassen, Längen begrenzt; liefert nur die Anzahl.'),
      ('kc_stand_kassen_qr_melden', 'security_definer_authenticated_execute', 'wie anon: erst kc_stand__pruefe (Stand-ID + 256-Bit-Geheimnis).')
    ) as v(name, code, grund)
   where not exists (select 1 from public.kc_security_reviewed_exceptions r
                      where r.object_schema = 'public' and r.object_name = v.name and r.finding_code = v.code and r.active);
end $$;

-- Rückweg:
--   drop function if exists public.kc_stand_kassen_qr_melden(uuid, text, jsonb);
--   drop table if exists public.kc_stand_kassen_qr;
--   update public.kc_security_reviewed_exceptions set active = false where object_name = 'kc_stand_kassen_qr_melden';
