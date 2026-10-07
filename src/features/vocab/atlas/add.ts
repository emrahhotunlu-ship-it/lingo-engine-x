import { getWriter } from '../../../data';
import { mayCreateDoc } from '../../../domain/capacity/docGuard';
import { atlasDoc, atlasOp, type AtlasEntry } from '../../../domain/atlas/atlas';
import { askJson } from '../../../ai/gate';
import { selectAiAvailable } from '../../../ai/scope';
import { bracketExample } from '../../../domain/srs/newCard';
import { useCapabilities } from '../../../platform/capabilities';
import { logError, logWarn } from '../../../platform/diagnostics';
import { cardExamples } from '../../../prompts/cardExamples';

/**
 * Ein Business-Satz in US-Englisch für den Atlas-Eintrag (Lernplattform 2.0 §4.8): „Lernen“ holt zuerst einen Satz aus der Berufswelt von
 * Claude (`card-examples@3`, einmal, nie automatisch wiederholt). Ohne Claude oder bei einem Fehler gilt der alte Satz des Atlas,
 * gekennzeichnet über `exMark: 'atlas'` (die Karte sagt dann „Beispielsatz aus dem Wörterbuch“).
 */
async function businessSentence(e: AtlasEntry): Promise<string | null> {
  if (!selectAiAvailable(useCapabilities.getState())) return null;
  try {
    const r = await askJson({ template: cardExamples, vars: { word: e.w, pos: e.p ?? '', meaning: e.d, sentence: e.x }, signal: new AbortController().signal });
    for (const x of r.data.examples) {
      if (bracketExample(x, null, e.w)) return x;
    }
  } catch (err) {
    logWarn('atlas:sentence', err, e.w);
  }
  return null;
}

/** Atlas-Eintrag als Karte anlegen (nur wenn es sie noch nicht gibt; nie ersetzen). `true`, wenn geschrieben wurde. */
export async function addAtlasCard(e: AtlasEntry, today: string, nowMs: number): Promise<boolean> {
  const writer = getWriter();
  const biz = await businessSentence(e);
  const base = atlasDoc(biz ? { ...e, x: biz } : e, today, nowMs);
  // Ohne Business-Satz bleibt der alte Satz des Atlas und die Karte bekommt die Kennzeichnung.
  const made = base && !biz ? { ...base, doc: { ...base.doc, exMark: 'atlas' } } : base;
  if (!writer || !made) return false;
  try {
    let wrote = false;
    await writer.transform(`vocab/${made.id}`, (cur) => {
      // Datenbank fast voll (Gesamtzahl): keine neue Karte, laut gemeldet (Prüfbefund S8).
      if (!cur && !mayCreateDoc(`vocab/${made.id}`)) return null;
      const op = atlasOp(cur, made);
      wrote = op !== null;
      return op;
    });
    return wrote;
  } catch (err) {
    logError('atlas:add', err, e.w);
    return false;
  }
}
