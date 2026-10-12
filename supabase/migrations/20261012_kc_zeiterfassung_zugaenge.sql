-- KC-ZEITERFASSUNG-ZUGAENGE (12.10.2026, Betreiber: „Richte jetzt für alle ein, dass sie sich mit ihren Ausweisen und
-- Geburtstag einloggen können bei der Zeiterfassung“).
--  • Der PC-Manager holt die Zugänge für die Stechuhr der Kassen aus der zentralen Mitgliederverwaltung (kc_core_personen):
--    Mitgliedsnummer (= QR auf dem Ausweis), Pseudonym, Mitgliedsart und den Geburtstagscode TTMMJJ.
--  • KEINE Klarnamen, keine Anschrift/Telefon/E-Mail, kein volles Geburtsdatum – nur der sechsstellige Code.
--  • Nur für angemeldete Manager-Administratoren des eigenen Vereins (gleiche Prüfung wie kc_rt_programm_kanal('manager')).
--  • Nur lesen. Rückweg: drop function public.kc_zeiterfassung_zugaenge();
create or replace function public.kc_zeiterfassung_zugaenge() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org text;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then return null; end if;
  select m.org_id into v_org from public.kc_manager_memberships m
    where m.user_id = v_uid and m.active is true and m.role in ('admin', 'superadmin') limit 1;
  if v_org is null then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'mitgliedsnummer', p.mitgliedsnummer,
      'pseudonym', nullif(trim(p.pseudonym), ''),
      'mitgliedsart', p.mitgliedsart,
      'geburtstagscode', case when p.geburtstag is null then null else to_char(p.geburtstag, 'DDMMYY') end
    ) order by p.mitgliedsnummer)
    from public.kc_core_personen p
    where p.org_id = v_org and p.aktiv is true and coalesce(trim(p.mitgliedsnummer), '') <> ''
  ), '[]'::jsonb);
end $$;
revoke all on function public.kc_zeiterfassung_zugaenge() from public, anon;
grant execute on function public.kc_zeiterfassung_zugaenge() to authenticated;
