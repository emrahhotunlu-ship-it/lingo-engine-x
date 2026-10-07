import { useMemo, useState } from 'react';
import { EnglishText } from '../../../engine/EnglishText';
import { Choices } from '../../../engine/Choices';
import { mccMuted } from '../../../domain/c1x/kinds/mcc';
import { mccOrder } from '../../../domain/c1x/mix';
import type { Mcc } from '../../../domain/c1x/types';
import { useT } from '../../../i18n';
import type { C1Ctrl, C1Ui } from '../types';

// `mcc` (Passendes Wort, Cambridge Teil 1), P20: vier Karten A–D (am Laptop auch die Tasten 1–4), danach „Prüfen“. Auswahl ist nie freier Abruf.
// Im Inhalt steht die Lösung in einem festen Kreis; deshalb mischt die Anzeige fest je Aufgabe und Lerntag (`mccOrder`, Neu-Zeichnen würfelt nie neu).
// `chosen`, Tasten, A–D und Ausgrauen arbeiten mit der angezeigten Position; gemeldet und gebucht wird der Index im Inhalt. Hinweisleiter (§2.6): Stufe 1 die Formel des
// Musters (bei Wortschatz-Aufgaben: der Hinweis auf die ganze Wendung), Stufe 2 eine falsche Antwort wird ausgegraut. Die Begründung je Option
// (mit Kategorie, z. B. „Deutsch gedacht“) kommt aus dem Rahmen („Warum nicht …?“).

const GAP = /_{3,}/;

export function useMccUi(ctrl: C1Ctrl): C1Ui {
  const item = ctrl.item as Mcc;
  const { t } = useT();
  // `chosen`: angezeigte Position; `order[Position]` = Index in `item.options`.
  const [chosen, setChosen] = useState<number | null>(null);
  // Einmal je Aufgabe (der Rahmen hängt jede Aufgabe mit eigenem `key` ein): auch ein Tageswechsel mitten in der Aufgabe verschiebt nichts.
  const [order] = useState(() => mccOrder(item, ctrl.day));
  const options = useMemo(() => order.map((i) => item.options[i] ?? ''), [order, item]);
  const orig = chosen !== null ? (order[chosen] ?? null) : null;
  const src = { area: ctrl.area, source: `grammar/${ctrl.task.topic}` };
  const verdict = ctrl.score?.verdict;
  const muted = useMemo(() => (!ctrl.locked && ctrl.tip >= 2 ? [order.indexOf(mccMuted(item, orig))] : []), [ctrl.locked, ctrl.tip, item, orig, order]);
  const pick = (i: number): void => {
    if (ctrl.locked) return;
    const o = order[i];
    if (o === undefined) return;
    setChosen(i);
    ctrl.setResponse({ kind: 'mcc', pick: o }, { form: 'default', picked: item.options[o] });
  };
  const shown = ctrl.locked ? item.options[item.answer] : orig !== null ? item.options[orig] : '';
  const gap = (
    <span className="lx-gap" data-testid="gap" data-state={!ctrl.locked ? 'input' : verdict === 'correct' ? 'correct' : 'reveal'} style={{ width: 'auto' }}>
      {shown || '   '}
    </span>
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
    tipText: (n) => (n === 1 ? (item.area === 'lex' ? t('cxMccTip1Lex') : null) : t('cxMccTip2')),
    prompt: (
      <div className="flex flex-col gap-2" data-testid="c1x-mcc" data-mcc-area={item.area}>
        {sentence}
      </div>
    ),
    answer: (
      <Choices
        options={options}
        chosen={chosen}
        correct={ctrl.locked ? order.indexOf(item.answer) : null}
        revealed={ctrl.locked}
        onPick={pick}
        lang="en"
        collapse={ctrl.inp === 'touch'}
        muted={muted}
        label={t('cxMccLabel')}
        testId="choices"
      />
    ),
  };
}
