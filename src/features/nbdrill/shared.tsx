import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { leaveBack, useNav } from '../../app/nav';
import { usePlayer } from '../../app/shell/playerContext';
import { toast } from '../../ui/Toast';
import { clearResume, holdResume, loadResume, type Resumable } from '../../app/resume';
import type { Route } from '../../app/router/types';
import { unitDone } from '../../app/unit/done';
import type { UnitBlockNo, UnitCtx, UnitTaskResult } from '../../app/unit/types';
import { getWriter } from '../../data';
import { outPath, upsertOut, type OutItem } from '../../domain/nbdrill/outDoc';
import { channelLogEntry } from '../../domain/progress/channelLog';
import type { WeekTargets } from '../../domain/unit/types';
import { useT } from '../../i18n';
import { logError } from '../../platform/diagnostics';
import { inputProfile } from '../../platform/input';
import { local } from '../../platform/storage';
import { ExerciseBar } from '../../ui/ExerciseBar';
import { Icon } from '../../ui/Icon';
import { recordChannelEntries } from '../progress/persist';
import { ExerciseActions } from '../system/Chrome';

// Gemeinsame Bausteine der neuen Übungen (Paket P7, docs/neubau/plan.md §4.8):
// - Einheit: `UnitRun` (was ein Block beim Start bekam) und `finishUnit` (→ `unitDone`),
// - Ergebnisse: `saveOut` (`out/<Monat>` über writer.transform) und `logAnswers` (Tagesprotokoll),
// - Oberfläche: Übungsleiste, Kopf mit Aufgabe und „Wozu?“, Zeitbalken, Ziel-Zeile,
// - Stabilität: `StepBoundary` (Vertrag WP0b, bis zum Merge hier) und das Fortsetzen.

// ------------------------------------------------------------------ Einheit

/** Was ein Block der Tageseinheit beim Start bekommt (JSON, Teil der Momentaufnahme). */
export type UnitRun = {
  block: UnitBlockNo;
  day: string;
  theme: string | null;
  minutes: number;
  targets?: Pick<WeekTargets, 'goals' | 'phrases'>;
};

export function unitRunOf(ctx: UnitCtx): UnitRun {
  const run: UnitRun = { block: ctx.block, day: ctx.day, theme: ctx.theme?.id ?? null, minutes: ctx.minutes };
  if (ctx.targets.goals.length || ctx.targets.phrases.length) run.targets = { goals: [...ctx.targets.goals], phrases: [...ctx.targets.phrases] };
  return run;
}

export const currentDay = (): string => useClock.getState().today;

/**
 * Abschluss: In der Einheit meldet die Übung `unitDone(block, result)` (P1 führt weiter). Führt der
 * Meldepunkt nicht weg (kein Handler angemeldet), geht es zurück zur Herkunft – nie eine Sackgasse.
 */
export function finishUnit(unit: UnitRun | null, result?: UnitTaskResult): void {
  const before = useNav.getState().route;
  if (unit) {
    try {
      unitDone(unit.block, result);
    } catch (err) {
      logError('training:unitDone', err, `Block ${unit.block}`);
    }
  }
  if (useNav.getState().route === before) leaveBack();
}

// ------------------------------------------------------------------ Ergebnisse

/** Eintrag in `out/<Monat>` (idempotent über `id`; verdichtet, nie in ein ungültiges Dokument). */
export async function saveOut(item: OutItem): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(outPath(item.d), (cur) => upsertOut(cur, item));
    return true;
  } catch (err) {
    logError('training:out', err, item.id);
    return false;
  }
}

/** Arten im Tagesprotokoll (Präfix `nb-`, damit keine Auswertung sie mit Lesen/Hören verwechselt). */
export type NbLogType = `nb-${string}`;

export type NbAnswer = {
  type: NbLogType;
  ref: string;
  q: string;
  given: string;
  ans: string;
  ok: boolean;
  ms: number;
  day: string;
  lang: string;
  /** Teil der Tageseinheit (Pflicht) oder freiwillig (Extra). */
  duty: boolean;
  t: number;
  /** Gerät der Runde (`'t'` Touch, `'k'` Tastatur), einmal beim Start gelesen (§4.1, §8). */
  dev?: DevTag;
};

export type DevTag = 't' | 'k';

/** Das Eingabeprofil als Zeichen für das Tagesprotokoll; gilt für die ganze Runde. */
export const devOf = (): DevTag => (inputProfile() === 'touch' ? 't' : 'k');

/**
 * Antworten ins Tagesprotokoll über den gemeinsamen Puffer (`recordChannelEntries`). Das Format ist
 * das der Kanal-Einträge; nur `type` ist neu (`nb-*`, Schema `log` liest `type` tolerant als Text).
 * Freiwilliges Üben → `ctx:'xtra'` (zählt nie zur Pflicht, Kap. 15).
 */
export function logAnswers(rows: readonly NbAnswer[]): void {
  if (!rows.length) return;
  try {
    recordChannelEntries(
      rows.map((r) => {
        const base = channelLogEntry({ t: r.t, ok: r.ok, lang: r.lang, type: r.type, ref: r.ref, q: r.q, given: r.given, ans: r.ans, ms: r.ms, ctx: r.duty ? 'duty' : 'extra' });
        return { ...base, day: r.day, ...(r.dev ? { dev: r.dev } : {}) };
      }),
    );
  } catch (err) {
    logError('training:log', err, rows[0]?.type);
  }
}

/** Rundenzähler je Übung (reihum andere Aufgaben) – reine Bequemlichkeit, lokal. */
export function nextRound(set: string): number {
  const key = `lx:nb:round:${set}`;
  const n = Number(local.get(key)) || 0;
  local.set(key, String(n + 1));
  return n;
}

// ------------------------------------------------------------------ Fortsetzen (WP0b sichert, hier nur Herstellen im `ensure`)

/**
 * Stellt eine Momentaufnahme aus `lx:resume:<id>` her (gleicher Lerntag, gleiche Version).
 * SYNCHRON; schreibt nie in die db. `true` = hergestellt.
 */
export function restoreSaved<S>(r: Resumable<S>, day: string): boolean {
  const env = loadResume(r.id);
  if (!env || env.v !== r.version || env.day !== day) return false;
  try {
    return r.restore(env.data as S);
  } catch (err) {
    logError('training:restore', err, r.id);
    clearResume(r.id);
    return false;
  }
}

// ------------------------------------------------------------------ Oberfläche

/**
 * Übungsleiste: ✕ · Balken · Übersetzen/Claude; darunter der Beitrag des Players (P1: „Tageseinheit ·
 * Block 2 von 5“), sonst „Tageseinheit · Block n“ bzw. „Extra“. ✕ fragt nie nach (N02): Fortsetz-Stand
 * behalten, schließen, ruhig bestätigen.
 */
export function TrainingBar({ unit, progress, onClose }: { route?: Route; unit: UnitRun | null; progress: { n: number; total: number } | null; onClose?: () => void }) {
  const { t } = useT();
  const player = usePlayer();
  const note = player.note ?? (unit ? t('nbTrainingUnitNote', { n: unit.block }) : t('trExtraBadge'));
  const close = () => {
    const kept = holdResume();
    if (onClose) onClose();
    else leaveBack();
    if (kept) toast(t('nbShSaved'));
  };
  return (
    <ExerciseBar
      onClose={close}
      closeLabel={t('trClose')}
      progress={progress}
      progressLabel={progress ? `${progress.n} / ${progress.total}` : undefined}
      note={<span data-testid="training-note">{note}</span>}
      end={<ExerciseActions />}
    />
  );
}

/** Kopf einer Aufgabe: Statuszeile, Aufgabe in einer Zeile, Zweck hinter dem Info-Symbol (Kap. 2.4). */
export function TaskHead({ status, task, purpose }: { status: ReactNode; task: string; purpose: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <header className="flex flex-col gap-2">
      <p className="lx-tnum text-xs font-medium text-muted" data-testid="training-status">
        {status}
      </p>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl" data-testid="training-task">
          {task}
        </h2>
        <button
          type="button"
          className="-m-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
          aria-label={t('nbTrainingInfo')}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          data-testid="training-info"
        >
          <Icon name="info" size={18} />
        </button>
      </div>
      {open && (
        <p id={id} className="text-sm text-muted" data-testid="training-purpose">
          {purpose}
        </p>
      )}
    </header>
  );
}

/** Hinweis oder Zwischenstand während einer Aufgabe (Streifen + Symbol, nie nur Farbe). */
export function Note({ tone, children, testId, kind }: { tone: 'ok' | 'warn' | 'info'; children: ReactNode; testId?: string; kind?: string }) {
  const stripe = tone === 'ok' ? 'border-ok' : tone === 'warn' ? 'border-gold-text' : 'border-line';
  const icon = tone === 'ok' ? 'check' : tone === 'warn' ? 'lightbulb' : 'info';
  return (
    <div className={`flex items-start gap-2 border-l-2 ${stripe} py-1 pl-3 text-sm`} role="status" data-testid={testId ?? 'training-note-box'} data-kind={kind}>
      <Icon name={icon} size={16} className="mt-0.5 flex-none text-muted" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Zeitbalken (Einwand-Training, Nachsprechen). Läuft über `setInterval` mit gemessener Zeit;
 * steht `performance.now` still (Testuhr), zählt jeder Takt 100 ms. `onEnd` genau einmal.
 */
export function useCountdown(totalMs: number, running: boolean, onEnd: () => void, resetKey: string | number): number {
  const [state, setState] = useState<{ key: string; left: number }>({ key: '', left: totalMs });
  const end = useRef(onEnd);
  useEffect(() => {
    end.current = onEnd;
  }, [onEnd]);
  const key = `${resetKey}|${totalMs}|${running ? 1 : 0}`;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let rest = totalMs;
    let fired = false;
    const id = window.setInterval(() => {
      const now = performance.now();
      const d = now - last > 0 ? now - last : 100;
      last = now;
      rest = Math.max(0, rest - d);
      setState({ key, left: rest });
      if (rest <= 0 && !fired) {
        fired = true;
        window.clearInterval(id);
        end.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [totalMs, running, key]);
  // Neuer Lauf (anderer Schlüssel): wieder voll, ohne setState im Effekt.
  return state.key === key ? state.left : totalMs;
}

export function TimeBar({ left, total, label, testId }: { left: number; total: number; label: string; testId: string }) {
  const { t } = useT();
  const pct = total > 0 ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;
  const s = Math.ceil(left / 1000);
  return (
    <div className="flex flex-col gap-1" data-testid={testId} data-left={s}>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="lx-tnum">{t('nbTrainingSeconds', { s })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={Math.round(total / 1000)} aria-valuenow={s}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-100 ease-linear" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Fehlergrenze je Aufgabe

/** Fehlergrenze um die aktuelle Aufgabe: der WP0b-Baustein (`resetKey`, `scope`, `onSkip`). */
export { StepBoundary } from '../../app/shell/Boundary';
