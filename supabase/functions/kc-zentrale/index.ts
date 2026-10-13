async function sicherGleich(a:string,b:string){const h=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [x,y]=await Promise.all([h(a),h(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
// KC Zentrale - Vermittlungsstelle für die KC-Programme.
//
// WARUM ES DIESE STELLE GIBT:
// Zum Schreiben in die zentralen Tabellen braucht es den Dienstschlüssel. Der darf aber nicht
// auf einen Vereinsrechner und schon gar nicht in einen Browser - wer ihn hat, kann alles.
// Deshalb liegt er hier, wo nur Supabase selbst ihn kennt. Die Programme melden sich mit einem
// eigenen Zugangswort an, das jederzeit ausgetauscht werden kann, ohne den Dienstschlüssel
// anzufassen.
//
// ERLAUBT SIND NUR DIE VIER VORGÄNGE UNTEN. Das ist Absicht: eine offene Schnittstelle könnte
// alles verändern, diese kann genau das, was der Datenvertrag vorsieht.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ZUGANGSWORT = Deno.env.get("KC_ZENTRALE_ACCESS_WORD") || "";
const LEGACY_WORD=Deno.env.get("KC_ZENTRALE_ACCESS_WORD_LEGACY")||"";
const LEGACY_ENABLED=Deno.env.get("KC_ZENTRALE_LEGACY_ENABLED")==="true";
// KC-SEC-ZENTRALE-TRANSITION v2: nur vorbereiten; kein automatisches Abschalten.
async function credentialGeneration(given:string){if(!given||ZUGANGSWORT.length<32)return null;if(LEGACY_ENABLED&&LEGACY_WORD&&await sicherGleich(ZUGANGSWORT,LEGACY_WORD))return null;const [primary,legacy]=await Promise.all([sicherGleich(given,ZUGANGSWORT),LEGACY_WORD?sicherGleich(given,LEGACY_WORD):Promise.resolve(false)]);return primary?"new":LEGACY_ENABLED&&legacy?"legacy":null}
const URL_BASIS = Deno.env.get("SUPABASE_URL")!;
const DIENST = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const kopf = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-kc-zugang, x-kc-device-id, x-kc-device-name, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

async function db(pfad: string, optionen: RequestInit = {}) {
  const antwort = await fetch(`${URL_BASIS}/rest/v1/${pfad}`, {
    ...optionen,
    headers: {
      apikey: DIENST,
      Authorization: `Bearer ${DIENST}`,
      "Content-Type": "application/json",
      ...(optionen.headers as Record<string, string> ?? {}),
    },
  });
  const text = await antwort.text();
  if (!antwort.ok) throw new Error(`${antwort.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : [];
}

const geburtstagZuCode = (iso: string | null) => {
  if (!iso) return "";
  const [j, m, t] = String(iso).slice(0, 10).split("-");
  return `${t}${m}${j.slice(2)}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: kopf });
  if (req.method !== "POST") return new Response(JSON.stringify({ fehler: "nur POST" }), { status: 405, headers: kopf });

  // Zugangswort prüfen. Ohne gültiges Wort passiert gar nichts.
  const generation=await credentialGeneration(req.headers.get("x-kc-zugang")||"");
  if (!generation) {
    return new Response(JSON.stringify({ fehler: "kein_zugang" }), { status: 401, headers: kopf });
  }

  let anfrage: any;
  try { anfrage = await req.json(); } catch { return new Response(JSON.stringify({ fehler: "ungueltig" }), { status: 400, headers: kopf }); }
  const erlaubteOrgs=(Deno.env.get("KC_ZENTRALE_ALLOWED_ORGS")||"KC_WERNE").split(",").map(s=>s.trim()).filter(Boolean);
  const org = String(anfrage.orgId ?? erlaubteOrgs[0]);
  if(!erlaubteOrgs.includes(org))return new Response(JSON.stringify({fehler:"organisation_nicht_erlaubt"}),{status:400,headers:kopf});
  const orgFilter=encodeURIComponent(org);
  const deviceId=String(req.headers.get("x-kc-device-id")||"").slice(0,100);
  const expectedIds=(Deno.env.get("KC_ZENTRALE_EXPECTED_DEVICE_IDS")||"").split(",").map(s=>s.trim()).filter(Boolean);
  async function record(){const id=/^mgr_[a-f0-9]{32}$/.test(deviceId)?deviceId:generation==="legacy"?"__unidentified__":"";if(!id)return false;try{await db("kc_zentrale_credential_devices?on_conflict=org_id,device_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({org_id:org,device_id:id,device_name:decodeURIComponent(req.headers.get("x-kc-device-name")||deviceId).slice(0,100),generation,last_seen_at:new Date().toISOString()})});return true}catch{return false}}
  if(anfrage.vorgang==="migration_probe")return new Response(JSON.stringify({ok:true,generation,deviceId,trackingRequired:true}),{headers:kopf});
  if(anfrage.vorgang==="migration_ack"){if(generation!=="new")return new Response(JSON.stringify({ok:false,fehler:"neuer_zugang_erforderlich"}),{status:409,headers:kopf});const confirmed=await record();return new Response(JSON.stringify({ok:confirmed,generation,deviceId}),{status:confirmed?200:503,headers:kopf})}
  if(anfrage.vorgang==="migration_status"){try{const rows=await db(`kc_zentrale_credential_devices?org_id=eq.${orgFilter}&select=device_id,device_name,generation,last_seen_at`);const complete=expectedIds.length>0&&expectedIds.every(id=>rows.some((r:any)=>r.device_id===id&&r.generation==="new"&&!rows.some((u:any)=>u.device_id==="__unidentified__"&&Date.parse(u.last_seen_at)>=Date.parse(r.last_seen_at))));return new Response(JSON.stringify({ok:true,expectedIds,devices:rows,complete,legacyEnabled:LEGACY_ENABLED}),{headers:kopf})}catch{return new Response(JSON.stringify({ok:false,fehler:"umstellungsstand_unbekannt"}),{status:503,headers:kopf})}}
  await record();

  try {
    // 1) Zustand - für die Anzeige im Manager
    if (anfrage.vorgang === "zustand") {
      const personen = await db(`kc_core_personen?org_id=eq.${orgFilter}&select=person_id`);
      const zeiten = await db(`kc_attendance_events?org_id=eq.${orgFilter}&select=event_id`);
      return new Response(JSON.stringify({ ok: true, personen: personen.length, zeiten: zeiten.length }), { headers: kopf });
    }

    // 2) Personen lesen - gehören der Mitgliederverwaltung, hier NUR lesen
    if (anfrage.vorgang === "personen") {
      const zeilen = await db(`kc_core_personen?org_id=eq.${orgFilter}&order=mitgliedsnummer`);
      return new Response(JSON.stringify({
        ok: true,
        personen: zeilen.map((z: any) => ({
          personId: z.person_id, credential: z.mitgliedsnummer ?? "", displayName: z.name,
          pseudonym: z.pseudonym ?? "", birthCode: geburtstagZuCode(z.geburtstag),
          active: z.aktiv !== false, type: "member",
        })),
      }), { headers: kopf });
    }

    // 3) Arbeitszeiten melden - Rohbuchungen, Doppelte werden zusammengeführt
    if (anfrage.vorgang === "zeiten") {
      const personen = await db(`kc_core_personen?org_id=eq.${orgFilter}&select=person_id,mitgliedsnummer`);
      const nachNummer: Record<string, string> = {};
      personen.forEach((p: any) => { if (p.mitgliedsnummer) nachNummer[p.mitgliedsnummer] = p.person_id; });
      const zeilen: any[] = [];
      let uebersprungen = 0;
      for (const e of (anfrage.ereignisse ?? [])) {
        const personId = nachNummer[e.credential];
        if (!personId || !e.id) { uebersprungen++; continue; }
        zeilen.push({
          org_id: org, event_id: e.id, person_id: personId, member_number: e.credential ?? null,
          kind: e.kind === "in" ? "check_in" : "check_out",
          recorded_at: e.recordedAt ?? e.effectiveAt, effective_at: e.effectiveAt,
          register_id: e.registerId ?? null, event_name: e.eventId ?? null,
          source_system: "pos", source_device: e.registerId ?? null,
          correction_reason: e.correctionReason ?? null, shift_reason: e.shiftReason ?? null,
          voided_at: e.voidedAt ?? null,
        });
      }
      if (zeilen.length) {
        await db("kc_attendance_events?on_conflict=org_id,event_id", {
          method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(zeilen),
        });
      }
      return new Response(JSON.stringify({ ok: true, gemeldet: zeilen.length, uebersprungen }), { headers: kopf });
    }

    // 4) Pseudonyme schreiben - gehören dem Manager
    if (anfrage.vorgang === "pseudonyme") {
      const personen = await db(`kc_core_personen?org_id=eq.${orgFilter}&select=person_id,mitgliedsnummer`);
      const nachNummer: Record<string, string> = {};
      personen.forEach((p: any) => { if (p.mitgliedsnummer) nachNummer[p.mitgliedsnummer] = p.person_id; });
      const zeilen = Object.entries(anfrage.pseudonyme ?? {})
        .filter(([nummer, name]) => nachNummer[nummer] && name)
        .map(([nummer, name]) => ({ org_id: org, person_id: nachNummer[nummer], alias_name: String(name), active: true }));
      if (zeilen.length) {
        await db("kc_core_pos_aliases?on_conflict=org_id,person_id", {
          method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(zeilen),
        });
      }
      return new Response(JSON.stringify({ ok: true, geschrieben: zeilen.length }), { headers: kopf });
    }

    return new Response(JSON.stringify({ fehler: "unbekannter_vorgang" }), { status: 400, headers: kopf });
  } catch (fehler) {
    return new Response(JSON.stringify({ fehler: String((fehler as Error).message) }), { status: 502, headers: kopf });
  }
});

