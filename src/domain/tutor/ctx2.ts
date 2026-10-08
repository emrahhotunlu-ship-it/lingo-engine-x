import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { logWarn } from '../../platform/diagnostics';
import { clip } from '../../prompts/common';
import { jsonEqual } from '../equal';

// Berufsprofil „Mein Arbeitsalltag“ (Lernplattform 3.0 P46, KI-Tutor T4): `app/profile.ctx2` = `{v: 1, role, field, who[≤6], sit[≤6], terms[≤12], t}`
// (≤ 1 KB). `app/profile.ctx` (der Freitext der alten App) bleibt UNVERÄNDERT; das Profil wird daraus nur vorbelegt. Gelesen wird es von
// `tutorCtx()` (eine Zeile ≤ 300 Zeichen für die Vorlagen). Geschrieben wird ergänzend über `writer.transform`, nur bei Änderung, nie in ein ungültiges Dokument.

export type Ctx2 = { v: 1; role: string; field: string; who: string[]; sit: string[]; terms: string[]; t: number };

export const CTX2_LIMITS = { role: 60, field: 60, who: 6, whoLen: 30, sit: 6, sitLen: 40, terms: 12, termsLen: 24 } as const;

/** Auswahlfelder (gespeichert wird der englische Wert, denn er geht in die Vorlagen; die Oberfläche zeigt Deutsch oder Englisch). */
export const WHO_CHIPS = ['CFO', 'IT lead', 'procurement', 'partner', 'own team', 'investor'] as const;
export const SIT_CHIPS = ['negotiation', 'objection', 'status update', 'client email', 'presentation', 'small talk', 'escalation'] as const;

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const one = (v: unknown, max: number): string => (typeof v === 'string' ? clip(v, max) : '');
const many = (v: unknown, n: number, max: number): string[] => {
  const out: string[] = [];
  if (!Array.isArray(v)) return out;
  for (const x of v) {
    const s = one(x, max);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= n) break;
  }
  return out;
};

/** Profil aus Eingaben bereinigen (Längen, Doppelte, Leeres). */
export function cleanCtx2(i: { role?: unknown; field?: unknown; who?: unknown; sit?: unknown; terms?: unknown }, t: number): Ctx2 {
  return {
    v: 1,
    role: one(i.role, CTX2_LIMITS.role),
    field: one(i.field, CTX2_LIMITS.field),
    who: many(i.who, CTX2_LIMITS.who, CTX2_LIMITS.whoLen),
    sit: many(i.sit, CTX2_LIMITS.sit, CTX2_LIMITS.sitLen),
    terms: many(i.terms, CTX2_LIMITS.terms, CTX2_LIMITS.termsLen),
    t,
  };
}

/** Gespeichertes Profil (tolerant); `null`, wenn keines da ist. */
export function readCtx2(profile: Doc | null | undefined): Ctx2 | null {
  const raw = obj(profile).ctx2;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Doc;
  const c = cleanCtx2(o, typeof o.t === 'number' ? o.t : 0);
  return c.role || c.field || c.who.length || c.sit.length || c.terms.length ? c : null;
}

/**
 * Vorbelegung aus dem Freitext `ctx`: „Sales manager at a mid-sized software company …“ → Rolle „Sales manager“, Branche „a mid-sized software company …“.
 * Ohne Trennwort (at/in/for) steht der Text (gekürzt) als Rolle. Nur zum Vorbelegen der Felder, nie gespeichert.
 */
export function prefillFromCtx(freeText: unknown): { role: string; field: string } {
  const s = typeof freeText === 'string' ? freeText.replace(/\s+/g, ' ').trim() : '';
  if (!s) return { role: '', field: '' };
  const m = /^(.{3,}?)\s+(?:at|in|for|of)\s+(.{3,})$/i.exec(s);
  if (!m) return { role: clip(s, CTX2_LIMITS.role), field: '' };
  return { role: clip(m[1] ?? '', CTX2_LIMITS.role), field: clip(m[2] ?? '', CTX2_LIMITS.field) };
}

/** Das Profil, mit dem das Formular beginnt: gespeichert, sonst aus `ctx` vorbelegt. */
export function startCtx2(profile: Doc | null | undefined, t: number): Ctx2 {
  const stored = readCtx2(profile);
  if (stored) return stored;
  const pre = prefillFromCtx(obj(profile).ctx);
  return cleanCtx2({ ...pre, who: [], sit: [], terms: [] }, t);
}

/** Gleicher Inhalt (ohne den Zeitstempel)? */
export const sameCtx2 = (a: Ctx2, b: Ctx2): boolean => jsonEqual({ ...a, t: 0 }, { ...b, t: 0 });

export type SaveCtx2Result = 'saved' | 'unchanged' | 'unavailable' | 'blocked' | 'failed';

/** Profil in `app/profile.ctx2` speichern (nur dieses Feld; `ctx` bleibt). Nie geworfen. */
export async function saveCtx2(next: Ctx2): Promise<SaveCtx2Result> {
  const writer = getWriter();
  if (!writer) return 'unavailable';
  let result: SaveCtx2Result = 'unchanged';
  try {
    await writer.transform('app/profile', (cur) => {
      if (!cur) {
        result = 'blocked';
        return null;
      }
      if (!validateDoc('app/profile', cur).ok) {
        logWarn('tutor:ctx2', { code: 'invalid_document', message: 'Profil ungültig – Arbeitsalltag nicht gespeichert' }, 'app/profile');
        result = 'blocked';
        return null;
      }
      // Unbekannte Unterfelder (z. B. einer neueren App-Version) bleiben erhalten: nur die bekannten Felder werden überschrieben.
      const raw: Doc = cur.ctx2 && typeof cur.ctx2 === 'object' && !Array.isArray(cur.ctx2) ? (cur.ctx2 as Doc) : {};
      const merged = { ...raw, ...next };
      if (jsonEqual({ ...merged, t: 0 }, { ...raw, t: 0 })) return null;
      result = 'saved';
      return { update: { ctx2: merged } };
    });
    return result;
  } catch (err) {
    logWarn('tutor:ctx2', err, 'app/profile');
    return 'failed';
  }
}
