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

// Programmkarte „Dein Weg zu C1“ (Lernplattform 3.0 P32), im Grammatik-Reiter unter dem Titel (Slot `grammar.head`).
// Handy: senkrechte Route mit 7 Stationen, das aktuelle Kapitel offen mit Ziel und „Muster sicher a/b“. Laptop: waagerechte Leiste mit den Themen darunter.
// Alle Zahlen kommen aus `chapterState` (eine Quelle, dieselbe Zählung wie der Lernpfad). Nichts ist gesperrt, nichts wird gespeichert.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

/** Kapitelstand aus den Live-Daten (für Programmkarte und später die C1-Reise). */
export function useChapterState(): ChapterStateResult {
  const today = useClock((s) => s.today);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  return useMemo(() => chapterState({ docs, today }), [docs, today]);
}

/** Station: geschafft = grüner Ring mit Haken, „Du bist hier“ = blauer Ring mit Fortschritt, sonst gestrichelt mit Nummer (wie im Lernpfad). */
function Station({ n, status, frac, size = 44 }: { n: number; status: ChapterProgress['status']; frac: number; size?: number }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  return (
    <svg className="flex-none" width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" data-testid="program-station" data-state={status}>
      {status === 'done' ? (
        <>
          <circle cx="22" cy="22" r={r} fill="var(--lx-ok-soft)" stroke="var(--lx-ok)" strokeWidth="3" />
          <path d="M14 22.5l5.5 5.5L30 17" fill="none" stroke="var(--lx-ok-text)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="22" cy="22" r={r} fill="var(--lx-bg)" stroke="var(--lx-line-strong)" strokeWidth="3" strokeDasharray={status === 'current' ? undefined : '4 4'} />
          {status === 'current' && (
            <circle cx="22" cy="22" r={r} fill="none" stroke="var(--lx-ch-grammar)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * Math.max(frac, 0.12)} ${c}`} transform="rotate(-90 22 22)" />
          )}
          <text x="22" y="27.5" textAnchor="middle" fill="var(--lx-fg)" fontSize="15" fontWeight="650">
            {n}
          </text>
        </>
      )}
    </svg>
  );
}

const frac = (p: ChapterProgress): number => (p.patTotal > 0 ? Math.min(1, p.patSafe / p.patTotal) : 0);

function StatusChip({ status }: { status: ChapterProgress['status'] }) {
  const { t } = useT();
  if (status === 'open') return null;
  return status === 'done' ? (
    <span className="inline-flex h-6 flex-none items-center rounded-full bg-ok-soft px-2.5 text-xs font-bold text-ok-text" data-testid="program-done">
      {t('pxMapDone')}
    </span>
  ) : (
    <span className="inline-flex h-[1.375rem] flex-none items-center rounded-full px-2.5 text-xs font-bold" style={{ background: 'var(--lx-btn-grammar)', color: '#fff' }} data-testid="program-here">
      {t('pxMapHere')}
    </span>
  );
}

function PatsLine({ p }: { p: ChapterProgress }) {
  const { t } = useT();
  return p.ready ? (
    <span className="lx-tnum text-sm text-muted" data-testid="program-pats" data-safe={p.patSafe} data-total={p.patTotal}>
      {t('pxMapPats', { a: p.patSafe, b: p.patTotal })}
    </span>
  ) : (
    <span className="text-sm text-muted" data-testid="program-soon">
      {t('pxMapSoon')}
    </span>
  );
}

export function ProgramMap() {
  const { t, lang } = useT();
  const wide = useWide();
  const state = useChapterState();
  const chs = programChapters();
  const [picked, setPicked] = useState<number | null>(null);
  const [sheet, setSheet] = useState<{ idx: number; open: boolean } | null>(null);
  if (!chs.length || state.chapters.length !== chs.length) return null;

  const openSheet = (idx: number): void => setSheet({ idx, open: true });
  const sheetIdx = sheet?.idx ?? 0;
  const stateName = (p: ChapterProgress): string => (p.status === 'done' ? t('pxMapDone') : p.status === 'current' ? t('pxMapHere') : t('pxMapOpenState'));

  return (
    <section className="lx-glass flex flex-col gap-4 rounded-[var(--radius-card)] p-5" aria-labelledby="px-map-title" data-testid="program-map" data-current={state.current}>
      <header className="flex flex-col gap-1">
        <h2 id="px-map-title" className="lx-t-answer tracking-tight">
          {t('pxMapTitle')}
        </h2>
        <p className="text-sm text-muted">{t('pxMapSub')}</p>
      </header>

      {wide ? (
        <WideMap chs={chs} state={state} picked={picked ?? state.current} onPick={setPicked} onOpen={openSheet} stateName={stateName} />
      ) : (
        <ol className="m-0 flex list-none flex-col p-0" aria-label={t('pxMapRoute')}>
          {chs.map((c, i) => {
            const p = state.chapters[i]!;
            const here = p.status === 'current';
            const last = i === chs.length - 1;
            return (
              <li
                key={c.id}
                className="relative pb-3 pl-14"
                data-testid="program-chapter"
                data-chapter={c.id}
                data-status={p.status}
                data-here={here ? 'true' : undefined}
              >
                {!last && (
                  <span
                    aria-hidden="true"
                    className="absolute top-11 -bottom-0.5 left-[1.3125rem] w-0.5"
                    style={p.status === 'done' ? { background: 'var(--lx-ok)' } : { background: 'repeating-linear-gradient(to bottom, var(--lx-line-strong) 0 4px, transparent 4px 8px)' }}
                  />
                )}
                <span className="absolute top-0 left-0">
                  <Station n={c.n} status={p.status} frac={frac(p)} />
                </span>
                <button
                  type="button"
                  onClick={() => openSheet(i)}
                  className="flex min-h-11 w-full items-start gap-2 py-0.5 text-left"
                  aria-label={t('pxMapAria', { n: c.n, name: c.name[lang], state: stateName(p) })}
                  data-testid="program-chapter-open"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold tracking-tight">{t('pxMapChapter', { n: c.n, name: c.name[lang] })}</span>
                    <PatsLine p={p} />
                  </span>
                  <StatusChip status={p.status} />
                </button>
                {here && <Goal c={c} p={p} onOpen={() => openSheet(i)} />}
              </li>
            );
          })}
        </ol>
      )}

      <ChapterSheet open={!!sheet?.open} chapter={chs[sheetIdx] ?? null} progress={state.chapters[sheetIdx] ?? null} onClose={() => setSheet((s) => (s ? { ...s, open: false } : s))} />
    </section>
  );
}

/** Ziel des aktuellen Kapitels: „Abgeschlossen heißt …“ und der Knopf zum Kapitelblatt. */
function Goal({ c, p, onOpen }: { c: ProgramChapter; p: ChapterProgress; onOpen: () => void }) {
  const { t, lang } = useT();
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-[0.875rem] border border-line bg-surface-solid p-3.5" data-testid="program-goal" data-chapter={c.id}>
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

/** Laptop: waagerechte Leiste mit den sieben Stationen, darunter Ziel und Themen des gewählten Kapitels. */
function WideMap({
  chs,
  state,
  picked,
  onPick,
  onOpen,
  stateName,
}: {
  chs: readonly ProgramChapter[];
  state: ChapterStateResult;
  picked: number;
  onPick: (i: number) => void;
  onOpen: (i: number) => void;
  stateName: (p: ChapterProgress) => string;
}) {
  const { t, lang } = useT();
  const c = chs[picked]!;
  const p = state.chapters[picked]!;
  return (
    <div className="flex flex-col gap-4">
      <ol className="m-0 grid list-none grid-cols-7 gap-2 p-0" aria-label={t('pxMapRailAria')}>
        {chs.map((x, i) => {
          const q = state.chapters[i]!;
          return (
            <li key={x.id} className="min-w-0" data-testid="program-chapter" data-chapter={x.id} data-status={q.status} data-here={q.status === 'current' ? 'true' : undefined}>
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-pressed={i === picked}
                aria-label={t('pxMapAria', { n: x.n, name: x.name[lang], state: stateName(q) })}
                data-testid="program-chapter-open"
                className={`flex min-h-11 w-full flex-col items-center gap-1 rounded-[0.875rem] border px-1.5 py-2 text-center transition-colors hover:bg-surface-strong ${i === picked ? 'bg-surface-strong border-line-strong' : 'border-transparent'}`}
              >
                <Station n={x.n} status={q.status} frac={frac(q)} size={40} />
                <span className="w-full text-sm font-semibold leading-tight [overflow-wrap:anywhere]">{x.name[lang]}</span>
                <PatsLine p={q} />
              </button>
            </li>
          );
        })}
      </ol>
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
              <li key={r.id} data-testid="program-topic" data-topic={r.id} data-exists={r.exists ? 'true' : 'false'} data-tone={topicTone(r)} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line px-3 text-sm">
                <span>{name}</span>
                <span className="lx-tnum text-muted">{r.exists && r.patTotal > 0 ? `${r.patSafe}/${r.patTotal}` : t('pxChTopicSoon')}</span>
              </li>
            );
          })}
        </ul>
        <div>
          <Button variant="secondary" onClick={() => onOpen(picked)} data-testid="program-more">
            {t('pxMapMore')}
          </Button>
        </div>
      </div>
    </div>
  );
}
