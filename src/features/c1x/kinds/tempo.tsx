import { useState } from 'react';
import { EnglishText } from '../../../engine/EnglishText';
import { KineticGap, type GapState } from '../../../engine/KineticGap';
import { WordCounter } from '../../../engine/WordCounter';
import { hasKey, kwtCount, kwtWords } from '../../../domain/c1x/kwtNorm';
import { kwtSplit } from '../../../domain/c1x/tempo';
import type { Kwt } from '../../../domain/c1x/types';
import { useT } from '../../../i18n';
import type { C1Ctrl, C1KindEntry, C1Ui } from '../types';
import { useErrUi } from './Err';
import { useOclUi } from './OpenCloze';

// Eingabeformen der Tempo-Runde (Lernplattform 3.0 §2.3, P24). Nichts ist länger als 3 Wörter, damit es am Handy ohne langes Tippen geht:
//  · `ocl`: wie sonst, ein Wort in die Lücke.
//  · `kwt` „Teil B“: der Anfang der Lösung (Teil A) steht schon im Satz, getippt wird nur das Ende (höchstens 3 Wörter). Note `kwt_part`.
//  · `err` mit 1-Wort-Korrektur: Wort antippen (oder „Kein Fehler“), dann die Korrektur tippen. Am Handy die Form `tapfix`, am Laptop wie sonst.

export const TEMPO_PART_B_MAX = 3;

export function useKwtTempoUi(ctrl: C1Ctrl): C1Ui {
  const item = ctrl.item as Kwt;
  const { t } = useT();
  const split = kwtSplit(item);
  const a = split?.a ?? '';
  const [value, setValue] = useState('');
  const verdict = ctrl.score?.verdict;
  const state: GapState = !ctrl.locked ? 'input' : verdict === 'correct' ? 'correct' : verdict === 'near' ? 'near' : 'wrong';
  const src = { area: ctrl.area, source: `grammar/${ctrl.task.topic}` };
  const atom = [item.key];
  const [lo, hi] = item.words ?? [3, 6];

  const report = (v: string, deleted: number): void => {
    const text = `${a} ${v}`.trim();
    const words = kwtWords(text, atom);
    const b = kwtCount(v);
    const ready = b >= 1 && b <= TEMPO_PART_B_MAX && words.length >= lo && words.length <= hi && hasKey(words, item.key.toLowerCase());
    ctrl.setResponse(ready ? { kind: 'kwt', text, typed: true } : null, { form: 'part', chars: v.length, deletions: deleted });
  };

  const gap = (
    <KineticGap
      label={t('grGapLabel')}
      maxLength={30}
      state={state}
      shown={ctrl.locked ? value : null}
      reveal={ctrl.locked && verdict !== 'correct' ? { solution: split?.b ?? '', given: value.trim() ? value : null } : null}
      silent
      onChange={(v, info) => {
        setValue(v);
        report(v, info.deleted);
        if (info.firstKey) ctrl.markFirstKey();
      }}
      onEnter={ctrl.submit}
    />
  );
  const frame = `${item.before} ${a} ___ ${item.after}`.replace(/\s+/g, ' ').trim();
  const at = frame.indexOf('___');
  const typedWords = kwtWords(`${a} ${value}`, atom);
  const keyTyped = hasKey(typedWords, item.key.toLowerCase());

  return {
    aid: null,
    maxTip: 1,
    prompt: (
      <div className="flex flex-col gap-2" data-testid="c1x-kwt" data-kwt-mode="partB">
        <EnglishText as="p" className="text-muted" text={item.lead} {...src} testId="transform-from" />
        <p className="flex flex-wrap items-center gap-2">
          <span className="lx-t-meta text-muted">{t('gxKeyWord')}</span>
          <span className="rounded-[var(--radius-inline)] bg-surface px-2 py-0.5 font-semibold tracking-wide" lang="en" data-testid="kwt-key" data-found={keyTyped ? 'true' : 'false'}>
            {item.key}
          </span>
        </p>
        <EnglishText as="p" testId="sentence" text={frame} {...src} slot={{ start: at, end: at + 3, node: gap }} />
      </div>
    ),
    answer: (
      <div className="flex flex-col gap-2" data-testid="kwt-part-b-only">
        <p className="lx-t-meta text-muted">{t('cxTempoKwtEnd', { max: TEMPO_PART_B_MAX })}</p>
        <WordCounter n={kwtCount(value)} min={1} max={TEMPO_PART_B_MAX} testId="word-counter-b" />
      </div>
    ),
  };
}

/** Fehler finden in der Tempo-Runde: immer die getippte Korrektur (Handy: `tapfix`), nie die Chips. */
export function useErrTempoUi(ctrl: C1Ctrl): C1Ui {
  return useErrUi({ ...ctrl, p: 1 });
}

/** Die Arten der Tempo-Runde für den Rahmen (`C1Item entry=…`). */
export const TEMPO_ENTRIES: Readonly<Record<'ocl' | 'kwt' | 'err', C1KindEntry>> = {
  ocl: { useUi: useOclUi },
  kwt: { useUi: useKwtTempoUi },
  err: { useUi: useErrTempoUi },
};
