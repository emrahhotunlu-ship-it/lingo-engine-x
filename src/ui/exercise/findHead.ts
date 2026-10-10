import type { ResultVerdict } from '../../domain/explain/types';
import { translate, type Lang } from '../../i18n';

// Kopf der Rückmeldung bei „Fehler finden“ (LP2 `find` und c1x `err`), Emrahs Rückmeldung 7 (10.10.2026): Oben steht eindeutig,
// ob die Stelle richtig erkannt wurde, und welches Wort getippt wurde (Kap. 2 Nr. 4, Frage 3 „Was hatte ich?“). Rein, ohne React.

export type FindFacts = {
  verdict: ResultVerdict;
  /** Die Fehlerstelle im Satz (Wortlaut), `null` = der Satz ist fehlerfrei. */
  errWord: string | null;
  /** Getipptes Wort; 'none' = „Kein Fehler“ gewählt; `null` = nichts getippt (z. B. sofort „Weiß ich nicht“). */
  tapped: string | null;
  /** Das getippte Wort liegt in der Fehlerstelle. */
  found: boolean;
  /** Die eingesetzte Korrektur (wenn eine abgegeben wurde); bei gefundener Stelle und nicht richtigem Urteil im Untertitel genannt. */
  fix?: string;
};

export type FindHead = {
  /** Überschrift statt des Urteilsworts; `null` = das Urteilswort bleibt („Kein Problem – so geht es“ ohne eigenen Versuch). */
  title: string | null;
  sub: string | null;
};

/** `noneLabel`: Beschriftung des Knopfs „Kein Fehler“ der jeweiligen Übung (Standard `exNoError`). */
export function findHead(f: FindFacts, lang: Lang, noneLabel: string = translate(lang, 'exNoError')): FindHead {
  const fixed = f.found && f.verdict !== 'ok' && !!f.fix && !!f.tapped && f.tapped !== 'none';
  const yours = fixed ? translate(lang, 'exFindYouFixed', { word: f.tapped ?? '', fix: f.fix ?? '' }) : f.tapped === 'none' ? translate(lang, 'exFindYouNone', { label: noneLabel }) : f.tapped ? translate(lang, 'exFindYouTapped', { word: f.tapped }) : null;
  const where = f.errWord ? translate(lang, 'exFindErrIn', { word: f.errWord }) : translate(lang, 'exFindNoErr');
  let title: string | null = null;
  if (f.verdict === 'ok') title = translate(lang, 'exFindSpotted');
  else if (f.verdict === 'near') title = translate(lang, 'exFindSpotFixNear');
  else if (f.verdict === 'wrong') title = translate(lang, f.found ? 'exFindSpotFixWrong' : 'exFindNotQuite');
  else if (f.verdict === 'dontKnow' && f.found) title = translate(lang, 'exFindSpotOnly');
  // Stelle gefunden (oder richtig erkannt): die Korrektur steht direkt darunter, hier nur das getippte Wort.
  // Sonst: was getippt wurde und wo der Fehler wirklich steckt (bzw. dass der Satz fehlerfrei ist).
  const short = f.found || (f.verdict === 'ok' && !!f.errWord);
  const sub = short ? yours : [yours, where].filter((x): x is string => !!x).join(' ');
  return { title, sub: sub || null };
}
