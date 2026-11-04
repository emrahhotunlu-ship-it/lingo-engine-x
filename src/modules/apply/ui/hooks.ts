import { useEffect, useMemo, useState } from 'react';
import { getDb, loadRecentArticle, readDoc, topicById, useComboPairs, useLive, useT, useTodayPlan, type RecentArticle } from '../sharedUi';
import { inboxMails, logWarn, patternById, readCtx2 } from '../shared';
import type { InboxMail, MailSituation } from '../shared';
import type { WriteKind } from '../domain/count';
import { incomingText, pickMail, pickWriteSituation } from '../domain/material';

// Material und Zielwörter der Disziplinen (F3). Auswahl fest je Lerntag (Kap. 15), Artikel nur auf Öffnen gelesen (je ein `get`).

export type Material =
  | { kind: 'reply'; id: string; mail: InboxMail; incoming: string; ctx: string; plain: string }
  | { kind: 'write'; id: string; situation: MailSituation; ctx: string; plain: string }
  | { kind: 'summary'; id: string; article: RecentArticle; ctx: string; plain: string };

export type MaterialState = { state: 'loading' | 'ready' | 'none'; m: Material | null };

type Doc = Record<string, unknown>;

async function readOne(path: string): Promise<Doc | undefined> {
  const db = getDb();
  if (!db) throw new Error('no_db');
  const r = await readDoc(db, path);
  return r.status === 'missing' ? undefined : r.doc;
}

export function useMaterial(kind: WriteKind, day: string): MaterialState {
  const profile = useLive((s) => s.docs['app/profile']);
  const chapter = useTodayPlan((s) => (s.plan && s.plan.d === day ? (s.plan.u?.gt?.ch ?? null) : null));
  const sit = readCtx2(profile)?.sit;
  const sync = useMemo((): MaterialState | null => {
    if (kind === 'reply') {
      const mail = pickMail(inboxMails(), day);
      return mail ? { state: 'ready', m: { kind, id: mail.id, mail, incoming: incomingText(mail), ctx: mail.subject, plain: `${mail.subject}\n${mail.body}` } } : { state: 'none', m: null };
    }
    if (kind === 'write') {
      const situation = pickWriteSituation(day, chapter, sit ?? []);
      return situation ? { state: 'ready', m: { kind, id: situation.id, situation, ctx: situation.sit, plain: `${situation.brief.en}\n${situation.phrases.join('\n')}` } } : { state: 'none', m: null };
    }
    return null;
  }, [kind, day, chapter, sit]);
  const [article, setArticle] = useState<MaterialState>({ state: 'loading', m: null });
  useEffect(() => {
    if (kind !== 'summary') return;
    let alive = true;
    loadRecentArticle(readOne, day)
      .then((a) => {
        if (alive) setArticle(a ? { state: 'ready', m: { kind: 'summary', id: a.id, article: a, ctx: a.title, plain: `${a.title}\n${a.text}` } } : { state: 'none', m: null });
      })
      .catch((err: unknown) => {
        logWarn('apply:article', err, day);
        if (alive) setArticle({ state: 'none', m: null });
      });
    return () => {
      alive = false;
    };
  }, [kind, day]);
  return sync ?? article;
}

export type Rule = { label: string; text: string; prompt: string; patId: string | null };
export type Targets = { words: string[]; rule: Rule | null };

/**
 * Zwei Zielwörter aus dem eigenen Wortschatz und eine Regel (Nachtrag learning-scientist „Sollte“: kombinierte Aufgabe). Wörter und Regel wie beim eigenen Satz
 * (`useComboPairs`: schwache und heute geübte Wörter zuerst, Thema des Tages zuerst); beim Schreiben ist die Regel das erste Muster der Situation (Claude prüft es dort).
 */
export function useTargets(m: Material | null): Targets {
  const { lang } = useT();
  const pairs = useComboPairs();
  return useMemo(() => {
    const words: string[] = [];
    for (const p of pairs) {
      if (words.length >= 2) break;
      if (!words.some((w) => w.toLowerCase() === p.word.toLowerCase())) words.push(p.word);
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
    return { words, rule };
  }, [pairs, m, lang]);
}
