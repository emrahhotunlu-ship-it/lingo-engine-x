import { local } from '../../platform/storage';

// Qualitätszähler und Stichprobe der Claude-Inhalte (Lernplattform 3.0 P25, KT §3.1). Nur Browser (Bequemlichkeit, Kap. 3.1), keine Datenbank:
// - `lx:ai-q` = `{<vorlage>: {gen, acc, shown, flag}}`: erzeugt · formal bestanden · gezeigt · gemeldet.
// - `lx:ai-shown`: die letzten 30 gezeigten Inhalte (Aufgabe, Antwort, Erklärung, Meldung) für „KI-Stichprobe sichern“ (Datei über `downloads`).
// Echte Claude-Antworten lassen sich nur so prüfen: in der Cloud-Umgebung gibt es kein `sample`. Jeder Zugriff über `platform/storage`.

export type QualityKind = 'gen' | 'acc' | 'shown' | 'flag';
export type Quality = Record<QualityKind, number>;
export const QUALITY_KINDS: readonly QualityKind[] = ['gen', 'acc', 'shown', 'flag'];

const KEY_Q = 'lx:ai-q';
const KEY_SHOWN = 'lx:ai-shown';
/** So viele gezeigte Inhalte hält die Stichprobe. */
export const SHOWN_MAX = 30;
const FIELD_MAX = 600;

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const empty = (): Quality => ({ gen: 0, acc: 0, shown: 0, flag: 0 });

export function readQuality(): Record<string, Quality> {
  const raw = local.getJson<Record<string, Partial<Quality>>>(KEY_Q);
  const out: Record<string, Quality> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [tpl, q] of Object.entries(raw)) {
    if (!q || typeof q !== 'object') continue;
    out[tpl] = { gen: count(q.gen), acc: count(q.acc), shown: count(q.shown), flag: count(q.flag) };
  }
  return out;
}

/** Zählt eins hoch (`tpl` = `<vorlage>@<version>`). */
export function noteQuality(tpl: string, kind: QualityKind, n = 1): void {
  if (!tpl || n < 1) return;
  const all = readQuality();
  const q = all[tpl] ?? empty();
  q[kind] += Math.floor(n);
  all[tpl] = q;
  local.set(KEY_Q, JSON.stringify(all));
}

/** Summe über alle Vorlagen. */
export function totalQuality(all: Record<string, Quality> = readQuality()): Quality {
  const t = empty();
  for (const q of Object.values(all)) for (const k of QUALITY_KINDS) t[k] += q[k];
  return t;
}

export type ShownItem = {
  /** Eindeutig je Inhalt (z. B. Aufgaben-ID oder `Thema:Fehlerindex`). */
  id: string;
  /** `<vorlage>@<version>`. */
  tpl: string;
  t: number;
  /** Aufgabe bzw. Frage. */
  task?: string;
  /** Antwort des Lernenden. */
  given?: string;
  /** Erklärung oder Satz von Claude. */
  text?: string;
  /** Meldegrund, falls gemeldet. */
  flag?: string;
};

const clipField = (s: unknown): string | undefined => (typeof s === 'string' && s ? s.slice(0, FIELD_MAX) : undefined);

function readShown(): ShownItem[] {
  const raw = local.getJson<unknown>(KEY_SHOWN);
  if (!Array.isArray(raw)) return [];
  const out: ShownItem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.tpl !== 'string') continue;
    const item: ShownItem = { id: r.id, tpl: r.tpl, t: typeof r.t === 'number' ? r.t : 0 };
    for (const k of ['task', 'given', 'text', 'flag'] as const) {
      const v = clipField(r[k]);
      if (v) item[k] = v;
    }
    out.push(item);
  }
  return out.slice(-SHOWN_MAX);
}

/** Merkt einen gezeigten Inhalt (Ring der letzten 30; derselbe Inhalt ersetzt seinen früheren Eintrag). */
export function recordShown(item: ShownItem): void {
  const clean: ShownItem = { id: item.id, tpl: item.tpl, t: item.t };
  for (const k of ['task', 'given', 'text', 'flag'] as const) {
    const v = clipField(item[k]);
    if (v) clean[k] = v;
  }
  const rest = readShown().filter((x) => !(x.id === clean.id && x.tpl === clean.tpl));
  local.set(KEY_SHOWN, JSON.stringify([...rest, clean].slice(-SHOWN_MAX)));
}

/** Setzt den Meldegrund an einen schon gemerkten Inhalt. */
export function flagShown(id: string, tpl: string, reason: string, now: number = Date.now()): void {
  const list = readShown();
  const i = list.findIndex((x) => x.id === id && x.tpl === tpl);
  if (i >= 0) list[i] = { ...(list[i] as ShownItem), flag: reason.slice(0, 80) };
  else list.push({ id, tpl, t: now, flag: reason.slice(0, 80) });
  local.set(KEY_SHOWN, JSON.stringify(list.slice(-SHOWN_MAX)));
}

export const shownSample = (): ShownItem[] => readShown();

/** Inhalt der Datei „KI-Stichprobe“ (JSON). */
export function sampleFile(now: number = Date.now()): { name: string; data: string } {
  const body = { v: 1, at: new Date(now).toISOString(), quality: readQuality(), items: readShown() };
  return { name: `ki-stichprobe-${new Date(now).toISOString().slice(0, 10)}.json`, data: JSON.stringify(body, null, 2) };
}

/** Nur für Tests. */
export function resetQuality(): void {
  local.remove(KEY_Q);
  local.remove(KEY_SHOWN);
}
