import { useMemo, useState } from 'react';
import { EnglishText } from '../../../engine/EnglishText';
import { KineticGap, type GapState } from '../../../engine/KineticGap';
import { MorphSplit } from '../../../engine/MorphSplit';
import { useFxLevel } from '../../../engine/fx/level';
import { morphPieces, wfMask } from '../../../domain/c1x/kinds/wf';
import type { Wf } from '../../../domain/c1x/types';
import { useT, type MessageKey } from '../../../i18n';
import type { C1Ctrl, C1Ui } from '../types';

// `wf` (Wort umbauen, Cambridge Teil 3), P38: der Stamm steht als goldener Chip in Großbuchstaben über dem Satz, ein Wort in die Lücke tippen
// (Handy und Laptop gleich, höchstens 16 Zeichen). Rechtschreibung zählt (Tippfehler im Stamm = „Fast“, falsches Affix = falsch). Hinweisleiter
// (Lernplattform 3.0 §2.6): Stufe 1 Wortart und „mit Vorsilbe?“, Stufe 2 Platzhalter mit erstem Buchstaben (zählt als Stütze). Nach dem Prüfen
// zeigt die Rückmeldung die Zerlegung (*un · precedent · ed*) und die Wortfamilie, jedes Wort antippbar.

const GAP = /_{3,}/;
const MAX_CHARS = 16;

export function useWfUi(ctrl: C1Ctrl): C1Ui {
  const item = ctrl.item as Wf;
  const { t } = useT();
  const fx = useFxLevel();
  const [value, setValue] = useState('');
  const verdict = ctrl.score?.verdict;
  const state: GapState = !ctrl.locked ? 'input' : verdict === 'correct' ? 'correct' : verdict === 'near' ? 'near' : 'wrong';
  const src = { area: ctrl.area, source: `grammar/${ctrl.task.topic}` };
  const mask = useMemo(() => wfMask(item), [item]);
  const pieces = useMemo(() => morphPieces(item), [item]);
  const solution = item.accept[0] ?? '';

  const gap = (
    <KineticGap
      label={t('grGapLabel')}
      maxLength={MAX_CHARS}
      state={state}
      mask={!ctrl.locked && ctrl.tip >= 2 ? mask : null}
      shown={ctrl.locked ? value : null}
      reveal={ctrl.locked && verdict !== 'correct' ? { solution, given: value.trim() ? value : null } : null}
      silent
      onChange={(v, info) => {
        setValue(v);
        const text = v.trim();
        ctrl.setResponse(text ? { kind: 'wf', text } : null, {
          form: 'typed',
          chars: v.length,
          deletions: info.deleted,
        });
        if (info.firstKey) ctrl.markFirstKey();
      }}
      onEnter={ctrl.submit}
    />
  );
  const m = GAP.exec(item.text);
  const sentence = m ? <EnglishText as="p" testId="sentence" text={item.text} {...src} slot={{ start: m.index, end: m.index + m[0].length, node: gap }} /> : <EnglishText as="p" testId="sentence" text={item.text} {...src} />;

  return {
    aid: (
      <p className="m-0 flex flex-wrap items-center gap-2">
        <span className="lx-t-meta text-muted">{t('cxWfStem')}</span>
        <span className="wf-stem" lang="en" data-testid="wf-stem">
          {item.stem}
        </span>
      </p>
    ),
    maxTip: 2,
    tipText: (n) =>
      n === 1
        ? t('cxWfTip1', {
            pos: t(`cxWfPos_${item.pos}` as MessageKey),
            pre: t(item.parts.pre ? 'cxWfPre_yes' : 'cxWfPre_no'),
          })
        : t('cxWfTip2'),
    prompt: (
      <div className="flex flex-col gap-2" data-testid="c1x-wf" data-wf-pos={item.pos}>
        {sentence}
      </div>
    ),
    right:
      ctrl.locked && verdict !== 'correct' ? (
        <p className="lx-t-support m-0" data-testid="wf-solution">
          <span className="text-muted">{t('cxWfSolution')} </span>
          <span lang="en" className="font-semibold text-ok-text">
            {solution}
          </span>
        </p>
      ) : null,
    answer: ctrl.locked ? (
      <div className="flex flex-col gap-2" data-testid="wf-after">
        <p className="lx-t-meta m-0 text-muted">{t('cxWfBuilt')}</p>
        <MorphSplit pieces={pieces} animate={fx !== 'off'} />
        <p className="lx-t-support m-0" data-testid="wf-family">
          <span className="text-muted">{t('cxWfFamily')} </span>
          <EnglishText as="span" text={item.family.join(', ')} {...src} />
        </p>
        {item.parts.change ? (
          <p className="lx-t-meta m-0 text-muted" data-testid="wf-change">
            {t('cxWfChange', { change: item.parts.change })}
          </p>
        ) : null}
      </div>
    ) : null,
  };
}
