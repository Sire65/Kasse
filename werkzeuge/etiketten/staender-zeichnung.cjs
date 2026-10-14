// Zeichnung Edelstahl-Ständer für das Kesselschild-Etikett (KC-SCHILD-STAENDER, 14.10.2026)
// node werkzeuge/etiketten/staender-zeichnung.cjs  -> werkzeuge/etiketten/ausgabe/Staender_Schild_Zeichnung.pdf (A4 quer)
// Betreiber: "Edelstahlschild genauso, aber als Ständer: Front etwas nach hinten geneigt, unten dreht sich das Metall
// zu einer Bodenplatte (wie ein Reserviert-Schild im Restaurant). Maße bleiben, Langlöcher nicht, mittiges Loch bleibt.
// Front, Seite und Perspektive auf einer A4-Seite verkleinert."
// Grundlage: Originalzeichnung SCH-001 Rev. C "Schild mit Bandbefestigung" (90 x 100 x 1,5 mm, 1.4301, Ecken R8, Rundloch Ø8
// mittig 8 mm unter Oberkante, Etikett 80 x 80 ab 16 mm unter Oberkante). Annahmen (gekennzeichnet *): Neigung, Bodenplatte, Biegeradius.
const fs = require('fs'), path = require('path'), pw = require('playwright');
const ZIEL = path.join(__dirname, 'ausgabe'); fs.mkdirSync(ZIEL, {recursive: true});
const M = module.exports.M = {breite: 90, hoehe: 100, neigung: 15, boden: 60, t: 1.5, r: 2, loch: 8, lochAbOben: 8, etikett: 80, rand: 5, etikettUnten: 4, eckRadius: 8};
const S = 0.5;                                   // Massstab 1:2 (mm Zeichnung je mm Bauteil)
const f1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const rad = (g) => g * Math.PI / 180;

// ---------- Hilfen (alles in Papier-mm) ----------
const linie = (x1, y1, x2, y2, k = 'k') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${k}"/>`;
const text = (x, y, t, o = '') => `<text x="${x}" y="${y}" ${o}>${t}</text>`;
// Maß zwischen p1 und p2, Maßlinie um "ab" in Richtung n (Einheitsvektor) versetzt; Text außen an der Maßlinie, lesbar gedreht
function mass(p1, p2, n, ab, label) {
  const a1 = [p1[0] + n[0] * ab, p1[1] + n[1] * ab], a2 = [p2[0] + n[0] * ab, p2[1] + n[1] * ab];
  let w = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]) * 180 / Math.PI; if (w > 90.1 || w <= -90.1) w += 180;
  const mx = (a1[0] + a2[0]) / 2 + n[0] * 1.2, my = (a1[1] + a2[1]) / 2 + n[1] * 1.2;
  const hl = (p, q) => linie(p[0] + n[0] * 0.8, p[1] + n[1] * 0.8, q[0] + n[0] * 1.2, q[1] + n[1] * 1.2, 'hl');
  return hl(p1, a1) + hl(p2, a2) + `<line x1="${a1[0]}" y1="${a1[1]}" x2="${a2[0]}" y2="${a2[1]}" class="ml" marker-start="url(#p)" marker-end="url(#p)"/>`
    + `<text x="${mx}" y="${my}" class="mt" text-anchor="middle" dominant-baseline="${(n[1] > 0.5 || n[0] > 0.5) ? 'hanging' : 'auto'}" transform="rotate(${w} ${mx} ${my})">${label}</text>`;
}
const hinweis = (x1, y1, x2, y2, t, anker = 'start') => linie(x1, y1, x2, y2, 'hl') + text(x2 + (anker === 'end' ? -0.8 : 0.8), y2 + 1, t, `class="mt" text-anchor="${anker}"`);
const kopf = (x, y, t1, t2) => text(x, y, t1, 'class="ue" text-anchor="middle"') + text(x, y + 4.5, t2, 'class="ut" text-anchor="middle"');

// ---------- 1. Vorderansicht (Blick senkrecht auf die Schildfläche, wahre Größe) ----------
function vorne(ox, oy) {
  const b = M.breite * S, h = M.hoehe * S, e = M.etikett * S, rd = M.rand * S, rr = M.eckRadius * S;
  const ey = (M.hoehe - M.etikettUnten - M.etikett) * S, ly = M.lochAbOben * S, lr = M.loch * S / 2;
  // Kettenmaß rechts: Oberkante -> Lochmitte -> Etikett oben -> Etikett unten -> Biegekante
  const kette = [[0, ly, '8'], [ly, ey, '8'], [ey, ey + e, '80'], [ey + e, h, '4']], kx = b + 5;
  const ketteSvg = linie(kx, 0, kx, h, 'ml') + [0, ly, ey, ey + e, h].map((y) => linie(b + 0.8, y, kx + 1.2, y, 'hl') + linie(kx - 0.7, y + 0.7, kx + 0.7, y - 0.7, 'ml')).join('')
    + kette.map(([y1, y2, t]) => text(kx + 1.6, (y1 + y2) / 2 + 1, t, 'class="mt"')).join('');
  return `<g transform="translate(${ox} ${oy})">
    <path d="M 0 ${h} L 0 ${rr} A ${rr} ${rr} 0 0 1 ${rr} 0 L ${b - rr} 0 A ${rr} ${rr} 0 0 1 ${b} ${rr} L ${b} ${h}" class="k"/>
    ${linie(-3, h, b + 3, h, 'bieg')}
    <circle cx="${b / 2}" cy="${ly}" r="${lr}" class="k"/>
    ${linie(b / 2 - 4, ly, b / 2 + 4, ly, 'mi')}${linie(b / 2, -2, b / 2, ly + 5, 'mi')}${linie(b / 2, h - 3, b / 2, h + 2, 'mi')}
    <rect x="${rd}" y="${ey}" width="${e}" height="${e}" rx="${3 * S}" class="et"/>
    ${text(b / 2, ey + e / 2 - 1, 'Etikett 80 × 80', 'class="ett" text-anchor="middle"')}
    ${text(b / 2, ey + e / 2 + 2.6, '(wasserfest, aufgeklebt)', 'class="ett" text-anchor="middle"')}
    ${mass([0, 0], [b, 0], [0, -1], 5, '90')}
    ${mass([0, h], [0, 0], [-1, 0], 5, '100')}
    ${mass([rd, h], [b - rd, h], [0, 1], 4, '80')}
    ${ketteSvg}
    ${hinweis(b / 2 - lr * 0.7, ly - lr * 0.7, b / 2 - 9, -2.5, 'Ø8', 'end')}
    ${hinweis(b - rr * 0.3, rr * 0.3, b + 3, -4, '2x R8')}
    ${text(b / 2, h + 12, 'Biegekante (– · –) → Bodenplatte', 'class="ett" text-anchor="middle"')}
    ${kopf(b / 2, -16, 'VORDERANSICHT', 'senkrecht auf die Schildfläche · M 1:2')}
  </g>`;
}

// ---------- 2. Seitenansicht (Profil von links; vorne = links) ----------
function seite(ox, oy) {
  const a = rad(M.neigung), H = M.hoehe * S, B = M.boden * S, r = M.r * S + 0.6;
  const top = [H * Math.sin(a), -H * Math.cos(a)], dir = [Math.sin(a), -Math.cos(a)], links = [-Math.cos(a), -Math.sin(a)];
  const lochP = [M.lochAbOben * S * -dir[0] + top[0], M.lochAbOben * S * -dir[1] + top[1]];
  const R = 22;   // Winkelbogen
  return `<g transform="translate(${ox} ${oy})">
    ${linie(-10, 0.4, B + 10, 0.4, 'bo')}
    <path d="M ${B} 0 L ${r} 0 Q 0 0 ${r * dir[0]} ${r * dir[1]} L ${top[0]} ${top[1]}" class="profil" style="stroke-width:${M.t * S}"/>
    ${linie(lochP[0] - 1.2 * links[0], lochP[1] - 1.2 * links[1], lochP[0] + 1.2 * links[0], lochP[1] + 1.2 * links[1], 'mi')}
    ${linie(0, 0, 0, -H - 2, 'mi')}
    <path d="M 0 ${-R} A ${R} ${R} 0 0 1 ${R * dir[0]} ${R * dir[1]}" class="ml" marker-end="url(#p)"/>
    ${text(-2.2, -R + 3, `${M.neigung}°*`, 'class="mt" text-anchor="end"')}
    ${mass([0, 0], top, links, 6, '100')}
    ${mass([0, 0], [B, 0], [0, 1], 6, '60*')}
    ${linie(top[0] + 0.8, top[1], B + 7.5, top[1], 'hl')}
    ${mass([B, 0], [B, top[1]], [1, 0], 6, f1(M.hoehe * Math.cos(a)))}
    ${hinweis(0.3, -0.3, -7, 5, 'Biegung innen R≈2*', 'end')}
    ${hinweis(lochP[0] + 0.6, lochP[1] + 0.3, lochP[0] + 6, lochP[1] + 9, 'Rundloch Ø8')}
    ${text(-6, 16, '← vorne', 'class="ett" text-anchor="middle"')}${text(B + 4, 16, 'hinten →', 'class="ett" text-anchor="middle"')}
    ${text(B / 2 + 3, 20.5, 'Blech 1,5 mm', 'class="ett" text-anchor="middle"')}
    ${kopf(B / 2, -H - 14, 'SEITENANSICHT', 'Profil von links · M 1:2')}
  </g>`;
}

// ---------- 3. Perspektive (Blick von vorne links oben, ohne Maßstab) ----------
function perspektive(ox, oy) {
  const a = rad(M.neigung), k = 0.5, EX = [0.85, 0.32], EY = [0.8, -0.26];
  const P = (X, Y, Z) => [(X * EX[0] + Y * EY[0]) * k, (X * EX[1] + Y * EY[1] - Z) * k];
  const W = M.breite, H = M.hoehe, B = M.boden, R = M.eckRadius, d = 2;     // d = Blechstärke (überhöht dargestellt)
  const fr = (u, v, o = 0) => P(u, v * Math.sin(a) + o * Math.cos(a), v * Math.cos(a) - o * Math.sin(a));   // o = nach hinten versetzt
  const bogen = (cx, cy, w0, f) => Array.from({length: 7}, (_, i) => { const w = rad(w0 + i * 15); return f(cx + Math.cos(w) * R, cy + Math.sin(w) * R); });
  const poly = (pts, cls) => `<polygon points="${pts.map((q) => q.map((z) => z.toFixed(2)).join(',')).join(' ')}" class="${cls}"/>`;
  const bodenUmriss = (z) => { const f = (x, y) => P(x, y, z); return [f(0, 0), f(W, 0), ...bogen(W - R, B - R, 0, f), ...bogen(R, B - R, 90, f)]; };
  const frontUmriss = (o) => { const f = (u, v) => fr(u, v, o); return [f(0, 0), f(W, 0), ...bogen(W - R, H - R, 0, f), ...bogen(R, H - R, 90, f)]; };
  const etk = [[M.rand, M.etikettUnten], [W - M.rand, M.etikettUnten], [W - M.rand, M.etikettUnten + M.etikett], [M.rand, M.etikettUnten + M.etikett]].map(([u, v]) => fr(u, v));
  const loch = Array.from({length: 28}, (_, i) => { const w = i / 28 * 2 * Math.PI; return fr(W / 2 + Math.cos(w) * M.loch / 2, H - M.lochAbOben + Math.sin(w) * M.loch / 2); });
  return `<g transform="translate(${ox} ${oy})">
    ${poly(bodenUmriss(-d), 'fl3')}${poly(bodenUmriss(0), 'fl2')}${poly(frontUmriss(d), 'fl3')}${poly(frontUmriss(0), 'fl1')}
    ${poly(etk, 'etf')}${poly(loch, 'lo')}
    ${linie(...P(0, 0, 0), ...P(W, 0, 0), 'bieg')}
    ${kopf(30, -72, 'PERSPEKTIVE', 'von vorne links oben · ohne Maßstab')}
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210">
  <defs><marker id="p" viewBox="0 0 10 10" refX="10" refY="5" markerUnits="userSpaceOnUse" markerWidth="2" markerHeight="2" orient="auto-start-reverse"><path d="M0 1.5 L10 5 L0 8.5 z" fill="#111"/></marker>
  <linearGradient id="st" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset=".5" stop-color="#cbd5e1"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient>
  <linearGradient id="st2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#94a3b8"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs>
  <style>
    .k{fill:none;stroke:#111;stroke-width:.45}.bieg{stroke:#111;stroke-width:.3;stroke-dasharray:3 1 .6 1}.mi{stroke:#555;stroke-width:.18;stroke-dasharray:3 1 .6 1}
    .et{fill:none;stroke:#2563eb;stroke-width:.3;stroke-dasharray:1.6 1}.ett{font:2.6px Carlito,Arial,sans-serif;fill:#334155}
    .ml{fill:none;stroke:#111;stroke-width:.18}.hl{stroke:#111;stroke-width:.15}.mt{font:3px Carlito,Arial,sans-serif;fill:#111}
    .ue{font:bold 4.2px Carlito,Arial,sans-serif;fill:#173765}.ut{font:2.7px Carlito,Arial,sans-serif;fill:#5b6572}
    .profil{fill:none;stroke:#111;stroke-linejoin:round;stroke-linecap:butt}.bo{stroke:#94a3b8;stroke-width:.25;stroke-dasharray:1 1}
    .fl1{fill:url(#st);stroke:#334155;stroke-width:.3}.fl2{fill:url(#st2);stroke:#334155;stroke-width:.3}.fl3{fill:#64748b;stroke:#334155;stroke-width:.2}
    .etf{fill:#fff;fill-opacity:.85;stroke:#2563eb;stroke-width:.25}.lo{fill:#1e293b;stroke:#111;stroke-width:.15}
    .rah{fill:none;stroke:#111;stroke-width:.5}.tb{font:2.8px Carlito,Arial,sans-serif;fill:#111}.tbb{font:bold 4.6px Carlito,Arial,sans-serif;fill:#173765}
  </style>
  <rect x="8" y="8" width="281" height="194" class="rah"/>
  ${vorne(32, 40)}
  ${seite(138, 112)}
  ${perspektive(206, 118)}
  <!-- Schriftfeld -->
  <g transform="translate(8 152)">
    ${linie(0, 0, 281, 0, 'rah')}${linie(150, 0, 150, 50, 'rah')}${linie(215, 0, 215, 50, 'rah')}
    ${text(4, 8, 'Schild als Ständer (Tischaufsteller) – nach SCH-001 Rev. C', 'class="tbb"')}
    ${text(4, 14, 'Köcheclub Werne · Etikett 80 × 80 mm (wasserfest) wird auf die Schildfläche geklebt', 'class="tb"')}
    ${text(4, 21, 'Werkstoff: Edelstahl 1.4301 (V2A), Blech 1,5 mm (wie SCH-001)  ·  aus einem Zuschnitt, eine Biegung', 'class="tb"')}
    ${text(4, 26, 'Schildfläche 90 × 100 mm, oben Ecken R8 (wie SCH-001)  ·  Bodenplatte 90 × 60 mm*, hinten Ecken R8  ·  Neigung 15° nach hinten*', 'class="tb"')}
    ${text(4, 31, 'Rundloch Ø 8 mittig, Mitte 8 mm unter Oberkante (bleibt)  ·  2 Langlöcher 16 × 4 entfallen', 'class="tb"')}
    ${text(4, 36, 'Biegung innen R ≈ 2*  ·  Kanten entgratet  ·  ISO 2768-m  ·  Abwicklung ca. 90 × 158 mm – genaue Länge legt der Fertiger fest', 'class="tb"')}
    ${text(4, 43, '* Annahme – bitte vor der Fertigung bestätigen oder ändern', 'class="tb" style="font-weight:bold;fill:#b91c1c"')}
    ${text(154, 8, 'Maßstab', 'class="tb"')}${text(154, 15, '1 : 2 (Ansichten)', 'class="tbb" style="font-size:4px"')}
    ${text(154, 25, 'Maße in mm', 'class="tb"')}${text(154, 33, 'Standsicherheit: Schwerpunkt', 'class="tb"')}${text(154, 37.5, 'ca. 19 mm hinter der Biegung,', 'class="tb"')}${text(154, 42, 'Bodenplatte 60 mm → steht sicher', 'class="tb"')}
    ${text(219, 8, '14.10.2026  ·  SCH-002 Rev. A', 'class="tb"')}${text(219, 15, 'KC-SCHILD-STAENDER', 'class="tbb" style="font-size:3.8px"')}
    ${text(219, 25, 'Blatt 1 / 1  ·  A4 quer', 'class="tb"')}${text(219, 33, 'Optional: 4 selbstklebende', 'class="tb"')}${text(219, 37.5, 'Gummifüße unter der Bodenplatte', 'class="tb"')}
  </g>
</svg>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:0}html,body{margin:0;width:297mm;height:210mm;overflow:hidden}svg{display:block}</style></head><body>${svg}</body></html>`;
if (require.main === module) (async () => {
  const b = await pw.chromium.launch();
  try {
    const p = await (await b.newContext({deviceScaleFactor: 2})).newPage();
    await p.setContent(html); await p.waitForTimeout(200);
    await p.pdf({path: path.join(ZIEL, 'Staender_Schild_Zeichnung.pdf'), width: '297mm', height: '210mm', printBackground: true});
    await p.setViewportSize({width: 1123, height: 794}); await p.screenshot({path: path.join(ZIEL, 'Staender_Schild_Zeichnung.png')});
    console.log('fertig: ' + path.join(ZIEL, 'Staender_Schild_Zeichnung.pdf'));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
