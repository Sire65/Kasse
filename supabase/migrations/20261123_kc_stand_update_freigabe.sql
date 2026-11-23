-- Selbst-Update der Kassen-PCs (23.11.2026): Während der Marktsperre (04.–14.12.) installiert der Kassen-PC am
-- Stand neue Programmversionen nur nach Freigabe. Die Freigabe kann auch von zu Hause kommen (PC-Manager im
-- Fernmodus) - dafür ein weiterer erlaubter Auftragspfad. Der Stand schreibt dabei nur eine Freigabe-Datei
-- (gilt für den laufenden Tag); installiert wird beim nächsten Start des Kassen-PCs.
create or replace function public.kc_stand__auftrag_pfade() returns text[]
language sql immutable set search_path = '' as $$
  select array['/master-data/push', '/dienstplan/push', '/sold-out-status/setzen', '/remote-command/queue',
    '/kassen/kopplung-widerrufen', '/api/v1/cash-transfer/queue', '/api/v1/finance-transfer/queue',
    '/bargeld/uebergabe', '/bargeld/protokoll', '/fernseher/tv-paket', '/fernseher/tv-programm', '/update/freigeben']
$$;
revoke all on function public.kc_stand__auftrag_pfade() from public, anon, authenticated;

-- Rückweg: die Funktion wie in 20261113_kc_stand_bruecke.sql ohne '/update/freigeben' neu anlegen.
