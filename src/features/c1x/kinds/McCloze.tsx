import { useMemo, useState } from 'react';
import { EnglishText } from '../../../engine/EnglishText';
import { Choices } from '../../../engine/Choices';
import { dayKey } from '../../../domain/date';
import { mccMuted, mccOrder } from '../../../domain/c1x/kinds/mcc';
import type { Mcc } from '../../../domain/c1x/types';
import { useT } from '../../../i18n';
import type { C1Ctrl, C1Ui } from '../types';

// `mcc` (Passendes Wort, Cambridge Teil 1), P20: vier Karten A–D (am Laptop auch die Tasten 1–4), danach „Prüfen“. Auswahl ist nie freier Abruf.
// Die Optionen werden beim Anzeigen fest gemischt (je Aufgabe und Tag, `mccOrder`); Tasten 1–4 und Begründungen folgen der Anzeige. Hinweisleiter (§2.6): Stufe 1 die Formel des
// Musters (bei Wortschatz-Aufgaben: der Hinweis auf die ganze Wendung), Stufe 2 eine falsche Antwort wird ausgegraut. Die Begründung je Option
// (mit Kategorie, z. B. „Deutsch gedacht“) kommt aus dem Rahmen („Warum nicht …?“).

const GAP = /_{3,}/;

export function useMccUi(ctrl: C1Ctrl): C1Ui {
  const item = ctrl.item as Mcc;
  const { t } = useT();
  // `chosen` ist der Platz in der Anzeige (A–D); `order[Platz]` ist der Index im Inhalt. Der Tag wird einmal je Aufgabe festgehalten.
  const [chosen, setChosen] = useState<number | null>(null);
  const [day] = useState(() => dayKey(Date.now()));
  const order = useMemo(() => mccOrder(item, day), [item, day]);
  const shownOptions = useMemo(() => order.map((o) => item.options[o] ?? ''), [order, item]);
  const chosenOrig = chosen === null ? null : (order[chosen] ?? null);
  const src = { area: ctrl.area, source: `grammar/${ctrl.task.topic}` };
  const verdict = ctrl.score?.verdict;
  const muted = useMemo(() => (!ctrl.locked && ctrl.tip >= 2 ? [order.indexOf(mccMuted(item, chosenOrig))] : []), [ctrl.locked, ctrl.tip, item, order, chosenOrig]);
  const pick = (i: number): void => {
    if (ctrl.locked) return;
    const orig = order[i];
    if (orig === undefined) return;
    setChosen(i);
    ctrl.setResponse({ kind: 'mcc', pick: orig }, { form: 'default', picked: item.options[orig] });
  };
  const shown = ctrl.locked ? item.options[item.answer] : chosenOrig !== null ? item.options[chosenOrig] : '';
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
        options={shownOptions}
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
