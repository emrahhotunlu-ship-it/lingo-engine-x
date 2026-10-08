import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { flags, kindEnabled } from '../../app/flags';
import { leaveBack, useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { readDoc } from '../../data/reads';
import { addDays } from '../../domain/date';
import { isTempoKind, selectTempo, targetMs, TEMPO_MIN, type TempoKind } from '../../domain/c1x/tempo';
import { toTask, type C1Task } from '../../domain/c1x/runtime';
import type { C1Item as C1ItemT } from '../../domain/c1x/types';
import type { GrammarAnswer } from '../../domain/learn/types';
import { answerRight } from '../../domain/learn/right';
import { recentMedian, slownessByPattern, summarizeTempo, type TempoLogEntry, type TempoRow } from '../../domain/metrics/tempo';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { getDb } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { inputProfile } from '../../platform/input';
import { SessionEnd } from '../../ui/SessionEnd';
import { ExerciseTop } from '../learn/ui';
import { flush, learnRecorder } from '../progress/persist';
import { C1Item } from './C1Item';
import { TEMPO_ENTRIES } from './kinds/tempo';

// Tempo-Runde (Lernplattform 3.0 §2.3, P24): zwölf kurze Aufgaben zu Mustern ab „Sicher“ (ocl, kwt Teil B, Fehler finden mit 1-Wort-Korrektur), jede wird
// gezählt. Ein ruhiger Balken zeigt die Zielzeit: keine Zahl, kein Ton, kein Rot, keine Sperre, kein automatisches Weiter. Nach Ablauf wird er neutral grau.
// Am Ende: „9 von 12 richtig · 7 davon in der Zielzeit · im Schnitt 5,8 s“ plus die Zeile der letzten vier Wochen. Keine Hilfe (wie ein Messmodus),
// gebucht wird wie bei den Arten selbst (`C1Item`), dazu `tm` je getippter Antwort im Protokoll (`grammarLogEntry`).

/** Typ der nächsten Aufgabe für den Fokus im selben Handler (iPhone: Tastatur nur im Tipp-Ereignis). */
const typedKind = (item: C1ItemT | undefined): 'typed' | 'choice' | null => (!item ? null : item.kind === 'err' ? null : 'typed');

// ------------------------------------------------------------------ Messwerte aus dem Protokoll (einmal je Minute, von Kachel und Runde geteilt)

export type TempoStats = { slow: ReadonlyMap<string, number>; recent: { ms: number; n: number } | null };
const NO_STATS: TempoStats = { slow: new Map(), recent: null };
const STATS_DAYS = 28;
let cache: { day: string; at: number; p: Promise<TempoStats> } | null = null;

/** Liest die Protokolle der letzten 28 Tage (höchstens 4 gleichzeitig) und rechnet Langsamkeit je Muster und den Median. Fehler: leere Werte, Meldung im Protokoll. */
export function loadTempoStats(today: string): Promise<TempoStats> {
  const now = Date.now();
  if (cache && cache.day === today && now - cache.at < 60_000) return cache.p;
  const p = (async (): Promise<TempoStats> => {
    const db = getDb();
    if (!db) return NO_STATS;
    const days: Array<{ day: string; entries: TempoLogEntry[] }> = [];
    const list = Array.from({ length: STATS_DAYS }, (_, k) => addDays(today, -k));
    for (let i = 0; i < list.length; i += 4) {
      const part = list.slice(i, i + 4);
      const docs = await Promise.all(part.map((d) => readDoc(db, `log/${d}`)));
      docs.forEach((r, k) => {
        if (r.status === 'valid' && Array.isArray(r.doc.entries)) days.push({ day: part[k] ?? '', entries: r.doc.entries as TempoLogEntry[] });
      });
    }
    return { slow: slownessByPattern(days.flatMap((d) => d.entries)), recent: recentMedian(days) };
  })().catch((err: unknown) => {
    logWarn('tempo:stats', err);
    return NO_STATS;
  });
  cache = { day: today, at: now, p };
  return p;
}

/** Messwerte für Kachel und Runde; bis sie da sind, `null`. */
export function useTempoStats(): TempoStats | null {
  const today = useClock((s) => s.today);
  const [stats, setStats] = useState<TempoStats | null>(null);
  useEffect(() => {
    let alive = true;
    void loadTempoStats(today).then((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, [today]);
  return stats;
}

// ------------------------------------------------------------------ Auswahl

const EMPTY_DOCS = new Map<string, Readonly<Record<string, unknown>>>();
let runNo = 0;

function build(grammarDocs: ReadonlyMap<string, Readonly<Record<string, unknown>>>, today: string, slow?: TempoStats['slow']): C1ItemT[] {
  runNo++;
  return selectTempo({ grammarDocs, today, seed: `${today}|tempo|${runNo}`, ...(slow ? { slow } : {}) });
}

/** Gibt es genug sichere Muster mit passenden Aufgaben? (Sonst zeigt Anwenden keine Kachel: kein toter Knopf.) */
export function useTempoAvailable(): boolean {
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY_DOCS;
  const today = useClock((s) => s.today);
  return useMemo(() => {
    if (!flags.tempo || !(kindEnabled('ocl') || kindEnabled('kwt') || kindEnabled('err'))) return false;
    return selectTempo({ grammarDocs: docs, today, seed: 'probe' }).length >= TEMPO_MIN;
  }, [docs, today]);
}

/** Vorbereitete Runde: wird im Klick gebaut (Fokus der Tastatur) und vom Bildschirm gelesen. Ohne sie (Neuladen) baut der Bildschirm selbst. */
const useTempoRun = create<{ items: C1ItemT[] | null }>(() => ({ items: null }));

/** Baut die Runde und öffnet den Bildschirm. `false`, wenn weniger als 4 Aufgaben passen. */
export function startTempo(api: ReturnType<typeof useHiddenInput>, slow?: TempoStats['slow']): boolean {
  const docs = useLive.getState().collections.grammar ?? EMPTY_DOCS;
  const items = build(docs, useClock.getState().today, slow);
  if (items.length < TEMPO_MIN) return false;
  useTempoRun.setState({ items });
  if (typedKind(items[0]) === 'typed') api.focusNow();
  else api.blur();
  useNav.getState().go({ name: 'tempoRound' });
  return true;
}

// ------------------------------------------------------------------ Zielzeit-Balken

/** Ruhiger Balken: füllt sich über die Zielzeit, danach neutral grau. Nur Zeichnung, kein Zustand, keine Zahl. Neue Aufgabe = neues Element (`key`). */
export function TargetBar({ ms }: { ms: number }) {
  const { t } = useT();
  return (
    <div className="cx-tempo-bar" role="img" aria-label={t('cxTempoBarLabel')} data-testid="tempo-bar" data-ms={ms}>
      <span style={{ ['--cx-tempo-ms' as string]: `${ms}ms` }} />
    </div>
  );
}

// ------------------------------------------------------------------ Runde

export type TempoRoundProps = {
  items: readonly C1ItemT[];
  day: string;
  ctx: 'duty' | 'xtra';
  /** „zuletzt …“ aus den letzten vier Wochen (vor dieser Runde). */
  recent: TempoStats['recent'];
  onClose: () => void;
  onFinish?: (rows: readonly TempoRow[]) => void;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function TempoRound({ items, day, ctx, recent, onClose, onFinish }: TempoRoundProps) {
  const { t, num } = useT();
  const api = useHiddenInput();
  const profile = useMemo(() => inputProfile(), []);
  const inp = profile === 'touch' ? 'touch' : 'desk';
  const tasks = useMemo<C1Task[]>(() => items.map((i) => toTask(i, { ref: 'content/c1x' })), [items]);
  const [pos, setPos] = useState(0);
  const [rows, setRows] = useState<TempoRow[]>([]);
  const [startedAt] = useState(() => performance.now());
  const [endMs, setEndMs] = useState(0);
  const closed = useRef(false);
  const finished = pos >= tasks.length;
  const task = tasks[pos];

  const roundEnd = (aborted: boolean, list: readonly TempoRow[]): void => {
    if (closed.current || !list.length) return;
    closed.current = true;
    void learnRecorder.roundEnd({ day, act: 'gram', ctx, partial: aborted && list.length < tasks.length, n: list.length, right: list.filter((r) => r.ok).length, activeMs: Math.round(performance.now() - startedAt) });
  };
  const leave = (): void => {
    api.blur();
    roundEnd(true, rows);
    void flush();
    onClose();
  };
  useHotkeys({ escape: leave }, api.isInput);

  const onDone = (a: GrammarAnswer): 'typed' | 'choice' | null => {
    // Gebucht wird wie bei den Arten selbst (BKT, Muster, Fehlersatz, Protokoll mit `tm`), dazu `tp` (zählt nicht für K6).
    void learnRecorder.grammar({ ...a, tempo: true });
    const kind = a.task.c1?.kind;
    const row: TempoRow | null = kind && isTempoKind(kind) ? { kind, ok: answerRight(a) && a.firstWrong === undefined, ms: a.ms, target: targetMs(kind, inp) } : null;
    const list = row ? [...rows, row] : rows;
    if (row) setRows(list);
    const nextPos = pos + 1;
    setPos(nextPos);
    if (nextPos >= tasks.length) {
      setEndMs(Math.round(performance.now() - startedAt));
      onFinish?.(list);
      roundEnd(false, list);
      void flush();
      return null;
    }
    return typedKind(items[nextPos]);
  };

  if (finished) {
    const sum = summarizeTempo(rows);
    const facts = [
      [t('cxTempoResult', { right: num(sum.right), total: num(sum.total), inTarget: num(sum.inTarget) }), sum.avgMs !== null ? t('cxTempoAvg', { avg: num(round1(sum.avgMs / 1000)) }) : null].filter(Boolean).join(' · '),
      ...(recent ? [t('cxTempoRecent', { avg: num(round1(recent.ms / 1000)) })] : []),
    ];
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="tempo-round" data-state="done">
        <SessionEnd mode="growth" title={t('cxTempoEndTitle')} right={sum.right} total={0} ms={Math.max(1, endMs)} facts={facts} next={{ label: t('lrBackToApply'), run: () => leaveBack(() => api.blur()) }} />
      </div>
    );
  }
  if (!task) return null;
  const kind = task.c1.kind as TempoKind;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="tempo-round" data-state="open" data-pos={pos}>
      <ExerciseTop onClose={leave} progress={{ n: pos + 1, total: tasks.length }} ctx={ctx === 'duty' ? 'duty' : 'xtra'} />
      <TargetBar key={`bar-${task.key}`} ms={targetMs(kind, inp)} />
      <C1Item key={task.key} task={task} ctx={ctx} day={day} onDone={onDone} profile={profile} noHelp noAuto entry={TEMPO_ENTRIES[kind]} />
    </div>
  );
}

// ------------------------------------------------------------------ Bildschirm (Route `tempoRound`)

export function TempoRoundScreen() {
  const { t } = useT();
  const back = useNav((s) => s.back);
  const day = useClock((s) => s.today);
  const grammar = useLive((s) => s.collections.grammar);
  const stats = useTempoStats();
  // Einmal beim Öffnen festlegen: die Runde ändert sich während der Antworten nicht.
  const [items] = useState<C1ItemT[]>(() => {
    const prepared = useTempoRun.getState().items;
    useTempoRun.setState({ items: null });
    return prepared ?? build(grammar ?? EMPTY_DOCS, day);
  });
  if (items.length < TEMPO_MIN) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="tempo-round" data-state="empty">
        <ExerciseTop onClose={back} ctx="xtra" />
        <div className="lx-glass flex flex-col gap-1 rounded-[var(--radius-card)] p-5">
          <p className="m-0 text-sm" data-testid="tempo-none">
            {t('cxTempoNone')}
          </p>
          <p className="lx-t-support m-0 text-muted">{t('cxTempoNoneSub')}</p>
        </div>
      </div>
    );
  }
  return <TempoRound items={items} day={day} ctx="xtra" recent={stats?.recent ?? null} onClose={back} />;
}
