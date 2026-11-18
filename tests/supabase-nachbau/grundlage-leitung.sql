-- Nachbau für Tests der direkten Leitung (NICHT in Supabase einspielen – dort gibt es das schon):
-- Vault mit dem Club-Geheimnis, realtime.send (gibt das Signal per pg_notify an den Nachbau weiter, der es an die
-- WebSocket-Teilnehmer des Kanals verteilt), Monatszähler, Prüfregister und eine schlanke Stempel-Tabelle.
do $$ begin if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if; end $$;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists vault;
create table if not exists vault.decrypted_secrets (name text primary key, decrypted_secret text not null);
insert into vault.decrypted_secrets values ('kc_club_rt_geheimnis', 'nur-fuer-tests-' || md5('kc')) on conflict do nothing;
create schema if not exists realtime;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
language sql as $$ select pg_notify('kc_nachbau_realtime', jsonb_build_object('topic', topic, 'event', event, 'payload', payload)::text) $$;
create table if not exists public.kc_club_rt_zaehler (
  monat text primary key, anzahl bigint not null default 0, gewarnt jsonb not null default '{}'::jsonb, geaendert_am timestamptz not null default now());
create table if not exists public.kc_security_reviewed_exceptions (object_schema text, object_name text, object_type text, finding_code text,
  decision text, reason text, reviewed_at timestamptz, review_after timestamptz, active boolean);
create table if not exists public.kc_dp_memberships (user_id uuid, org_id text, role text, active boolean);
create table if not exists public.kc_dp_stempel (id bigserial primary key, org_id text not null, member_no text, art text, zeit timestamptz default now());
