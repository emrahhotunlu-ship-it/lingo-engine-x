import { useMemo, useState } from 'react';
import { EnglishText } from '../../../engine/EnglishText';
import { KineticGap, type GapState } from '../../../engine/KineticGap';
import { oclMask } from '../../../domain/c1x/kinds/ocl';
import type { Ocl } from '../../../domain/c1x/types';
import { useT, type MessageKey } from '../../../i18n';
import type { C1Ctrl, C1Ui } from '../types';

// `ocl` (Kleines Wort, Cambridge Teil 2), P20: ein Wort in die Lücke tippen (Handy und Laptop gleich: ein Wort ist kurz genug zum Tippen).
// Rechtschreibung zählt (Tippfehler im Budget = „Fast“). Hinweisleiter (Lernplattform 3.0 §2.6): Stufe 1 die Wortklasse („Gesucht: ein Hilfsverb“),
// Stufe 2 die Platzhalter mit dem ersten Buchstaben (zählt als Stütze). Nach einer falschen Eingabe gibt der Rahmen erst einen Hinweis (zweiter Versuch).

const GAP = /_{3,}/;

export function useOclUi(ctrl: C1Ctrl): C1Ui {
  const item = ctrl.item as Ocl;
  const { t } = useT();
  const [value, setValue] = useState('');
  const verdict = ctrl.score?.verdict;
  const state: GapState = !ctrl.locked ? 'input' : verdict === 'correct' ? 'correct' : verdict === 'near' ? 'near' : 'wrong';
  const src = { area: ctrl.area, source: `grammar/${ctrl.task.topic}` };
  const mask = useMemo(() => oclMask(item), [item]);
  const solution = item.accept[0] ?? '';

  const gap = (
    <KineticGap
      label={t('grGapLabel')}
      maxLength={24}
      state={state}
      mask={!ctrl.locked && ctrl.tip >= 2 ? mask : null}
      shown={ctrl.locked ? value : null}
      reveal={ctrl.locked && verdict !== 'correct' ? { solution, given: value.trim() ? value : null } : null}
      silent
      onChange={(v, info) => {
        setValue(v);
        const text = v.trim();
        ctrl.setResponse(text ? { kind: 'ocl', text } : null, { form: 'typed', chars: v.length, deletions: info.deleted });
        if (info.firstKey) ctrl.markFirstKey();
      }}
      onEnter={ctrl.submit}
    />
  );
  const m = GAP.exec(item.text);
  const sentence = m ? (
    <EnglishText as="p" testId="sentence" text={item.text} {...src} slot={{ start: m.index, end: m.index + m[0].length, node: gap }} />
  ) : (
    <EnglishText as="p" testId="sentence" text={item.text} {...src} />
  );

  return {
    aid: null,
    maxTip: 2,
    tipText: (n) => (n === 1 ? t('cxOclTip1', { cls: t(`cxOclCls_${item.cls}` as MessageKey) }) : t('cxOclTip2')),
    prompt: (
      <div className="flex flex-col gap-2" data-testid="c1x-ocl" data-ocl-cls={item.cls}>
        {sentence}
      </div>
    ),
    answer:
      ctrl.locked && verdict !== 'correct' ? (
        <p className="lx-t-support" data-testid="ocl-solution">
          <span className="text-muted">{t('cxOclSolution')} </span>
          <span lang="en" className="font-semibold">
            {solution}
          </span>
        </p>
      ) : null,
  };
}
