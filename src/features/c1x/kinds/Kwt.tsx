import { useState, type ReactNode } from 'react';
import { EnglishText } from '../../../engine/EnglishText';
import { KineticGap, type GapState } from '../../../engine/KineticGap';
import { WordCounter } from '../../../engine/WordCounter';
import { kwtCount } from '../../../domain/c1x/kwtNorm';
import type { Kwt } from '../../../domain/c1x/types';
import { useT } from '../../../i18n';
import type { C1Ctrl, C1Ui } from '../types';

// `kwt` (Umformen, Cambridge Teil 4). P14: die getippte Grundform (Satz A, Schlüsselwort, Satz B mit Lücke für 3–6 Wörter, Wortzähler).
// P16 baut die Handy-Formen dazu (Bausteine, Teil B getippt, Hinweisleiter je Stufe).

export function useKwtUi(ctrl: C1Ctrl): C1Ui {
  const item = ctrl.item as Kwt;
  const { t } = useT();
  const [value, setValue] = useState('');
  const [lo, hi] = item.words ?? [3, 6];
  const verdict = ctrl.score?.verdict;
  const state: GapState = !ctrl.locked ? 'input' : verdict === 'correct' ? 'correct' : verdict === 'near' ? 'near' : 'wrong';
  const solution = `${item.keys[0]?.a[0] ?? ''} ${item.keys[0]?.b[0] ?? ''}`.trim();
  const src = { area: ctrl.area, source: `grammar/${ctrl.task.topic}` };

  const gap = (
    <KineticGap
      label={t('grGapLabel')}
      maxLength={80}
      state={state}
      shown={ctrl.locked ? value : null}
      reveal={ctrl.locked && verdict === 'wrong' ? { solution, given: value.trim() ? value : null } : null}
      silent
      onChange={(v, info) => {
        setValue(v);
        ctrl.setResponse(v.trim() ? { kind: 'kwt', text: v, typed: true } : null, { form: 'typed', chars: v.length, deletions: info.deleted });
        if (info.firstKey) ctrl.markFirstKey();
      }}
      onEnter={ctrl.submit}
    />
  );
  const frame = `${item.before} ___ ${item.after}`.trim();
  const at = frame.indexOf('___');
  const sentence: ReactNode = <EnglishText as="p" testId="sentence" text={frame} {...src} slot={{ start: at, end: at + 3, node: gap }} />;

  return {
    aid: null,
    prompt: (
      <div className="flex flex-col gap-2" data-testid="c1x-kwt">
        <EnglishText as="p" className="text-muted" text={item.lead} {...src} testId="transform-from" />
        <p className="flex flex-wrap items-center gap-2">
          <span className="lx-t-meta text-muted">{t('gxKeyWord')}</span>
          <span className="rounded-[var(--radius-inline)] bg-surface px-2 py-0.5 font-semibold tracking-wide" lang="en" data-testid="kwt-key">
            {item.key}
          </span>
        </p>
        {sentence}
      </div>
    ),
    answer: <WordCounter n={kwtCount(value)} min={lo} max={hi} />,
  };
}
