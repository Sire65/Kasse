/* SmartLayoutCore V0.2.0 – center-based geometry, safe area and collision inspection */
(function (w) {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function normalize(p, margin = 2) { p.w = clamp(+p.w || 20, 4, 100 - margin * 2); p.h = clamp(+p.h || 10, 4, 100 - margin * 2); const hw = p.w / 2, hh = p.h / 2; p.x = clamp(+p.x || 50, margin + hw, 100 - margin - hw); p.y = clamp(+p.y || 50, margin + hh, 100 - margin - hh); return p; }
  function snap(p, tolerance = 1.2) { for (const value of [5, 25, 50, 75, 95]) { if (Math.abs(p.x - value) <= tolerance) p.x = value; if (Math.abs(p.y - value) <= tolerance) p.y = value; } return normalize(p); }
  function overlapArea(a, b) { const left = Math.max(a.x - a.w / 2, b.x - b.w / 2), right = Math.min(a.x + a.w / 2, b.x + b.w / 2), top = Math.max(a.y - a.h / 2, b.y - b.h / 2), bottom = Math.min(a.y + a.h / 2, b.y + b.h / 2); return Math.max(0, right - left) * Math.max(0, bottom - top); }
  function overlaps(a, b, threshold = .18) { const area = overlapArea(a, b); return area > Math.min(a.w * a.h, b.w * b.h) * threshold; }
  function inspect(layout) { const keys = Object.keys(layout || {}), issues = []; for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = layout[keys[i]], b = layout[keys[j]]; if (a && b && overlaps(a, b)) issues.push([keys[i], keys[j]]); } return issues; }
  w.KCSmartLayoutCore = { version: '0.2.0', normalize, snap, overlaps, inspect };
})(window);
