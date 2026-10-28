import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { closeContext, contextPortalTarget, openContext, useContextPresentation } from '../../app/shell/contextColumn';
import { useLive } from '../../data/live';
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
import { BandSheet } from './Band';
import { inTextField, setBandMoreOpen, useBand } from './bandStore';

// Das eine Übungsgerüst (Lernplattform 2.0 §4.2). Es erzwingt Reihenfolge und Darstellung (`data-slot`):
// status · task · aid · prompt · answer · secondary · hint · verdict · comparison · explanation · examples · menu.
// Keine Übung baut Karte, Kopf, Urteil oder Erklärung selbst. Eine Glasebene je Übung; das Ergebnis ist ein
// Abschnitt DERSELBEN Karte (Linie oben), nie eine zweite Karte. Haptik, Ton und `role="status"` kommen
// nur aus `Verdict`.
//
// Relaunch Stufe 1 P3 S1-BAND (stufe1-plan §6.4): Ohne Split-Layout (Handy, Tablet) ist das Ergebnis ein BAND, fest über der
// Aktionsleiste (gleiche Fläche, ein Dock): Zeile 1–2 Urteil und Lösung („Was hatte ich, was ist richtig?“), Zeile 3 „Warum“
// (auch bei richtiger Antwort), darunter höchstens zwei Zweitknöpfe (Mehr + Handlung der Rückmeldung). Alles Weitere im Mehr-Blatt
// (≤ 85 % hoch). Das Band ist höchstens 45 % des Bildes hoch (samt Leiste), rollt nicht und verschwindet nie von selbst.
// Korrekturrunde P3 (Punkt 1): feste Reihenfolge im Band – (a) Urteilszeile mit „Wieder in …“ als ruhiger Zusatz, (b) EINE Lösungszeile
// („Du: … → Richtig: …“, bei Auswahl „Du: B · Richtig: C“), (c) Warum/Merke 2–3 Zeilen mit sichtbarem Auslaufen, (d) Knopfzeile, immer ganz
// sichtbar. Der Wortkopf (Bedeutung, Lautschrift, Vorlesen) steht im Mehr-Blatt. Läuft (b) oder (c) über (`data-clipped`), steht „Mehr“
// IMMER da, und das Blatt beginnt mit dem vollen Text.
// Am Laptop (Split) bleibt das Ergebnis in der Seitenspalte; „Mehr“ und ⓘ klappen IN dieser Spalte auf (Punkt 2: nur EINE Spalte neben der
// Bühne). Die Kontextspalte des Rahmens nutzt nur das Band (Tablet ab 1024 px mit Touch).
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
export type ShellSecondary = { id: 'hint' | 'dontKnow' | 'unclear' | 'noError' | 'skip' | 'replay' | 'reset' | 'noSound'; label: string; onClick: () => void; testId: string; disabled?: boolean; /** Standard `quiet` (leise Knopfform, U3); umrandeter Glasknopf für die Einführungskarte „Kenne ich“. */ variant?: 'quiet' | 'ghost' | 'secondary' };
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
  const state = deriveShellState(props);
  const keyRange = typeof choiceCount === 'number' ? choiceKeyRange(choiceCount) : null;
  const profileSplit = useSplitLayout();
  const split = layout === 'split' || (layout === 'auto' && profileSplit);
  const band = !split;
  const tablet = useMediaQuery('(min-width: 768px)');
  const fine = useMediaQuery('(pointer: fine)');
  const presentation = useContextPresentation();
  const [info, setInfo] = useState(false);
  const sideRef = useRef<HTMLElement>(null);
  const [reason, setReason] = useState<{ text: string; code: string } | null>(null);
  const infoId = useId();
  // Ab 1024 px mit Kontextspalte des Rahmens steht „Wozu?“ in der Spalte statt über der Aufgabe (Hauptsitzung 28.10.2026, Vorschau L2/L3);
  // ohne Spalte (Handy, Tablet, Rahmen ohne `#lx-context`) klappt es wie bisher über der Aufgabe auf.
  const [infoCtx, setInfoCtx] = useState(false);
  const purposeBody = (r: { text: string; code: string } | null): ReactNode => (
    <p className="lx-t-support m-0 text-muted" data-testid="purpose">
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
  const [ctxMore, setCtxMore] = useState(false);
  // Korrekturrunde P3 (Punkt 1d): „Erklär mir meine Antwort“ steht nie im Band, sondern im Mehr-Blatt – im Band höchstens „Mehr“ und
  // EINE Handlung der Rückmeldung (Wörter „War das auch richtig?“, Grammatik „Claude fragen“ & Co.).

  const resultKey = feedback ? `${meta.id}:${feedback.verdict}:${feedback.title ?? ''}:${feedback.sub ?? ''}` : `${meta.id}:answering`;
  const auto = feedback
    ? shouldAutoAdvance({
        verdict: feedback.verdict,
        hintLevel: feedback.auto ? 0 : 1,
        depth: feedback.depth,
        autoNextPref: autoPref as boolean | null | undefined,
        menuOpen: menuOpen || topMenuOpen,
        foldOpen: moreOpen || keysOpen || ctxMore,
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
  // Laptop: „Weniger“, Esc oder ✕ klappen „Mehr“ zu – das Urteil steht danach wieder im Bild (Punkt 2).
  const wasMore = useRef(false);
  useEffect(() => {
    if (split && wasMore.current && !moreOpen) {
      document.querySelector<HTMLElement>('[data-testid="result"] [data-slot="verdict"]')?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    }
    wasMore.current = moreOpen;
  }, [moreOpen, split]);
  useEffect(() => () => void closeContext('more'), [resultKey]);

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

  // Band: Höhe messen → `--lx-band-h` und `html[data-band]` (die Seite bekommt Polster, die Leiste dieselbe Fläche wie das Band).
  const resultRef = useRef<HTMLElement>(null);
  const taskRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const hasResult = feedback !== null;
  const verdictNow = feedback?.verdict ?? null;
  useLayoutEffect(() => {
    if (!band || !verdictNow) return;
    const root = document.documentElement;
    const el = resultRef.current;
    if (!el) return;
    root.setAttribute('data-band', verdictNow);
    const set = (): void => {
      // Steht das Band im Fluss (Querformat, `max-height: 500px`), braucht die Seite kein Polster.
      const fixed = getComputedStyle(el).position === 'fixed';
      root.style.setProperty('--lx-band-h', `${fixed ? Math.ceil(el.getBoundingClientRect().height) : 0}px`);
    };
    set();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.removeAttribute('data-band');
      root.style.removeProperty('--lx-band-h');
    };
  }, [band, verdictNow, resultKey]);
  // Am Handy steht das Band über dem unteren Teil der Übung: liegt die eigene Antwort dahinter, rückt die Seite so weit hoch,
  // dass sie über dem Band steht – aber nie über die Statuszeile hinaus (UX-Prüfung W8, Korrekturrunde P3 Punkt 14: Status und ⓘ bleiben sichtbar).
  useEffect(() => {
    if (!hasResult || !band) return;
    const id = window.requestAnimationFrame(() => {
      const res = resultRef.current;
      const ans = answerRef.current;
      const tk = statusRef.current;
      if (!res || !ans || !tk || getComputedStyle(res).position !== 'fixed') return;
      const top = res.getBoundingClientRect().top;
      const need = ans.getBoundingClientRect().bottom + 8 - top;
      const room = tk.getBoundingClientRect().top - 8;
      const by = Math.min(need, room);
      if (by > 0) window.scrollBy({ top: by, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [hasResult, resultKey, band]);

  // Band (Punkt 1): Läuft die Lösungszeile oder das Warum über, steht `data-clipped` am Band und „Mehr“ immer da; das Blatt beginnt dann
  // mit dem vollen Text. Gemessen nach dem Zeichnen und bei jeder Größenänderung (Drehen, Schrift).
  const whyBoxRef = useRef<HTMLDivElement>(null);
  const solRef = useRef<HTMLDivElement>(null);
  const [clip, setClip] = useState<{ why: boolean; sol: boolean }>({ why: false, sol: false });
  useLayoutEffect(() => {
    if (!band || !verdictNow) return;
    const over = (el: HTMLElement | null): boolean => !!el && el.scrollHeight > el.clientHeight + 1;
    const measure = (): void => {
      const next = { why: over(whyBoxRef.current), sol: over(solRef.current) };
      setClip((c) => (c.why === next.why && c.sol === next.sol ? c : next));
    };
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    for (const el of [whyBoxRef.current, solRef.current, resultRef.current]) if (el) ro?.observe(el);
    return () => ro?.disconnect();
  }, [band, verdictNow, resultKey]);
  const clipped = band && (clip.why || clip.sol);

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
  const asideSecondary = tablet && secondaryNode;

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
  const nextNotes = feedback ? (
    <>
      {feedback.nextIn && (
        <p className="lx-t-meta mt-1 text-muted" data-testid="next-in">
          {feedback.nextIn}
        </p>
      )}
      {feedback.stageNote && (
        <p className="lx-t-meta mt-1 text-muted" data-testid="stage-hold">
          {feedback.stageNote}
        </p>
      )}
    </>
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
  if (feedback && band) {
    // Band (Punkt 1): (a) Urteilszeile mit „Wieder in …“ · (b) Lösungszeile · (c) EIN Warum bzw. Merke, 2–3 Zeilen · (d) Knöpfe.
    // Zeile (c) ist EIN Warum (Konzept 12.1: „Warum = Merke, höchstens 120 Zeichen“); weitere Begründungen stehen im Mehr-Blatt.
    // Ausnahme: eine kurze Status-Zeile (`note`, z. B. „Zählt nicht als Fehler …“ bei „Auch richtig“) bleibt im Band – sie sagt, was die Antwort zählt.
    const inBand = (it: ResultPlan['why'][number], i: number): boolean => i === 0 || (it.t === 'text' && it.k === 'note');
    // Ohne eigenes Warum steht das erste Merke-Stück im Band (Konzept 12.1: „Warum = Merke“) – die dritte Frage hat immer ihren Platz.
    const bandRemember = plan.why.length === 0 && !feedback.why ? plan.remember.slice(0, 1) : [];
    // Gibt es weder Warum noch Merke, trägt der (antippbare) Beispielsatz die Zeile.
    const bandExample = plan.why.length === 0 && !feedback.why && plan.remember.length === 0 ? plan.example : null;
    const whyOnly: ResultPlan = { why: plan.why.filter(inBand), remember: bandRemember, more: [], example: bandExample };
    const rememberOnly: ResultPlan = { why: plan.why.filter((it, i) => !inBand(it, i)), remember: plan.remember.slice(bandRemember.length), more: [], example: bandExample ? null : plan.example };
    const hasSol = !!(feedback.right || comparisonNode || choiceNode);
    // Das Mehr-Blatt: zuerst, was im Band abgeschnitten ist (Lösung, volles Warum), dann Wortkopf, Stufen-Zeile, Merke, Weiteres, Tutor.
    const sheetBody = (
      <div className="flex flex-col gap-4">
        {clip.sol && hasSol && (
          <div className="flex flex-col gap-2" data-slot="sheet-solution">
            {feedback.right}
            {cmp && <Comparison given={cmp.given} ops={cmp.ops} compact={!!cmp.compact} {...(cmp.label ? { label: cmp.label } : {})} {...(cmp.correct ? { correct: cmp.correct } : {})} hideCorrect={!!cmp.hideCorrect} />}
            {choiceNode}
          </div>
        )}
        {clip.why && <ResultBlocks plan={whyOnly} area="trainer" ai={!!feedback.explanation?.ai} depth={feedback.depth} testId="sheet-why" {...whyBefore} />}
        {feedback.head && <div data-slot="head">{feedback.head}</div>}
        {feedback.stageNote && (
          <p className="lx-t-meta m-0 text-muted" data-testid="stage-hold">
            {feedback.stageNote}
          </p>
        )}
        <ResultBlocks plan={rememberOnly} area="trainer" depth={feedback.depth} testId="explanation-remember" whyTitle={t('bandWhyMore')} />
        {foldContent}
        {feedback.tutor && <div data-slot="tutor">{feedback.tutor}</div>}
      </div>
    );
    const sheetHas = !!(clipped || feedback.head || feedback.stageNote || feedback.tutor || rememberOnly.why.length > 0 || rememberOnly.remember.length || rememberOnly.example || hasMore);
    result = (
      <section key={resultKey} ref={resultRef} className="lx-band" data-testid="result" aria-label={t('exExplanationLabel')} data-verdict={feedback.verdict} data-band="" data-clipped={clipped ? '' : undefined}>
        <div className="lx-band-inner">
          <div data-block="verdict" className="lx-band-verdict">
            <div data-slot="verdict" className="lx-band-vline">
              <div className="min-w-0 flex-1">
                {verdictNode}
                {feedback.parts}
              </div>
              {feedback.nextIn && (
                <span className="lx-t-meta lx-band-next text-muted" data-testid="next-in">
                  {feedback.nextIn}
                </span>
              )}
              {taskMenu && <div className="-my-2 -mr-2 flex-none">{taskMenu}</div>}
            </div>
            {hasSol && (
              <div ref={solRef} className="lx-band-sol" data-slot="solution" data-clipped={clip.sol ? '' : undefined}>
                {feedback.right && <div data-slot="right">{feedback.right}</div>}
                {comparisonNode}
                {choiceNode}
              </div>
            )}
          </div>
          <div ref={whyBoxRef} className="lx-band-why" data-clipped={clip.why ? '' : undefined}>
            <ResultBlocks plan={whyOnly} area="trainer" ai={!!feedback.explanation?.ai} {...blocksSource} depth={feedback.depth} {...whyBefore} />
          </div>
          {(sheetHas || feedback.act) && (
            <div className="lx-band-btns" data-slot="more">
              {sheetHas && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    // Tablet ab 1024 px mit Kontextspalte (Rahmen P2): „Mehr“ steht in der Spalte statt im Blatt (Hauptsitzung 28.10.2026).
                    if (presentation === 'column' && contextPortalTarget()) {
                      if (ctxMore) {
                        closeContext('more');
                        return;
                      }
                      setCtxMore(true);
                      openContext({ kind: 'more', title: t('bandMoreTitle'), node: sheetBody, onClose: () => setCtxMore(false) });
                      return;
                    }
                    setBandMoreOpen(true);
                  }}
                  data-testid="explanation-more"
                  aria-haspopup={presentation === 'column' ? undefined : 'dialog'}
                  aria-expanded={moreOpen || ctxMore}
                >
                  {t('bandMore')}
                </Button>
              )}
              {feedback.act && <div data-slot="act">{feedback.act}</div>}
            </div>
          )}
        </div>
        <BandSheet
          open={moreOpen}
          onClose={() => setBandMoreOpen(false)}
          title={t('bandMoreTitle')}
          next={{
            label: primary.label,
            onClick: () => {
              setBandMoreOpen(false);
              fire();
            },
          }}
        >
          {sheetBody}
        </BandSheet>
      </section>
    );
  } else if (feedback) {
    // Laptop (Split): die ganze Rückmeldung in der Seitenspalte. „Mehr“ klappt IN dieser Spalte auf (Vorschau desk.js `dMoreBody`):
    // nur EINE Spalte neben der Bühne, die Bühne bleibt breit (Punkt 2). Offen-Zustand im Band-Speicher, damit Esc ihn schließt.
    const moreId = `${infoId}-more`;
    result = (
      <section key={resultKey} ref={resultRef} className="lx-card lx-result relative flex scroll-mt-4 flex-col gap-4 overflow-hidden p-4" data-testid="result" aria-label={t('exExplanationLabel')} data-verdict={feedback.verdict}>
        <div data-block="verdict" className="flex flex-col gap-4">
          <div data-slot="verdict" className="lx-result-head -mx-4 -mt-4 scroll-mt-4 px-4 py-4 pr-14">
            {verdictNode}
            {feedback.parts}
            {nextNotes}
          </div>
          {feedback.head && <div data-slot="head">{feedback.head}</div>}
          {feedback.right && <div data-slot="right">{feedback.right}</div>}
          {comparisonNode}
        </div>
        <ResultBlocks plan={plan} area="trainer" ai={!!feedback.explanation?.ai} {...blocksSource} depth={feedback.depth} {...whyBefore} />
        {(feedback.act || feedback.tutor) && (
          <div className="flex flex-col gap-2" data-block="act">
            {feedback.act && <div data-slot="act">{feedback.act}</div>}
            {feedback.tutor && <div data-slot="tutor">{feedback.tutor}</div>}
          </div>
        )}
        {hasMore && (
          <div data-slot="more" className="-mx-4 -mb-2 border-t border-line px-4">
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
        )}
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
      {/* UX-Prüfung W1: Kopf in EINER Zeile („●●○○ Lernt · Lücke“) mit ⓘ rechts; dahinter Zweck und Thema. */}
      <div ref={statusRef} data-slot="status" className="flex scroll-mt-2 items-center justify-between gap-3">
        <ExerciseStatus {...status} />
        {!status.noInfo && !task.open && (
          <button
            type="button"
            className="-my-2 -mr-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
            aria-label={t('exInfo')}
            aria-expanded={info || infoCtx}
            aria-controls={info ? infoId : undefined}
            onClick={() => showWhy(true)}
            data-testid="purpose-info"
          >
            <Icon name="info" size={18} />
          </button>
        )}
      </div>
      <div ref={taskRef} data-slot="task" className="flex scroll-mt-4 flex-col gap-1">
        {task.open && (
          // UX-Prüfung WL2 K1: offener Zweck mit etwas Abstand zum Titel.
          <p className="lx-t-meta m-0 pb-1.5 text-muted" data-testid="purpose" data-open="">
            {task.purpose}
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
        <h2 className="lx-t-task" data-testid="task">
          {task.text}
        </h2>
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
        <div data-slot="hint" className="lx-hintband" data-state={state === 'retry' ? 'retry' : undefined}>
          <Icon name="lightbulb" size={18} aria-hidden="true" className="lx-hintband-icon" />
          <HintLine text={hint.text} tone={hint.tone} />
        </div>
      )}
      {errorNode}
      {!split && result}
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
          {/* Hinweis je Art: nur wo Optionen stehen, nennt er „1–4 / A–D wählen“ (Auswahl per CSS `:has`, dz2.css). */}
          {keysText ?? (
            <>
              <span className="dz-kh-choice">{keyRange ? t('exKeysHintN', keyRange) : t('exKeysHint')}</span>
              <span className="dz-kh-typed">{t('exKeysHintTyped')}</span>
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
      <div className="lx-split" data-split={split || undefined}>
        <div data-col="main" className="flex min-w-0 flex-col gap-4">
          {main}
          {split && bar}
          {split && keysLine}
        </div>
        {split && (
          <aside ref={sideRef} data-col="side" className="flex min-w-0 scroll-mt-4 flex-col gap-4" aria-label={t('exSideLabel')}>
            {info && !task.open && (
              <div id={infoId} className="lx-inset" data-slot="info">
                {purposeBody(reason)}
              </div>
            )}
            {feedback ? result : (side ?? <p className="lx-t-support lx-inset text-muted" data-testid="side-placeholder">{sideNote ?? t('exSidePlaceholder')}</p>)}
          </aside>
        )}
      </div>
      {!split && keysLine}
      {!split && bar}
    </article>
  );
}
