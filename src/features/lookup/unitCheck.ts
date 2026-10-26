import { askJson } from '../../ai/gate';
import { selectAiAvailable } from '../../ai/scope';
import { takeTutorCall } from '../../ai/tutorBudget';
import { AiFailure } from '../../ai/types';
import { dictLookup } from '../../domain/lexicon/dict';
import { isWeakWord } from '../../domain/lexicon/unit';
import { cardUnitVerdict, isReadGroup, type CardUnitMark } from '../../domain/lexicon/unitHeld';
import { atlasInfo } from '../../domain/lexicon/unitKnown';
import { lemmaCandidates } from '../../domain/text/lemma';
import { normalizeWord } from '../../domain/text/tokenize';
import { useCapabilities } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { lexicalUnitCheck } from '../../prompts/lexicalUnitCheck';

// Sperre „nur feste Einheiten als Wendungs-Karte“ (Kartenqualität 26.10.2026, docs/umbau/card-quality.md) – vor dem Speichern einer
// Wortgruppe aus einem Artikel oder dem Leser (`src:'read'`):
//  1. Reine Prüfung `lexicalUnit`: belegt bzw. klar gebaut → speichern. Klar frei („adaptive attempts“) oder Adjektiv + Nomen ohne Beleg → 2.
//  2. Claude fragen (`lexical-unit-check@1`, quick; nie bei Gruppen der Lehrer-Sperrliste), nur wenn die KI bereitsteht und die Tutor-Tagesbremse Platz hat; die erste Nutzung fragt
//     über die Plattform nach Zustimmung (der Knopf „Als Karte“ ist die ausdrückliche Handlung). Kein Neuversuch aus dem Code.
//  3. Ohne Claude entscheidet die Regel: „prüfen“ → nicht als Wendung speichern; Adjektiv + Nomen → speichern.
// Nicht gespeicherte Gruppen bekommen höchstens das tragende Einzelwort als Ausweg (mit Bedeutung aus Wörterbuch oder Atlas).

export type SingleOption = { word: string; de: string; pos: string | null; surface: string };
export type UnitDecision =
  | { kind: 'ok'; lu?: CardUnitMark }
  | { kind: 'not_unit'; by: 'rule' | 'claude'; better?: string; why?: string; single: SingleOption | null };

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Tragendes Einzelwort der Gruppe, das selbst im Satz steht und eine Bedeutung hat (seltenstes zuerst); sonst `null`. */
export function singleWordOf(phrase: string, sentence: string): SingleOption | null {
  const tokens = normalizeWord(phrase)
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z]+|[^a-z]+$/g, ''))
    .filter((w) => w && !isWeakWord(w));
  const ranked = tokens.map((w) => ({ w, r: atlasInfo(w)?.r ?? Number.MAX_SAFE_INTEGER })).sort((a, b) => b.r - a.r);
  for (const { w } of ranked) {
    const m = new RegExp(`(^|[^A-Za-z'-])(${escape(w)})(?=$|[^A-Za-z'-])`, 'i').exec(sentence);
    if (!m?.[2]) continue;
    for (const cand of lemmaCandidates(w)) {
      const e = dictLookup(cand);
      const sense = e?.senses[0];
      if (e && sense?.de) return { word: e.word, de: sense.de, pos: sense.pos || null, surface: m[2] };
    }
    const a = atlasInfo(w);
    if (a?.de) return { word: a.w, de: a.de, pos: a.pos[0] === 'adj' ? 'adj' : (a.pos[0] ?? null), surface: m[2] };
  }
  return null;
}

/** Urteil vor dem Speichern. `uiLang`: Sprache von Claudes Begründung. */
export async function checkCardUnit(i: { word: string; sentence: string; uiLang: 'de' | 'en'; signal?: AbortSignal; src?: string }): Promise<UnitDecision> {
  if (!isReadGroup(i.src ?? 'read', i.word)) return { kind: 'ok' };
  const v = cardUnitVerdict(i.word);
  const unsure = v.verdict === 'check' || v.reason === 'adj_noun';
  if (!unsure) return { kind: 'ok' };
  const byRule = (): UnitDecision =>
    v.verdict === 'check' ? { kind: 'not_unit', by: 'rule', ...(v.better ? { better: v.better } : {}), single: singleWordOf(i.word, i.sentence) } : { kind: 'ok' };

  // Lehrer-Sperrliste (`units.json` → `free`): das Urteil steht fest, kein Claude-Aufruf (spart Budget, Claude überstimmt den Lehrer nicht).
  if (v.detail === 'teacher list') return byRule();
  if (!selectAiAvailable(useCapabilities.getState()) || !takeTutorCall()) return byRule();
  try {
    const r = await askJson({ template: lexicalUnitCheck, vars: { phrase: i.word.trim(), sentence: i.sentence, uiLang: i.uiLang }, signal: i.signal ?? new AbortController().signal });
    const t = Date.now();
    if (r.data.isUnit) return { kind: 'ok', lu: { ok: true, by: 'claude', t } };
    const better = r.data.better ?? v.better;
    return { kind: 'not_unit', by: 'claude', ...(better ? { better } : {}), why: r.data.why, single: singleWordOf(i.word, i.sentence) };
  } catch (err) {
    if (!(err instanceof AiFailure && err.kind === 'cancelled')) logWarn('lookup:unit-check', err instanceof AiFailure ? { code: err.code, message: err.kind } : err, i.word);
    return byRule();
  }
}
