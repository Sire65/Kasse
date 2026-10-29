-- Entwurf, NICHT eingespielt. Vor Aktivierung als reguläre Migration prüfen.
-- Keine Zugangswörter/Hashes in dieser Status-Tabelle.
create table if not exists public.kc_zentrale_credential_devices (
 org_id text not null,
 device_id text not null check (device_id ~ '^mgr_[a-f0-9]{32}$' or device_id='__unidentified__'),
 device_name text,
 generation text not null check (generation in ('new','legacy')),
 last_seen_at timestamptz not null,
 primary key(org_id,device_id)
);
alter table public.kc_zentrale_credential_devices enable row level security;
revoke all on public.kc_zentrale_credential_devices from public, anon, authenticated;
grant select,insert,update on public.kc_zentrale_credential_devices to service_role;
