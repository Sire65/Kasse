#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Erzeugt die Offline-Dateiliste des Service Workers aus dem Programm selbst.

Warum es dieses Werkzeug gibt: die Liste im service-worker.js war von Hand gepflegt und
stehengeblieben - es fehlten alle nach dem letzten Update dazugekommenen Bausteine und
saemtliche Produktbilder. Offline GARANTIERT verfuegbar ist nur, was in dieser Liste steht.
Ein frisch eingerichtetes Tablet konnte dadurch am Marktmorgen unvollstaendig starten.

Aufruf aus dem Ordner kassenoberflaeche-und-pc-manager:
    python3 werkzeuge/offline-liste.py            # zeigt nur an, was sich aendern wuerde
    python3 werkzeuge/offline-liste.py --schreiben # traegt die Liste in den Service Worker ein
"""
import io, re, os, json, sys

POS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pos')

def sammle():
    os.chdir(POS)
    html = io.open('index.html', encoding='utf-8').read()
    dateien = {'./', './index.html', './manifest.webmanifest', './version-manifest.json'}
    for m in re.finditer(r'(?:src|href)="([^"]+)"', html):
        p = m.group(1)
        if p.startswith(('http', 'data:', '#', 'mailto')):
            continue
        dateien.add('./' + p if not p.startswith(('.', '/')) else p)
    # dynamisch nachgeladene Module (ladeNacheinander)
    for m in re.finditer(r"ladeNacheinander\(\[([^\]]+)\]", html):
        for t in re.findall(r"'([^']+)'", m.group(1)):
            dateien.add('./' + t)
    for ordner, _u, namen in os.walk('.'):
        if any(x in ordner for x in ('node_modules', '.git')):
            continue
        for n in namen:
            if n.endswith(('.webp', '.png', '.jpg', '.svg', '.mp3', '.css', '.woff2')):
                dateien.add(os.path.join(ordner, n).replace('\\', '/'))
    for pfad in ['../shared/runtime-flags.js', '../shared/kc-bargeld-statistik.js',
                 '../shared/kc-bargeld-statistik.css', '../pc-manager/vendor/qrcode-generator.js']:
        dateien.add(pfad)
    for wurzel in ['../cores', '../exchange-core-v31']:
        for ordner, _u, namen in os.walk(wurzel):
            for n in namen:
                if n.endswith(('.js', '.css')):
                    dateien.add(os.path.join(ordner, n).replace('\\', '/'))
    # BEFUND aus der Offline-Probe: die Skripte stehen in index.html MIT Versionsangabe
    # (kc-sync-connection.js?build=0.2.0). Die Existenzpruefung muss diese Angabe abschneiden,
    # die Liste sie aber BEHALTEN - der Browser fragt genau diese Adresse an, und der
    # Offline-Speicher vergleicht Adressen zeichengenau. Ohne das fielen ausgerechnet die
    # Sync-Module und das Ausverkauft-Modul aus der Liste, und die Kasse startete ohne Netz gar
    # nicht mehr.
    return sorted(d for d in dateien if os.path.exists(d.split('?')[0]))

def main():
    assets = sammle()
    sw = io.open('service-worker.js', encoding='utf-8').read()
    alt = re.search(r'const ASSETS=\[.*?\];', sw, re.S)
    bisher = json.loads(alt.group(0)[len('const ASSETS='):-1]) if alt else []
    neu = [d for d in assets if d not in bisher]
    weg = [d for d in bisher if d not in assets]
    print(f'{len(assets)} Dateien insgesamt, {len(neu)} neu, {len(weg)} entfallen')
    for d in neu[:20]:
        print('  + ' + d)
    for d in weg[:20]:
        print('  - ' + d)
    if '--schreiben' in sys.argv and alt:
        sw = sw[:alt.start()] + 'const ASSETS=' + json.dumps(assets, ensure_ascii=False) + ';' + sw[alt.end():]
        io.open('service-worker.js', 'w', encoding='utf-8').write(sw)
        print('In den Service Worker eingetragen.')

main()
