/* Test-PostgreSQL für die Stand-Brücke einrichten (Grundlage + Migrationen in der richtigen Reihenfolge).
 * Aufruf: KC_TEST_PG=postgresql://… node tests/supabase-nachbau/einrichten.cjs   (braucht das npm-Paket "pg")
 * Von 20261011_kc_rt_programme.sql werden nur die Leitungs-Funktionen eingespielt (die Trigger dort gehören zu
 * Geld-/dp2-Tabellen, die es im Nachbau nicht gibt). */
'use strict';
const fs = require('fs'), path = require('path');
const { Client } = require('pg');
const W = path.join(__dirname, '..', '..');
const lies = (p) => fs.readFileSync(path.join(W, p), 'utf8');
(async () => {
  const c = new Client({ connectionString: process.env.KC_TEST_PG });
  await c.connect();
  const teile = [
    ['grundlage', lies('tests/supabase-nachbau/grundlage.sql')],
    ['grundlage-leitung', lies('tests/supabase-nachbau/grundlage-leitung.sql')],
    ['20261011 (Leitungs-Funktionen)', lies('supabase/migrations/20261011_kc_rt_programme.sql').split('-- Geld (Money Butler')[0]],
    ['20261113', lies('supabase/migrations/20261113_kc_stand_bruecke.sql')],
    ['20261118 sparsam', lies('supabase/migrations/20261118_kc_stand_sparsam.sql')],
    ['20261119 leitung', lies('supabase/migrations/20261119_kc_stand_leitung.sql')],
  ];
  for (const [name, sql] of teile) { await c.query(sql); console.log('  eingespielt: ' + name); }
  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
