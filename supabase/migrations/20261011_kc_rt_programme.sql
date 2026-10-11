-- KC-RT-PROGRAMME (11.10.2026, Wunsch Hansi: „hänge PC-Manager, Money Butler und dp2 an die Standleitung“).
-- Gleiches Muster wie die direkte Leitung der Club-App (KC-CLUB-REALTIME, 2.226.0/2.230.0):
--  • Die Datenbank meldet über Supabase Realtime (Broadcast, kostenlos) nur ein SIGNAL „es gibt Neues“ (Art) – nie Beträge,
--    Namen oder Inhalte. Den Inhalt holt jedes Programm wie bisher über seinen gesicherten Weg.
--  • Kanal je Bereich und Verein = HMAC(vorhandenes Club-Geheimnis aus dem Vault, „programm:Bereich:Verein“) → nicht erratbar
--    und durch den Vorsatz „programm:“ getrennt von den Personen-Kanälen der Club-App. Es wird KEIN neues Geheimnis angelegt.
--  • Den Kanalnamen bekommt nur, wer angemeldet UND für den Bereich berechtigt ist (kc_rt_programm_kanal).
--  • Gemeinsamer Monatszähler mit der Club-App (kc_club_rt_zaehler, ein Kontingent je Projekt): ab 95 % keine Signale mehr.
--  • Fehler im Signal dürfen das eigentliche Speichern nie stören (exception when others).
--  • Fällt die Leitung aus, fragen die Programme wie früher selbst nach – es geht nichts verloren.
-- Rückweg: Trigger kc_rt_* (siehe unten) löschen, danach die Funktionen kc_rt_programm_*.

-- Kanalname (nur intern)
create or replace function public.kc_rt_programm_kanal_intern(p_bereich text, p_org text) returns text
language sql stable security definer set search_path = '' as $$
  select 'kc-rt-' || left(encode(extensions.hmac('programm:' || p_bereich || ':' || p_org,
    (select decrypted_secret from vault.decrypted_secrets where name = 'kc_club_rt_geheimnis'), 'sha256'), 'hex'), 32)
$$;
revoke all on function public.kc_rt_programm_kanal_intern(text, text) from public, anon, authenticated;

-- Kanalname für das angemeldete Programm – nur bei passender, aktiver Berechtigung, sonst null (Programm fragt dann wie früher nach)
create or replace function public.kc_rt_programm_kanal(p_bereich text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org text;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then return null; end if;
  if p_bereich = 'manager' then
    select m.org_id into v_org from public.kc_manager_memberships m
      where m.user_id = v_uid and m.active is true and m.role in ('admin', 'superadmin') limit 1;
  elsif p_bereich = 'money-butler' then
    select l.org_id into v_org from public.kc_core_user_links l
      where l.user_id = v_uid and l.active is true
        and (l.core_role in ('admin', 'superadmin') or exists (select 1 from public.kc_core_app_access a
              where a.org_id = l.org_id and a.person_id = l.person_id and a.app_id = 'KC_MONEY_BUTLER' and a.active is true
                and a.access_role in ('admin', 'manager', 'operator')))
      limit 1;
  elsif p_bereich = 'dp' then
    select m.org_id into v_org from public.kc_dp_memberships m where m.user_id = v_uid and m.active is true limit 1;
  end if;
  if v_org is null then return null; end if;
  return public.kc_rt_programm_kanal_intern(p_bereich, v_org);
end $$;
revoke all on function public.kc_rt_programm_kanal(text) from public, anon;
grant execute on function public.kc_rt_programm_kanal(text) to authenticated;

-- Signal senden (Zähler gemeinsam mit der Club-App; ab 95 % des kostenlosen Kontingents nichts mehr)
create or replace function public.kc_rt_programm_melden(p_bereiche text[], p_org text, p_art text) returns void
language plpgsql security definer set search_path = '' as $$
declare b text; v_monat text := to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM'); v_n bigint; v_anz int := coalesce(array_length(p_bereiche, 1), 0);
begin
  if v_anz = 0 or p_org is null then return; end if;
  begin
    select anzahl into v_n from public.kc_club_rt_zaehler where monat = v_monat;
    if coalesce(v_n, 0) >= 1900000 then return; end if;
    insert into public.kc_club_rt_zaehler (monat, anzahl) values (v_monat, v_anz)
      on conflict (monat) do update set anzahl = public.kc_club_rt_zaehler.anzahl + excluded.anzahl, geaendert_am = now();
  exception when others then null;
  end;
  foreach b in array p_bereiche loop
    begin
      perform realtime.send(jsonb_build_object('art', p_art), 'neu', public.kc_rt_programm_kanal_intern(b, p_org), false);
    exception when others then null;
    end;
  end loop;
end $$;
revoke all on function public.kc_rt_programm_melden(text[], text, text) from public, anon, authenticated;

-- Geld (Money Butler ↔ PC-Manager): neue Übergabe/Zählung oder geänderter Status; gemeinsame Messwerte-Einstellungen
create or replace function public.kc_rt_programm_geld_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    if tg_table_name = 'kc_finance_cash_measure_settings' then
      perform public.kc_rt_programm_melden(array['manager', 'money-butler'], new.org_id, 'einstellungen');
    elsif tg_op = 'INSERT' or new.status is distinct from old.status then
      perform public.kc_rt_programm_melden(array['manager', 'money-butler'], new.org_id,
        case when tg_table_name = 'kc_finance_cash_counts' then 'zaehlung' else 'geld' end);
    end if;
  exception when others then null;
  end;
  return null;
end $$;
revoke all on function public.kc_rt_programm_geld_trigger() from public, anon, authenticated;

-- dp2: Abgleich (andere Geräte holen sofort) und veröffentlichter Sollplan (PC-Manager holt sofort).
-- Je Anweisung EIN Signal je Verein, nicht je Zeile (ein Abgleich schreibt viele Zeilen auf einmal).
create or replace function public.kc_rt_programm_dp_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o text;
begin
  begin
    for o in select distinct org_id from neu where org_id is not null loop
      if tg_table_name = 'kc_dp_sync_operations' then
        perform public.kc_rt_programm_melden(array['dp'], o, 'abgleich');
      else
        perform public.kc_rt_programm_melden(array['manager'], o, 'dienstplan');
      end if;
    end loop;
  exception when others then null;
  end;
  return null;
end $$;
revoke all on function public.kc_rt_programm_dp_trigger() from public, anon, authenticated;

drop trigger if exists kc_rt_geld_uebergabe on public.kc_finance_cash_transfers;
create trigger kc_rt_geld_uebergabe after insert or update on public.kc_finance_cash_transfers
  for each row execute function public.kc_rt_programm_geld_trigger();
drop trigger if exists kc_rt_geld_zaehlung on public.kc_finance_cash_counts;
create trigger kc_rt_geld_zaehlung after insert or update on public.kc_finance_cash_counts
  for each row execute function public.kc_rt_programm_geld_trigger();
drop trigger if exists kc_rt_geld_einstellungen on public.kc_finance_cash_measure_settings;
create trigger kc_rt_geld_einstellungen after insert or update on public.kc_finance_cash_measure_settings
  for each row execute function public.kc_rt_programm_geld_trigger();
drop trigger if exists kc_rt_dp_abgleich on public.kc_dp_sync_operations;
create trigger kc_rt_dp_abgleich after insert on public.kc_dp_sync_operations
  referencing new table as neu for each statement execute function public.kc_rt_programm_dp_trigger();
drop trigger if exists kc_rt_dp_plan_neu on public.kc_dp_plan_published;
create trigger kc_rt_dp_plan_neu after insert on public.kc_dp_plan_published
  referencing new table as neu for each statement execute function public.kc_rt_programm_dp_trigger();
drop trigger if exists kc_rt_dp_plan_geaendert on public.kc_dp_plan_published;
create trigger kc_rt_dp_plan_geaendert after update on public.kc_dp_plan_published
  referencing new table as neu for each statement execute function public.kc_rt_programm_dp_trigger();
