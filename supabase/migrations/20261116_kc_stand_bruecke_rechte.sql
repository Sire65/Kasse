-- KS-04 Nachbesserung (16.11.2026): Supabase vergibt neuen Funktionen in "public" per
-- Default-Privileg EXECUTE an anon. Die Admin-RPCs prüfen zwar intern (nur_fuer_admins),
-- werden hier aber zusätzlich auf Rechte-Ebene für anon gesperrt.
-- Für anon bleiben nur kc_stand_melden und kc_stand_auftrag_erledigt (Mini-PC mit Stand-Geheimnis).
revoke execute on function public.kc_stand_anlegen(text), public.kc_stand_liste(), public.kc_stand_abmelden(uuid),
  public.kc_stand_ereignisse(uuid, bigint, integer), public.kc_stand_spiegel(uuid, text),
  public.kc_stand_auftrag_anlegen(uuid, text, jsonb), public.kc_stand_auftrag(bigint) from anon;
