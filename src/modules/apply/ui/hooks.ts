import { useEffect, useMemo, useState } from 'react';
import { getDb, loadRecentArticle, outPath, readDoc, topicById, useComboPairs, useLive, useT, useTodayPlan, type RecentArticle } from '../sharedUi';
import { articleStock, inboxMails, logWarn, patternById, readCtx2 } from '../shared';
import type { InboxMail, MailSituation, TargetWord } from '../shared';
import type { WriteKind } from '../domain/count';
import { historyDays, lastShown, pickFresh } from '../domain/fresh';
import { mailGreet, situationGreet, type Greet } from '../domain/greet';
import { incomingText, mailOrder, situationOrder, stockOrder } from '../domain/material';

// Material und Zielwörter der Disziplinen (F3). Auswahl fest je Lerntag (Kap. 15) in einer festen Reihenfolge; davon das erste, das seit 14 Tagen nicht dran
// war (W5 K14, über die gespeicherten Ergebnisse `out/<Monat>`: je Monat ein `get`, nichts abonniert, nichts geschrieben). Artikel: der Tagesartikel (je ein
// `get`), sonst ein Text aus dem geprüften Vorrat (W5 K8, mit festen Kernpunkten). Anrede und Gruß je Empfänger (W5 K7).

export type Material =
  | { kind: 'reply'; id: string; mail: InboxMail; incoming: string; ctx: string; plain: string; greet: Greet }
  | { kind: 'write'; id: string; situation: MailSituation; ctx: string; plain: string; greet: Greet }
  | { kind: 'summary'; id: string; article: RecentArticle; ctx: string; plain: string; keyPoints: string[] | null; stock: boolean };

export type MaterialState = { state: 'loading' | 'ready' | 'none'; m: Material | null };

type Doc = Record<string, unknown>;

async function readOne(path: string): Promise<Doc | undefined> {
  const db = getDb();
  if (!db) throw new Error('no_db');
  const r = await readDoc(db, path);
  return r.status === 'missing' ? undefined : r.doc;
}

/** Zuletzt geprüfte Materialien dieser Disziplin (vor heute) aus den Monatsdokumenten der letzten 14 Tage; ein Lesefehler lässt nur diesen Monat weg. */
async function readHistory(kind: WriteKind, day: string): Promise<Map<string, string>> {
  const db = getDb();
  if (!db) return new Map();
  const paths = [...new Set(historyDays(day).map((d) => outPath(d)))];
  const docs = await Promise.all(
    paths.map(async (p) => {
      try {
        const r = await readDoc(db, p);
        return r.status === 'valid' ? r.doc : null;
      } catch (err) {
        logWarn('apply:history', err, p);
        return null;
      }
    }),
  );
  return lastShown(docs, kind, day);
}

const replyMaterial = (mail: InboxMail): Material => ({ kind: 'reply', id: mail.id, mail, incoming: incomingText(mail), ctx: mail.subject, plain: `${mail.subject}\n${mail.body}`, greet: mailGreet(mail) });
const writeMaterial = (situation: MailSituation): Material => ({
  kind: 'write',
  id: situation.id,
  situation,
  ctx: situation.sit,
  plain: `${situation.brief.en}\n${situation.phrases.join('\n')}`,
  greet: situationGreet(situation.id),
});
type SumCand = { id: string; article: RecentArticle; keyPoints: string[] | null; stock: boolean };
const summaryMaterial = (c: SumCand): Material => ({ kind: 'summary', id: c.id, article: c.article, ctx: c.article.title, plain: `${c.article.title}\n${c.article.text}`, keyPoints: c.keyPoints, stock: c.stock });

async function recentArticle(day: string): Promise<RecentArticle | null> {
  try {
    return await loadRecentArticle(readOne, day);
  } catch (err) {
    logWarn('apply:article', err, day);
    return null;
  }
}

async function pick(kind: WriteKind, day: string, chapter: number | null, sit: readonly string[]): Promise<Material | null> {
  const last = await readHistory(kind, day);
  if (kind === 'reply') {
    const mail = pickFresh(mailOrder(inboxMails(), day), (x) => x.id, last, day);
    return mail ? replyMaterial(mail) : null;
  }
  if (kind === 'write') {
    const situation = pickFresh(situationOrder(day, chapter, sit), (x) => x.id, last, day);
    return situation ? writeMaterial(situation) : null;
  }
  const recent = await recentArticle(day);
  const cands: SumCand[] = [
    ...(recent ? [{ id: recent.id, article: recent, keyPoints: null, stock: false }] : []),
    ...stockOrder(articleStock(), day).map((a) => ({ id: a.id, article: { id: a.id, day, title: a.title, text: a.text }, keyPoints: [...a.points], stock: true })),
  ];
  const c = pickFresh(cands, (x) => x.id, last, day);
  return c ? summaryMaterial(c) : null;
}

export function useMaterial(kind: WriteKind, day: string): MaterialState {
  const profile = useLive((s) => s.docs['app/profile']);
  const chapter = useTodayPlan((s) => (s.plan && s.plan.d === day ? (s.plan.u?.gt?.ch ?? null) : null));
  const sit = readCtx2(profile)?.sit;
  const sitKey = (sit ?? []).join('|');
  const [state, setState] = useState<MaterialState>({ state: 'loading', m: null });
  useEffect(() => {
    let alive = true;
    pick(kind, day, chapter, sitKey ? sitKey.split('|') : [])
      .then((m) => {
        if (alive) setState(m ? { state: 'ready', m } : { state: 'none', m: null });
      })
      .catch((err: unknown) => {
        logWarn('apply:material', err, kind);
        if (alive) setState({ state: 'none', m: null });
      });
    return () => {
      alive = false;
    };
  }, [kind, day, chapter, sitKey]);
  return state;
}

export type Rule = { label: string; text: string; prompt: string; patId: string | null };
/**
 * `keys`: Wort (klein) → Pfad der Wortkarte, für den Beleg an die Wörter-App (F2). `prompt` (Mail-Vorlagen @3, Großpaket P, P4): dieselben Wörter mit
 * Kennung (`w1`, `w2`) und gelernter Bedeutung aus der Wortkarte, damit Claude die Verwendung in DIESER Bedeutung beurteilt.
 */
export type Targets = { words: string[]; keys: Record<string, string>; rule: Rule | null; prompt: TargetWord[] };

/**
 * Zwei Zielwörter aus dem eigenen Wortschatz und eine Regel (Nachtrag learning-scientist „Sollte“: kombinierte Aufgabe). Wörter und Regel wie beim eigenen Satz
 * (`useComboPairs`: schwache und heute geübte Wörter zuerst, Thema des Tages zuerst); beim Schreiben ist die Regel das erste Muster der Situation (Claude prüft es dort).
 */
export function useTargets(m: Material | null): Targets {
  const { lang } = useT();
  const pairs = useComboPairs();
  const vocab = useLive((s) => s.collections.vocab);
  return useMemo(() => {
    const words: string[] = [];
    const keys: Record<string, string> = {};
    for (const p of pairs) {
      if (words.length >= 2) break;
      if (!words.some((w) => w.toLowerCase() === p.word.toLowerCase())) {
        words.push(p.word);
        if (p.key) keys[p.word.toLowerCase()] = p.key;
      }
    }
    let rule: Rule | null = null;
    if (m?.kind === 'write') {
      const pat = m.situation.patterns[0] ? patternById(m.situation.patterns[0].id) : null;
      if (pat) rule = { label: pat.name[lang], text: pat.form[lang], prompt: `${pat.name.en}: ${pat.form.en}`, patId: pat.id };
    } else {
      const topic = pairs[0] ? topicById(pairs[0].topicId) : undefined;
      if (topic?.rule) {
        // Die Kurzregel liegt in den Inhalten auch auf Englisch (`rule_en`), im Typ `Topic` aber nicht genannt: tolerant lesen.
        const ruleEn: unknown = (topic as Readonly<Record<string, unknown>>).rule_en;
        const en = typeof ruleEn === 'string' && ruleEn.trim() ? ruleEn : topic.rule;
        const name = topic.name_en ?? topic.name;
        rule = { label: lang === 'en' ? name : topic.name, text: lang === 'en' ? en : topic.rule, prompt: `${name}: ${en}`, patId: null };
      }
    }
    const prompt = words.map((word, k): TargetWord => {
      const key = keys[word.toLowerCase()];
      const de: unknown = key?.startsWith('vocab/') ? vocab?.get(key.slice('vocab/'.length))?.de : undefined;
      return { id: `w${k + 1}`, word, de: typeof de === 'string' ? de.trim() : '' };
    });
    return { words, keys, rule, prompt };
  }, [pairs, m, lang, vocab]);
}
