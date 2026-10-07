import { useMemo, useState, type ReactNode } from 'react';
import { EnglishText } from '../../../engine/EnglishText';
import { KineticGap, type GapState } from '../../../engine/KineticGap';
import { Tiles } from '../../../engine/Tiles';
import { WordCounter } from '../../../engine/WordCounter';
import { hasKey, kwtCount, kwtWords } from '../../../domain/c1x/kwtNorm';
import type { Tile } from '../../../domain/drills/order';
import type { Kwt } from '../../../domain/c1x/types';
import { hash32, mulberry32, shuffle } from '../../../domain/random';
import { useT } from '../../../i18n';
import type { C1Ctrl, C1Ui } from '../types';

// `kwt` (Umformen, Cambridge Teil 4), P16. Drei Eingabeformen (Lernplattform 3.0 §2.10, §3.4):
//  · Laptop (`desk`): in die Lücke tippen, Wortzähler, das Schlüsselwort leuchtet, sobald es unverändert getippt ist.
//  · Handy, p ≤ 0,7 (`tiles`): Bausteine in eine wachsende Antwortzeile legen (Plätze = gelegte + 1, die Wortzahl bleibt verborgen).
//  · Handy, p > 0,7 (`part`): Teil A aus Bausteinen, Teil B höchstens 3 Wörter getippt (Produktion; zählt als freier Abruf).
// „Prüfen“ wird erst frei, wenn die Antwort 3–6 Wörter hat und das Schlüsselwort enthält.

export type KwtMode = 'desk' | 'tiles' | 'part';
export const PART_B_MAX = 3;

/** Eingabeform nach Gerät und Stufe: Handy bis p 0,7 Bausteine, darüber Teil A Bausteine + Teil B getippt. */
export function kwtMode(inp: 'touch' | 'desk', p: number): KwtMode {
  return inp === 'desk' ? 'desk' : p > 0.7 ? 'part' : 'tiles';
}

/** Die Bausteine einer Aufgabe in stabiler, gemischter Reihenfolge (Lösung, Ablenker, Schlüsselwort); `only` begrenzt auf Teil A. */
export function kwtTiles(item: Kwt, only: 'all' | 'a' = 'all'): Tile[] {
  const atom = [item.key];
  const first = item.keys[0];
  const bWords = only === 'a' ? [...kwtWords((first?.b[0] ?? ''), atom)] : [];
  const texts = [...item.tiles.map((t) => ({ text: t, distractor: false })), { text: item.key, distractor: false }, ...item.extra.map((t) => ({ text: t, distractor: true }))];
  const kept = only === 'a'
    ? texts.filter((x) => {
        if (x.distractor) return true;
        const w = kwtWords(x.text, atom);
        const hit = w.length > 0 && w.every((v) => bWords.includes(v));
        if (hit) for (const v of w) bWords.splice(bWords.indexOf(v), 1);
        return !hit;
      })
    : texts;
  const rng = mulberry32(hash32(`kwt-tiles|${item.id}|${only}`));
  return shuffle(kept, rng).map((x, id) => ({ id, text: x.text, distractor: x.distractor }));
}

export function useKwtUi(ctrl: C1Ctrl): C1Ui {
  const item = ctrl.item as Kwt;
  const { t } = useT();
  const mode = kwtMode(ctrl.inp, ctrl.p);
  const [value, setValue] = useState('');
  const [placed, setPlaced] = useState<number[]>([]);
  const [lo, hi] = item.words ?? [3, 6];
  const verdict = ctrl.score?.verdict;
  const state: GapState = !ctrl.locked ? 'input' : verdict === 'correct' ? 'correct' : verdict === 'near' ? 'near' : 'wrong';
  const solution = `${item.keys[0]?.a[0] ?? ''} ${item.keys[0]?.b[0] ?? ''}`.trim();
  const src = { area: ctrl.area, source: `grammar/${ctrl.task.topic}` };
  const tiles = useMemo(() => kwtTiles(item, mode === 'part' ? 'a' : 'all'), [item, mode]);
  const atom = [item.key];
  /** Teil B darf so lang sein wie die längste Lösung (mindestens 3 Wörter). */
  const partMax = Math.max(PART_B_MAX, ...item.keys.flatMap((k) => k.b.map((x) => kwtWords(x, atom).length)));

  const tileText = (ids: readonly number[]): string => ids.map((id) => tiles.find((x) => x.id === id)?.text ?? '').join(' ');
  /** Antwort aus Bausteinen und (im Teil-Modus) dem getippten Teil B. */
  const report = (ids: readonly number[], typed: string, info?: { deleted: number }): void => {
    const text = `${tileText(ids)} ${mode === 'part' ? typed : ''}`.trim();
    const words = kwtWords(text, atom);
    const bWords = mode === 'part' ? kwtCount(typed) : 0;
    const ready = words.length >= lo && words.length <= hi && hasKey(words, item.key.toLowerCase()) && (mode !== 'part' || (bWords >= 1 && bWords <= partMax));
    ctrl.setResponse(ready ? { kind: 'kwt', text, typed: mode !== 'tiles' } : null, { form: mode === 'tiles' ? 'tiles' : mode === 'part' ? 'part' : 'typed', chars: text.length, deletions: info?.deleted ?? 0, units: ids.length });
  };

  const gapInput = (
    <KineticGap
      label={t('grGapLabel')}
      maxLength={mode === 'part' ? 30 : 80}
      state={state}
      shown={ctrl.locked ? (mode === 'part' ? value : value) : null}
      reveal={ctrl.locked && verdict !== 'correct' && mode !== 'tiles' ? { solution: mode === 'part' ? (item.keys[0]?.b[0] ?? solution) : solution, given: value.trim() ? value : null } : null}
      silent
      onChange={(v, info) => {
        setValue(v);
        if (mode === 'part') report(placed, v, { deleted: info.deleted });
        else ctrl.setResponse(v.trim() ? { kind: 'kwt', text: v, typed: true } : null, { form: 'typed', chars: v.length, deletions: info.deleted });
        if (info.firstKey) ctrl.markFirstKey();
      }}
      onEnter={ctrl.submit}
    />
  );

  const frame = `${item.before} ___ ${item.after}`.trim();
  const at = frame.indexOf('___');
  const sentence: ReactNode =
    mode === 'desk' ? <EnglishText as="p" testId="sentence" text={frame} {...src} slot={{ start: at, end: at + 3, node: gapInput }} /> : <EnglishText as="p" testId="sentence" text={frame} {...src} />;

  const typedWords = mode === 'desk' ? kwtWords(value, atom) : [];
  const keyTyped = mode === 'desk' && hasKey(typedWords, item.key.toLowerCase());

  const tilesNode = (
    <Tiles
      tiles={tiles}
      placed={placed}
      onChange={(ids) => {
        setPlaced(ids);
        report(ids, value);
        ctrl.markFirstKey();
      }}
      locked={ctrl.locked}
      labels={{ line: t('drTileLine'), pool: t('drTilePool') }}
      markLabels={{ ok: t('drMarkOk'), near: t('drMarkNear'), off: t('drMarkOff') }}
      slots={placed.length + 1}
    />
  );

  const counterN = mode === 'desk' ? kwtCount(value) : kwtWords(`${tileText(placed)} ${mode === 'part' ? value : ''}`, atom).length;
  const answer =
    mode === 'desk' ? (
      <WordCounter n={counterN} min={lo} max={hi} />
    ) : mode === 'tiles' ? (
      <div className="flex flex-col gap-2" data-testid="kwt-tiles">
        {tilesNode}
        <WordCounter n={counterN} min={lo} max={hi} />
        {ctrl.locked && verdict !== 'correct' && (
          <p className="lx-t-support" data-testid="kwt-solution">
            <span className="text-muted">{t('cxKwtSolution')} </span>
            <span lang="en" className="font-semibold">{solution}</span>
          </p>
        )}
      </div>
    ) : (
      <div className="flex flex-col gap-3" data-testid="kwt-part">
        <p className="lx-t-meta text-muted">{t('cxKwtPartA')}</p>
        {tilesNode}
        <p className="lx-t-meta text-muted">{t('cxKwtPartB', { max: partMax })}</p>
        <div data-testid="kwt-part-b">{gapInput}</div>
        <WordCounter n={kwtCount(value)} min={1} max={partMax} testId="word-counter-b" />
        <WordCounter n={counterN} min={lo} max={hi} />
      </div>
    );

  return {
    aid: null,
    maxTip: 3,
    tipText: (n) => {
      // Stufe 1 und 2: Leitfrage und Formel des Musters (Rahmen); Stufe 3: der erste Teil-A-Baustein (zählt als Hilfe).
      if (n < 3) return null;
      const first = (item.keys[0]?.a[0] ?? '').split(/\s+/)[0] ?? '';
      return first ? t('cxKwtTip3', { word: first }) : null;
    },
    prompt: (
      <div className="flex flex-col gap-2" data-testid="c1x-kwt" data-kwt-mode={mode}>
        <EnglishText as="p" className="text-muted" text={item.lead} {...src} testId="transform-from" />
        <p className="flex flex-wrap items-center gap-2">
          <span className="lx-t-meta text-muted">{t('gxKeyWord')}</span>
          <span
            className="rounded-[var(--radius-inline)] bg-surface px-2 py-0.5 font-semibold tracking-wide"
            style={keyTyped ? { color: 'var(--color-ok-text)' } : undefined}
            lang="en"
            data-testid="kwt-key"
            data-found={keyTyped ? 'true' : 'false'}
          >
            {item.key}
            {keyTyped && <span aria-hidden="true"> ✓</span>}
          </span>
        </p>
        {sentence}
      </div>
    ),
    answer,
  };
}
