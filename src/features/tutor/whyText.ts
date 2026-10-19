import { patternById } from '../../domain/grammar/patterns';
import type { ProgressProof } from '../../domain/tutor/learner';
import type { WhyFact } from '../../domain/tutor/policy';
import { translate, type Lang } from '../../i18n';
import { topicName } from '../grammar/topicUi';

// Texte zu „Warum diese Aufgabe?“ und zum Fortschrittsbeleg (Tutor-Engine v3 S2). Jede Zahl stammt aus `whyOf` bzw. `progressProof`.

/** Anzeigename eines Musters oder Gebrauchsmusters (`use:depend+on` → „depend on“); sonst die Kennung. */
export function refName(ref: string, lang: Lang): string {
  if (ref.startsWith('use:')) return ref.slice(4).replace('+', ' ');
  const p = patternById(ref);
  return p ? (lang === 'de' ? p.name.de : p.name.en) : ref;
}

const nameOf = (f: Pick<WhyFact, 'pat' | 'topic'>, lang: Lang): string => (f.pat && patternById(f.pat) ? refName(f.pat, lang) : topicName(f.topic, lang));

/** Ein Satz zum Grund der Aufgabe. */
export function whyText(f: WhyFact, lang: Lang): string {
  const name = nameOf(f, lang);
  switch (f.code) {
    case 'due':
      return f.days === undefined ? translate(lang, 'ttWhy_dueBare') : f.days === 0 ? translate(lang, 'ttWhy_due0') : f.days === 1 ? translate(lang, 'ttWhy_due1') : translate(lang, 'ttWhy_due', { days: f.days });
    case 'hyp':
      return f.vs && f.n !== undefined ? translate(lang, 'ttWhy_hyp', { name, n: f.n, vs: refName(f.vs, lang) }) : translate(lang, 'ttWhy_mix', { name });
    case 'weak':
      if (f.n !== undefined && f.ok !== undefined) return translate(lang, 'ttWhy_weakQ', { name, ok: f.ok, n: f.n });
      if (f.days === 0) return translate(lang, 'ttWhy_weakD0', { name });
      if (f.days === 1) return translate(lang, 'ttWhy_weakD1', { name });
      return f.days !== undefined ? translate(lang, 'ttWhy_weakD', { name, days: f.days }) : translate(lang, 'ttWhy_mix', { name });
    case 'chapter':
      return translate(lang, 'ttWhy_chapter', { name });
    case 'known':
      return translate(lang, 'ttWhy_known');
    case 'freer':
      return translate(lang, 'ttWhy_freer');
    case 'supported':
      return translate(lang, 'ttWhy_supported');
    default:
      return translate(lang, 'ttWhy_mix', { name });
  }
}

/** Fortschrittsbeleg in Worten („vor 3 Wochen 4 von 9, jetzt 8 von 9“). */
export const proofText = (pat: string, p: ProgressProof, lang: Lang): string =>
  translate(lang, 'ttProof', { name: refName(pat, lang), weeks: p.weeks, thenOk: p.thenOk, thenN: p.thenN, nowOk: p.nowOk, nowN: p.nowN });
