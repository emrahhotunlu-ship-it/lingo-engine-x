import type { VocabAi } from '../aiPort';
import type { UiLang } from '../shared';
import { type OwnSentenceOut, type OwnSentenceVars, ownSentence, ownSentenceRecheck } from '../prompts/ownSentence';
import { type TransferOut, type TransferVars, transfer, transferRecheck } from '../prompts/transfer';
import { promptTarget, type UseModel } from '../domain/use';
import { type UseAi, UseFail, type UseQuery, type UseVerdicts } from './learnRun';

// Großpaket A S5c-3: Brücke von der Anwenden-Karte zu Claude. Das Wörter-Modul kennt das KI-Tor (src/ai) nicht; wortschatz.tsx reicht es
// als `VocabAi` herein (aiPort.ts). Hier wird aus Karte und Text die passende Vorlage samt Variablen.

/** Lage-Text der Karte in der Oberflächensprache (`null` = freier Satz, Stufe 6). */
export type SitText = (m: UseModel) => string | null;

function transferOut(o: TransferOut): UseVerdicts {
  return { words: o.words, extra: o.extra, fixed: o.fixed, fixedUnsure: !!o.fixedUnsure, better: o.better };
}

function ownOut(key: string, o: OwnSentenceOut): UseVerdicts {
  return { words: [{ key, v: o.v, err: o.err, at: o.at, why: o.why }], extra: o.extra, fixed: o.fixed, fixedUnsure: !!o.fixedUnsure, better: o.better };
}

async function checkWith(ai: VocabAi, q: UseQuery, sit: SitText, lang: () => UiLang, signal: AbortSignal): Promise<UseVerdicts> {
  const uiLang = lang();
  if (q.m.form === 'transfer') {
    const vars: TransferVars = { frame: q.m.frame, task: sit(q.m) ?? '', targets: q.m.targets.map(promptTarget), text: q.text, spoken: q.spoken, uiLang };
    return transferOut(q.first ? await ai.ask(transferRecheck, { ...vars, first: q.first }, signal) : await ai.ask(transfer, vars, signal));
  }
  const target = promptTarget(q.m.targets[0]!);
  const vars: OwnSentenceVars = { target, sentence: q.text, task: sit(q.m), spoken: q.spoken, uiLang };
  const f = q.first?.find((x) => x.key === target.key) ?? q.first?.[0];
  const out = f ? await ai.ask(ownSentenceRecheck, { ...vars, first: { v: f.v, err: f.err, why: f.why } }, signal) : await ai.ask(ownSentence, vars, signal);
  return ownOut(target.key, out);
}

/** Prüf-Tor der Anwenden-Karte: Vorlage wählen, fragen, Antwort auf das gemeinsame Urteil abbilden; Fehler als `UseFail`. */
export function makeUseAi(ai: VocabAi, sit: SitText, lang: () => UiLang): UseAi {
  return {
    ready: () => ai.ready(),
    async check(q, signal) {
      try {
        return await checkWith(ai, q, sit, lang, signal);
      } catch (err) {
        if (err instanceof UseFail) throw err;
        const f = ai.fail(err);
        throw new UseFail(f.kind, f.key);
      }
    },
  };
}
