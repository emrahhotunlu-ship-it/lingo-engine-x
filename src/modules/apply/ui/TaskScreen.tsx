import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type ReactNode, type Ref } from 'react';
import {
  AiRunPanel,
  Button,
  ExerciseTop,
  Icon,
  isBusy,
  keepVisibleDelta,
  KEY_PREFIX,
  keyboardCovers,
  local,
  Skeleton,
  takeTutorCall,
  unitDone,
  useAiAvailable,
  useAsk,
  useClock,
  useInputProfile,
  useLive,
  useNav,
  useT,
  useTodayPlan,
  type MessageKey,
  type ScreenProps,
} from '../sharedUi';
import { applyKeypoints, applyReply, applySummary, c1Mail, mailVars, patListText, tutorCtx } from '../shared';
import { copyCheck } from '../domain/copy';
import { countSentences, countWords, fitGoal, joinParts, lengthGoal, lengthState, type Device } from '../domain/kinds';
import { keypointsItem } from '../domain/material';
import { startersFor } from '../domain/starters';
import { confirmedWords, fromMail, fromReply, fromSummary, newRunId, selfSpots, spotContext, type ApplyRun, type Feedback } from '../domain/result';
import { useMaterial, useTargets, type Material } from './hooks';
import type { Greet } from '../domain/greet';
import { ApplyResult, kindLabel, type SelfState } from './Result';
import { knownKeypoints, saveKeypoints, saveRun, type SaveResult } from './save';
import type { WriteKind } from '../domain/count';

// Schreibbildschirm der Disziplinen „Auf eine Mail antworten“, „Eine Mail schreiben“ und „Einen Artikel zusammenfassen“ (F3, anwenden-plan.md „Ablauf“).
// Aufgabe (Titel als Handlung, ein Wozu-Satz) → Material → worauf es ankommt → 2 Zielwörter + 1 Regel → Textfeld mit Wortzähler → Prüfen (eine Anfrage,
// Tagesbremse) → erst selbst verbessern (bis zu 3 Stellen) → Lösung in fester Reihenfolge. Handy: kürzer und gegliedert (Antwort: ein Feld je Pflichtpunkt + Gruß).
// Entwurf nur im Browser-Speicher (Bequemlichkeit, Fortsetzen nach Verlassen); Ergebnis, Fehlersätze und K7 in der Datenbank.

const MAX_CHECKS = 3;
const TEXT_MAX = 1_800;
const WHY: Record<WriteKind, 'axWhyReply' | 'axWhyWrite' | 'axWhySummary'> = { reply: 'axWhyReply', write: 'axWhyWrite', summary: 'axWhySummary' };
const SHORT: Record<WriteKind, MessageKey> = { reply: 'axBarReply', write: 'axBarWrite', summary: 'axBarSummary' };
/** Empfänger der Situationen (mail-situations.json `to`) in der Oberflächensprache; Unbekanntes bleibt wie geliefert. */
const TO_KEY: Record<string, MessageKey> = {
  'steering committee': 'axTo_steering',
  'key client': 'axTo_keyClient',
  CFO: 'axTo_cfo',
  'client IT lead': 'axTo_clientIt',
  client: 'axTo_client',
  manager: 'axTo_manager',
  management: 'axTo_management',
  'absent colleague': 'axTo_colleague',
  procurement: 'axTo_procurement',
  investor: 'axTo_investor',
  'client and director': 'axTo_clientDirector',
};
const TPL: Record<WriteKind, string> = {
  reply: `${applyReply.id}@${applyReply.version}`,
  write: `${c1Mail.id}@${c1Mail.version}`,
  summary: `${applySummary.id}@${applySummary.version}`,
};

/** Entwurf; `greet` = Anrede-Feld am Handy (fehlt = noch nicht angefasst, dann vorbelegt), `helped` = Starthilfe geöffnet (W5 K9). */
type Draft = { text: string; parts: string[]; pasted: boolean; peeked: boolean; greet?: string; helped: boolean };

function readDraft(key: string): Draft | null {
  const v = local.getJson<Partial<Draft>>(key);
  if (!v || typeof v !== 'object') return null;
  return {
    text: typeof v.text === 'string' ? v.text : '',
    parts: Array.isArray(v.parts) ? v.parts.filter((p): p is string => typeof p === 'string') : [],
    pasted: v.pasted === true,
    peeked: v.peeked === true,
    ...(typeof v.greet === 'string' ? { greet: v.greet } : {}),
    helped: v.helped === true,
  };
}

const unitOf = (v: unknown): 1 | 2 | 3 | 4 | 5 | null => (v === 1 || v === 2 || v === 3 || v === 4 || v === 5 ? v : null);

/** Zeitstempel einer Prüfung (nur im Klick, nie beim Zeichnen). */
const stamp = (): number => Date.now();

const reducedMotion = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Übungsleiste der Schreibübung: ✕ · Aufgabe (Kurztitel) mit „Pflicht“/„Extra“ darunter · Frag Claude. Solange ein Textfeld den Fokus hat, steht darunter
 * der Hauptknopf (`dock`) – die Leiste klebt oben, also bleiben Aufgabe und Knopf über der Bildschirmtastatur (ui-standard §3, UX-Befund 1).
 */
function ApplyTop({ kind, unit, onClose, dock = null }: { kind: WriteKind; unit: number | null; onClose: () => void; dock?: ReactNode }) {
  const { t } = useT();
  const title = (
    <>
      <span className="lx-kbar-area" data-testid="ax-bar-title">
        {t(SHORT[kind])}
      </span>
      <span className="lx-kbar-count">{t(unit ? 'axBarDuty' : 'axBarExtra')}</span>
    </>
  );
  return <ExerciseTop onClose={onClose} ctx={unit ? 'duty' : 'xtra'} title={title} middleOverlay={dock} />;
}

/**
 * Bildschirmtastatur (wie die Lücke, Kap. 4.1): Hat ein Feld den Fokus und verdeckt die Tastatur den unteren Teil (`visualViewport`), rollt die Seite so,
 * dass das Feld zwischen klebender Leiste und Tastatur steht. Ohne `visualViewport` (oder wenn der Rahmen ihn nicht meldet) bleibt es beim Rollen des
 * Browsers; die Leiste mit Aufgabe und Knopf klebt ohnehin oben.
 */
function useKeepFieldVisible(active: boolean): void {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !vv) return;
    let timer: number | null = null;
    const keep = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) || !el.closest('[data-testid="ax-flow"]')) return;
      if (!keyboardCovers(window.innerHeight, vv.height)) return;
      const bar = document.querySelector<HTMLElement>('[data-testid="exercise-bar"]');
      const top = Math.max(vv.offsetTop, bar ? bar.getBoundingClientRect().bottom : 0);
      const d = keepVisibleDelta([el.getBoundingClientRect()], { top, height: vv.offsetTop + vv.height - top });
      if (Math.abs(d) > 1) window.scrollBy({ top: d });
    };
    const later = () => {
      if (timer !== null) window.clearTimeout(timer);
      // Safari meldet die endgültige Höhe erst nach der Tastatur-Animation.
      timer = window.setTimeout(keep, 120);
    };
    vv.addEventListener('resize', later);
    later();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      vv.removeEventListener('resize', later);
    };
  }, [active]);
}

export function ApplyTaskScreen({ route }: ScreenProps<'applyTask'>) {
  const kind = route.kind;
  const { t } = useT();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const [day] = useState(today);
  const [unit] = useState(() => unitOf(route.unit));
  const ai = useAiAvailable();
  const liveProfile = useInputProfile();
  const [device] = useState<Device>(() => (liveProfile === 'touch' ? 'touch' : 'keys'));
  const mat = useMaterial(kind, day);
  const m = mat.m;
  const [started, setStarted] = useState(false);

  const close = (): void => back();
  const comboInstead = (): void => {
    if (unit) go({ name: 'comboSentence', unit });
    else go({ name: 'comboSentence' });
  };
  const header = <ApplyTop kind={kind} unit={unit} onClose={close} />;

  if (!ai && !started) {
    return (
      <Frame top={header} kind={kind}>
        <div className="lx-card flex flex-col gap-3 p-5" data-testid="ax-unavailable">
          <p className="lx-ax-text m-0 text-muted">{t('axUnavailable')}</p>
          <Fallback unit={unit} onCombo={comboInstead} onBack={close} />
        </div>
      </Frame>
    );
  }
  if (mat.state === 'loading') {
    return (
      <Frame top={header} kind={kind}>
        <Skeleton className="h-64 w-full" />
      </Frame>
    );
  }
  if (!m) {
    return (
      <Frame top={header} kind={kind}>
        <div className="lx-card flex flex-col gap-3 p-5" data-testid="ax-nomaterial">
          <p className="lx-ax-text m-0 text-muted">{t(kind === 'summary' ? 'axNoArticle' : 'axNoMaterial')}</p>
          <Fallback unit={unit} onCombo={comboInstead} onBack={close} />
        </div>
      </Frame>
    );
  }
  return (
    <Frame top={null} kind={kind} materialId={m.id} device={device}>
      <TaskBody key={m.id} m={m} kind={kind} day={day} unit={unit} device={device} onStarted={() => setStarted(true)} onBack={close} onCombo={comboInstead} />
    </Frame>
  );
}

type BodyProps = { m: Material; kind: WriteKind; day: string; unit: 1 | 2 | 3 | 4 | 5 | null; device: Device; onStarted: () => void; onBack: () => void; onCombo: () => void };

/** Der eigentliche Ablauf, je Material einmal aufgebaut (`key`): der Entwurf wird beim Aufbau übernommen. */
function TaskBody({ m, kind, day, unit, device, onStarted, onBack, onCombo }: BodyProps) {
  const { t, lang, num } = useT();
  const profile = useLive((s) => s.docs['app/profile']);
  // Entscheidung B (Emrah 05.11.2026): als Schritt 3 passt sich die Länge an die Planminuten an (dieselbe Zahl wie Heute und die Seite Anwenden).
  const planMin = useTodayPlan((s) => (unit && s.plan?.d === day ? s.plan.u?.b.find(([, k]) => k === 'task.apply')?.[2] : undefined));
  const goal = useMemo(() => fitGoal(lengthGoal(kind, device), kind, planMin), [kind, device, planMin]);
  const targets = useTargets(m);
  const partsMode = kind === 'reply' && device === 'touch';
  const mustN = m.kind === 'reply' ? m.mail.must.length : 0;

  const askReply = useAsk(applyReply);
  const askMail = useAsk(c1Mail);
  const askKp = useAsk(applyKeypoints);
  const askSum = useAsk(applySummary);
  const ask = kind === 'reply' ? askReply : kind === 'write' ? askMail : isBusy(askKp.phase) || askKp.error ? askKp : askSum;
  const busy = isBusy(askReply.phase) || isBusy(askMail.phase) || isBusy(askKp.phase) || isBusy(askSum.phase);

  const draftKey = `${KEY_PREFIX}apply:${kind}:${day}:${m.id}`;
  const [draft] = useState(() => readDraft(draftKey));
  const [text, setText] = useState(() => draft?.text ?? '');
  const [parts, setParts] = useState<string[]>(() => draft?.parts ?? []);
  const [pasted, setPasted] = useState(() => draft?.pasted ?? false);
  const [peeked, setPeeked] = useState(() => draft?.peeked ?? false);
  // K7: am Handy ein eigenes Anrede-Feld, vorbelegt mit der passenden Anrede (änderbar). K9: Starthilfe geöffnet?
  const [greet, setGreet] = useState(() => draft?.greet ?? (m.kind === 'reply' ? m.greet.hello : ''));
  const [helped, setHelped] = useState(() => draft?.helped ?? false);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const [articleOpen, setArticleOpen] = useState(() => !(draft && (draft.text.trim() || draft.parts.some((p) => p.trim()))));
  const [limited, setLimited] = useState(false);
  const [checks, setChecks] = useState(0);
  const [run, setRun] = useState<ApplyRun | null>(null);
  const [save, setSave] = useState<SaveResult | null>(null);
  const [self, setSelf] = useState<SelfState>(null);
  const [revealed, setRevealed] = useState(false);
  const [keyPoints, setKeyPoints] = useState<string[] | null>(null);
  const textId = useRef<string | null>(null);
  const editorId = useId();
  /** Welches Feld hat gerade den Fokus: der eigene Text (`edit`) oder eine Stelle zum Selbst-Verbessern (`self`)? */
  const [focusOn, setFocusOn] = useState<'edit' | 'self' | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const selfHead = useRef<HTMLHeadingElement>(null);
  const resultHead = useRef<HTMLHeadingElement>(null);
  useKeepFieldVisible(focusOn !== null);
  // Platz unter dem Inhalt für das Rollen über die Tastatur (`room`): verschwindet erst kurz nach dem Fokus, sonst verschöbe sich die Seite zwischen
  // Drücken und Loslassen eines Knopfes und das Tippen ginge daneben.
  const [room, setRoom] = useState(false);
  const roomTimer = useRef<number | null>(null);
  const keepRoom = (on: boolean): void => {
    if (roomTimer.current !== null) window.clearTimeout(roomTimer.current);
    roomTimer.current = null;
    if (on) setRoom(true);
    else roomTimer.current = window.setTimeout(() => setRoom(false), 400);
  };
  useEffect(() => () => {
    if (roomTimer.current !== null) window.clearTimeout(roomTimer.current);
  }, []);
  // Nur Eingabefelder zählen (nicht die Überschrift, auf die der Fokus nach dem Prüfen springt).
  const isField = (el: EventTarget): boolean => el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
  const onEditFocus = (e: FocusEvent<HTMLElement>): void => {
    if (!isField(e.target)) return;
    setFocusOn('edit');
    keepRoom(true);
  };
  const onSelfFocus = (e: FocusEvent<HTMLElement>): void => {
    if (!isField(e.target)) return;
    setFocusOn('self');
    keepRoom(true);
  };
  const onFieldBlur = (e: FocusEvent<HTMLElement>): void => {
    // Wechsel zwischen den Feldern derselben Gruppe (Punkt 1 → Punkt 2) lässt die Leiste stehen.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    setFocusOn(null);
    keepRoom(false);
  };

  // Entwurf im Browser-Speicher (Bequemlichkeit, Fortsetzen nach Verlassen); leer = entfernt.
  useEffect(() => {
    if (!text.trim() && !parts.some((p) => p.trim()) && !helped) local.remove(draftKey);
    else local.set(draftKey, JSON.stringify({ text, parts, pasted, peeked, greet, helped }));
  }, [draftKey, text, parts, pasted, peeked, greet, helped]);

  // Die vorbelegte Anrede allein ist noch kein Text (kein „Schreiben begonnen“, keine Wörter vor dem ersten Punkt).
  const body = partsMode ? joinParts(parts) : text;
  const composed = partsMode && body.trim() ? joinParts([greet, ...parts]) : body;
  const starters = useMemo(() => startersFor(kind, m.id, m.kind === 'write' ? m.situation.sit : ''), [kind, m]);
  const greetVars = m.kind === 'reply' ? { reader: `${m.mail.from} (${m.mail.role})`, hello: m.greet.hello, close: m.greet.close } : m.kind === 'write' ? { reader: `${m.situation.to}${m.greet.name ? `, ${m.greet.name}` : ''}`, hello: m.greet.hello, close: m.greet.close } : undefined;
  const chars = Array.from(composed.trim()).length;
  const words = countWords(composed);
  const sentences = countSentences(composed);
  const tooLong = chars > TEXT_MAX;
  const tooShort = words < goal.minSubmit;
  const live = useMemo(() => (m.kind === 'summary' && composed.trim() ? copyCheck(composed, m.article.text) : null), [m, composed]);
  const writing = !!composed.trim();

  const check = async (): Promise<void> => {
    if (tooLong || tooShort || checks >= MAX_CHECKS || busy) return;
    if (!takeTutorCall()) {
      setLimited(true);
      return;
    }
    setLimited(false);
    onStarted();
    // Tastatur zu, Leiste zurück: das Ergebnis braucht den Platz.
    setFocusOn(null);
    keepRoom(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const given = composed.trim();
    const ctx = tutorCtx(profile);
    const rulePrompt = targets.rule?.prompt ?? '';
    let fb: Feedback | null = null;
    let kps: string[] | null = keyPoints;
    if (m.kind === 'reply') {
      const out = await askReply.run({ incoming: m.incoming, must: m.mail.must.map((x) => x.en), words: targets.words, rule: rulePrompt, text: given, uiLang: lang, ctx, pats: patListText(), greet: greetVars });
      if (out) fb = fromReply(out);
    } else if (m.kind === 'write') {
      // T7: Claude prüft, was Emrah sieht – die Regel ist das erste Muster der Situation, die Wendungen sind die beiden Zielwörter.
      const v = mailVars({ situation: m.situation, text: given, ctx, uiLang: lang });
      const out = await askMail.run({ ...v, patterns: v.patterns.slice(0, 1), phrases: targets.words, greet: greetVars, polish: true });
      if (out) fb = fromMail(out);
    } else {
      // K8: Texte aus dem Vorrat bringen ihre geprüften Kernpunkte mit (keine Anfrage, derselbe Maßstab bei jeder Prüfung).
      kps ??= m.keyPoints ?? (await knownKeypoints(m.id, [useClock.getState().today, m.article.day]));
      if (!kps) {
        const r = await askKp.run({ title: m.article.title, article: m.article.text });
        if (!r) return;
        kps = await saveKeypoints(keypointsItem(m.id, m.article.title, r.points, useClock.getState().today, stamp()), r.points);
      }
      setKeyPoints(kps);
      const out = await askSum.run({
        title: m.article.title,
        article: m.article.text,
        keyPoints: kps,
        goal: { sentences: goal.sentences ?? [3, 5], maxWords: goal.words[1] },
        words: targets.words,
        rule: rulePrompt,
        text: given,
        uiLang: lang,
        ctx,
        pats: patListText(),
      });
      if (out) fb = fromSummary(out);
    }
    if (!fb) return;
    const now = stamp();
    const n = checks + 1;
    const id = textId.current ?? newRunId(kind, now);
    textId.current = id;
    setChecks(n);
    const next: ApplyRun = {
      kind,
      id,
      check: n,
      day: useClock.getState().today,
      now,
      text: given,
      pasted,
      material: m.id,
      ctx: m.ctx,
      feedback: fb,
      length: lengthState(given, goal).state,
      copy: m.kind === 'summary' ? copyCheck(given, m.article.text) : null,
      peeked,
      // L1: Beleg nur für Zielwörter, die Claude als richtig bestätigt hat und die nicht im Material stehen; angeboten waren `offered`.
      words: confirmedWords(targets.words, fb, given, m.plain),
      offered: targets.words,
      helped,
    };
    next.lex = next.words.map((w) => targets.keys[w.toLowerCase()]).filter((k): k is string => !!k);
    const spots = n === 1 ? selfSpots(fb.edits) : [];
    setSelf(spots.length ? { spots, fixes: spots.map((e) => e.from) } : null);
    setRevealed(spots.length === 0);
    setRun(next);
    setSave(null);
    const saved = await saveRun(next);
    setSave((cur) => cur ?? saved);
  };

  const done = (): void => {
    local.remove(draftKey);
    // L2: Mit `unit` läuft genau die eingefrorene Disziplin des Tages (Route aus `u.ap`), und „Fertig“ gibt es erst nach einer Prüfung: erledigt.
    if (unit) unitDone(unit, undefined, { apDone: true });
    else onBack();
  };
  const revise = (): void => {
    setRun(null);
    setSelf(null);
    setRevealed(false);
    setTextOpen(false);
  };
  const reveal = (): void => {
    setFocusOn(null);
    keepRoom(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setRevealed(true);
  };

  // UX-Befund 3: Nach dem Prüfen (und nach „Lösung zeigen“) springt die Seite zum Ergebnis; der Fokus geht auf die Überschrift (öffnet keine Tastatur).
  const shown = run ? (revealed ? `r${run.check}` : `s${run.check}`) : '';
  useEffect(() => {
    if (!shown) return;
    const head = (shown.startsWith('r') ? resultHead : selfHead).current;
    const box = head?.closest<HTMLElement>('[data-testid="ax-result"], [data-testid="ax-self"]');
    if (!head || !box) return;
    box.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    head.focus({ preventScroll: true });
  }, [shown]);

  const title = m.kind === 'reply' ? t('axTaskReply', { name: m.mail.from }) : m.kind === 'write' ? t('axTaskWrite') : t(device === 'touch' ? 'axTaskSummary3' : 'axTaskSummary35');
  const sentGoal = goal.sentences ? (goal.sentences[0] === goal.sentences[1] ? String(goal.sentences[0]) : `${goal.sentences[0]}–${goal.sentences[1]}`) : '';
  const pointLabels = m.kind === 'reply' ? m.mail.must.map((x) => x[lang]) : (keyPoints ?? []);
  const editorOff = busy || !!run;
  const countText = `${t('axCount', { n: num(words), min: goal.words[0], max: goal.words[1] })}${goal.sentences ? ` · ${t('axCountSent', { n: num(sentences), goal: sentGoal })}` : ''}`;
  const checkOff = tooLong || tooShort || checks >= MAX_CHECKS;
  // Knopf in der klebenden Leiste, solange ein Feld den Fokus hat (Tippen darauf nimmt dem Feld den Fokus nicht: `mousedown` ohne Standard).
  const dock =
    focusOn === 'edit' && !editorOff ? (
      <div className="flex items-center justify-between gap-3" data-testid="ax-dock">
        <span className="lx-ax-small text-subtle lx-tnum">{countText}</span>
        <Button variant="primary" className="flex-none" onMouseDown={(e) => e.preventDefault()} onClick={() => void check()} disabled={checkOff} data-testid="ax-dock-check">
          {t('axCheck')}
        </Button>
      </div>
    ) : focusOn === 'self' && run && self && !revealed ? (
      <div className="flex items-center justify-end gap-3" data-testid="ax-dock">
        <Button variant="primary" className="flex-none" onMouseDown={(e) => e.preventDefault()} onClick={reveal} data-testid="ax-dock-reveal">
          {t('axReveal')}
        </Button>
      </div>
    ) : null;

  return (
    <>
      <ApplyTop kind={kind} unit={unit} onClose={onBack} dock={dock} />
      <header className="flex flex-col gap-2">
        <h1 className="lx-ax-title m-0" data-testid="ax-task">
          {title}
        </h1>
        <p className="lx-ax-hint m-0 text-muted" data-testid="ax-purpose">
          {t('axPurpose', { why: t(WHY[kind]) })}
        </p>
      </header>

      <MaterialCard m={m} open={articleOpen} writing={writing} onToggle={(open) => {
        setArticleOpen(open);
        if (open && writing) setPeeked(true);
      }} />

      {m.kind === 'reply' && !partsMode && (
        <section className="flex flex-col gap-2" data-testid="ax-must">
          <h2 className="lx-ax-small m-0 text-subtle">{t('axMust')}</h2>
          <ol className="lx-ax-text m-0 flex flex-col gap-1 pl-5">
            {m.mail.must.map((x, k) => (
              <li key={k}>{x[lang]}</li>
            ))}
          </ol>
          <GreetHint g={m.greet} />
        </section>
      )}
      {m.kind === 'summary' && (
        <section className="flex flex-col gap-2" data-testid="ax-guide">
          <h2 className="lx-ax-small m-0 text-subtle">{t('axGuide')}</h2>
          <ol className="lx-ax-text m-0 flex flex-col gap-1 pl-5">
            <li>{t('axGuide1')}</li>
            <li>{t('axGuide2')}</li>
            <li>{t('axGuide3')}</li>
          </ol>
        </section>
      )}

      {(targets.words.length > 0 || targets.rule) && (
        <section className="flex flex-col gap-2" data-testid="ax-targets">
          <h2 className="lx-ax-small m-0 text-subtle">{t('axUse')}</h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {targets.words.map((w) => (
              <li key={w} className="lx-chip lx-ax-text" lang="en" data-testid="ax-target-word">
                {w}
              </li>
            ))}
          </ul>
          {targets.rule && (
            <p className="lx-ax-hint m-0" data-testid="ax-target-rule">
              <span className="font-semibold">{t('axRule', { name: targets.rule.label })}</span>
              <span className="text-muted"> · {targets.rule.text}</span>
            </p>
          )}
        </section>
      )}

      {!run && <Starters items={starters} open={helped} onOpen={() => setHelped(true)} />}

      {run ? (
        <section className="lx-card px-4 py-1" data-testid="ax-yourtext" data-open={String(textOpen)}>
          <FoldText label={t('axYourText')} open={textOpen} onToggle={setTextOpen} text={run.text} />
        </section>
      ) : (
      <section className="flex flex-col gap-2" onFocus={onEditFocus} onBlur={onFieldBlur}>
        {partsMode && m.kind === 'reply' ? (
          <div className="flex flex-col gap-4" data-testid="ax-parts">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${editorId}-greet`} className="lx-ax-hint font-semibold">
                {t('axPartGreet')}
              </label>
              <input
                id={`${editorId}-greet`}
                value={greet}
                lang="en"
                name="lx-apply-greet"
                autoCorrect="off"
                autoCapitalize="sentences"
                autoComplete="off"
                spellCheck={false}
                disabled={editorOff}
                onChange={(e) => setGreet(e.target.value)}
                data-testid="ax-part-greet"
                className="lx-ax-input lx-glass min-h-11 w-full scroll-mt-40 rounded-[var(--radius-control)] px-4 py-2 text-fg"
              />
            </div>
            {[...m.mail.must.map((x, k) => t('axPartLabel', { n: k + 1, point: x[lang] })), t('axPartClose')].map((label, k) => (
              <div key={k} className="flex flex-col gap-1.5">
                <label htmlFor={`${editorId}-${k}`} className="lx-ax-hint font-semibold">
                  {label}
                </label>
                <textarea
                  id={`${editorId}-${k}`}
                  value={parts[k] ?? ''}
                  rows={k === mustN ? 1 : 3}
                  lang="en"
                  name={k === 0 ? 'lx-apply-text' : `lx-apply-text-${k}`}
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={k === mustN ? t('axPartClosePh', { close: m.greet.close }) : t('axPlaceholder')}
                  disabled={editorOff}
                  onChange={(e) => {
                    const v = e.target.value;
                    setParts((cur) => {
                      const next = [...cur];
                      while (next.length <= k) next.push('');
                      next[k] = v;
                      return next;
                    });
                  }}
                  onPaste={() => setPasted(true)}
                  onDrop={() => setPasted(true)}
                  data-testid={`ax-part-${k}`}
                  className="lx-ax-input lx-glass w-full scroll-mt-40 resize-y rounded-[var(--radius-control)] px-4 py-3 text-fg placeholder:text-subtle"
                />
              </div>
            ))}
          </div>
        ) : (
          <>
            <label htmlFor={editorId} className="lx-ax-small text-subtle">
              {t('axEditor')}
            </label>
            <textarea
              id={editorId}
              value={text}
              rows={device === 'touch' ? 7 : 12}
              lang="en"
              name="lx-apply-text"
              autoCorrect="off"
              autoCapitalize="sentences"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('axPlaceholder')}
              disabled={editorOff}
              onChange={(e) => {
                const v = e.target.value;
                setText(v);
                if (v.trim() && m.kind === 'summary' && articleOpen && !text.trim()) setArticleOpen(false);
                if (!v.trim()) setPasted(false);
              }}
              onPaste={(e) => {
                if (m.kind === 'summary') {
                  e.preventDefault();
                  setPasteBlocked(true);
                } else setPasted(true);
              }}
              onDrop={(e) => {
                if (m.kind === 'summary') {
                  e.preventDefault();
                  setPasteBlocked(true);
                } else setPasted(true);
              }}
              data-testid="ax-input"
              className="lx-ax-input lx-glass w-full scroll-mt-40 resize-y rounded-[var(--radius-control)] px-4 py-3 text-fg placeholder:text-subtle"
            />
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="lx-ax-small text-subtle lx-tnum" data-testid="ax-count" data-words={words} data-sentences={sentences}>
            {countText}
          </span>
          {tooLong ? (
            <span className="lx-ax-small text-wrong-text" role="status" data-testid="ax-toolong">
              {t('axTooLong', { n: num(TEXT_MAX) })}
            </span>
          ) : (
            tooShort &&
            words > 0 && (
              <span className="lx-ax-small text-muted" role="status" data-testid="ax-tooshort">
                {t('axTooShort', { n: goal.minSubmit })}
              </span>
            )
          )}
        </div>
        {pasteBlocked && (
          <p className="lx-ax-hint m-0 text-muted" role="status" data-testid="ax-nopaste">
            {t('axNoPaste')}
          </p>
        )}
        {live?.hint && (
          <p className="lx-ax-hint m-0 text-muted" role="status" data-testid="ax-copyhint">
            {t('axCopyHint')}
          </p>
        )}
      </section>
      )}

      {limited && (
        <p className="lx-ax-hint m-0 text-muted" role="status" data-testid="ax-limit">
          {t('axLimit')}
        </p>
      )}
      <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => void check()} />
      {!run && !busy && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="lg" onClick={() => void check()} disabled={checkOff} data-testid="ax-check">
            {t('axCheck')}
          </Button>
          {unit && ask.error && (
            <Button variant="ghost" onClick={onCombo} data-testid="ax-combo-instead">
              {t('axComboInstead')}
            </Button>
          )}
        </div>
      )}

      {run && self && !revealed && (
        <SelfFix
          self={self}
          text={run.text}
          onChange={(fixes) => setSelf({ ...self, fixes })}
          onReveal={reveal}
          headRef={selfHead}
          onFocus={onSelfFocus}
          onBlur={onFieldBlur}
        />
      )}
      {run && revealed && (
        <ApplyResult
          run={run}
          save={save}
          targets={targets}
          pointLabels={pointLabels}
          goal={goal}
          self={self}
          checksLeft={MAX_CHECKS - run.check}
          tpl={TPL[kind]}
          onRevise={revise}
          onDone={done}
          headRef={resultHead}
        />
      )}
      {/* Touch mit Fokus im Feld: Platz unter dem Inhalt (liegt hinter der Tastatur), damit die Seite das Feld über die Tastatur rollen kann. */}
      {device === 'touch' && room && <div aria-hidden="true" className="h-[50vh] flex-none" data-testid="ax-kb-room" />}
    </>
  );
}

function Frame({ top, kind, materialId, device, children }: { top: ReactNode; kind: WriteKind; materialId?: string; device?: Device; children: ReactNode }) {
  return (
    <div className="lx-ax mx-auto flex w-full max-w-[47.5rem] flex-col gap-6 px-4 py-4 sm:py-8" data-testid="ax-flow" data-kind={kind} data-material={materialId} data-device={device}>
      {top}
      {children}
    </div>
  );
}

function Fallback({ unit, onCombo, onBack }: { unit: number | null; onCombo: () => void; onBack: () => void }) {
  const { t } = useT();
  return unit ? (
    <Button variant="primary" className="self-start" onClick={onCombo} data-testid="ax-combo-instead">
      {t('axComboInstead')}
    </Button>
  ) : (
    <Button variant="secondary" className="self-start" onClick={onBack} data-testid="ax-back">
      {t('axBack')}
    </Button>
  );
}

function MaterialCard({ m, open, writing, onToggle }: { m: Material; open: boolean; writing: boolean; onToggle: (open: boolean) => void }) {
  const { t, lang } = useT();
  if (m.kind === 'reply') {
    return (
      <section className="lx-card flex flex-col gap-2 p-4 sm:p-6" aria-label={t('axIncoming')} data-testid="ax-mail">
        <p className="lx-ax-small m-0 text-subtle">{t('axFrom', { from: m.mail.from, role: m.mail.role })}</p>
        <p className="lx-ax-task m-0" lang="en">
          {t('axSubject', { s: m.mail.subject })}
        </p>
        <p className="lx-ax-text m-0 whitespace-pre-wrap [overflow-wrap:anywhere]" lang="en">
          {m.mail.body}
        </p>
      </section>
    );
  }
  if (m.kind === 'write') {
    return (
      <section className="lx-card flex flex-col gap-2 p-4 sm:p-6" aria-label={t('axBrief')} data-testid="ax-brief">
        <p className="lx-ax-small m-0 text-subtle" data-testid="ax-reader">
          {m.greet.name ? t('axReaderName', { to: readerOf(m.situation.to, t), name: m.greet.name }) : t('axReader', { to: readerOf(m.situation.to, t) })}
        </p>
        <p className="lx-ax-text m-0" lang={lang}>
          {m.situation.brief[lang]}
        </p>
        <GreetHint g={m.greet} />
      </section>
    );
  }
  return (
    <section className="lx-card flex flex-col gap-2 p-4 sm:p-6" data-testid="ax-article" data-open={String(open)}>
      <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 text-left" aria-expanded={open} onClick={() => onToggle(!open)} data-testid="ax-article-toggle">
        <span className="flex min-w-0 flex-col">
          <span className="lx-ax-small text-subtle">{t(m.stock ? 'axArticleStock' : 'axArticle')}</span>
          <span className="lx-ax-task" lang="en">
            {m.article.title}
          </span>
        </span>
      </button>
      {open ? (
        <div className="lx-ax-text flex flex-col gap-3 [overflow-wrap:anywhere]" lang="en" data-testid="ax-article-text">
          {m.article.text.split('\n\n').map((p, k) => (
            <p key={k} className="m-0">
              {p}
            </p>
          ))}
        </div>
      ) : (
        writing && <p className="lx-ax-hint m-0 text-muted">{t('axArticleHidden')}</p>
      )}
    </section>
  );
}

type SelfProps = {
  self: NonNullable<SelfState>;
  text: string;
  onChange: (fixes: string[]) => void;
  onReveal: () => void;
  headRef: Ref<HTMLHeadingElement>;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
  onBlur: (e: FocusEvent<HTMLElement>) => void;
};

function SelfFix({ self, text, onChange, onReveal, headRef, onFocus, onBlur }: SelfProps) {
  const { t } = useT();
  const id = useId();
  const n = self.spots.length;
  return (
    <section className="lx-card flex scroll-mt-28 flex-col gap-4 p-4 sm:p-6" data-testid="ax-self" onFocus={onFocus} onBlur={onBlur}>
      <header className="flex flex-col gap-1">
        <h2 ref={headRef} tabIndex={-1} className="lx-ax-task m-0 outline-none">
          {t('axSelfTitle')}
        </h2>
        <p className="lx-ax-hint m-0 text-muted">{t(n === 1 ? 'axSelfLead_one' : 'axSelfLead_other', { n })}</p>
      </header>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {self.spots.map((e, k) => {
          // T8: der ganze Satz aus dem eigenen Text, die falsche Stelle darin markiert.
          const at = spotContext(text, e);
          return (
            <li key={`${e.from}-${k}`} className="flex flex-col gap-1.5" data-testid={`ax-self-${k}`} data-kind={e.kind}>
              <label htmlFor={`${id}-${k}`} className="lx-ax-small text-subtle">
                {t('axSelfSpot', { n: k + 1, kind: t(kindLabel(e.kind)) })}
              </label>
              <p className="lx-ax-text m-0 [overflow-wrap:anywhere]" data-testid={`ax-self-sentence-${k}`}>
                <span className="sr-only">{t('axSelfIn')} </span>
                <span lang="en">
                  {at ? (
                    <>
                      {at.before}
                      <mark className="rounded bg-wrong-soft px-0.5 text-wrong-text" data-testid={`ax-self-mark-${k}`}>
                        {at.hit}
                      </mark>
                      {at.after}
                    </>
                  ) : (
                    <mark className="rounded bg-wrong-soft px-0.5 text-wrong-text" data-testid={`ax-self-mark-${k}`}>
                      {e.from}
                    </mark>
                  )}
                </span>
              </p>
              <input
                id={`${id}-${k}`}
                value={self.fixes[k] ?? ''}
                lang="en"
                name={`lx-apply-fix-${k}`}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                onChange={(ev) => {
                  const next = [...self.fixes];
                  next[k] = ev.target.value;
                  onChange(next);
                }}
                data-testid={`ax-self-input-${k}`}
                className="lx-ax-input lx-glass min-h-11 w-full scroll-mt-40 rounded-[var(--radius-control)] px-4 py-2 text-fg"
              />
            </li>
          );
        })}
      </ol>
      <Button variant="primary" size="lg" className="self-start" onClick={onReveal} data-testid="ax-reveal">
        {t('axReveal')}
      </Button>
    </section>
  );
}


/** K7: passende Anrede und passender Gruß für diesen Empfänger (als Hinweis; andere Formen derselben Tonlage gelten auch). */
function GreetHint({ g }: { g: Greet }) {
  const { t } = useT();
  return (
    <p className="lx-ax-hint m-0 text-muted" data-testid="ax-greet-hint">
      {t('axGreetHint', { hello: g.hello, close: g.close })}
    </p>
  );
}

/**
 * K9 Starthilfe: erst ein Knopf, auf Antippen drei Satzanfänge (Einstieg, Hauptteil, Schluss) aus festen Listen, kein KI-Aufruf. Geöffnet zählt als Hilfe
 * (im Ergebnis vermerkt); die Aufgabe und die Pflicht bleiben gleich. Die Anfänge stehen zum Abschreiben da, eingefügt wird nichts.
 */
function Starters({ items, open, onOpen }: { items: readonly string[]; open: boolean; onOpen: () => void }) {
  const { t } = useT();
  if (!items.length) return null;
  if (!open) {
    return (
      <Button variant="secondary" className="self-start" onClick={onOpen} data-testid="ax-starter">
        {t('axStarter')}
      </Button>
    );
  }
  return (
    <section className="flex flex-col gap-2" data-testid="ax-starters">
      <h2 className="lx-ax-small m-0 text-subtle">{t('axStarterTitle')}</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((x, k) => (
          <li key={x} className="lx-chip lx-ax-text self-start" lang="en" data-testid={`ax-starter-${k}`}>
            {x}
          </li>
        ))}
      </ul>
      <p className="lx-ax-hint m-0 text-muted">{t('axStarterNote')}</p>
    </section>
  );
}

const readerOf = (to: string, t: (k: MessageKey) => string): string => {
  const key = TO_KEY[to];
  return key ? t(key) : to;
};

/** Der geprüfte eigene Text, eingeklappt zu einer Zeile (UX-Befund 3: der Text stand sonst dreimal da). */
function FoldText({ label, open, onToggle, text }: { label: string; open: boolean; onToggle: (open: boolean) => void; text: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 pb-1">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => onToggle(!open)} className="lx-ax-text inline-flex min-h-11 w-full items-center justify-between gap-2 text-left font-semibold" data-testid="ax-yourtext-toggle">
        {label}
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={18} className="flex-none text-subtle" />
      </button>
      {open && (
        <p id={id} className="lx-ax-text m-0 whitespace-pre-wrap pb-2 [overflow-wrap:anywhere]" lang="en" data-testid="ax-yourtext-text">
          {text}
        </p>
      )}
    </div>
  );
}
