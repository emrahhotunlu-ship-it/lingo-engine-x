import { addLocalDays, learningDayEnd } from '../date';
import { logWarn } from '../../platform/diagnostics';
import { hash32 } from '../random';

// Reparatur-Sätze (Lernberatung 27.09., V2 „Nochmal, aber besser"): Emrahs eigene falsche oder
// schwache Sätze aus freiem Formulieren (Sag es, Gespräch, Schreiben, Preply) mit der besseren
// Fassung. Wiederholt in den Boxen 1/3/9 Tage wie die Fehler-Wiederholung der alten App:
// „Damals hast du gesagt: … – sag es jetzt besser." Ein Dokument `app/repair`, höchstens
// REPAIR_MAX Einträge (Kapazität, A6.6). Rein und getestet.

type Doc = Record<string, unknown>;

export const REPAIR_DAYS = [1, 3, 9] as const;
export const REPAIR_MAX = 150;
export const REPAIR_TEXT_MAX = 300;
export const REPAIR_WHY_MAX = 200;

/** `fluency` = Flüssigkeit 90 – 60 – 45 (V6), `pattern` = Deutsch-Fallen (V3), `tone` = drei Tonlagen (Vorschlag 8), `check` = C1-Check (LP3 P40), `clinic` = Satz-Klinik (LP3 P46). */
export type RepairSrc = 'say' | 'talk' | 'write' | 'preply' | 'teacher' | 'lesson' | 'fluency' | 'pattern' | 'tone' | 'check' | 'clinic';

export type RepairItem = {
  id: string;
  /** Emrahs eigener Satz (falsch oder zu schwach). */
  wrong: string;
  /** Bessere Fassung (US-Englisch). */
  right: string;
  /** Kurzer Grund in der Oberflächensprache. */
  why?: string;
  src: RepairSrc;
  /** Situation/Thema, aus der der Satz stammt. */
  ctx?: string;
  t: number;
  /** 0 = neu; nach richtigem Abruf +1, ab Box 3 erledigt. */
  box: number;
  due: number;
  done?: boolean;
  /** Zeitpunkt der zuletzt angewendeten Wiederholung (Doppelanwendung verhindern). */
  last?: number;
  /** Die korrigierten Stellen (Teilstücke von `right`), für die lokale Prüfung. */
  fix?: string[];
  /** Muster (Kennung aus der Grammatik, LP3 P46/P47), falls Claude eines genannt hat und es existiert. */
  pat?: string;
};

export type NewRepair = { wrong: string; right: string; why?: string | null; src: RepairSrc; ctx?: string | null; fix?: readonly string[] | null; pat?: string | null };

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

/** Korrigierte Stellen: nur nicht leere Stücke, die in `right` vorkommen (höchstens 6). */
function fixOf(fix: readonly string[] | null | undefined, right: string): string[] | null {
  if (!fix?.length) return null;
  const r = repairNorm(right);
  const out = [...new Set(fix.map((f) => clip(f.trim(), 80)).filter((f) => f && r.includes(repairNorm(f))))].slice(0, 6);
  return out.length ? out : null;
}

/** Vergleichsform: klein, ohne Satzzeichen und doppelte Leerzeichen. */
export function repairNorm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const repairId = (wrong: string): string => `r${hash32(repairNorm(wrong)).toString(36)}`;

/** Liste tolerant lesen: nur Einträge mit wrong und right. */
export function readRepairs(doc: Readonly<Doc> | undefined): RepairItem[] {
  const list = doc?.items;
  if (!Array.isArray(list)) return [];
  const out: RepairItem[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const e = raw as Doc;
    const wrong = str(e.wrong).trim();
    const right = str(e.right).trim();
    if (!wrong || !right) continue;
    const t = num(e.t) ?? 0;
    const src = str(e.src) as RepairSrc;
    out.push({
      ...(e as Partial<RepairItem>),
      id: str(e.id) || repairId(wrong),
      wrong,
      right,
      src: src || 'say',
      t,
      box: num(e.box) ?? 0,
      due: num(e.due) ?? addLocalDays(t, 1),
    });
  }
  return out;
}

/** Obergrenze der Dokumentgröße (A6.6: 256 KiB je Dokument, mit Reserve). */
export const REPAIR_MAX_BYTES = 200 * 1024;
const enc = new TextEncoder();
const bytesOf = (v: unknown): number => enc.encode(JSON.stringify(v)).length;

/**
 * Auf `max` Einträge und `REPAIR_MAX_BYTES` kürzen: nur erledigte Einträge (die ältesten zuerst) werden verdrängt. Offene werden nie
 * gelöscht; sind alle offen, bleibt die Liste länger (die Zahl ist nur Richtwert, hart ist die Dokumentgröße, siehe `addRepairs`).
 */
export function capRepairs(list: readonly RepairItem[], max = REPAIR_MAX, maxBytes = REPAIR_MAX_BYTES): RepairItem[] {
  const out = [...list];
  while (out.length > 1 && (out.length > max || bytesOf({ items: out }) > maxBytes)) {
    const doneIdx = out.findIndex((e) => e.done === true);
    if (doneIdx < 0) break;
    out.splice(doneIdx, 1);
  }
  return out;
}

/**
 * Neue Reparatur-Sätze anhängen. Gleiche falsche Sätze (normalisiert) werden nicht doppelt
 * angelegt; ein schon erledigter kommt wieder in Box 0 (der Fehler ist wieder aufgetreten).
 * Leere, identische (falsch = richtig) oder überlange Einträge fallen weg. `null` = nichts zu tun.
 */
export function addRepairs(list: readonly RepairItem[], add: readonly NewRepair[], nowMs: number): RepairItem[] | null {
  const out = [...list];
  let changed = false;
  for (const a of add) {
    const wrong = clip(a.wrong.trim(), REPAIR_TEXT_MAX);
    const right = clip(a.right.trim(), REPAIR_TEXT_MAX);
    if (!wrong || !right || repairNorm(wrong) === repairNorm(right)) continue;
    const id = repairId(wrong);
    const fix = fixOf(a.fix, right);
    const i = out.findIndex((e) => e.id === id);
    const fresh: RepairItem = {
      id,
      wrong,
      right,
      ...(a.why?.trim() ? { why: clip(a.why.trim(), REPAIR_WHY_MAX) } : {}),
      src: a.src,
      ...(a.ctx?.trim() ? { ctx: clip(a.ctx.trim(), 120) } : {}),
      ...(fix ? { fix } : {}),
      ...(a.pat?.trim() ? { pat: clip(a.pat.trim(), 40) } : {}),
      t: nowMs,
      box: 0,
      due: addLocalDays(nowMs, 1),
    };
    if (i < 0) {
      out.push(fresh);
      changed = true;
    } else if (out[i]!.done) {
      out[i] = { ...out[i]!, ...fresh, done: false };
      changed = true;
    }
  }
  if (!changed) return null;
  const capped = capRepairs(out);
  // Hart ist nur die Dokumentgröße (256 KiB, A6.6): Passt der Zuwachs nicht mehr, wird nichts Offenes gelöscht und nichts geschrieben – laut gemeldet.
  if (bytesOf({ items: capped }) > REPAIR_MAX_BYTES) {
    logWarn('repair:cap', { code: 'overflow', message: `app/repair voll (${capped.length} offene Sätze), neuer Satz nicht gespeichert` });
    return null;
  }
  return capped;
}

/** Fällige, nicht erledigte Einträge, älteste Fälligkeit zuerst. Fällig = vor dem Ende des Lerntags (04:00 Uhr), wie bei den Fehlersätzen der Grammatik. */
export function dueRepairs(list: readonly RepairItem[], nowMs: number): RepairItem[] {
  const end = learningDayEnd(nowMs);
  return list.filter((e) => !e.done && e.due < end).sort((a, b) => a.due - b.due);
}

/**
 * Wiederholung eintragen. Richtig: Box +1 (Abstand 1/3/9 Tage), ab Box 3 erledigt. Falsch:
 * Box 0, morgen wieder. „Fast richtig“ (`near`): Box unverändert, morgen wieder. `null`, wenn der Eintrag fehlt oder diese Antwort schon angewendet ist.
 */
export function reviewRepair(list: readonly RepairItem[], id: string, ok: boolean, nowMs: number, near = false): RepairItem[] | null {
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return null;
  const e = list[i]!;
  if ((e.last ?? 0) >= nowMs) return null;
  if (near) return list.map((x, k) => (k === i ? { ...e, last: nowMs, done: false, due: addLocalDays(nowMs, 1) } : x));
  const box = ok ? e.box + 1 : 0;
  const done = box >= REPAIR_DAYS.length;
  const next: RepairItem = { ...e, box, last: nowMs, done, due: addLocalDays(nowMs, REPAIR_DAYS[Math.min(box, REPAIR_DAYS.length - 1)] ?? 1) };
  const out = [...list];
  out[i] = next;
  return out;
}
