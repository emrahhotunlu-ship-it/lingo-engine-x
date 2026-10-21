import { useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import type { TrainCard } from '../../domain/srs/types';
import { useT } from '../../i18n';
import { logError } from '../../platform/diagnostics';
import { mnemonic } from '../../prompts/mnemonic';
import { Button } from '../../ui/Button';
import { dayKey } from '../../domain/date';
import { readWk, struggling } from '../../domain/srs/werkstatt';

// Merkhilfe für hartnäckige Wörter (Funktionsabgleich M3): Knopf nur bei Karten, die haken (Auslöser der Wort-Werkstatt, Wort-Lernen 2:
// 3 freie Fehlversuche oder Fehler an 2 Lerntagen in 14 Tagen) oder schon einmal in der Werkstatt waren. Von Claude erzeugt und an der Karte
// gespeichert (`mnemo {text, lang, t}`, nur ergänzt bzw. in der anderen Sprache ersetzt). Eine eigene Merkhilfe (`own: 1`) überschreibt Claude nie.

type Doc = Record<string, unknown>;

export function storedMnemo(doc: Readonly<Doc>, lang: 'de' | 'en'): string | null {
  const m = doc.mnemo;
  if (!m || typeof m !== 'object') return null;
  const r = m as Doc;
  return r.lang === lang && typeof r.text === 'string' && r.text.trim() ? r.text.trim() : null;
}

/** Pure: Patch für `vocab/<id>` – nur, wenn die Karte existiert, nicht ausgeblendet ist und noch keine Merkhilfe in dieser Sprache hat. */
export function mnemoPatch(cur: Readonly<Doc> | undefined, path: string, m: { text: string; lang: 'de' | 'en'; t: number }): { update: Doc } | null {
  if (!cur || cur.hidden === true || !validateDoc(path, cur).ok) return null;
  if (storedMnemo(cur, m.lang) || isOwnMnemo(cur)) return null;
  return { update: { mnemo: { text: m.text, lang: m.lang, t: m.t } } };
}

/** Hat Emrah die Merkhilfe selbst geschrieben oder ausgewählt (`mnemo.own = 1`)? */
export const isOwnMnemo = (doc: Readonly<Doc>): boolean => !!doc.mnemo && typeof doc.mnemo === 'object' && (doc.mnemo as Doc).own === 1;

/**
 * Pure: Merkhilfe aus der Werkstatt (selbst geschrieben oder aus Claudes Vorschlägen gewählt) – ersetzt eine vorhandene, `own: 1`.
 * Nur bei Änderung, nie in ein ungültiges oder ausgeblendetes Dokument, höchstens 240 Zeichen.
 */
export function ownMnemoPatch(cur: Readonly<Doc> | undefined, path: string, m: { text: string; lang: 'de' | 'en'; t: number }): { update: Doc } | null {
  const text = m.text.trim().slice(0, MNEMO_MAX);
  if (!text || !cur || cur.hidden === true || !validateDoc(path, cur).ok) return null;
  if (isOwnMnemo(cur) && storedMnemo(cur, m.lang) === text) return null;
  return { update: { mnemo: { text, lang: m.lang, t: m.t, own: 1 } } };
}
export const MNEMO_MAX = 240;

export const isLeech = (doc: Readonly<Doc>, day: string = dayKey(Date.now())): boolean => readWk(doc) !== null || struggling(doc, day);

export function MnemonicBlock({ card, always = false }: { card: TrainCard; always?: boolean }) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(mnemonic);
  const [saved, setSaved] = useState<string | null>(null);
  const stored = storedMnemo(card.doc, lang);
  const text = saved ?? stored;
  if (!text && !isLeech(card.doc) && !always) return null;
  if (text)
    return (
      <div className="flex flex-col gap-1 rounded-xl bg-surface p-3" data-testid="mnemo">
        <p className="lx-eyebrow">{t('vcMnemo')}</p>
        <p className="text-sm" lang={lang}>
          {text}
        </p>
      </div>
    );
  if (!ai) return null;
  const run = async () => {
    const out = await ask.run({ word: card.word, meaning: (lang === 'de' ? card.de : card.def) ?? card.de ?? '', sentence: card.context?.sentence ?? '', uiLang: lang });
    if (!out) return;
    setSaved(out.text);
    const writer = getWriter();
    if (!writer || !card.inDb) return;
    try {
      await writer.transform(card.path, (cur) => mnemoPatch(cur, card.path, { text: out.text, lang, t: Date.now() }));
    } catch (err) {
      logError('vocab:mnemo', err, card.path);
    }
  };
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'streaming' || ask.phase === 'slow';
  return (
    <div className="flex flex-col gap-1">
      <div>
        <Button variant="ghost" icon="sparkle" onClick={() => (busy ? ask.stop() : void run())} data-testid="mnemo-ask" data-ai="">
          {busy ? t('aiStop') : t('vcMnemoAsk')}
        </Button>
      </div>
      {busy && (
        <p className="text-sm text-muted" role="status">
          {t('aiThinking')}
        </p>
      )}
      {ask.error && (
        <p className="text-sm text-danger-text" role="alert">
          {t(ask.error)}
        </p>
      )}
    </div>
  );
}
