import { useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { pendingName, programChapters } from '../../domain/c1/chapters';
import type { ProgramChapter } from '../../domain/c1/programTypes';
import { chapterState, type ChapterProgress, type ChapterStateResult } from '../../domain/c1/state';
import { useT } from '../../i18n';
import { useWide } from '../../platform/input';
import { Button } from '../../ui/Button';
import { topicName } from '../grammar/topicUi';
import { ChapterSheet, topicTone } from './ChapterSheet';
import { JourneyMap, StatusChip } from './journey/JourneyMap';

// Programmkarte „Dein Weg zu C1“ (Lernplattform 3.0 P32), im Grammatik-Reiter unter dem Titel (Slot `grammar.head`).
// Darstellung seit R6 (P58): die C1-Reise (`journey/JourneyMap.tsx`). Handy: senkrechte Route mit 7 Stationen, darunter das Ziel des aktuellen
// Kapitels mit „Muster sicher a/b“. Laptop: waagerechte Route, darunter Ziel und Themen des gewählten Kapitels.
// Alle Zahlen kommen aus `chapterState` (eine Quelle, dieselbe Zählung wie der Lernpfad). Nichts ist gesperrt, nichts wird gespeichert.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

/** Kapitelstand aus den Live-Daten (für Programmkarte und später die C1-Reise). */
export function useChapterState(): ChapterStateResult {
  const today = useClock((s) => s.today);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  return useMemo(() => chapterState({ docs, today }), [docs, today]);
}

export function ProgramMap() {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const wide = useWide();
  const state = useChapterState();
  const chs = programChapters();
  const [picked, setPicked] = useState<number | null>(null);
  const [sheet, setSheet] = useState<{ idx: number; open: boolean } | null>(null);
  if (!chs.length || state.chapters.length !== chs.length) return null;

  const openSheet = (idx: number): void => setSheet({ idx, open: true });
  const sheetIdx = sheet?.idx ?? 0;
  const pickedIdx = Math.max(0, picked ?? state.current);
  const here = state.chapters.findIndex((p) => p.status === 'current');

  return (
    <section className="lx-glass flex flex-col gap-4 rounded-[var(--radius-card)] p-5" aria-labelledby="px-map-title" data-testid="program-map" data-current={state.current}>
      <header className="flex flex-col gap-1">
        <h2 id="px-map-title" className="lx-t-answer tracking-tight">
          {t('pxMapTitle')}
        </h2>
        <p className="text-sm text-muted">{t('pxMapSub')}</p>
      </header>

      {wide ? (
        <JourneyMap chapters={chs} progress={state.chapters} orientation="horizontal" picked={pickedIdx} onSelect={setPicked}>
          <Detail c={chs[pickedIdx]!} p={state.chapters[pickedIdx]!} onOpen={() => openSheet(pickedIdx)} />
        </JourneyMap>
      ) : (
        <JourneyMap chapters={chs} progress={state.chapters} orientation="vertical" onSelect={openSheet} centerDay={today}>
          {here >= 0 && <Goal c={chs[here]!} p={state.chapters[here]!} onOpen={() => openSheet(here)} />}
        </JourneyMap>
      )}

      <ChapterSheet open={!!sheet?.open} chapter={chs[sheetIdx] ?? null} progress={state.chapters[sheetIdx] ?? null} onClose={() => setSheet((s) => (s ? { ...s, open: false } : s))} />
    </section>
  );
}

/** Ziel des aktuellen Kapitels: „Abgeschlossen heißt …“ und der Knopf zum Kapitelblatt. */
function Goal({ c, p, onOpen }: { c: ProgramChapter; p: ChapterProgress; onOpen: () => void }) {
  const { t, lang } = useT();
  return (
    <div className="flex flex-col gap-2 rounded-[0.875rem] border border-line bg-surface-solid p-3.5" data-testid="program-goal" data-chapter={c.id}>
      <p className="lx-eyebrow">{t('pxMapGoalLabel')}</p>
      <p className="text-sm leading-relaxed">{c.done[lang]}</p>
      {p.ready && <p className="lx-tnum text-sm font-medium">{t('pxMapPats', { a: p.patSafe, b: p.patTotal })}</p>}
      <div>
        <Button variant="secondary" onClick={onOpen} data-testid="program-more">
          {t('pxMapMore')}
        </Button>
      </div>
    </div>
  );
}

/** Laptop: Ziel und Themen des gewählten Kapitels unter der waagerechten Route. */
function Detail({ c, p, onOpen }: { c: ProgramChapter; p: ChapterProgress; onOpen: () => void }) {
  const { t, lang } = useT();
  return (
    <div className="flex flex-col gap-3 rounded-[0.875rem] border border-line bg-surface-solid p-4" data-testid="program-detail" data-chapter={c.id}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold tracking-tight">{t('pxMapChapter', { n: c.n, name: c.name[lang] })}</p>
        <StatusChip status={p.status} />
      </div>
      <p className="lx-eyebrow">{t('pxMapGoalLabel')}</p>
      <p className="text-sm leading-relaxed">{c.done[lang]}</p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={t('pxChTopics')}>
        {p.topics.map((r) => {
          const name = r.exists ? topicName(r.id, lang) : (pendingName(r.id, lang) ?? r.id);
          return (
            <li
              key={r.id}
              data-testid="program-topic"
              data-topic={r.id}
              data-exists={r.exists ? 'true' : 'false'}
              data-tone={topicTone(r)}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line px-3 text-sm"
            >
              <span>{name}</span>
              <span className="lx-tnum text-muted">{r.exists && r.patTotal > 0 ? `${r.patSafe}/${r.patTotal}` : t('pxChTopicSoon')}</span>
            </li>
          );
        })}
      </ul>
      <div>
        <Button variant="secondary" onClick={onOpen} data-testid="program-more">
          {t('pxMapMore')}
        </Button>
      </div>
    </div>
  );
}
