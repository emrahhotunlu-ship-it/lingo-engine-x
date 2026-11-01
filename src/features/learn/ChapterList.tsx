import { chapterRunOn } from '../../app/flags';
import { useNav } from '../../app/nav';
import { programChapters } from '../../domain/c1/chapters';
import type { ChapterProgress } from '../../domain/c1/state';
import { useT } from '../../i18n';
import { useMediaQuery } from '../../platform/input';
import { Icon } from '../../ui/Icon';
import { useChapterNow } from '../c1/chapterRun';
import { useChapterState } from '../c1/ProgramMap';
import { chapterLater, LEARN_COLUMN_QUERY, useLearnPick } from './learnView';

// Kapitelliste „Dein Weg zu C1“ (Relaunch Teil 1c, D5 V-GRAMMATIK; Vorschau H6 screens.js:477–479, L4 desk.js:244–246): je Kapitel eine Zeile
// mit Nummernkachel, Name und einer Zeile Stand. Das Kapitel „jetzt dran“ hat die getönte Kachel und den Pfeil, Kapitel nach dem aktuellen, die
// noch nicht begonnen sind, ein Schloss. Abweichung von der Vorschau (Funktion bleibt, stufe1c-plan §5 A5): das Schloss sperrt nicht – heute kann
// man jedes Kapitel ansehen und vorziehen (Kapitel-Arbeit K1). Der Tipp öffnet das Kapitel-Detail: ab 1.280 px in der Kontextspalte (L4), darunter
// als eigene Seite (H6 `chapter`). Alle Zahlen aus `chapterState` (eine Quelle, wie Heute und Fortschritt); hier wird nichts gespeichert.

type Kind = 'run' | 'done' | 'later' | 'open' | 'soon';

function kindOf(p: ChapterProgress, idx: number, current: number): Kind {
  if (p.status === 'current') return 'run';
  if (p.status === 'done') return 'done';
  if (!p.ready) return 'soon';
  return chapterLater(p, idx, current) ? 'later' : 'open';
}

export function ChapterList() {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const state = useChapterState();
  const { cursor } = useChapterNow();
  const column = useMediaQuery(LEARN_COLUMN_QUERY);
  const picked = useLearnPick((s) => s.idx);
  const chs = programChapters();
  if (!chs.length || state.chapters.length !== chs.length) return null;
  const weeks = chs.map((c) => c.weeks);
  const shownIdx = picked ?? Math.max(0, state.current);
  const run = chapterRunOn();

  const sub = (p: ChapterProgress, k: Kind, idx: number): string => {
    const c = chs[idx]!;
    if (k === 'run') {
      // „Thema i von n“: das Thema des Cursors, sonst das erste noch nicht geschaffte.
      const live = p.topics.filter((x) => x.exists);
      const at = cursor && cursor.n === c.n && cursor.topic ? live.findIndex((x) => x.id === cursor.topic) : -1;
      const i = at >= 0 ? at + 1 : Math.min(live.length, (run ? p.topicDone : p.topicSafe) + 1);
      return t('vgChRun', { i, n: live.length });
    }
    if (k === 'done') return t('vgChDone', { n: p.liveTopics });
    if (k === 'soon') return t('pxMapSoon');
    if (k === 'later') return t('vgChLater', { w: String(c.weeks).replace('.', lang === 'de' ? ',' : '.') });
    return run ? t('pxKDoneCount', { a: p.topicDone, b: p.liveTopics }) : t('hxPathSafe', { a: p.topicSafe, b: p.liveTopics });
  };

  return (
    <section className="lx-vg-path" aria-labelledby="vg-path-t" data-testid="path-chapters" data-current={state.current}>
      <h2 id="vg-path-t" className="lx-vg-lbl lx-vg-pathlbl">
        {t('vgPath', { n: chs.length, a: Math.floor(Math.min(...weeks)), b: Math.ceil(Math.max(...weeks)) })}
      </h2>
      <ul className="lx-vg-chs">
        {state.chapters.map((p, idx) => {
          const c = chs[idx]!;
          const k = kindOf(p, idx, state.current);
          const selected = column && idx === shownIdx;
          return (
            <li key={c.id}>
              <button
                type="button"
                className="lx-v-row lx-vg-ch"
                data-kind={k}
                data-testid="path-chapter"
                data-chapter={c.id}
                data-status={p.status}
                aria-current={k === 'run' ? 'step' : undefined}
                aria-pressed={column ? selected : undefined}
                onClick={() => (column ? useLearnPick.setState({ idx }) : go({ name: 'chapter', id: c.id }))}
              >
                <span className="lx-v-row-ic lx-vg-num lx-v-num" aria-hidden="true">
                  {c.n}
                </span>
                <span className="lx-v-row-t">
                  <b>
                    <span className="sr-only">{t('vgChEyeOpen', { n: c.n })}: </span>
                    {c.name[lang]}
                  </b>
                  <span data-testid="path-chapter-sub">
                    {sub(p, k, idx)}
                    {k === 'later' && <span className="sr-only"> · {t('vgChLockAria')}</span>}
                  </span>
                </span>
                <span className="lx-v-row-chev" aria-hidden="true">
                  <Icon name={k === 'later' ? 'lock' : 'chevronRight'} size={18} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
