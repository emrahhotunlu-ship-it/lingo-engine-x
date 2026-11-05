import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AiRunPanel,
  Button,
  ExerciseTop,
  isBusy,
  KEY_PREFIX,
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
  type ScreenProps,
} from '../sharedUi';
import { applyKeypoints, applyReply, applySummary, c1Mail, mailVars, patListText, tutorCtx } from '../shared';
import { copyCheck } from '../domain/copy';
import { countSentences, countWords, joinParts, lengthGoal, lengthState, type Device } from '../domain/kinds';
import { keypointsItem } from '../domain/material';
import { confirmedWords, fromMail, fromReply, fromSummary, newRunId, selfSpots, spotContext, type ApplyRun, type Feedback } from '../domain/result';
import { useMaterial, useTargets, type Material } from './hooks';
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
const TPL: Record<WriteKind, string> = {
  reply: `${applyReply.id}@${applyReply.version}`,
  write: `${c1Mail.id}@${c1Mail.version}`,
  summary: `${applySummary.id}@${applySummary.version}`,
};

type Draft = { text: string; parts: string[]; pasted: boolean; peeked: boolean };

function readDraft(key: string): Draft | null {
  const v = local.getJson<Partial<Draft>>(key);
  if (!v || typeof v !== 'object') return null;
  return {
    text: typeof v.text === 'string' ? v.text : '',
    parts: Array.isArray(v.parts) ? v.parts.filter((p): p is string => typeof p === 'string') : [],
    pasted: v.pasted === true,
    peeked: v.peeked === true,
  };
}

const unitOf = (v: unknown): 1 | 2 | 3 | 4 | 5 | null => (v === 1 || v === 2 || v === 3 || v === 4 || v === 5 ? v : null);

/** Zeitstempel einer Prüfung (nur im Klick, nie beim Zeichnen). */
const stamp = (): number => Date.now();

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
  const header = <ExerciseTop onClose={close} ctx={unit ? 'duty' : 'xtra'} />;

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
    <Frame top={header} kind={kind} materialId={m.id} device={device}>
      <TaskBody key={m.id} m={m} kind={kind} day={day} unit={unit} device={device} onStarted={() => setStarted(true)} onBack={close} onCombo={comboInstead} />
    </Frame>
  );
}

type BodyProps = { m: Material; kind: WriteKind; day: string; unit: 1 | 2 | 3 | 4 | 5 | null; device: Device; onStarted: () => void; onBack: () => void; onCombo: () => void };

/** Der eigentliche Ablauf, je Material einmal aufgebaut (`key`): der Entwurf wird beim Aufbau übernommen. */
function TaskBody({ m, kind, day, unit, device, onStarted, onBack, onCombo }: BodyProps) {
  const { t, lang, num } = useT();
  const profile = useLive((s) => s.docs['app/profile']);
  const goal = lengthGoal(kind, device);
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

  // Entwurf im Browser-Speicher (Bequemlichkeit, Fortsetzen nach Verlassen); leer = entfernt.
  useEffect(() => {
    if (!text.trim() && !parts.some((p) => p.trim())) local.remove(draftKey);
    else local.set(draftKey, JSON.stringify({ text, parts, pasted, peeked }));
  }, [draftKey, text, parts, pasted, peeked]);

  const composed = partsMode ? joinParts(parts) : text;
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
    const given = composed.trim();
    const ctx = tutorCtx(profile);
    const rulePrompt = targets.rule?.prompt ?? '';
    let fb: Feedback | null = null;
    let kps: string[] | null = keyPoints;
    if (m.kind === 'reply') {
      const out = await askReply.run({ incoming: m.incoming, must: m.mail.must.map((x) => x.en), words: targets.words, rule: rulePrompt, text: given, uiLang: lang, ctx, pats: patListText() });
      if (out) fb = fromReply(out);
    } else if (m.kind === 'write') {
      // T7: Claude prüft, was Emrah sieht – die Regel ist das erste Muster der Situation, die Wendungen sind die beiden Zielwörter.
      const v = mailVars({ situation: m.situation, text: given, ctx, uiLang: lang });
      const out = await askMail.run({ ...v, patterns: v.patterns.slice(0, 1), phrases: targets.words });
      if (out) fb = fromMail(out);
    } else {
      kps ??= await knownKeypoints(m.id, [useClock.getState().today, m.article.day]);
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
  };

  const title = m.kind === 'reply' ? t('axTaskReply', { name: m.mail.from }) : m.kind === 'write' ? t('axTaskWrite') : t(device === 'touch' ? 'axTaskSummary3' : 'axTaskSummary35');
  const sentGoal = goal.sentences ? (goal.sentences[0] === goal.sentences[1] ? String(goal.sentences[0]) : `${goal.sentences[0]}–${goal.sentences[1]}`) : '';
  const pointLabels = m.kind === 'reply' ? m.mail.must.map((x) => x[lang]) : (keyPoints ?? []);
  const editorOff = busy || !!run;

  return (
    <>
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

      <section className="flex flex-col gap-2">
        {partsMode && m.kind === 'reply' ? (
          <div className="flex flex-col gap-4" data-testid="ax-parts">
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
                  placeholder={k === mustN ? t('axPartClosePh') : t('axPlaceholder')}
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
                  className="lx-ax-input lx-glass w-full resize-y rounded-[var(--radius-control)] px-4 py-3 text-fg placeholder:text-subtle"
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
              className="lx-ax-input lx-glass w-full resize-y rounded-[var(--radius-control)] px-4 py-3 text-fg placeholder:text-subtle"
            />
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="lx-ax-small text-subtle lx-tnum" data-testid="ax-count" data-words={words} data-sentences={sentences}>
            {t('axCount', { n: num(words), min: goal.words[0], max: goal.words[1] })}
            {goal.sentences ? ` · ${t('axCountSent', { n: num(sentences), goal: sentGoal })}` : ''}
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
        {live?.hint && !run && (
          <p className="lx-ax-hint m-0 text-muted" role="status" data-testid="ax-copyhint">
            {t('axCopyHint')}
          </p>
        )}
      </section>

      {limited && (
        <p className="lx-ax-hint m-0 text-muted" role="status" data-testid="ax-limit">
          {t('axLimit')}
        </p>
      )}
      <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => void check()} />
      {!run && !busy && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" className="min-h-[52px]" onClick={() => void check()} disabled={tooLong || tooShort || checks >= MAX_CHECKS} data-testid="ax-check">
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
          onReveal={() => setRevealed(true)}
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
        />
      )}
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
        <p className="lx-ax-small m-0 text-subtle">{t('axReader', { to: m.situation.to })}</p>
        <p className="lx-ax-text m-0" lang={lang}>
          {m.situation.brief[lang]}
        </p>
      </section>
    );
  }
  return (
    <section className="lx-card flex flex-col gap-2 p-4 sm:p-6" data-testid="ax-article" data-open={String(open)}>
      <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 text-left" aria-expanded={open} onClick={() => onToggle(!open)} data-testid="ax-article-toggle">
        <span className="flex min-w-0 flex-col">
          <span className="lx-ax-small text-subtle">{t('axArticle')}</span>
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

function SelfFix({ self, text, onChange, onReveal }: { self: NonNullable<SelfState>; text: string; onChange: (fixes: string[]) => void; onReveal: () => void }) {
  const { t } = useT();
  const id = useId();
  const n = self.spots.length;
  return (
    <section className="lx-card flex flex-col gap-4 p-4 sm:p-6" data-testid="ax-self">
      <header className="flex flex-col gap-1">
        <h2 className="lx-ax-task m-0">{t('axSelfTitle')}</h2>
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
                className="lx-ax-input lx-glass min-h-11 w-full rounded-[var(--radius-control)] px-4 py-2 text-fg"
              />
            </li>
          );
        })}
      </ol>
      <Button variant="primary" className="min-h-[52px] self-start" onClick={onReveal} data-testid="ax-reveal">
        {t('axReveal')}
      </Button>
    </section>
  );
}

