import { patternById } from '../../domain/grammar/patterns';
import type { ProgressProof } from '../../domain/tutor/learner';
import type { WhyExtra, WhyFact } from '../../domain/tutor/policy';
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

/** Der Grund (ein Satz): warum die Aufgabe wirklich in der Runde steht. */
function mainText(f: WhyFact, name: string, lang: Lang): string {
  switch (f.code) {
    case 'due':
      return f.days === undefined ? translate(lang, 'ttWhy_dueBare') : f.days === 0 ? translate(lang, 'ttWhy_due0') : f.days === 1 ? translate(lang, 'ttWhy_due1') : translate(lang, 'ttWhy_due', { days: f.days });
    case 'intro':
      return translate(lang, 'ttWhy_intro', { name });
    case 'chapter':
      return translate(lang, 'ttWhy_chapter', { name });
    case 'focus':
      return translate(lang, 'ttWhy_focus', { name });
    case 'need':
      return translate(lang, 'ttWhy_need', { name });
    case 'family':
      return translate(lang, 'ttWhy_family', { name });
    case 'chosen':
      return translate(lang, 'ttWhy_chosen', { name });
    case 'mix':
      return translate(lang, 'ttWhy_mix', { name });
    case 'known':
      return translate(lang, 'ttWhy_known');
    case 'freer':
      return translate(lang, 'ttWhy_freer');
    case 'supported':
      return translate(lang, 'ttWhy_supported');
    default:
      return translate(lang, 'ttWhy_plan', { name });
  }
}

/** Datenbeleg als Zusatz („Passt dazu: …“), nie als Grund formuliert. */
function extraText(x: WhyExtra, name: string, lang: Lang): string {
  if (x.k === 'hyp') return translate(lang, 'ttWhyPlus_hyp', { name, n: x.n, vs: refName(x.vs, lang) });
  if (x.k === 'weakQ') return translate(lang, 'ttWhyPlus_weakQ', { name, ok: x.ok, n: x.n });
  if (x.days === 0) return translate(lang, 'ttWhyPlus_weakD0', { name });
  if (x.days === 1) return translate(lang, 'ttWhyPlus_weakD1', { name });
  return translate(lang, 'ttWhyPlus_weakD', { name, days: x.days });
}

/** Grund der Aufgabe, dahinter höchstens ein Datenbeleg als Zusatz. */
export function whyText(f: WhyFact, lang: Lang): string {
  const name = nameOf(f, lang);
  const main = mainText(f, name, lang);
  return f.extra ? `${main} ${extraText(f.extra, name, lang)}` : main;
}

/** Fortschrittsbeleg in Worten („vor 3 Wochen 4 von 9 ohne Hilfe richtig, jetzt 8 von 9“). */
export const proofText = (pat: string, p: ProgressProof, lang: Lang): string =>
  translate(lang, 'ttProof', { name: refName(pat, lang), weeks: p.weeks, thenOk: p.thenOk, thenN: p.thenN, nowOk: p.nowOk, nowN: p.nowN });
