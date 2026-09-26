import { chunkTokens } from '../chunks/newChunk';

// E-Mail-Refiner (Plan §5.5): Die Mail wird LOKAL in Satz-Bausteine zerlegt (Zeilen und Sätze
// bleiben erhalten), Claude bewertet jeden Baustein über seine Nummer. So ergibt das
// Zusammensetzen immer genau den Eingabetext – die Abdeckungsregel aus Plan §6.2 gilt damit
// schon per Aufbau. Danach: Auswahl je Baustein → fertige Mail, Zahl der Änderungen, Wörter.

export type MailSegment = { i: number; text: string; /** Trenner danach: '' | ' ' | '\n' | '\n\n' … */ sep: string };

export const MAIL_MAX = 2500;
export const SEGMENTS_MAX = 25;

// Getrennt wird nur, wo nach dem Satzzeichen Leerraum folgt (3.5, U.S. und 1,000 bleiben ganz).
const SENTENCE_RE = /[^.!?]*?[.!?]+["'’”)\]]*(?=\s|$)|[^.!?]+$/g;

export function segmentMail(text: string): MailSegment[] {
  const src = text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!src) return [];
  const out: MailSegment[] = [];
  const blocks = src.split(/(\n+)/);
  for (let b = 0; b < blocks.length; b += 2) {
    const line = (blocks[b] ?? '').trim();
    const brk = blocks[b + 1] ?? '';
    if (!line) continue;
    const parts = (line.match(SENTENCE_RE) ?? [line]).map((s) => s.trim()).filter(Boolean);
    parts.forEach((p, k) => out.push({ i: out.length, text: p, sep: k < parts.length - 1 ? ' ' : brk }));
  }
  // Zu viele Bausteine: die letzten zusammenfassen (Obergrenze der Vorlage).
  if (out.length > SEGMENTS_MAX) {
    const head = out.slice(0, SEGMENTS_MAX - 1);
    const tail = out.slice(SEGMENTS_MAX - 1);
    head.push({ i: SEGMENTS_MAX - 1, text: tail.map((s, k) => s.text + (k < tail.length - 1 ? s.sep : '')).join(''), sep: '' });
    return head;
  }
  if (out.length) (out[out.length - 1] as MailSegment).sep = '';
  return out;
}

/** Gewählte Fassung je Baustein: -1 = Original, sonst Index der Option. */
export type Picks = Readonly<Record<number, number>>;
export type SegmentOptions = ReadonlyArray<{ i: number; options: ReadonlyArray<{ text: string }> }>;

export function composeMail(segments: readonly MailSegment[], options: SegmentOptions, picks: Picks): string {
  const byI = new Map(options.map((o) => [o.i, o.options]));
  return segments
    .map((s) => {
      const k = picks[s.i] ?? -1;
      const opt = k >= 0 ? byI.get(s.i)?.[k] : undefined;
      return (opt ? opt.text.trim() : s.text) + s.sep;
    })
    .join('')
    .trim();
}

export const wordCount = (s: string): number => chunkTokens(s).length;

export function changesOf(picks: Picks): number {
  return Object.values(picks).filter((k) => k >= 0).length;
}

/** Liste `[baustein, option]` der gewählten Fassungen (für `biz/<Monat>`). */
export function pickList(picks: Picks): Array<[number, number]> {
  return Object.entries(picks)
    .map(([i, k]): [number, number] => [Number(i), k])
    .filter(([, k]) => k >= 0)
    .sort((a, b) => a[0] - b[0]);
}
