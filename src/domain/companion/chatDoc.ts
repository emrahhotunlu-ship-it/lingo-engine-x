import { detectLang, stripQuoted } from '../lang/detect';

// `app/chat` (Phase 5 §5.2): ein Dokument mit höchstens 40 Nachrichten (Altgrenze) und
// höchstens 180 KB (Puffer zu 256 KiB, db.d.ts). Altnachrichten ohne `t`/`lang` bleiben lesbar.
// „Neues Gespräch" setzt nur `since`: ältere Nachrichten bleiben sichtbar, gehen aber nicht an Claude.

export const CHAT_MAX = 40;
export const CHAT_MAX_BYTES = 180_000;
export const USER_MAX = 2_000;
export const ASSISTANT_MAX = 8_000;

export type ChatRole = 'user' | 'assistant';
export type ChatMsg = { role: ChatRole; content: string; t?: number; lang?: string; ctx?: string; stopped?: boolean };

const encoder = new TextEncoder();
const bytesOf = (v: unknown): number => encoder.encode(JSON.stringify(v)).length;

function clipChars(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max - 1).join('').trimEnd() + '…';
}

function toMsg(v: unknown): ChatMsg | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if ((o.role !== 'user' && o.role !== 'assistant') || typeof o.content !== 'string' || !o.content.trim()) return null;
  const m: ChatMsg = { role: o.role, content: o.content };
  if (typeof o.t === 'number' && Number.isFinite(o.t)) m.t = o.t;
  if (typeof o.lang === 'string') m.lang = o.lang;
  if (typeof o.ctx === 'string') m.ctx = o.ctx;
  if (o.stopped === true) m.stopped = true;
  return m;
}

/**
 * Liest `app/chat` tolerant. `ok: false` heißt: Das Dokument ist da, hat aber einen
 * unerwarteten Aufbau – dann wird nie darauf geschrieben (§5.1, `saveState: 'invalid'`).
 */
export function readChat(doc: unknown): { msgs: ChatMsg[]; since: number; ok: boolean } {
  if (doc === undefined || doc === null) return { msgs: [], since: 0, ok: true };
  if (typeof doc !== 'object' || Array.isArray(doc)) return { msgs: [], since: 0, ok: false };
  const o = doc as Record<string, unknown>;
  if (o.msgs != null && !Array.isArray(o.msgs)) return { msgs: [], since: 0, ok: false };
  const msgs = (Array.isArray(o.msgs) ? o.msgs : []).map(toMsg).filter((m): m is ChatMsg => m !== null);
  const since = typeof o.since === 'number' && Number.isFinite(o.since) ? o.since : 0;
  return { msgs, since, ok: true };
}

/** Nachricht auf die Speichergrenze kürzen. */
export function clipMsg(m: ChatMsg): ChatMsg {
  return { ...m, content: clipChars(m.content, m.role === 'user' ? USER_MAX : ASSISTANT_MAX) };
}

/**
 * Neue Nachrichten anhängen: jede kürzen, dann die neuesten ≤ 40 behalten, dann so lange die
 * ältesten entfernen, bis das Dokument ≤ 180 KB ist. Doppelte (gleiches `t` und gleiche Rolle)
 * werden nicht zweimal angehängt – ein wiederholter Schreibvorgang wirkt wie einer.
 */
export function appendChat(cur: readonly ChatMsg[], add: readonly ChatMsg[]): ChatMsg[] {
  const seen = new Set(cur.filter((m) => m.t !== undefined).map((m) => `${m.role}|${m.t}`));
  const fresh = add.filter((m) => m.t === undefined || !seen.has(`${m.role}|${m.t}`)).map(clipMsg);
  let out = [...cur, ...fresh].slice(-CHAT_MAX);
  while (out.length > 1 && bytesOf({ msgs: out, since: 0 }) > CHAT_MAX_BYTES) out = out.slice(1);
  return out;
}

/** Nur die Nachrichten des laufenden Gesprächs (ab `since`); Altnachrichten ohne `t` gelten als früher. */
export function currentMsgs(msgs: readonly ChatMsg[], since: number): ChatMsg[] {
  if (!since) return [...msgs];
  return msgs.filter((m) => (m.t ?? 0) >= since);
}

/** Pause, nach der ein neues Thema beginnt (Emrahs Befund 27.09.: Claude antwortete auf die letzte Aufgabe). */
export const CHAT_GAP_MS = 60 * 60 * 1000;

/**
 * Was als Gesprächsverlauf an Claude geht: ab „Neues Gespräch" und nur der letzte zusammenhängende
 * Abschnitt – nach einer Pause von mehr als einer Stunde beginnt automatisch ein neues Thema.
 */
export function activeMsgs(msgs: readonly ChatMsg[], since: number, now: number): ChatMsg[] {
  const cur = currentMsgs(msgs, since);
  let start = cur.length;
  let prev = now;
  for (let i = cur.length - 1; i >= 0; i--) {
    const t = cur[i]?.t;
    if (t === undefined || prev - t > CHAT_GAP_MS) break;
    prev = t;
    start = i;
  }
  return cur.slice(start);
}

/** Text ohne Markdown-Hervorhebungen und Code – dort stehen meist englische Beispiele. */
function explanatoryText(content: string): string {
  return content
    .replace(/`[^`]*`/g, ' ')
    .replace(/\*\*[^*]+\*\*/g, ' ')
    .replace(/(^|\s)\*[^*\n]+\*/g, ' ')
    .replace(/^>.*$/gm, ' ');
}

/** Sprache einer Nachricht: gespeichertes `lang`, sonst Erkennung ohne Zitate und Hervorhebungen. */
export function msgLang(m: ChatMsg): 'de' | 'en' | 'unknown' {
  if (m.lang === 'de' || m.lang === 'en') return m.lang;
  return detectLang(stripQuoted(explanatoryText(m.content)));
}

/** Sprache einer fertigen Antwort (E5-04): eindeutig andere Sprache → diese, sonst die Oberflächensprache. */
export function replyLang(content: string, uiLang: 'de' | 'en'): 'de' | 'en' {
  const got = detectLang(stripQuoted(explanatoryText(content)));
  return got === 'unknown' ? uiLang : got;
}

/** Größe des Dokuments in Bytes (Diagnose-Zeile). */
export const chatBytes = (msgs: readonly ChatMsg[], since: number): number => bytesOf({ msgs, since });
