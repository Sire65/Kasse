-- Nachbau der Supabase-Grundlage für Tests (NICHT in Supabase einspielen - dort gibt es das schon):
-- Rollen anon/authenticated, auth.uid()/auth.jwt() aus request.jwt.claims, Schema extensions,
-- die vorhandene Tabelle kc_manager_memberships.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists extensions;
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
grant usage on schema auth, extensions, public to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
create table if not exists public.kc_manager_memberships (user_id uuid, org_id text, role text, active boolean);
