#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Packt den Money Butler als eigenstaendig auslieferbares Paket.

Aufruf aus dem Repo-Wurzelverzeichnis:

    python packaging/pack_money_butler.py
    python packaging/pack_money_butler.py --version 1.2.0

Ergebnis: dist/money-butler-<version>.zip

Das Skript sucht die Abhaengigkeiten selbst: es liest alle Dateien unter
money-butler/ und sammelt jeden Verweis, der aus dem Ordner herausfuehrt
(z. B. "../shared/kc-geldkassette.js"). Die Ordnerstruktur bleibt erhalten,
damit die relativen Pfade im Code unveraendert funktionieren -- es ist also
keine Codeaenderung noetig.
"""
import argparse
import datetime
import os
import re
import shutil
import sys
import zipfile

MODULE = "money-butler"
TEXT_EXT = (".html", ".js", ".css", ".json", ".webmanifest")
# Verweise der Form src="...", href='...', import ... from "...", url(...)
REF = re.compile(r"""(?:src|href|from|import|url)\s*[=(]?\s*["']([^"']+)["']""")


def find_refs(path):
    """Liefert alle Verweise aus einer Textdatei."""
    try:
        text = open(path, "r", encoding="utf-8", errors="replace").read()
    except OSError:
        return []
    out = []
    for raw in REF.findall(text):
        ref = raw.split("?")[0].split("#")[0].strip()
        if not ref or ref.startswith(("http://", "https://", "//", "data:", "mailto:")):
            continue
        out.append(ref)
    return out


def collect(root):
    """Alle Dateien des Moduls plus die von ihm benoetigten Fremddateien."""
    module_dir = os.path.join(root, MODULE)
    if not os.path.isdir(module_dir):
        sys.exit("Ordner '%s' nicht gefunden. Bitte aus dem Repo-Wurzelverzeichnis aufrufen." % MODULE)

    own, external, missing = set(), set(), set()
    for dirpath, dirnames, filenames in os.walk(module_dir):
        for name in filenames:
            own.add(os.path.relpath(os.path.join(dirpath, name), root).replace("\\", "/"))

    # Verweise aufloesen -- mehrstufig, damit auch Abhaengigkeiten der
    # Abhaengigkeiten mitkommen (z. B. eine CSS-Datei, die ein Bild laedt).
    queue = sorted(own)
    seen = set()
    while queue:
        rel = queue.pop()
        if rel in seen:
            continue
        seen.add(rel)
        abs_path = os.path.join(root, rel)
        if not rel.lower().endswith(TEXT_EXT):
            continue
        base = os.path.dirname(rel)
        for ref in find_refs(abs_path):
            target = os.path.normpath(os.path.join(base, ref.lstrip("/"))).replace("\\", "/")
            if target.startswith(".."):
                continue
            if not os.path.isfile(os.path.join(root, target)):
                if not target.startswith(MODULE + "/"):
                    missing.add(target)
                continue
            if not target.startswith(MODULE + "/"):
                external.add(target)
            queue.append(target)

    return sorted(own), sorted(external), sorted(missing)


def main():
    ap = argparse.ArgumentParser(description="Money Butler als eigenstaendiges Paket bauen.")
    ap.add_argument("--version", default=datetime.date.today().strftime("%Y-%m-%d"),
                    help="Versionskennung fuer den Dateinamen (Vorgabe: heutiges Datum)")
    ap.add_argument("--out", default="dist", help="Zielordner (Vorgabe: dist)")
    args = ap.parse_args()

    root = os.getcwd()
    own, external, missing = collect(root)

    print("Money Butler")
    print("  eigene Dateien   : %d" % len(own))
    print("  mitgelieferte    : %d" % len(external))
    for rel in external:
        print("      %s" % rel)
    if missing:
        print("  WARNUNG - Verweise ins Leere (%d):" % len(missing))
        for rel in missing:
            print("      %s" % rel)

    stage = os.path.join(args.out, "money-butler-%s" % args.version)
    if os.path.isdir(stage):
        shutil.rmtree(stage)
    for rel in own + external:
        dest = os.path.join(stage, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(os.path.join(root, rel), dest)

    archive = stage + ".zip"
    if os.path.exists(archive):
        os.remove(archive)
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirnames, filenames in os.walk(stage):
            for name in filenames:
                full = os.path.join(dirpath, name)
                zf.write(full, os.path.relpath(full, stage))

    total = len(own) + len(external)
    size = os.path.getsize(archive) / 1024.0
    print("\nFertig: %s" % archive)
    print("  %d Dateien, %.0f KB" % (total, size))
    print("  Zum Testen: index.html im Ordner %s/%s oeffnen" % (stage, MODULE))


if __name__ == "__main__":
    main()
