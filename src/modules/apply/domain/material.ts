import { clip, hash32, INCOMING_MAX, pickSituation } from '../shared';
import type { InboxMail, MailSituation, OutItem } from '../shared';

// Material je Disziplin (F3). Rein: Auswahl fest je Lerntag (Kap. 15: nichts würfelt sich neu), Texte für die Vorlagen, festgelegte Kernpunkte.

type Doc = Readonly<Record<string, unknown>>;

/** Eingegangene Mail des Tages (fest je Lerntag und Schlüssel). `null` ohne Mails. */
export function pickMail(mails: readonly InboxMail[], day: string, shift = 0): InboxMail | null {
  if (!mails.length) return null;
  const base = hash32(`reply|${day}`) % mails.length;
  return mails[(base + shift + mails.length * 4) % mails.length] ?? null;
}

/** Die eingegangene Mail als ein Block für `apply-reply@1` (Absender, Rolle, Betreff, Text), höchstens 1.600 Zeichen. */
export function incomingText(m: InboxMail): string {
  const s = `From: ${m.from} (${m.role})\nSubject: ${m.subject}\n\n${m.body.trim()}`;
  const chars = Array.from(s);
  return chars.length <= INCOMING_MAX ? s : `${chars.slice(0, INCOMING_MAX - 1).join('').trimEnd()}…`;
}

/** Vorname des Absenders (für den Gruß-Hinweis am Handy). */
export const firstName = (m: InboxMail): string => m.from.trim().split(/\s+/)[0] ?? '';

/** Mail-Situation zum Schreiben: fest je Lerntag (der Tag ist der Streuwert), bevorzugt eine passende Situationsart aus „Mein Arbeitsalltag“. */
export function pickWriteSituation(day: string, chapter: number | null, sit: readonly string[], shift = 0): MailSituation | null {
  return pickSituation({ chapter, sit, week: `day|${day}`, shift });
}

// ---------------------------------------------------------------- Kernpunkte eines Artikels (einmal festgelegt, `out/<Monat>`, Art `sumkp`)

export const KEYPOINTS_PREFIX = 'sumkp-';
export const keypointsId = (articleId: string): string => `${KEYPOINTS_PREFIX}${clip(articleId, 80)}`;

const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.length >= 3 && v.length <= 4 && v.every((x) => typeof x === 'string' && x.trim().length > 0);

/** Festgelegte Kernpunkte zu einem Artikel aus den Monatsdokumenten `out/<Monat>` (das erste gültige gewinnt), sonst `null`. */
export function findKeypoints(outDocs: ReadonlyArray<Doc | null | undefined>, articleId: string): string[] | null {
  const id = keypointsId(articleId);
  for (const d of outDocs) {
    const items = d && Array.isArray(d.items) ? (d.items as unknown[]) : [];
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      const o = it as Doc;
      if (o.id !== id || o.k !== 'sumkp') continue;
      const fb = o.fb && typeof o.fb === 'object' ? (o.fb as Doc) : null;
      if (fb && isStrList(fb.pts)) return fb.pts.map((p) => p.trim());
    }
  }
  return null;
}

/** Eintrag der festgelegten Kernpunkte (idempotent über die Kennung je Artikel: wird nie ein zweites Mal angelegt). */
export function keypointsItem(articleId: string, title: string, points: readonly string[], day: string, now: number): OutItem {
  return { id: keypointsId(articleId), k: 'sumkp', d: day, t: now, theme: clip(title, 120), fb: { pts: [...points] } };
}
