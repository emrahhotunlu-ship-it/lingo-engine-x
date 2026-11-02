import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { closeContext, contextPortalTarget, openContext, useContextPresentation } from '../../app/shell/contextColumn';
import { useAiAvailable } from '../../ai/scope';
import { useLive } from '../../data/live';
import { useCompanionSee, type Seeing } from '../../features/companion/seeing';
import { openCompanion, useCompanion } from '../../features/companion/store';
import { useSharedTarget } from '../../engine/shared';
import type { ExplainDepth, ExplainLine, ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import type { WordOp } from '../../domain/learn/types';
import type { UnitState } from '../../domain/metrics';
import { useT } from '../../i18n';
import { useMediaQuery, useSplitLayout } from '../../platform/input';
import { ActionBar, PrimaryAction } from '../ActionBar';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Skeleton } from '../Skeleton';
import { Comparison } from './Comparison';
import { ExerciseMenu } from './ExerciseMenu';
import { ExerciseStatus } from './ExerciseStatus';
import { Examples } from './Examples';
import { MoreItems, ResultBlocks } from './ResultBlocks';
import { planResult, type ResultPlan } from './resultPlan';
import { HintLine } from './HintLine';
import { shouldAutoAdvance } from './autoAdvance';
import { choiceKeyRange } from '../../engine/choiceKeys';
import { useAutoAdvance } from './useAutoAdvance';
import { Verdict } from './Verdict';
import { ClaudeAskBox } from './ClaudeAskBox';
import { TodayMini } from './TodayMini';
import { inTextField, setBandMoreOpen, useBand } from './bandStore';

// Das eine Übungsgerüst (Lernplattform 2.0 §4.2). Es erzwingt Reihenfolge und Darstellung (`data-slot`):
// status · task · aid · prompt · answer · secondary · hint · verdict · comparison · explanation · examples · menu.
// Keine Übung baut Karte, Kopf, Urteil oder Erklärung selbst. Eine Glasebene je Übung; das Ergebnis ist ein
// Abschnitt DERSELBEN Karte (Linie oben), nie eine zweite Karte. Haptik, Ton und `role="status"` kommen
// nur aus `Verdict`.
//
// UX-Neuanfang B (02.11.2026, Vorschau `5Zwv5noCiNwzrzzfQsfzXy`, Emrah „Passt, so einbauen“): Die Rückmeldung steht IMMER ganz im Fluss
// unter der Aufgabe – Urteil, Lösung, Warum, Merke und „Erklär mir meine Antwort“ offen, ohne „Mehr“-Knopf zum Lesen; nur Zusätzliches
// (Typischer Fehler, Beispiele, „Zum Wort“) klappt unter „Mehr“ auf. Am Handy trägt die feste Leiste unten nur „Weiter“ (früher: Band).
// Am Laptop (Split) ist die Übung Vollbild (ohne Seitenleiste, `Shell.tsx`); rechts steht die Spalte „Erklärung“ (nach dem Prüfen: Warum,
// Merke, Mehr) bzw. „Wozu?“/„Regel“ (davor) und darunter immer „Frag Claude“ mit Schnellfragen und eigener Frage. Dockt der Begleiter an,
// wird er selbst die rechte Spalte, und die Erklärung rückt in die Mitte (nie zwei Spalten, nie eine gequetschte Bühne).
// Tasten: T = Tipp, W = „Weiß ich nicht“ (nie in einem Textfeld); Esc und „?“ regelt die Übungsebene (`Band.tsx`).

export type ExerciseArea = 'words' | 'grammar';
export type ShellStatus = {
  area: ExerciseArea;
  /** `null` = keine Punkte (nie ein falsches „Neu“). */
  state: UnitState | null;
  kindLabel: string;
  /** Wörter: der Beleg hinter dem Zustandswort („frei abgerufen an 1 von 3 Tagen · zuletzt falsch am 12. Okt.“), aus `features/vocab/statusText.ts`. */
  detail?: string | null;
  topic?: string | null;
  pattern?: string | null;
  badge?: string | null;
  /** Farbe des Zusatzes: `near` (Bernstein, Standard: „deine Fehler“, „noch einmal“) oder `hint` (Cyan, neutral, z. B. „Themen-Test“). */
  badgeTone?: 'near' | 'hint' | 'neutral';
  /** Kennung der Plakette (Standard `again-badge`). */
  badgeTestId?: string;
  /** Ohne Hilfe (Themen-Test, Vortest, Messung): kein ⓘ mit Zweck und Muster – die Aufgabe selbst nennt den Hinweis. */
  noInfo?: boolean;
};
export type ShellAction = { /** Pfeil auch ohne Ergebnis (z. B. „Weiter“ mitten in der Aufgabe). */ arrow?: boolean; label: string; onClick: () => void; testId: string; disabled?: boolean; busy?: boolean; busyLabel?: string };
export type ShellSecondary = { id: 'hint' | 'dontKnow' | 'unclear' | 'noError' | 'skip' | 'replay' | 'reset' | 'noSound' | 'phone'; label: string; onClick: () => void; testId: string; disabled?: boolean; /** Standard `quiet` (leise Knopfform, U3); umrandeter Glasknopf für die Einführungskarte „Kenne ich“. */ variant?: 'quiet' | 'ghost' | 'secondary' };
export type ShellMenuId = 'override' | 'copyOnce' | 'showMe' | 'translate' | 'moreInfo' | 'askClaude' | 'wholeTopic' | 'report';
export type ShellFeedback = {
  verdict: ResultVerdict;
  /** Eigene Überschrift statt des Urteilsworts (Fehler finden: „Richtig erkannt“ / „Nicht ganz“, Rückmeldung 7). Ton und Zeichen bleiben beim Urteil. */
  title?: string | null;
  sub?: string | null;
  /** Zusätzlich unter „Mehr“ (z. B. 'pattern') bzw. immer offen (z. B. 'contrast'); `unfold` gewinnt. */
  fold?: ReadonlyArray<ExplainLine['k']>;
  unfold?: ReadonlyArray<ExplainLine['k']>;
  /** `bandOnly`: nur im Band (Handy) – am Laptop zeigen Lücke und Optionen die Lösung schon. */
  comparison?: { given: string; ops: WordOp[]; compact?: boolean; label?: string; correct?: string; hideCorrect?: boolean; bandOnly?: boolean } | null;
  /** Auswahl (Punkt 1b, LS6): Lösungszeile „Du: B · Richtig: C …“ im Band. `you` = Buchstabe der Wahl (`null` = nichts gewählt). */
  choice?: { you: string | null; right: string; text?: string } | null;
  /** Mit Hilfe geschafft (Hinweisrunde, Anfangsbuchstaben): die Combo wächst nicht (Punkt 9). */
  helped?: boolean;
  explanation?: ExplanationModel | null;
  depth: ExplainDepth;
  menu?: Partial<Record<ShellMenuId, () => void>>;
  /** KI-Tutor: sichtbarer Knopf „Erklär mir meine Antwort“ unter der Erklär-Karte (nur auf Tipp). */
  tutor?: ReactNode;
  /** Teilpunkte (c1x, `PartBar`): steht im Platz `verdict` unter dem Urteil. */
  parts?: ReactNode;
  /** Zusatz unter der Erklär-Karte (c1x: „Warum nicht …?“ je Option): steht im Platz `explanation`. */
  after?: ReactNode;
  /** „Richtig: …“ als erste Inhaltszeile der Karte (c1x: kwt-Lösung, err-Korrektur), UX-Prüfung W2. */
  right?: ReactNode;
  /** Warum zur Form direkt unter „Deine Antwort / Richtig“ (Wörter: „overcame = Vergangenheit von overcome“), UX-Prüfung W8. */
  why?: ReactNode;
  /** Kopf der Rückmeldung (Wörter: Wort, Vorlesen, Lautschrift, „Zum Wort“): steht direkt unter dem Urteil, vor der Erklärung (Design-Lead). */
  head?: ReactNode;
  /** Fuß der Rückmeldung (Wörter: „Zum Wort“), ganz unten in der Ergebnis-Karte. */
  foot?: ReactNode;
  /**
   * Handlung der Rückmeldung (Tutor-Engine: „Claude fragen“, „Als richtig werten“, Zielform, „Sicher?“): steht ÜBER „Mehr“, direkt unter dem
   * sichtbaren Inhalt – nie ganz unten, wo sie am Handy unter dem Weiter-Balken verschwindet (UX-Prüfung 19.10.2026).
   */
  act?: ReactNode;
  /** Zeilen nach dem Warum (Wörter: Wortpartner, „Kommt wieder“): im Band unter dem Warum, am Laptop unter der Erklärung; nie abgeschnitten. */
  tail?: ReactNode;
  nextIn?: string | null;
  /** Warum die Stufe noch nicht steigt (Wörter: so viele freie Antworten an anderen Tagen fehlen noch), eigene ruhige Zeile unter „Wieder in …“. */
  stageNote?: string | null;
  /**
   * Die Übung meldet: keine Hilfe genutzt. Zusammen mit Urteil `ok`, Tiefe `min` und `app/profile.autoNext`
   * ≠ false (`shouldAutoAdvance`) läuft dann der 4-s-Zeitgeber; ein Menü oder Aufklappbereich hält ihn an.
   */
  auto?: boolean;
  /** „Mehr“ aufklappen (Menü „Mehr Infos“ der Wörter: der Inhalt von „Zum Wort“ steht dort). */
  moreOpen?: boolean;
};
export type ShellState = 'loading' | 'answering' | 'busy' | 'retry' | 'result' | 'aiError';
export type ExerciseShellProps = {
  meta: { ex: string; id: string; stage?: number; kind?: string };
  status: ShellStatus;
  /** `open`: das Wozu steht immer als ruhige Zeile über der Aufgabe (Aktivierung), nicht hinter dem ⓘ (Kap. 2.4: an fester Stelle). */
  task: {
    text: string;
    purpose: string;
    open?: boolean;
    /**
     * „Warum diese Aufgabe?“ (Tutor-Engine): der Grund steht im ⓘ unter dem Zweck – EIN Warum-Zugang an fester Stelle, ohne Sprung nach dem
     * Prüfen (UX-Prüfung 19.10.2026). Wird erst beim Öffnen gerechnet, nie beim Zeichnen.
     */
    reason?: (() => { text: string; code: string } | null) | null;
  };
  aid?: ReactNode | null;
  prompt: ReactNode;
  answer: ReactNode;
  hint?: { text: string; tone: 'hint' | 'near' } | null;
  secondary?: ShellSecondary[];
  primary: ShellAction;
  barOverride?: ReactNode;
  feedback?: ShellFeedback | null;
  side?: ReactNode | null;
  /** Was Claude gerade sieht (Begleiter, „Claude erklärt“) – für Übungen, die es nicht selbst anmelden (Wörter-App). Vor dem Prüfen ohne Lösung. */
  see?: Seeing | null;
  /** Text der ruhigen Seitenkarte am Laptop vor dem Prüfen (Standard: „Die Regel kommt nach dem Prüfen“ – passt nur, wo es eine Regel gibt; UX-Prüfung S9). */
  sideNote?: string;
  layout?: 'auto' | 'stack' | 'split';
  /** Hülle nur um Vorlage und Antwort (Anki: die wischbare Karte, UX-Prüfung W6 – Kopf und Aufgabe bleiben beim Wischen stehen). */
  wrapCard?: (card: ReactNode) => ReactNode;
  /** Tastaturhinweis am Laptop je Übungsart (UX-Prüfung W5/W9): eigener Text, `null` = keiner; sonst nach Art (Auswahl oder Tippen). */
  keysHint?: string | null;
  /** Zahl der Optionen einer Auswahl: der Standardhinweis nennt dann genau so viele Tasten („A–B oder 1–2“) statt immer „A–D oder 1–4“. */
  choiceCount?: number;
  /** Skelett in Kartengröße statt Inhalt (nie ein Leerbild). */
  loading?: boolean;
  /** Optional: `retry` (Hinweis mit Leitfrage, Eingabe bleibt) und `aiError`; sonst aus `feedback`/`primary.busy` abgeleitet. */
  state?: ShellState;
};

export function deriveShellState(p: Pick<ExerciseShellProps, 'loading' | 'state' | 'feedback' | 'primary'>): ShellState {
  if (p.loading) return 'loading';
  if (p.state === 'aiError' || p.state === 'retry') return p.state;
  if (p.feedback) return 'result';
  if (p.primary.busy) return 'busy';
  return p.state ?? 'answering';
}

export function ExerciseShell(props: ExerciseShellProps) {
  const { meta, status, task, aid = null, prompt, answer, hint = null, secondary = [], primary, barOverride, feedback = null, side = null, sideNote, layout = 'auto', keysHint, choiceCount, wrapCard } = props;
  const { t } = useT();
  const ai = useAiAvailable();
  useCompanionSee(props.see ?? null);
  const state = deriveShellState(props);
  const keyRange = typeof choiceCount === 'number' ? choiceKeyRange(choiceCount) : null;
  const profileSplit = useSplitLayout();
  const split = layout === 'split' || (layout === 'auto' && profileSplit);
  const band = !split;
  const tablet = useMediaQuery('(min-width: 768px)');
  const fine = useMediaQuery('(pointer: fine)');
  const presentation = useContextPresentation();
  // Angedockter Begleiter (ab 1024 px, `ContextHost`): er ist dann die rechte Spalte; die Übung zeigt ihre eigene Spalte nicht.
  const docked = useCompanion((s) => s.open && s.winMode === 'float' && !s.minimized) && presentation === 'column';
  const sideCol = split && !docked;
  const [info, setInfo] = useState(false);
  const sideRef = useRef<HTMLElement>(null);
  const [reason, setReason] = useState<{ text: string; code: string } | null>(null);
  const infoId = useId();
  // Ab 1024 px mit Kontextspalte des Rahmens steht „Wozu?“ in der Spalte statt über der Aufgabe (Hauptsitzung 28.10.2026, Vorschau L2/L3);
  // ohne Spalte (Handy, Tablet, Rahmen ohne `#lx-context`) klappt es wie bisher über der Aufgabe auf.
  const [infoCtx, setInfoCtx] = useState(false);
  const purposeBody = (r: { text: string; code: string } | null, testId = 'purpose'): ReactNode => (
    <p className="lx-t-support m-0 text-muted" data-testid={testId}>
      {[status.topic, status.pattern].filter(Boolean).length > 0 && <span className="block text-fg">{[status.topic, status.pattern].filter(Boolean).join(' · ')}</span>}
      {status.state && status.detail && (
        <span className="block" data-testid="status-detail">
          {status.detail}
        </span>
      )}
      {!r && task.purpose}
      {r && (
        <span className="block" data-testid="why-line" data-code={r.code}>
          {r.text}
        </span>
      )}
    </p>
  );
  /** „Wozu?“ öffnen (`toggle`: ⓘ schließt es auch wieder; der Menüpunkt öffnet nur). */
  const showWhy = (toggle: boolean): void => {
    // Laptop (Split): das Wozu klappt oben in der Seitenspalte auf – nie eine zweite Spalte (Punkt 2).
    if (!split && presentation === 'column' && contextPortalTarget()) {
      if (toggle && closeContext('explain')) return;
      const r = task.reason ? task.reason() : null;
      openContext({ kind: 'explain', title: t('exInfo'), node: purposeBody(r), onClose: () => setInfoCtx(false) });
      setInfoCtx(true);
      return;
    }
    if (toggle && info) {
      setInfo(false);
      return;
    }
    if (task.reason) setReason(task.reason());
    setInfo(true);
    if (!toggle) window.requestAnimationFrame(() => (split ? sideRef.current : taskRef.current)?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' }));
  };
  // D3 (Prüfung learning-scientist): am Laptop steht in der Spalte gleich der Grund für genau diese Aufgabe, nicht nur der allgemeine Zweck.
  const taskReason = task.reason;
  const sideReason = useMemo(() => (split && taskReason ? taskReason() : null), [split, taskReason]);
  const showWhyRef = useRef(showWhy);
  useEffect(() => {
    showWhyRef.current = showWhy;
  });
  useEffect(() => () => void closeContext('explain'), [meta.id]);
  const [menuOpen, setMenuOpen] = useState(false);
  // Kap. 4.4: Die Heldenkarte von Heute gleitet in die erste Übung (nur direkt nach dem Start; Grammatik und Drills nehmen sie vorher selbst).
  const { ref: sharedRef, shared } = useSharedTarget<HTMLElement>('lx-hero');
  const autoPref = useLive((s) => s.docs['app/profile']?.autoNext);
  const topMenuOpen = useBand((s) => s.menuOpen);
  const moreOpen = useBand((s) => s.moreOpen);
  const keysOpen = useBand((s) => s.keysOpen);
  const hosts = useBand((s) => s.hosts);
  // „Claude erklärt“ (UX-Neuanfang 02.11.2026): in jeder Übung vor und nach dem Prüfen sichtbar. Vor dem Prüfen sieht Claude die Aufgabe ohne
  // Lösung (Begleiter-Kontext `question`), danach mit Lösung und eigener Antwort. Ohne KI unsichtbar; in Tests ohne Hilfe (Themen-Test, Vortest,
  // Einstufung) erst nach dem Prüfen, damit die Messung gilt. Am Handy (Band mit Übungsleiste) steht er oben rechts in der Leiste, sonst in der Aufgabenzeile.
  const claudeQuestion = ai && (!status.noInfo || !!feedback) ? t(feedback ? 'vuClaudeAskAfter' : 'vuClaudeAskBefore', { task: task.text }) : null;
  const claudeAsk = useMemo(() => (claudeQuestion ? () => openCompanion({ tab: 'chat', send: claudeQuestion }) : null), [claudeQuestion]);
  const claudeInBar = band && hosts > 0;
  useEffect(() => {
    if (!band) return;
    useBand.setState({ explain: claudeAsk });
    return () => {
      if (useBand.getState().explain === claudeAsk) useBand.setState({ explain: null });
    };
  }, [band, claudeAsk]);
  // Strg+E (Vorschau-Tastenzeile): „Claude erklärt“ – auch im Textfeld, weil es eine Steuerungstaste ist.
  useEffect(() => {
    if (!claudeAsk) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.shiftKey || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'e') return;
      e.preventDefault();
      claudeAsk();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [claudeAsk]);

  const resultKey = feedback ? `${meta.id}:${feedback.verdict}:${feedback.title ?? ''}:${feedback.sub ?? ''}` : `${meta.id}:answering`;
  const auto = feedback
    ? shouldAutoAdvance({
        verdict: feedback.verdict,
        hintLevel: feedback.auto ? 0 : 1,
        depth: feedback.depth,
        autoNextPref: autoPref as boolean | null | undefined,
        menuOpen: menuOpen || topMenuOpen,
        foldOpen: moreOpen || keysOpen,
      })
    : false;
  const { running, fire } = useAutoAdvance({ active: auto, onNext: primary.onClick, nextTestId: primary.testId, resetKey: resultKey });

  // Übungsebene: ein Gerüst steht (Esc-Schutz und „?“ in `ExerciseKeys`).
  useEffect(() => {
    useBand.setState((s) => ({ shells: s.shells + 1 }));
    return () => useBand.setState((s) => ({ shells: Math.max(0, s.shells - 1), moreOpen: false, items: {}, why: null }));
  }, []);
  // Menü „…“ oben in der Leiste: Punkte der Aufgabe und „Warum diese Aufgabe?“ (öffnet die Zweckzeile unter dem Status).
  const menuItems = feedback?.menu;
  useEffect(() => {
    useBand.setState({ items: menuItems ?? {} });
  }, [menuItems]);
  const taskRefLive = useRef(task);
  useEffect(() => {
    taskRefLive.current = task;
  });
  const hasWhy = !status.noInfo;
  useEffect(() => {
    if (!hasWhy) return;
    useBand.setState({
      why: () => showWhyRef.current(false),
    });
    return () => useBand.setState({ why: null });
  }, [hasWhy]);
  // Neues Ergebnis: das Mehr-Blatt ist zu; „Mehr Infos“ aus dem Menü öffnet es (bzw. „Mehr“ in der Seitenspalte).
  useEffect(() => {
    setBandMoreOpen(false);
  }, [resultKey]);
  const moreSignal = !!feedback?.moreOpen;
  useEffect(() => {
    if (moreSignal) setBandMoreOpen(true);
  }, [moreSignal]);
  // „Weniger“, Esc oder ✕ klappen „Mehr“ zu – das Urteil steht danach wieder im Bild (Punkt 2).
  const wasMore = useRef(false);
  useEffect(() => {
    if (wasMore.current && !moreOpen) {
      const v = document.querySelector<HTMLElement>('[data-testid="result"] [data-slot="verdict"]');
      v?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
      // C: nie hinter der festen Übungsleiste – liegt das Urteil darunter, rollt die Seite um den Rest (Leistenunterkante + 16 px).
      const barBottom = document.querySelector<HTMLElement>('[data-testid="exercise-bar"]')?.getBoundingClientRect().bottom ?? 0;
      const top = v?.getBoundingClientRect().top;
      if (top !== undefined && top < barBottom + 8) window.scrollBy({ top: top - barBottom - 16, behavior: 'auto' });
    }
    wasMore.current = moreOpen;
  }, [moreOpen]);

  // T = Tipp, W = „Weiß ich nicht“ (Vorschau desk.js). Nie in einem Textfeld, nie unter einem Dialog, nur vor dem Prüfen.
  const secRef = useRef(secondary);
  useEffect(() => {
    secRef.current = secondary;
  });
  const answering = !feedback && state !== 'loading';
  useEffect(() => {
    if (!answering) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k !== 't' && k !== 'w') return;
      if (inTextField(e.target) || document.querySelector('[role="dialog"]')) return;
      const s = secRef.current.find((x) => x.id === (k === 't' ? 'hint' : 'dontKnow'));
      if (!s || s.disabled) return;
      e.preventDefault();
      s.onClick();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answering]);

  // Das Ergebnis messen: nur die Verweise für das Einrollen (UX-Neuanfang B: kein Band mehr).
  const resultRef = useRef<HTMLElement>(null);
  const taskRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const hasResult = feedback !== null;
  // Neues Ergebnis: das Urteil rückt ins Bild – über die feste Leiste unten (Handy) bzw. den Bildrand, nie hinter die Übungsleiste oben;
  // höchstens so weit, dass die Statuszeile oben stehen bleibt (Aufgabe und eigene Antwort bleiben sichtbar, UX-Prüfung W8).
  useEffect(() => {
    if (!hasResult) return;
    const id = window.requestAnimationFrame(() => {
      const el = resultRef.current;
      if (!el) return;
      const topBar = document.querySelector<HTMLElement>('[data-testid="exercise-bar"]')?.getBoundingClientRect().bottom ?? 0;
      const fixedBar = band ? document.querySelector<HTMLElement>('.lx-actionbar')?.getBoundingClientRect().top : undefined;
      const bottom = Math.min(window.innerHeight, fixedBar ?? window.innerHeight);
      const r = el.getBoundingClientRect();
      const head = el.querySelector<HTMLElement>('[data-block="verdict"]')?.getBoundingClientRect().bottom ?? r.top + 120;
      // Ziel: Urteil und Lösung ganz sichtbar, gern auch das Warum (bis 160 px darunter).
      const need = Math.min(r.bottom, head + 160) + 12 - bottom;
      const stTop = statusRef.current?.getBoundingClientRect().top ?? r.top;
      const room = stTop - topBar - 8;
      const by = Math.min(need, room);
      if (by > 0) window.scrollBy({ top: by, behavior: 'auto' });
      else if (r.top < topBar + 8) window.scrollBy({ top: r.top - topBar - 16, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [hasResult, resultKey, band]);

  // Hauptknopf in der Bereichsfarbe (Design LP2): Wörter violett, Grammatik blau; nur solange die Übung steht.
  const area = status.area;
  useEffect(() => {
    const root = document.documentElement;
    if (area) root.setAttribute('data-lx-area', area);
    return () => root.removeAttribute('data-lx-area');
  }, [area]);

  if (state === 'loading') {
    return (
      <article className="lx-glass lx-exercise flex flex-col gap-4" data-testid="exercise" data-area={status.area} data-state="loading" aria-busy="true" aria-label={t('exLoading')} data-ex={meta.ex} data-card={meta.id}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-14 w-full" />
      </article>
    );
  }

  const learning = status.state === 'new' || status.state === 'learning' || status.state === 'wobbly';
  const showSecondary = secondary.slice(0, 2);
  const KBD: Partial<Record<ShellSecondary['id'], string>> = { hint: 'T', dontKnow: 'W' };
  const secondaryNode =
    showSecondary.length > 0 && !feedback ? (
      <div className="flex flex-wrap items-center gap-2" data-slot="secondary" role="group" aria-label={t('exSecondaryLabel')}>
        {showSecondary.map((s) => (
          <Button key={s.id} variant={s.variant ?? 'quiet'} onClick={s.onClick} disabled={s.disabled} data-testid={s.testId} data-secondary={s.id} data-kbd={KBD[s.id]} aria-keyshortcuts={KBD[s.id]}>
            {s.label}
          </Button>
        ))}
      </div>
    ) : null;
  // D3 V-UEBUNG (Vorschau `ex-foot abovekb`, desk.js `dKeys`): Tipp und „Weiß ich nicht“ stehen immer in der Knopfzeile neben „Prüfen“ –
  // am Handy über der Tastatur, am Laptop in der Tastenzeile unter der Bühne. Nie mehr als eigene Pillenreihe im Inhalt.
  const asideSecondary = secondaryNode;
  void tablet;

  // Bauplan der Ergebnis-Karte (UX-Audit U3, 27.10.2026) – für alle Übungsarten gleich, höchstens drei Blöcke in fester Reihenfolge:
  // 1. Urteil + Lösung (Urteil, Kopf, „Richtig: …“, Vergleich) · 2. „Warum“ · 3. „Merke“. Alles Weitere hinter EINEM „Mehr“
  // (Typischer Fehler, Nicht verwechseln, Hinweise, „Warum nicht …?“, Beispiele, „Zum Wort“). Handlungen (`act`, Tutor) stehen über „Mehr“.
  // R5: Im Kontrast-Schritt („Welches Wort passt?“) IST „Nicht verwechseln“ der Inhalt – die Zeile steht dort offen, nie unter „Mehr“.
  const contrastStep = meta.ex === 'contrast';
  // Rückmeldung 7: Eine Übung kann Zeilen zusätzlich einklappen (`feedback.fold`, z. B. die Muster-Fachsprache bei „Fehler finden“) oder öffnen (`feedback.unfold`, das Kontrastbeispiel).
  const unfoldExtra = feedback?.unfold ?? [];
  const FOLD: ReadonlyArray<ExplainLine['k']> = [...(contrastStep ? ['mistake', 'note'] : ['mistake', 'contrast', 'note']), ...(feedback?.fold ?? [])].filter(
    (k): k is ExplainLine['k'] => !unfoldExtra.includes(k as ExplainLine['k']),
  );
  const UNFOLD: ReadonlyArray<ExplainLine['k']> | undefined = contrastStep || unfoldExtra.length ? [...(contrastStep ? (['contrast'] as const) : []), ...unfoldExtra] : undefined;
  const plan: ResultPlan = feedback?.explanation ? planResult(feedback.explanation, feedback.depth, { learning, fold: FOLD, unfold: UNFOLD }) : { why: [], remember: [], more: [], example: null };
  // Der offene Beispielsatz (Merke-Block) steht nicht noch einmal unter „Mehr“.
  const examples = (feedback?.explanation?.examples ?? []).slice(plan.example ? 1 : 0);
  const hasMore = !!feedback && (plan.more.length > 0 || examples.length > 0 || !!feedback.after || !!feedback.foot);
  const blocksSource = feedback?.explanation ? { source: feedback.explanation.source } : {};
  const whyBefore = feedback?.why ? { before: <div data-slot="why">{feedback.why}</div> } : {};
  const verdictNode = feedback ? <Verdict verdict={feedback.verdict} sub={feedback.sub ?? null} title={feedback.title ?? null} help={!!feedback.helped} /> : null;
  // Im Band ersetzt die Auswahl-Zeile („Du: B · Richtig: C“) den Wortvergleich – EINE Lösungszeile (Punkt 1b).
  const cmp = feedback?.comparison && (band ? !feedback.choice : !feedback.comparison.bandOnly) ? feedback.comparison : null;
  const comparisonNode = cmp ? (
    <div data-slot="comparison">
      <Comparison given={cmp.given} ops={cmp.ops} compact={!!cmp.compact} {...(cmp.label ? { label: cmp.label } : {})} {...(cmp.correct ? { correct: cmp.correct } : {})} hideCorrect={!!cmp.hideCorrect} inline={band} />
    </div>
  ) : null;
  // Auswahl (LS6): „Du: B · Richtig: C …“ – nur im Band; am Laptop stehen Wahl und Lösung mit ✕/✓ an den Optionen.
  const choiceNode =
    band && feedback?.choice ? (
      <p className="lx-t-support m-0" data-testid="band-choice">
        {feedback.choice.you && (
          <>
            <span className="text-muted">{t('bandYou')}: </span>
            <span className="font-semibold">{feedback.choice.you}</span>
            <span aria-hidden="true" className="text-muted">
              {' · '}
            </span>
          </>
        )}
        <span className="text-muted">{t('exCmpExpected')}: </span>
        <span className="font-semibold">{feedback.choice.right}</span>
        {feedback.choice.text && (
          <>
            {' '}
            <span lang="en" className="font-semibold">
              {feedback.choice.text}
            </span>
          </>
        )}
      </p>
    ) : null;
  const taskMenu = feedback?.menu && Object.keys(feedback.menu).length > 0 && hosts === 0 ? <ExerciseMenu items={feedback.menu} onOpenChange={setMenuOpen} /> : null;
  // Inhalt hinter „Mehr“ (Seitenspalte: Aufklappbereich bzw. Kontextspalte).
  const foldContent = feedback ? (
    <div className="flex flex-col gap-4 pb-2">
      <MoreItems items={plan.more} />
      {feedback.after && <div data-slot="after">{feedback.after}</div>}
      {examples.length > 0 && (
        <div data-slot="examples">
          <Examples items={examples} open={examples.length} />
        </div>
      )}
      {feedback.foot && <div data-slot="foot">{feedback.foot}</div>}
    </div>
  ) : null;

  let result: ReactNode = null;
  // UX-Neuanfang B: EINE Rückmeldung im Fluss (Handy und Laptop). Am Laptop mit eigener Spalte stehen Warum, Merke, Tutor und „Mehr“ rechts
  // in „Erklärung“ (Vorschau `.aside`); sonst (Handy, angedockter Begleiter) hier unter dem Urteil.
  const moreId = `${infoId}-more`;
  const explainNode = feedback ? <ResultBlocks plan={plan} area="trainer" ai={!!feedback.explanation?.ai} {...blocksSource} depth={feedback.depth} {...whyBefore} /> : null;
  const moreNode =
    feedback && hasMore ? (
      <div data-slot="more" className="lx-vu-dmore">
        <button
          type="button"
          className="lx-t-support -mx-1 flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-inline)] px-1 font-semibold text-muted hover:text-fg"
          aria-expanded={moreOpen}
          aria-controls={moreId}
          data-testid="explanation-more"
          onClick={() => setBandMoreOpen(!moreOpen)}
        >
          <span>{moreOpen ? t('exLess') : t('exMore')}</span>
          <span aria-hidden="true" className="inline-block transition-transform" style={{ transform: moreOpen ? 'rotate(90deg)' : undefined }}>
            ▸
          </span>
        </button>
        <div id={moreId} hidden={!moreOpen} data-testid="more-body">
          {moreOpen ? foldContent : null}
        </div>
      </div>
    ) : null;
  const tutorNode = feedback?.tutor ? <div data-slot="tutor">{feedback.tutor}</div> : null;
  if (feedback) {
    result = (
      <section
        key={resultKey}
        ref={resultRef}
        className="lx-vu-dverdict lx-result relative flex scroll-mt-4 flex-col gap-3"
        data-testid="result"
        aria-label={t('exExplanationLabel')}
        data-verdict={feedback.verdict}
        data-flow={band ? '' : undefined}
      >
        <div data-block="verdict" className="flex flex-col gap-3">
          <div data-slot="verdict" className={`lx-result-head${taskMenu ? ' pr-12' : ''}`}>
            {/* „Wieder in …“ rechts neben dem Urteil (Nachprüfung P3, G). */}
            <div className="lx-band-vline">
              <div className="min-w-0 flex-1">
                {verdictNode}
                {feedback.parts}
              </div>
              {feedback.nextIn && (
                <span className="lx-t-meta lx-band-next text-muted" data-testid="next-in">
                  {feedback.nextIn}
                </span>
              )}
            </div>
            {feedback.stageNote && (
              <p className="lx-t-meta mt-1 text-muted" data-testid="stage-hold">
                {feedback.stageNote}
              </p>
            )}
          </div>
          {feedback.head && <div data-slot="head">{feedback.head}</div>}
          {feedback.right && <div data-slot="right">{feedback.right}</div>}
          {comparisonNode}
          {choiceNode}
        </div>
        {!sideCol && explainNode}
        {feedback.tail && (
          <div className="flex flex-col gap-1.5" data-slot="tail">
            {feedback.tail}
          </div>
        )}
        {(feedback.act || (tutorNode && !sideCol)) && (
          <div className="flex flex-col gap-2" data-block="act">
            {feedback.act && <div data-slot="act">{feedback.act}</div>}
            {!sideCol && tutorNode}
          </div>
        )}
        {!sideCol && moreNode}
        {/* Handy: „Frag Claude“ steht offen unter der Rückmeldung (Emrah 02.11.2026: Hilfe muss sichtbar sein, ohne erst zu suchen). */}
        {band && claudeQuestion && <ClaudeAskBox task={task.text} after input={false} testId="claude-ask-inline" />}
        {taskMenu && <div className="absolute right-1 top-2">{taskMenu}</div>}
      </section>
    );
  }

  const errorNode =
    state === 'aiError' ? (
      <p className="lx-t-support rounded-[var(--radius-control)] bg-surface p-3 text-muted" role="alert" data-testid="ai-error" data-slot="hint">
        {t('exAiError')}
      </p>
    ) : null;

  const main = (
    <>
      {/* D3 V-UEBUNG: Blockzeile (Vorschau `blockline`); „Wozu?“ steht rechts neben der Aufgabe (Vorschau `instr`). */}
      <div ref={statusRef} data-slot="status" className="flex scroll-mt-2 items-center gap-3">
        <ExerciseStatus {...status} />
      </div>
      <div ref={taskRef} data-slot="task" className="flex scroll-mt-4 flex-col gap-1">
        {task.open && (
          // UX-Prüfung WL2 K1: offener Zweck mit etwas Abstand zum Titel.
          <p className="lx-t-meta m-0 pb-1.5 text-muted" data-testid="purpose" data-open="">
            {task.purpose}
            {/* Offener Zweck: „Warum diese Aufgabe?“ (Menü „…“) hängt den Grund für genau diese Karte an, statt ins Leere zu laufen. */}
            {info && reason && (
              <span className="mt-0.5 block text-fg" data-testid="why-line" data-code={reason.code}>
                {reason.text}
              </span>
            )}
            {status.state && status.detail && (
              <span className="mt-0.5 block text-subtle" data-testid="status-detail">
                {status.detail}
              </span>
            )}
          </p>
        )}
        {info && !task.open && !split && (
          <p id={infoId} className="lx-t-support m-0 text-muted" data-testid="purpose">
            {[status.topic, status.pattern].filter(Boolean).length > 0 && (
              <span className="block text-fg">{[status.topic, status.pattern].filter(Boolean).join(' · ')}</span>
            )}
            {status.state && status.detail && (
              <span className="block" data-testid="status-detail">
                {status.detail}
              </span>
            )}
            {/* Nachprüfung N3: am Handy höchstens drei Zeilen – gibt es einen Grund für genau diese Aufgabe, ersetzt er den allgemeinen Zweck. */}
            {!reason && task.purpose}
            {reason && (
              <span className="block" data-testid="why-line" data-code={reason.code}>
                {reason.text}
              </span>
            )}
          </p>
        )}
        <div className="lx-vu-instr">
          <h2 className="lx-vu-task" data-testid="task">
            {task.text}
          </h2>
          {claudeAsk && !claudeInBar && <ClaudeExplain onClick={claudeAsk} />}
          {!status.noInfo && !task.open && (
            <button
              type="button"
              className="lx-vu-why"
              aria-expanded={info || infoCtx}
              aria-controls={info ? infoId : undefined}
              onClick={() => showWhy(true)}
              data-testid="purpose-info"
            >
              <span className="lx-vu-why-face">
                {t('vuWhy')}
              </span>
            </button>
          )}
        </div>
      </div>
      {aid && <div data-slot="aid">{aid}</div>}
      {(wrapCard ?? ((c: ReactNode) => c))(
        <>
          <div data-slot="prompt" className="lx-t-prompt">
            {prompt}
          </div>
          <div ref={answerRef} data-slot="answer">
            {answer}
          </div>
        </>,
      )}
      {!asideSecondary && secondaryNode}
      {hint && state !== 'aiError' && (
        // Tipp-Runde (Vorschau `hintband`): EINE ruhige Zeile mit Glühbirne, nie Rot.
        <div data-slot="hint" className="lx-hintband" data-state={state === 'retry' ? 'retry' : undefined} data-tone={hint.tone}>
          <Icon name="lightbulb" size={18} aria-hidden="true" className="lx-hintband-icon" />
          <HintLine text={hint.text} tone={hint.tone} />
        </div>
      )}
      {errorNode}
      {result}
    </>
  );

  const bar = (
    <ActionBar stateKey={feedback ? 'next' : 'main'} placement={split ? 'column' : 'fixed'} aside={asideSecondary || undefined}>
      {barOverride ?? (
        <PrimaryAction
          onClick={feedback ? fire : primary.onClick}
          disabled={primary.disabled}
          busy={primary.busy}
          busyLabel={primary.busyLabel}
          iconAfter={feedback || primary.arrow ? 'arrowRight' : undefined}
          testId={primary.testId}
          data-auto={running ? '' : undefined}
          data-kbd="⏎"
          className="overflow-hidden"
        >
          {primary.label}
          {running && <span className="lx-autonext" aria-hidden="true" data-testid="autonext" />}
        </PrimaryAction>
      )}
    </ActionBar>
  );

  // Tastenzeile (Punkt 3): ohne „? Regel“; T nur vor dem Prüfen, danach „Enter geht weiter“; „? alle Kürzel“ öffnet die Übersicht.
  const keysText = keysHint ?? (feedback ? t('exKeysHintNext') : null);
  const keysLine =
    fine && keysHint !== null && (split || keysHint) ? (
      <div className="lx-keys-line flex items-center justify-between gap-3" data-testid="keys-line">
        <p className="lx-t-meta m-0 text-subtle" data-testid="keys-hint">
          {/* Hinweis je Art: nur wo Optionen stehen, nennt er „1–4 / A–D wählen“ (Auswahl per CSS `:has`, v-uebung.css). */}
          {keysText ?? (
            <>
              <span className="lx-vu-kh-choice">{keyRange ? t('exKeysHintN', keyRange) : t('exKeysHint')}</span>
              <span className="lx-vu-kh-typed">{t('exKeysHintTyped')}</span>
            </>
          )}
        </p>
        <button type="button" className="lx-keys-open lx-t-meta" aria-keyshortcuts="?" data-testid="keys-open" onClick={() => useBand.setState((s) => ({ keysOpen: !s.keysOpen }))}>
          {t('bandKeysAll')}
        </button>
      </div>
    ) : null;

  return (
    <article
      ref={sharedRef}
      className="lx-glass lx-exercise flex flex-col gap-4 outline-none"
      tabIndex={-1}
      data-shared={shared ? '' : undefined}
      data-testid="exercise"
      data-area={status.area}
      data-state={state}
      data-ex={meta.ex}
      data-card={meta.id}
      data-stage={meta.stage}
      data-kind={meta.kind}
    >
      <div className="lx-split" data-split={split || undefined} data-noside={split && !sideCol ? '' : undefined}>
        <div data-col="main" className="flex min-w-0 flex-col gap-4">
          {main}
          {split && bar}
          {split && keysLine}
        </div>
        {sideCol && (
          // UX-Neuanfang B (Vorschau `.aside`): rechts „Erklärung“ (nach dem Prüfen) bzw. „Wozu?“/„Regel“ (davor), darunter immer „Frag Claude“.
          <aside ref={sideRef} data-col="side" className="lx-vu-side flex min-w-0 scroll-mt-4 flex-col" aria-label={t('exSideLabel')}>
            {feedback && (explainNode || tutorNode || moreNode) && (
              <section className="lx-vu-ctx" data-testid="side-explain">
                <h3 className="lx-vu-ctx-h">{t('vuExplain')}</h3>
                {explainNode}
                {tutorNode}
                {moreNode}
              </section>
            )}
            {info && !task.open && (
              <section id={infoId} className="lx-vu-ctx" data-slot="info">
                <h3 className="lx-vu-ctx-h">{t('vuSideWhy')}</h3>
                {purposeBody(reason)}
              </section>
            )}
            {side ? (
              <section className="lx-vu-ctx" data-testid="ex-rule">
                <h3 className="lx-vu-ctx-h">{t('vuSideRule')}</h3>
                {side}
              </section>
            ) : (
              !feedback &&
              !info &&
              !status.noInfo &&
              !task.open && (
                <section className="lx-vu-ctx" data-testid="side-placeholder">
                  <h3 className="lx-vu-ctx-h">{t('vuSideWhy')}</h3>
                  {task.purpose || sideReason ? purposeBody(sideReason, 'side-purpose') : <p className="lx-t-support m-0 text-muted">{sideNote ?? t('exSidePlaceholder')}</p>}
                </section>
              )
            )}
            {claudeQuestion && <ClaudeAskBox task={task.text} after={!!feedback} />}
            {!claudeQuestion && <TodayMini />}
          </aside>
        )}
      </div>
      {!split && keysLine}
      {!split && bar}
    </article>
  );
}

/** „Claude erklärt“: ruhige, beschriftete Knopfform wie „Wozu?“, mit Funken; Trefferfläche 44 px. Auch in der Übungsleiste (`ExerciseActions`). */
export function ClaudeExplain({ onClick, testId = 'claude-explain' }: { onClick: () => void; testId?: string }) {
  const { t } = useT();
  return (
    <button type="button" className="lx-vu-why lx-vu-claude" onClick={onClick} data-testid={testId} data-ai="">
      <span className="lx-vu-why-face">
        <Icon name="sparkle" size={14} />
        {t('vuClaude')}
      </span>
    </button>
  );
}
