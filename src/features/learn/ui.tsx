import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { leaveBack, useNav, type Route } from '../../app/nav';
import { useLive } from '../../data/live';
import { certainty } from '../../domain/grammar/bkt';
import type { Ctx, Verdict } from '../../domain/learn/types';
import type { DutyId } from '../../domain/plan/types';
import { dutyStep } from '../../domain/plan/pflicht';
import { CardStatus } from '../../engine/CardStatus';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { verdictHaptic } from '../../platform/haptics';
import { useSwipeLeft } from '../../engine/swipe';
import type { WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { Button, IconButton } from '../../ui/Button';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { ExerciseBar } from '../../ui/ExerciseBar';
import { ExerciseActions, TitleActions } from '../system/Chrome';
import { firstOpenDuty, useToday } from '../today/state';
import { startDuty } from './flow';

// Gemeinsame Bausteine der Phase-2-Bildschirme (CLAUDE.md A7 für alle Übungen): Statuszeile,
// Rundenkopf mit Planleiste (M11), Ergebnisbereich an fester Stelle mit Vergleich, Form-Hinweis,
// Beispielen, „Auch richtig", Einspruch (M4), „Einmal richtig schreiben" (M5) und „Weiter" mit
// „Automatisch weiter" (M6).

export const CERTAINTY_KEYS = ['certainty0', 'certainty1', 'certainty2', 'certainty3', 'certainty4', 'certainty5'] as const;

/** Statuszeile für Grammatik und Übungen: Sicherheit (5 Punkte + Wort) · Übungsart. */
export function LearnStatus({ p, n, recent, kind, kindId, extra }: { p: number | null; n?: number | null; recent?: readonly number[] | null; kind: string; kindId: string; extra?: string | null }) {
  const { t } = useT();
  const c = p === null ? null : certainty(p, { n: n ?? null, recent: recent ?? null });
  // Ohne Beherrschungswert (Übungen ohne eigene Karte): 0 Punkte mit dem Wort „neu", nie leer.
  const word = t(CERTAINTY_KEYS[c?.word ?? 0]);
  return (
    <CardStatus
      testId="status-line"
      dots={c?.dots ?? 0}
      level={c?.word ?? 0}
      word={word}
      label={t('confLabel', { level: word })}
      kind={kind}
      kindLabel={t('exKindLabel', { name: '' }).trim()}
      p={p ?? undefined}
      kindId={kindId}
      again={extra ?? null}
    />
  );
}

/**
 * Kopf eines Unterbildschirms (Kurs, Grammatik, Wortschatz …): Zurück zur Herkunft links,
 * rechts eigene Knöpfe und das Claude-Symbol (UX-Beratung Nr. 3/7). Reiter-Startseiten nutzen
 * `TabTitle` ohne Zurück-Pfeil.
 */
export function ScreenHeader({ eyebrow, title, lead, back, right }: { eyebrow?: string; title: string; lead?: ReactNode; back?: () => void; right?: ReactNode }) {
  const { t } = useT();
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {back && <IconButton icon="arrowLeft" label={t('lrBack')} onClick={back} data-testid="back" className="-ml-2" />}
          {eyebrow && <p className="lx-eyebrow">{eyebrow}</p>}
        </div>
        <TitleActions>{right}</TitleActions>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {lead && <div className="max-w-2xl text-base text-muted">{lead}</div>}
    </header>
  );
}

/** Kleines Wort unter dem Balken: „Pflicht · 2 von 3" (M11, Schritt laut `dutyStep`), sonst „Pflicht". */
export function DutyBar({ ctx, duty = null }: { ctx: Ctx | 'extra'; duty?: DutyId | null }) {
  const { t } = useT();
  const st = useToday();
  if (ctx !== 'duty') return null;
  if (st.duties.total < 2) return <span>{t('nvDuty')}</span>;
  const n = dutyStep(st.duties, duty);
  return (
    <span data-testid="duty-bar" data-n={n} data-total={st.duties.total}>
      {t('nvDutyStep', { n, total: st.duties.total })}
    </span>
  );
}

/**
 * Die eine Übungsleiste (UX-Beratung Nr. 4): ✕ · Fortschrittsbalken „3 / 8" · Claude-Symbol,
 * darunter „Pflicht" bzw. „Extra" als kleines Wort. Gilt für jede Vollbild-Übung.
 */
export function ExerciseTop({
  onClose,
  closeLabel,
  closeTestId,
  progress = null,
  progressTestId,
  ctx = null,
  duty = null,
}: {
  onClose: () => void;
  closeLabel?: string;
  closeTestId?: string;
  progress?: { n: number; total: number } | null;
  progressTestId?: string;
  ctx?: Ctx | 'extra' | null;
  duty?: DutyId | null;
}) {
  const { t } = useT();
  const note = ctx === 'duty' ? <DutyBar ctx="duty" duty={duty} /> : ctx ? t('trExtraBadge') : null;
  const has = !!progress && progress.total > 0;
  return (
    <ExerciseBar
      onClose={onClose}
      closeLabel={closeLabel ?? t('trClose')}
      closeTestId={closeTestId ?? 'round-close'}
      progress={progress}
      progressLabel={has ? t('nvProgress', { n: Math.max(1, Math.min(progress.total, progress.n)), total: progress.total }) : undefined}
      progressTestId={progressTestId ?? 'round-progress'}
      note={note}
      end={<ExerciseActions />}
    />
  );
}

/** Kopf einer Runde (Grammatik, Übungen, Wochen-Check): die gemeinsame Übungsleiste. */
export function RoundTop({ onClose, progress, ctx, closeLabel, duty = null }: { onClose: () => void; progress: { n: number; total: number } | null; ctx: Ctx | 'extra'; closeLabel?: string; duty?: DutyId | null }) {
  return <ExerciseTop onClose={onClose} progress={progress} ctx={ctx} duty={duty} {...(closeLabel ? { closeLabel } : {})} />;
}

/** Soll nach grün ohne Hilfe automatisch weitergehen? (`app/profile.autoNext`, Standard an wie in der alten App.) */
export function useAutoNextPref(): boolean {
  return useLive((s) => s.docs['app/profile']?.autoNext) !== false;
}

/**
 * „Weiter" mit optionalem Ablaufbalken (M6): nach etwa 1,2 s weiter. Ein Tippen oder eine
 * Taste irgendwo hält an. Reduzierte Bewegung: Balken ohne Animation (globale Regel).
 */
export function NextButton({ onNext, auto, label, testId = 'next' }: { onNext: () => void; auto: boolean; label?: string; testId?: string }) {
  const { t } = useT();
  const pref = useAutoNextPref();
  const [running, setRunning] = useState(auto && pref);
  const fired = useRef(false);
  const cb = useRef(onNext);
  useEffect(() => {
    cb.current = onNext;
  });
  useEffect(() => {
    if (!running) return;
    const stop = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.(`[data-testid="${testId}"]`)) return;
      setRunning(false);
    };
    const id = window.setTimeout(() => {
      if (fired.current) return;
      fired.current = true;
      cb.current();
    }, 1200);
    window.addEventListener('pointerdown', stop, true);
    window.addEventListener('keydown', stop, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', stop, true);
      window.removeEventListener('keydown', stop, true);
    };
  }, [running, testId]);
  const fire = () => {
    if (fired.current) return;
    fired.current = true;
    setRunning(false);
    cb.current();
  };
  // Am Handy: nach links wischen = „Weiter“ (Kap. 4.5); Knopf, Enter und Autoweiter bleiben.
  useSwipeLeft(fire, true);
  return (
    <Button
      variant="primary"
      iconAfter="arrowRight"
      onClick={fire}
      data-testid={testId}
      data-auto={running ? '' : undefined}
      className="overflow-hidden"
    >
      {label ?? t('trNext')}
      {running && <span className="lx-autonext" aria-hidden="true" data-testid="autonext" />}
    </Button>
  );
}

export const VERDICT_TONE: Record<Verdict, string> = { correct: 'text-accent-text', near: 'text-gold-text', wrong: 'text-danger-text' };

export function VerdictLine({ verdict, text }: { verdict: Verdict; text: string }) {
  // Kurze Vibration beim Erscheinen des Ergebnisses (Kap. 4.3), nur wo möglich und eingeschaltet;
  // doppelte Meldungen desselben Prüfens fängt platform/haptics ab.
  const first = useRef(verdict);
  useEffect(() => {
    verdictHaptic(first.current);
  }, []);
  return (
    <p className={`text-base font-semibold ${VERDICT_TONE[verdict]}`} data-testid="verdict" data-verdict={verdict} role="status">
      {text}
    </p>
  );
}

/** 2–3 Beispiele, jedes Wort antippbar. */
export function ExampleList({ items, area = 'trainer', source = null }: { items: readonly string[]; area?: WordTapArea; source?: string | null }) {
  const { t } = useT();
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5" data-testid="examples">
      <p className="lx-eyebrow">{t('trExamples')}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((x) => (
          <li key={x} className="text-[0.95rem] leading-relaxed" data-testid="example">
            <EnglishText as="span" text={x} area={area} source={source} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Eine Zeile Form-Hinweis in der Oberflächensprache. */
export function FormHint({ text }: { text: string }) {
  const { lang } = useT();
  if (!text) return null;
  return (
    <p className="text-sm" data-testid="form-hint" lang={lang}>
      {text}
    </p>
  );
}

/** „Auch richtig": weitere Lösungen und Hinweise des Regelwerks. */
export function AlsoRight({ answers, notes }: { answers: readonly string[]; notes: readonly string[] }) {
  const { t, lang } = useT();
  if (!answers.length && !notes.length) return null;
  return (
    <div className="flex flex-col gap-1" data-testid="also-right">
      <p className="lx-eyebrow">{t('grAlsoRight')}</p>
      {answers.length > 0 && (
        <p className="text-sm" lang="en">
          {answers.join(' · ')}
        </p>
      )}
      {notes.slice(0, 2).map((n) => (
        <p key={n} className="text-sm text-muted" lang={lang}>
          {n}
        </p>
      ))}
    </div>
  );
}

/** Einspruch „Ich lag richtig" (M4): nur bei rot und getippter Antwort. Korrigiert den Prüfer, keine Selbstbewertung. */
export function OverrideButton({ onOverride }: { onOverride: () => void }) {
  const { t } = useT();
  return (
    <Button variant="ghost" icon="check" onClick={onOverride} data-testid="override">
      {t('lrOverride')}
    </Button>
  );
}

/** „Einmal richtig schreiben" (M5): freiwillig, zählt nicht als Antwort und ändert keine Note. */
export function CopyOnce({ solution }: { solution: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const ok = value.trim().toLowerCase() === solution.trim().toLowerCase();
  if (!open)
    return (
      <Button variant="ghost" icon="plus" onClick={() => setOpen(true)} data-testid="copy-open">
        {t('lrCopyOpen')}
      </Button>
    );
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-muted">{t('lrCopyLabel')}</span>
      <input
        className="lx-field"
        lang="en"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        data-testid="copy-input"
        data-state={ok ? 'correct' : undefined}
        autoFocus
      />
      {ok && (
        <span className="text-sm text-accent-text" data-testid="copy-ok">
          {t('lrCopyOk')}
        </span>
      )}
    </label>
  );
}

/** Ergebnisbereich mit leichter Einblendung. */
export function ResultArea({ children, label }: { children: ReactNode; label: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      aria-label={label}
      className="flex flex-col gap-3 border-t border-line pt-4"
      data-testid="result"
    >
      {children}
    </motion.section>
  );
}

/** Aufgabe in einer Zeile + Info-Symbol mit dem Zweck (Kap. 2.4 in der Fassung von A7). */
export function TaskLine({ task, purpose }: { task: string; purpose: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl" data-testid="task-line">
          {task}
        </h2>
        <IconButton icon="info" label={t('trInfo')} aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="purpose-info" className="-m-2 flex-none" />
      </div>
      {open && (
        <p className="text-sm text-muted" data-testid="purpose">
          {purpose}
        </p>
      )}
    </div>
  );
}

const DUTY_LABEL: Record<string, MessageKey> = { review: 'tdReviewTitle', lesson: 'lrDutyLesson', 'ch:gram': 'drGram', 'ch:cloze': 'drCloze', 'ch:order': 'drOrder', 'ch:say': 'sayTitle' };

export function dutyLabel(id: DutyId, t: (k: MessageKey) => string): string {
  const k = DUTY_LABEL[id];
  return k ? t(k) : id;
}

/** Beschriftung des Rückwegs nach der Herkunft („Zurück zu Heute", „Zum Kurs" …). */
const ORIGIN_LABEL: Partial<Record<Route['name'], MessageKey>> = { today: 'sumBack', learn: 'lrBackToLearn', course: 'lsBackToCourse', overview: 'ckBack' };

/**
 * Primärknopf jeder Pflicht-Zusammenfassung (M11): „Weiter: {nächster offener Pflichtpunkt}",
 * sonst „Zurück zu Heute". Ein zweiter, ruhiger Knopf führt zurück.
 */
export function SummaryActions({ onBack, backLabel, backTo }: { onBack: () => void; backLabel?: string; backTo?: Route }) {
  const { t } = useT();
  const api = useHiddenInput();
  const st = useToday();
  const go = useNav((s) => s.go);
  const origin = useNav((s) => s.stack[s.stack.length - 1] ?? null);
  const next = st.ready ? firstOpenDuty(st) : null;
  const label = origin ? t(ORIGIN_LABEL[origin.name] ?? 'lrBack') : (backLabel ?? t('sumBack'));
  // UX-Beratung Nr. 3: zurück dorthin, woher man kam (`backTo` nur, wenn es keine Herkunft gibt).
  const back = () => {
    const hasOrigin = useNav.getState().stack.length > 0;
    if (!hasOrigin && backTo) {
      onBack();
      go(backTo);
      return;
    }
    leaveBack(onBack);
  };
  if (!next)
    return (
      <div>
        <Button variant="primary" size="lg" onClick={back} data-testid="summary-back">
          {label}
        </Button>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="primary"
        size="lg"
        iconAfter="arrowRight"
        onClick={() => {
          onBack();
          startDuty(next, api);
        }}
        data-testid="summary-next"
        data-duty={next}
      >
        {t('lrNextDuty', { step: dutyLabel(next, t) })}
      </Button>
      <Button variant="ghost" onClick={back} data-testid="summary-back">
        {label}
      </Button>
    </div>
  );
}
