import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  dictLookup,
  EnglishText,
  ExerciseShell,
  GradeButtons,
  KineticGap,
  lookupOpenMs,
  maskOf,
  playGapTone,
  primeGapTone,
  speak,
  stopSpeech,
  useHiddenInput,
  useHotkeys,
  useSpeech,
  useClock,
  useT,
  type GapState,
  type MessageKey,
  type ShellFeedback,
  type ShellSecondary,
  toast,
} from '../sharedUi';
import { addDays, dayKey } from '../shared';
import type { Band, Line, Next, Why } from '../domain/band';
import { tipOf } from '../domain/card';
import type { CardModel } from '../domain/flow';
import type { Reason } from '../domain/reason';
import type { Grade } from '../domain/types';
import type { FlipWhen, LearnRun, LearnView } from './learnRun';

// Wörter-Modul V3 Schritt 2b-2: eine Lernkarte und ihr Band (v3-bau.md §1–§3, Bilder s1-*). Die Karte rechnet nichts selbst: Prüfen, Wahl und
// Weiter gehen an die Steuerung (`learnRun.ts`). Feste Reihenfolge im Band: Urteil · Lösungszeile · Warum · Wortpartner · Kommt wieder · Knöpfe.

type CardView = Extract<LearnView, { k: 'card' }>;
type BandView = Extract<LearnView, { k: 'band' }>;
type T = ReturnType<typeof useT>['t'];

const TONE: Record<Band['tone'], ShellFeedback['verdict']> = { ok: 'ok', almost: 'near', no: 'wrong', info: 'dontKnow' };
const GAP: Record<Band['tone'], GapState> = { ok: 'correct', almost: 'near', no: 'wrong', info: 'wrong' };

/** Satz mit der (ersten) Lücke als Platz für das Eingabefeld; eine zweite Lücke (getrenntes Phrasal Verb) steht als Strich. */
function gapText(card: CardModel): { text: string; start: number; end: number } | null {
  const s = card.sentence;
  if (!s) return null;
  let text = '';
  let start = -1;
  let end = -1;
  for (const seg of s.gap.segs) {
    if (seg.t === 'gap' && start < 0) {
      start = text.length;
      text += seg.s;
      end = text.length;
    } else text += seg.t === 'gap' ? '_____' : seg.s;
  }
  return start < 0 ? null : { text, start, end };
}

/** Ganzer Satz mit markierter Stelle (Bedeutung abfragen, Band). */
function fullText(card: CardModel): { text: string; start: number; end: number } | null {
  const s = card.sentence;
  if (!s) return null;
  let text = '';
  let start = -1;
  let end = -1;
  for (const seg of s.gap.segs) {
    if (seg.t === 'gap' && start < 0) start = text.length;
    text += seg.s;
    if (seg.t === 'gap') end = text.length;
  }
  return start < 0 ? null : { text, start, end };
}

/** „Satz vor dem Prüfen anhören“: die Teile zwischen den Lücken; jede Lücke wird beim Abspielen ein kurzer Ton. */
function gapParts(card: CardModel): string[] | null {
  const s = card.sentence;
  if (!s) return null;
  const out = [''];
  for (const seg of s.gap.segs) {
    if (seg.t === 'gap') out.push('');
    else out[out.length - 1] += seg.s;
  }
  return out.length > 1 ? out : null;
}

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Satz vorlesen (S6b-3, Bild s2-13). `parts` mit mehr als einem Teil: zwischen den Teilen ein kurzer Ton statt des Lösungsworts. Ohne Stimme kein Knopf. */
/** `onSpent`: Vorlesezeit in ms; sie zählt nicht als Antwortzeit (learning-scientist S6b-3 Befund 2). */
function ListenButton({ parts, testId, onSpent }: { parts: readonly string[]; testId: string; onSpent?: (ms: number) => void }) {
  const { t } = useT();
  const status = useSpeech((x) => x.status);
  const run = useRef(0);
  const mine = useRef(false);
  useEffect(
    () => () => {
      run.current += 1;
      if (mine.current) stopSpeech();
    },
    [],
  );
  if (status === 'unsupported' || status === 'novoice' || parts.every((p) => !p.trim())) return null;
  const play = async () => {
    primeGapTone();
    const id = ++run.current;
    mine.current = true;
    const start = performance.now();
    try {
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          playGapTone();
          await wait(450);
          if (run.current !== id) return;
        }
        const p = (parts[i] ?? '').trim();
        if (!p) continue;
        const r = await speak(p);
        if (r !== 'done' || run.current !== id) break;
      }
    } finally {
      onSpent?.(performance.now() - start);
      if (run.current === id) mine.current = false;
    }
  };
  return (
    <div>
      <Button variant="quiet" icon="speaker" onClick={() => void play()} data-testid={testId} data-parts={parts.length}>
        {t('vmListen')}
      </Button>
    </div>
  );
}

function whenText(t: T, w: FlipWhen, today: string): string | undefined {
  if (w.k === 'soon') return t('vmIvlSoon');
  if (w.k === 'none') return undefined;
  if (w.day <= today) return t('vmIvlToday');
  if (w.day === addDays(today, 1)) return t('vmIvlTomorrow');
  const n = Math.round((Date.parse(`${w.day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  return t('vmIvlDays', { n: String(n) });
}

function partnersNode(t: T, partners: Band['partners']): ReactNode {
  if (!partners.length) return null;
  return (
    <p className="lx-t-support text-muted" data-testid="vm-partners">
      <span className="text-subtle">{t('vmPartners')}: </span>
      {partners.map((p, i) => (
        <span key={p.p}>
          {i > 0 ? ' · ' : ''}
          <span lang="en">{p.p}</span>
          {p.de ? (
            <span className="text-subtle" lang="de">
              {' '}
              ({p.de})
            </span>
          ) : null}
        </span>
      ))}
    </p>
  );
}

function taskKey(v: CardView | BandView): MessageKey {
  if (v.card.mode === 'flip') return 'vmTask_flip';
  if (v.kind === 'intro') return 'vmTask_intro';
  if (v.kind === 'probe') return 'vmTask_probe';
  if (v.card.form === 'contrast') return 'vmTask_contrast';
  return v.card.mode === 'meaning' ? 'vmTask_meaning' : v.card.mode === 'nosent' ? 'vmTask_nosent' : v.card.firstLetters ? 'vmTask_gap_hint' : 'vmTask_gap';
}
const wozuKey = (k: MessageKey): MessageKey => k.replace('vmTask_', 'vmWozu_') as MessageKey;

function kindLabel(t: T, v: CardView | BandView): string {
  if (v.kind === 'intro') return t('vmKindNew');
  if (v.kind === 'probe') return t('vmKindProbe');
  if (v.card.form === 'contrast') return t(v.card.contrast?.ff ? 'vmKindContrastFf' : 'vmKindContrast');
  return t(v.task.planned ? 'vmKindReview' : 'vmKindPractice');
}

export function LearnCard({ view, run }: { view: CardView | BandView; run: LearnRun }) {
  // Je Karte frisch (Lücke, Messung); das Band behält die Eingabe der Karte.
  const key = `${view.task.path}|${view.kind}|${view.n}`;
  return <CardInner key={key} view={view} run={run} />;
}

function CardInner({ view, run }: { view: CardView | BandView; run: LearnRun }) {
  const { t, lang, dateShort } = useT();
  const api = useHiddenInput();
  const today = useClock((s) => s.today);
  const card = view.card;
  const band = view.k === 'band' ? view : null;
  const typed = useRef('');
  const shownAt = useRef(0);
  const lookupAtStart = useRef(0);
  const firstKeyAt = useRef<number | null>(null);
  const firstKeyLookup = useRef(0);
  const listenMs = useRef(0);
  const firstKeyListen = useRef(0);
  const [hasInput, setHasInput] = useState(false);
  useEffect(() => {
    shownAt.current = performance.now();
    lookupAtStart.current = lookupOpenMs();
  }, []);
  // Jede neue Karte ist sofort tippbereit (UX-Neuanfang 02.11.2026): der Cursor steht in der Lücke, auf jedem Gerät. Am Handy hält „Weiter“
  // die Tastatur offen (das Feld bleibt dasselbe und wird im Tipp selbst fokussiert); ohne Lücke (Anki-Karte) ruht das Feld. Einmal je Karte.
  const focused = useRef(false);
  const flipCard = card.mode === 'flip';
  useEffect(() => {
    if (focused.current) return;
    focused.current = true;
    if (flipCard) api.blur();
    else api.focusNow();
  }, [api, flipCard]);

  const measure = () => {
    const now = performance.now();
    const ms = Math.max(0, Math.round(now - shownAt.current - (lookupOpenMs() - lookupAtStart.current) - listenMs.current));
    const fk = firstKeyAt.current === null ? ms : Math.max(0, Math.round(firstKeyAt.current - shownAt.current - firstKeyLookup.current - firstKeyListen.current));
    return { ms, fk };
  };
  const check = (dunno = false) => {
    if (view.k !== 'card') return;
    run.check(dunno ? '' : typed.current, measure(), dunno);
  };
  const next = () => {
    run.next();
    api.focusNow();
  };
  // Anki-Modus (S6b-3): Aufdecken, dann Selbsturteil 1–4; gebucht wird sofort, ohne Band.
  const isFlip = card.mode === 'flip';
  const flip = view.k === 'card' ? (view.flip ?? null) : null;
  // Abstands-Deckel: Schwer/Gut/Leicht können denselben Termin ergeben; dann ehrlich sagen, warum (ux-reviewer S6c).
  const sameDay = flip ? new Set(flip.opts.filter((o) => o.g >= 2).map((o) => (o.when.k === 'day' ? o.when.day : o.when.k))).size === 1 && flip.opts.some((o) => o.g >= 2 && o.when.k === 'day') : false;
  const flipMeaningRule = !!flip?.why && flip.why.kind === 'rule' && (flip.why.key === 'vmWhyMeaning' || flip.why.key === 'vmWhyMeaningNoPos');
  const flipPos = flip?.why && flip.why.kind === 'rule' ? (flip.why.vars.pos ?? null) : null;
  const flipOpen = () => {
    if (view.k === 'card' && isFlip && !view.flip) run.flipOpen(measure());
  };
  const flipGrade = (g: Grade) => {
    if (!flip) return;
    run.flipGrade(g);
    api.focusNow();
  };
  const onEnter = () => (isFlip ? flipOpen() : band ? next() : check());
  useHotkeys(
    {
      enter: onEnter,
      ...(flip
        ? {
            digit: (n: number) => {
              if (n >= 1 && n <= 4) flipGrade(n as Grade);
            },
          }
        : {}),
    },
    api.isInput,
  );

  const tip = view.k === 'card' && (view.tip || card.firstLetters);
  const typedGap = card.mode !== 'meaning' && !isFlip;
  const mask = typedGap && tip ? maskOf(card.answer, { firstLetter: true, perWord: true }) : null;
  const gapState: GapState = band ? GAP[band.band.tone] : 'input';
  const intro = view.kind === 'intro';
  const shown = band ? (band.given.trim() ? band.given : null) : null;
  // Bedeutung abfragen: die Lösung in der Lücke ist die deutsche Bedeutung.
  const reveal = band && band.band.tone !== 'ok' ? { solution: card.mode === 'meaning' ? card.de : card.answer, given: shown } : null;

  const gapLabel = (() => {
    const g = gapText(card);
    if (card.mode === 'meaning') return t('vmGapMeaningLabel', { word: card.answer });
    return g ? t('vmGapLabel', { sentence: `${g.text.slice(0, g.start)}…${g.text.slice(g.end)}` }) : t('vmTypeLabel', { de: card.de });
  })();
  const tk = taskKey(view);
  // Was Claude sieht („Claude erklärt“, Begleiter): Aufgabe und Satz mit Lücke; vor dem Prüfen nie die Lösung.
  const seeGap = gapText(card);
  const seeSentence = seeGap ? `${seeGap.text.slice(0, seeGap.start)}___${seeGap.text.slice(seeGap.end)}` : '';
  const seeSolution = card.mode === 'meaning' ? card.de : card.answer;
  const see = {
    area: 'trainer',
    label: `${t('cmpSeeTrainer')} · ${t(tk)}`.slice(0, 60),
    phase: band ? 'feedback' : 'question',
    detail: card.mode === 'meaning' ? `${t(tk)}\n${card.answer}${seeSentence ? `\n${seeSentence}` : ''}` : `${t(tk)}\n${seeSentence || card.de}${seeSentence && card.de ? `\n(${card.de})` : ''}`,
    ...(band ? { reveal: `Solution: ${seeSolution}. Learner: ${band.given || '(empty)'}` } : { mask: card.mode === 'meaning' ? [card.de] : [card.answer, card.head] }),
  } as const;
  const gap = (
    <KineticGap
      label={gapLabel}
      maxLength={Math.max(40, card.answer.length + 10)}
      state={gapState}
      mask={mask}
      shown={shown}
      reveal={reveal}
      silent
      onChange={(v, info) => {
        typed.current = v;
        if (info.firstKey && firstKeyAt.current === null) {
          firstKeyAt.current = performance.now();
          firstKeyLookup.current = lookupOpenMs() - lookupAtStart.current;
          firstKeyListen.current = listenMs.current;
        }
        // Einführung: „Aufdecken“ ohne Eingabe, „Prüfen“ mit Eingabe.
        setHasInput(v.trim().length > 0);
      }}
      onEnter={onEnter}
    />
  );

  const cue = card.cue && card.mode !== 'meaning' ? (
    <p className="lx-t-support text-muted" data-testid="vm-cue" lang={lang}>
      {t(card.cue.ff ? 'vmCueFf' : 'vmCue', { de: card.cue.de })}
    </p>
  ) : null;
  const tipLine =
    view.k === 'card' && view.tip && !card.firstLetters ? (
      <p className="lx-t-support text-muted" data-testid="vm-tip">
        {(() => {
          const x = tipOf(card.answer);
          return x.words > 1 ? t('vmTip', { first: x.first, words: x.words }) : t('vmTipOne', { first: x.first });
        })()}
      </p>
    ) : null;

  let prompt: ReactNode;
  let answer: ReactNode = null;
  const g = gapText(card);
  const whole = fullText(card);
  // Vorlesen: nach dem Prüfen und bei sichtbarem Wort der ganze Satz; vor dem Prüfen einer Lücke nur mit der Einstellung (Lücke als Ton).
  const parts = band || (card.mode !== 'gap' && card.mode !== 'intro') ? (whole ? [whole.text] : null) : run.listenFirst() ? gapParts(card) : null;
  const listen = parts ? <ListenButton key={band ? 'full' : 'pre'} parts={parts} testId="vm-listen" onSpent={band ? undefined : (ms) => (listenMs.current += ms)} /> : null;
  if (isFlip) {
    prompt = (
      <div className="flex flex-col gap-3">
        <p className="lx-t-display min-w-0 break-words" lang="en" data-testid="vm-flip-head">
          {card.head}
        </p>
        {whole ? <EnglishText as="p" testId="vm-sentence" text={whole.text} area="trainer" source={card.path} title={card.head} highlight={[whole.start, whole.end]} exclude={flip ? null : [whole.start, whole.end]} /> : null}
        {listen}
      </div>
    );
    answer = flip ? (
      <div className="lx-reveal-in flex flex-col gap-2" data-testid="vm-flip-back">
        <p className="lx-t-meta m-0 text-subtle">
          {t('vmFlipMeaning')}
          {flipPos ? ` · ${flipPos}` : ''}
        </p>
        <p className="lx-t-title m-0" lang="de" data-testid="vm-flip-de">
          {card.de}
        </p>
        {/* Die reine Bedeutungs-Zeile stünde doppelt unter „Bedeutung“ (learning-scientist S6b-3 Sollte 2, Nachprüfung): nur Lehrer-Zeile oder
            andere Regel zeigen; die Wortart steht dafür am Label. */}
        {flip.why && !flipMeaningRule ? (
          <p className="lx-t-support" data-testid="vm-why">
            {whyText(t, flip.why)}
          </p>
        ) : null}
        {partnersNode(t, flip.partners)}
        {/* Abstands-Deckel: eigene Zeile im Inhalt, nicht unter der festen Notenleiste (ux-reviewer S6c Nachprüfung Punkt 4). */}
        {sameDay ? (
          <p className="lx-t-support m-0 text-muted" data-testid="vm-grades-same">
            {t('vmGradesSame')}
          </p>
        ) : null}
      </div>
    ) : null;
  } else if (card.mode === 'meaning') {
    const f = whole;
    prompt = f ? (
      <div className="flex flex-col gap-3">
        <EnglishText as="p" testId="vm-sentence" text={f.text} area="trainer" source={card.path} title={card.head} highlight={[f.start, f.end]} exclude={band ? null : [f.start, f.end]} />
        {listen}
      </div>
    ) : null;
    answer = gap;
  } else if (g && (card.mode === 'gap' || card.mode === 'intro')) {
    prompt = (
      <div className="flex flex-col gap-3">
        {cue}
        <EnglishText as="p" testId="vm-sentence" text={g.text} area={intro ? 'intro' : 'trainer'} source={card.path} title={card.head} slot={{ start: g.start, end: g.end, node: gap }} />
        {tipLine}
        {listen}
      </div>
    );
  } else {
    // Ohne Satz (nosent, Probe, Einführung ohne nutzbaren Satz): die deutsche Bedeutung ist die Frage.
    prompt = (
      <div className="flex flex-col gap-3">
        <p className="lx-t-title" data-testid="vm-de" lang="de">
          {card.de}
        </p>
        {tipLine}
      </div>
    );
    // Ohne Satz steht die Lücke allein: so breit wie die Lücke im Satz, damit sie als Eingabeort erkennbar ist (UX-Prüfung V3 Nr. 10).
    answer = <div className="[&_.lx-gap]:min-w-32">{gap}</div>;
  }

  const card0 = view.k === 'card' ? view : null;
  const secondary: ShellSecondary[] = [
    ...(card0 && card0.kind === 'answer' && typedGap && !card0.tip && !card.firstLetters
      ? [{ id: 'hint', label: t('vmBtnTip'), onClick: () => run.tip(), testId: 'vm-tip-btn', variant: 'quiet' } as const]
      : []),
    ...(card0 && card0.kind !== 'intro' && !isFlip ? [{ id: 'dontKnow', label: t('vmBtnDunno'), onClick: () => check(true), testId: 'vm-dunno', variant: 'quiet' } as const] : []),
    ...(card0?.canProbe
      ? [
          {
            id: 'skip',
            label: t('vmBtnKnowIt'),
            onClick: () => {
              run.probe();
              api.focusNow();
            },
            testId: 'vm-knowit',
            variant: 'secondary',
          } as const,
        ]
      : []),
  ];
  const introEmpty = intro && view.k === 'card' && !hasInput;
  const primary = isFlip
    ? { label: t('vmBtnReveal'), onClick: flipOpen, testId: 'vm-flip-reveal' }
    : band
      ? { label: t('vmBtnNext'), onClick: next, testId: 'vm-next', arrow: true }
      : { label: t(introEmpty ? 'vmBtnReveal' : 'vmBtnCheck'), onClick: () => check(introEmpty), testId: 'vm-check' };
  const grades = flip ? (
    <GradeButtons
      options={flip.opts.map((o) => {
        const iv = whenText(t, o.when, today);
        return { grade: o.g, label: t(`vmGrade${o.g}` as MessageKey), ...(iv ? { interval: iv } : {}) };
      })}
      onGrade={flipGrade}
      label={t('vmGradesLabel')}
      note={t('vmGradesNote')}
      testId="vm-grades"
    />
  ) : undefined;

  return (
    <ExerciseShell
      meta={{ ex: `vm:${card.form}`, id: `${card.path}:${view.n}`, kind: card.path.startsWith('chunk/') ? 'chunk' : 'word' }}
      status={{ area: 'words', state: null, kindLabel: kindLabel(t, view) }}
      see={see}
      task={{ text: t(tk), purpose: t(view.card.form === 'contrast' && view.card.contrast?.ff ? 'vmWozu_contrastFf' : wozuKey(tk)), open: true, reason: () => reasonLine(t, run.reason(), dateShort) }}
      prompt={prompt}
      answer={answer}
      secondary={secondary}
      primary={primary}
      barOverride={grades}
      keysHint={null}
      feedback={band ? feedbackOf(band, t, dateShort, run) : null}
    />
  );
}

/** „Warum heute?“ (Menü „…“ → „Warum diese Aufgabe?“): Teile aus reason.ts als ein Satz, Tag und Spur in Oberflächensprache. */
function reasonLine(t: T, r: Reason | null, dateShort: (ms: number) => string): { text: string; code: string } | null {
  if (!r) return null;
  const text = r.parts
    .map((p) => {
      const vars: Record<string, string> = { ...p.vars };
      if (vars.date) vars.date = dateShort(new Date(`${vars.date}T12:00:00`).getTime());
      if (vars.track) vars.track = t(`vmRsTrack_${vars.track}` as MessageKey);
      return t(p.key as MessageKey, vars);
    })
    .join(' ');
  return { text, code: r.code };
}

function lineNode(t: T, line: Line): ReactNode {
  const you = <span className="text-subtle">{t('vmLineYou')} </span>;
  const right = (a: string) => (
    <>
      <span className="text-subtle">{t('vmLineRight')} </span>
      <strong lang="en">{a}</strong>
    </>
  );
  switch (line.kind) {
    case 'ok':
      return (
        <span data-testid="vm-line">
          {you}
          <strong lang="en">{line.given}</strong> ✓
        </span>
      );
    case 'syn':
      return (
        <span data-testid="vm-line">
          {you}
          <strong lang="en">{line.given}</strong> ✓ · <span className="text-subtle">{t('vmLinePracticed')}</span> <strong lang="en">{line.answer}</strong>
        </span>
      );
    case 'diff':
      return (
        <span data-testid="vm-line">
          {you}
          <span lang="en">
            {line.parts.map((p, i) =>
              p.k === 'eq' ? (
                <span key={i}>{p.s}</span>
              ) : p.k === 'ins' ? (
                <span key={i} className="text-near-text underline decoration-near-text decoration-2" data-diff="ins">
                  {p.s}
                </span>
              ) : (
                <span key={i} className="text-wrong-text line-through decoration-wrong" data-diff="del">
                  {p.s}
                </span>
              ),
            )}
          </span>
        </span>
      );
    case 'swap':
      return (
        <span data-testid="vm-line">
          {you}
          <span lang="en" className="text-wrong-text line-through decoration-wrong">
            {line.given}
          </span>{' '}
          → {right(line.answer)}
        </span>
      );
    case 'answer':
      return <span data-testid="vm-line">{right(line.answer)}</span>;
  }
}

function whyText(t: T, why: Why): string {
  if (why.kind === 'teach') return why.text;
  const vars: Record<string, string> = { ...why.vars };
  if (vars.pos) vars.pos = t(`vmPos_${vars.pos}` as MessageKey);
  return t(why.key as MessageKey, vars);
}

function nextText(t: T, next: Next, dateShort: (ms: number) => string): string {
  const today = dayKey(Date.now());
  const label = (day: string) => (day === today ? t('vmToday') : day === addDays(today, 1) ? t('vmTomorrow') : dateShort(new Date(`${day}T12:00:00`).getTime()));
  switch (next.kind) {
    case 'step':
      return `${t(`vmNextStep_${next.mode}` as MessageKey)}${next.thenTomorrow ? ` ${t('vmNextThenTomorrow')}` : ''}`;
    case 'date':
      return `${label(next.day)}${next.extra === 'tight' ? ` · ${t('vmNextTight')}` : next.extra === 'newSent' ? ` · ${t('vmNextNewSent')}` : ''}`;
    case 'practice':
      return next.day ? t('vmNextPracticeDate', { date: label(next.day) }) : t('vmNextPractice');
  }
}

function feedbackOf(v: BandView, t: T, dateShort: (ms: number) => string, run: LearnRun): ShellFeedback {
  const b = v.band;
  // Einführung: ein misslungener Versuch ist kein Fehler, das Band zeigt die Lösung.
  const soft = v.kind === 'intro' && b.tone !== 'ok';
  const verdict = soft ? 'dontKnow' : TONE[b.tone];
  const title = soft ? t('vmVerdict_dunno') : t(`vmVerdict_${b.verdict}` as MessageKey, { answer: v.card.answer });
  const partners = partnersNode(t, b.partners);
  // Kontrastkarte: die Falle ausdrücklich benennen (deutsche Falle, Paar, zuletzt verwechselt), englische Wörter mit `lang="en"`.
  const ct = v.card.contrast;
  const mixed = ct?.w && ct.w.toLowerCase() !== (ct.pair ?? '').toLowerCase() ? ct.w : null;
  // Das Unterscheidungsmerkmal auch ohne Lehrersatz: was das verwechselte Wort heißt (learning-scientist V3 S3, Sollte 3).
  const other = mixed ?? ct?.pair ?? null;
  const otherDe = other && other.toLowerCase() !== v.card.answer.toLowerCase() ? (dictLookup(other)?.senses[0]?.de ?? null) : null;
  const contrast = ct ? (
    <div className="flex flex-col gap-0.5" data-testid="vm-contrast">
      {ct.ff ? (
        <p className="lx-t-support">
          {t('vmCtFf1')} <span lang="de">„{ct.ff}“</span> {t('vmCtFf2')} <strong lang="en">{v.card.answer}</strong>.
        </p>
      ) : null}
      {ct.pair ? (
        <p className="lx-t-support">
          {t('vmCtPair')} <strong lang="en">{ct.pair}</strong>.
        </p>
      ) : null}
      {mixed ? (
        <p className="lx-t-support text-muted">
          {t('vmCtMixed')} <span lang="en">{mixed}</span>.
        </p>
      ) : null}
      {other && otherDe ? (
        <p className="lx-t-support text-muted" data-testid="vm-contrast-means">
          <span lang="en">„{other}“</span> {t('vmCtMeans')} <span lang="de">{otherDe}</span>.
        </p>
      ) : null}
    </div>
  ) : null;
  const done = v.choice ? (
    <div className="flex flex-col items-start gap-2" data-testid="vm-choice-done">
      <p className="lx-t-support text-muted">{t(v.choice === 'knewIt' ? 'vmKnewItDone' : 'vmLaterDone')}</p>
      <Button variant="ghost" onClick={() => run.choose(null)} data-testid="vm-undo">
        {t('vmBtnUndo')}
      </Button>
    </div>
  ) : null;
  const act =
    done ??
    (b.knewIt ? (
      <Button variant="secondary" onClick={() => run.choose('knewIt')} data-testid="vm-knewit">
        {t('vmBtnKnewIt')}
      </Button>
    ) : b.alsoRight ? (
      // Ohne Claude-Prüfung (kommt mit Schritt 3): „Später prüfen lassen“ (Emrah 01.11.2026).
      <Button variant="secondary" onClick={() => run.choose('later')} data-testid="vm-later">
        {t('vmBtnLater')}
      </Button>
    ) : null);
  // Die Lösung steht nur einmal: zeigt die Lücke sie schon (Lösung, anderes Wort), entfällt die Zeile „Richtig: …“ (Kap. 15, UX-Prüfung V3 Nr. 5).
  // Beim Buchstabenvergleich (Fast richtig) steht nur der Vergleich, ohne „→ Richtig: …“: die Lücke zeigt die Lösung schon (UX-Nachprüfung V3).
  const inGap = b.line.kind === 'answer' || b.line.kind === 'swap';
  return {
    verdict,
    title,
    right: inGap ? null : lineNode(t, b.line),
    // M43 „Aufgabe melden“ = war unfair: die Antwort zählt nicht und geht zur Inhaltsprüfung (nur solange nichts gebucht ist).
    menu: run.canUnfair()
      ? {
          report: () => {
            const r = run.unfair();
            if (r) toast(t(r === 'again' ? 'vmUnfairAgain' : r === 'counts' ? 'vmUnfairCounts' : 'vmUnfairDone'));
          },
        }
      : undefined,
    why: (
      <p className="lx-t-support" data-testid="vm-why">
        {whyText(t, b.why)}
      </p>
    ),
    // Feste Reihenfolge: Urteil · Lösung · Warum · Wortpartner · Kommt wieder (volle Breite, nie abgeschnitten).
    tail: (
      <>
        {contrast}
        {partners}
        <p className="lx-t-meta text-muted" data-testid="next-in">
          {t('vmNextTitle')}: {nextText(t, b.next, dateShort)}
        </p>
      </>
    ),
    nextIn: null,
    act,
    depth: 'min',
    explanation: null,
  };
}
