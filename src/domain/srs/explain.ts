import { meaningOf } from './cards';
import type { CheckResult, Exercise, Lang, Option, WhyPart } from './types';

// „Warum ist das so?" – immer, auch bei richtiger Antwort (Kap. 2.4). Bausteine als
// i18n-Schlüssel mit Werten; Inhalte (Wort, Bedeutung) werden unverändert eingesetzt.
// Höchstens drei Zeilen, mindestens eine (Lern-Entwurf §4.3).

const POS_KEYS = new Set(['noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'phrase', 'phrasal']);

export function posKey(pos: string | null): string | null {
  if (!pos) return null;
  const p = pos.toLowerCase();
  const k = p.startsWith('adj') ? 'adj' : p.startsWith('adv') ? 'adv' : p;
  return POS_KEYS.has(k) ? `pos_${k}` : null;
}

export function explain(e: Exercise, lang: Lang, result: CheckResult, chosen: Option | null): WhyPart[] {
  const card = e.card;
  const out: WhyPart[] = [];
  const meaning = meaningOf(card, lang);

  if (result.verdict === 'wrong') {
    if (chosen && !chosen.correct && e.ex === 'colloc' && e.colloc) {
      out.push({ key: 'whyCollocWrong', vars: { chosen: chosen.label, p: e.colloc.p } });
    } else if (chosen && !chosen.correct && chosen.fromWord) {
      if (e.ex === 'mc_de') out.push({ key: 'whyWordIs', vars: { word: chosen.fromWord, meaning: chosen.fromMeaning ?? '' } });
      else out.push({ key: 'whyChoiceBelongs', vars: { chosen: chosen.label, word: chosen.fromWord } });
    } else if (result.kind === 'confusable' && result.otherWord) {
      out.push({ key: 'whyOtherWord', vars: { given: result.otherWord, word: card.word } });
    }
  }
  if (result.verdict === 'near' && result.kind === 'typo') out.push({ key: 'whyTypo' });
  if (result.verdict === 'near' && result.kind === 'form') out.push({ key: 'whyForm', vars: { form: e.accepted[0] ?? '', lemma: card.lemma } });
  if (result.variant === 'uk' && result.us) out.push({ key: 'whyUk', vars: { us: result.us } });

  if (meaning && out.length < 3) out.push({ key: 'whyMeaning', vars: { word: card.word, meaning } });
  const pk = posKey(card.pos);
  if (pk && out.length < 3) out.push({ key: 'whyPos', vars: { pos: pk } });
  const col = card.col.find((c) => c.p && c !== e.colloc) ?? (e.ex === 'colloc' ? e.colloc : null);
  if (col?.p && out.length < 3) {
    if (lang === 'de' && col.de) out.push({ key: 'whyCollocDe', vars: { p: col.p, de: col.de } });
    else out.push({ key: 'whyColloc', vars: { p: col.p } });
  }
  if (!out.length) out.push({ key: 'whyWordOnly', vars: { word: card.word } });
  return out.slice(0, 3);
}
