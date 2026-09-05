(function (global) {
  'use strict';

  const VERSION = '0.1.0';
  const SCHEMA = 'KC_TIME_CLOCK_V1';
  const EVENT_KINDS = new Set(['in', 'out']);
  const iso = value => {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) throw new Error('Ungültiger Zeitpunkt.');
    return date.toISOString();
  };
  const text = (value, max = 120) => String(value ?? '').trim().slice(0, max);
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const clone = value => JSON.parse(JSON.stringify(value));
  const isActiveAt = (person, at = Date.now()) => {
    const stamp = new Date(at).getTime();
    if (person.active === false) return false;
    if (person.validFrom && stamp < new Date(person.validFrom).getTime()) return false;
    if (person.validUntil && stamp > new Date(person.validUntil).getTime()) return false;
    return true;
  };

  function normalizePerson(input = {}) {
    const type = input.type === 'helper' ? 'helper' : 'member';
    const id = text(input.id || uid(type === 'helper' ? 'HILFE' : 'MITGLIED'), 64);
    if (!id) throw new Error('Personen-ID fehlt.');
    const credential = text(input.credential || input.qrToken || uid('TC'), 128);
    return {
      id,
      type,
      displayName: text(input.displayName || input.name || id, 100),
      personnelNumber: text(input.personnelNumber, 40),
      birthCode: text(input.birthCode, 6).replace(/\D/g, ''),
      credential,
      active: input.active !== false,
      hourlyPaid: type === 'helper' ? input.hourlyPaid !== false : Boolean(input.hourlyPaid),
      hourlyRate: input.hourlyRate !== null && input.hourlyRate !== '' && Number.isFinite(Number(input.hourlyRate)) ? Math.max(0, Number(input.hourlyRate)) : null,
      validFrom: input.validFrom ? iso(input.validFrom) : null,
      validUntil: input.validUntil ? iso(input.validUntil) : null,
      role: text(input.role || (type === 'helper' ? 'Aushilfe' : 'Mitglied'), 60),
      createdAt: input.createdAt ? iso(input.createdAt) : iso(),
      updatedAt: iso()
    };
  }

  function identify(people, credential, at = Date.now()) {
    const needle = text(credential, 128);
    if (!needle) return { ok: false, code: 'EMPTY_CREDENTIAL', message: 'Bitte Code scannen oder eingeben.' };
    const normalizedDigits = needle.replace(/\D/g, '');
    const person = (people || []).find(item =>
      item.credential === needle ||
      (normalizedDigits.length === 6 && item.birthCode === normalizedDigits) ||
      item.id === needle
    );
    if (!person) return { ok: false, code: 'UNKNOWN_PERSON', message: 'Code ist nicht bekannt.' };
    if (!isActiveAt(person, at)) return { ok: false, code: 'CREDENTIAL_EXPIRED', message: 'Dieser Zugang ist nicht mehr gültig.' };
    return { ok: true, person: clone(person) };
  }

  function currentState(events, personId) {
    const list = (events || [])
      .filter(event => event.personId === personId && !event.voidedAt)
      .sort((a, b) => new Date(a.effectiveAt) - new Date(b.effectiveAt));
    const last = list.at(-1);
    return { present: last?.kind === 'in', last: last ? clone(last) : null, nextKind: last?.kind === 'in' ? 'out' : 'in' };
  }

  function createEvent(input, existing = []) {
    const kind = text(input.kind, 12);
    if (!EVENT_KINDS.has(kind)) throw new Error('Nur Kommen oder Gehen ist zulässig.');
    const personId = text(input.personId, 64);
    if (!personId) throw new Error('Personen-ID fehlt.');
    const state = currentState(existing, personId);
    if (state.nextKind !== kind) {
      throw new Error(kind === 'in' ? 'Person ist bereits angemeldet.' : 'Person ist nicht angemeldet.');
    }
    const recordedAt = iso(input.recordedAt);
    const effectiveAt = iso(input.effectiveAt || recordedAt);
    const differenceMinutes = Math.abs(new Date(recordedAt) - new Date(effectiveAt)) / 60000;
    const correctionReason = text(input.correctionReason, 240);
    if (differenceMinutes > 5 && !correctionReason) throw new Error('Bei abweichender Uhrzeit ist ein Korrekturgrund erforderlich.');
    return {
      id: text(input.id || uid('ZEIT'), 80),
      schema: SCHEMA,
      personId,
      personType: input.personType === 'helper' ? 'helper' : 'member',
      kind,
      recordedAt,
      effectiveAt,
      registerId: text(input.registerId || 'KASSE-UNBEKANNT', 64),
      eventId: text(input.eventId || 'VERANSTALTUNG', 64),
      source: ['qr', 'birth', 'id', 'manager'].includes(input.source) ? input.source : 'id',
      correctionReason,
      // Zwei verschiedene Dinge, deshalb zwei Felder:
      // correctionReason erklaert, warum die gebuchte Zeit vom Scanzeitpunkt abweicht
      //   (z.B. auf die halbe Stunde gerundet) - technische Begruendung.
      // shiftReason erklaert, warum die SCHICHT anders lief als geplant
      //   (krank geworden, frueher entlassen, laenger geblieben) - fachliche Begruendung,
      //   die in den Istplan gehoert. Beides in einem Feld waere spaeter nicht mehr trennbar.
      shiftReason: text(input.shiftReason, 120),
      createdBy: text(input.createdBy || 'local-pos', 80),
      voidedAt: null
    };
  }

  function mergeEvents(current = [], incoming = []) {
    const map = new Map(current.map(event => [event.id, clone(event)]));
    let added = 0;
    for (const event of incoming) {
      if (!event?.id || !EVENT_KINDS.has(event.kind) || !event.personId) continue;
      if (!map.has(event.id)) {
        map.set(event.id, clone(event));
        added += 1;
      }
    }
    return { events: [...map.values()].sort((a, b) => new Date(a.effectiveAt) - new Date(b.effectiveAt)), added };
  }

  function summarize(events = [], people = []) {
    const persons = new Map((people || []).map(person => [person.id, person]));
    const grouped = new Map();
    for (const event of [...events].filter(e => !e.voidedAt).sort((a, b) => new Date(a.effectiveAt) - new Date(b.effectiveAt))) {
      if (!grouped.has(event.personId)) grouped.set(event.personId, []);
      grouped.get(event.personId).push(event);
    }
    return [...grouped].map(([personId, list]) => {
      let open = null, milliseconds = 0;
      for (const event of list) {
        if (event.kind === 'in') open = event;
        else if (open) {
          milliseconds += Math.max(0, new Date(event.effectiveAt) - new Date(open.effectiveAt));
          open = null;
        }
      }
      const person = persons.get(personId);
      return {
        personId,
        displayName: person?.displayName || personId,
        personType: person?.type || list[0]?.personType || 'member',
        hourlyPaid: Boolean(person?.hourlyPaid),
        hourlyRate: person?.hourlyRate ?? null,
        milliseconds,
        hours: Math.round(milliseconds / 36000) / 100,
        present: Boolean(open),
        openSince: open?.effectiveAt || null
      };
    });
  }

  function makeConfigPackage(config, people) {
    return {
      schema: 'KC_TIME_CLOCK_CONFIG_V1',
      version: VERSION,
      packageId: uid('TC-CONFIG'),
      createdAt: iso(),
      config: {
        enabled: Boolean(config?.enabled),
        eventId: text(config?.eventId || 'WM-2026', 64),
        allowBirthCode: config?.allowBirthCode !== false,
        allowManualTime: config?.allowManualTime !== false
      },
      people: (people || []).map(normalizePerson)
    };
  }

  function makeEventDelta(events, registerId) {
    return {
      schema: 'KC_TIME_CLOCK_EVENT_DELTA_V1',
      version: VERSION,
      packageId: uid('TC-DELTA'),
      createdAt: iso(),
      registerId: text(registerId || 'KASSE-UNBEKANNT', 64),
      events: clone(events || [])
    };
  }

  global.KCTimeClockCore = Object.freeze({
    version: VERSION, schema: SCHEMA, normalizePerson, identify, isActiveAt,
    currentState, createEvent, mergeEvents, summarize, makeConfigPackage, makeEventDelta
  });
})(window);
