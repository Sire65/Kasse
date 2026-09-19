'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync('pc-manager/kc-manager-supabase-status.js', 'utf8');

test('Supabase info uses a modal dialog in the browser top layer', () => {
  assert.match(source, /document\.createElement\('dialog'\)/);
  assert.match(source, /overlay\.showModal\(\)/);
});

test('Supabase dialog closes cleanly by button, backdrop and Escape', () => {
  assert.match(source, /const schliessen = \(\) => \{ if \(overlay\.open\) overlay\.close\(\); overlay\.remove\(\); \}/);
  assert.match(source, /kcSupabaseInfoClose'[\s\S]*addEventListener\('click', schliessen\)/);
  assert.match(source, /e\.target === overlay\) schliessen\(\)/);
  assert.match(source, /addEventListener\('cancel'[\s\S]*e\.preventDefault\(\); schliessen\(\)/);
});

test('legacy z-index overlay is no longer used for Supabase info', () => {
  assert.doesNotMatch(source, /kcSupabaseInfoOverlay[\s\S]{0,500}z-index:99996/);
});
