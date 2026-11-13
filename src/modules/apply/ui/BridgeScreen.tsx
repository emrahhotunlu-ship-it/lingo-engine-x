import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  AiRunPanel,
  Button,
  ExerciseShell,
  ExerciseTop,
  Icon,
  isBusy,
  KEY_PREFIX,
  local,
  saveBridgeStat,
  SentenceInput,
  SessionEnd,
  Skeleton,
  stepNextLabel,
  takeTutorCall,
  unitDone,
  useAiAvailable,
  useAsk,
  useClock,
  useLive,
  useNav,
  useT,
  type IconName,
  type MessageKey,
  type ScreenProps,
  type ShellFeedback,
} from '../sharedUi';
import { alignWords, applyBridge, BRIDGE_N, bridgeNeedsFix, bridgeWordInText, patternById, tutorCtx } from '../shared';
import type { BridgeOut, BridgeTarget, PatVerdict, PatWhy, WordWhy } from '../shared';
import { bridgeVerdict, hasFix, patMark, starterUsed, wordMark, type Mark } from '../domain/bridgeResult';
import { useBridgeTargets } from './bridgeData';
import { saveBridge, type BridgeSaved } from './bridgeSave';
import { startOrderRound } from './route';

// Brücken-Sätze (Großpaket P „Politur“, P4; Entscheidung E2 vom 13.11.2026): Pflicht-Schritt 3 „Anwenden“ und freie Zusatzrunde.
// Je Satz EIN Wort aus der Wörter-App und EIN Grammatik-Muster, beide sichtbar und verbindlich („Benutze: …“), dazu Situation und Satzanfang.
// Claude prüft Wort und Muster getrennt (`apply-bridge@1`); die Rückmeldung hat drei Zeilen: Wort, Muster, „Merk dir“.
// Die vier Pflichtfragen stehen an fester Stelle (Kap. 2 Nr. 4): Was soll ich tun (Aufgabe) · Wozu (Zweck unter der Aufgabe) · Was hatte ich, was
// ist richtig (Vergleich „Du → besser“, nur bei Fehler) · Warum (je Element ein Satz, auch bei richtig).
// Bei Fehler erst „Nochmal selbst schreiben“, dann die bessere Fassung; die Profi-Fassung ist aufklappbar.
// Ziele, Position und Ergebnisse dieses Lerntags stehen im Browser-Speicher (Fortsetzen nach Verlassen; Kap. 15: nichts würfelt sich neu);
// Ergebnis, Fehlersatz und Belege stehen in der Datenbank (`bridgeSave.ts`).

type Done = { w: Mark; p: Mark; ok: boolean };
type Stored = { targets: BridgeTarget[]; pos: number; results: Done[] };
type Unit = 1 | 2 | 3 | 4 | 5;

const WORD_WHY: Record<WordWhy, MessageKey> = {
  today: 'axBWordWhy_today',
  yesterday: 'axBWordWhy_yesterday',
  learning: 'axBWordWhy_learning',
  sits: 'axBWordWhy_sits',
  known: 'axBWordWhy_known',
  legacy: 'axBWordWhy_legacy',
};
const PAT_WHY: Record<PatWhy, MessageKey> = { today: 'axBPatWhy_today', safe: 'axBPatWhy_safe', firm: 'axBPatWhy_firm', known: 'axBPatWhy_known' };
const WORD_LABEL: Record<BridgeOut['word']['v'], MessageKey> = { ok: 'axBWord_ok', odd: 'axBWord_odd', wrong: 'axBWord_wrong', thin: 'axBWord_thin', unused: 'axBWord_unused' };
const PAT_LABEL: Record<PatVerdict, MessageKey> = { ok: 'axBPat_ok', wrong: 'axBPat_wrong', avoided: 'axBPat_avoided', unsure: 'axBPat_unsure' };
const WORD_FALLBACK: Record<BridgeOut['word']['v'], MessageKey> = { ok: 'axBWordWhyOk', odd: 'axBWordWhyErr', wrong: 'axBWordWhyErr', thin: 'axBWordWhyThin', unused: 'axBWordWhyUnused' };
const PAT_FALLBACK: Record<PatVerdict, MessageKey> = { ok: 'axBPatWhyOk', wrong: 'axBPatWhyErr', avoided: 'axBPatWhyAvoided', unsure: 'axBPatWhyUnsure' };
const TONE: Record<Mark, string> = { ok: 'bg-ok-soft text-ok-text', bad: 'bg-wrong-soft text-wrong-text', open: 'bg-surface-strong text-muted' };
const ICON: Record<Mark, IconName> = { ok: 'check', bad: 'close', open: 'minus' };

const unitOf = (v: unknown): Unit | null => (v === 1 || v === 2 || v === 3 || v === 4 || v === 5 ? v : null);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Gespeicherter Stand einer Runde (nur dieser Lerntag); Ungültiges und unbekannte Muster werden verworfen. */
function readStored(key: string): Stored | null {
  const v = local.getJson<{ targets?: unknown; pos?: unknown; results?: unknown }>(key);
  if (!v || !Array.isArray(v.targets) || !v.targets.length || typeof v.pos !== 'number' || v.pos < 0 || v.pos >= v.targets.length || !Array.isArray(v.results)) return null;
  const ok = v.targets.every((x) => {
    const tg = x as Partial<BridgeTarget> | null;
    return !!tg && !!tg.word && isStr(tg.word.key) && isStr(tg.word.word) && isStr(tg.pat) && isStr(tg.topic) && !!patternById(tg.pat);
  });
  return ok ? { targets: v.targets as BridgeTarget[], pos: v.pos, results: v.results as Done[] } : null;
}

/** Aufklapper der Profi-Fassung (wie `Fold` der Schreibübungen; eigene Abschrift, damit beide Bildschirme getrennte Stücke bleiben). */
function Fold({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-2" data-open={String(open)}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} data-testid={testId} className="lx-ax-text inline-flex min-h-11 items-center gap-2 self-start rounded-lg font-semibold text-muted transition-colors hover:text-fg">
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={18} />
        {label}
      </button>
      {open && (
        <div id={id} className="flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  );
}

const blur = (): void => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
};

export function ApplyBridgeScreen({ route }: ScreenProps<'applyBridge'>) {
  const { t } = useT();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const [day] = useState(today);
  const [unit] = useState(() => unitOf(route.unit));
  const [n] = useState(() => (route.n === 1 ? 1 : BRIDGE_N));
  const ai = useAiAvailable();
  const saveKey = `${KEY_PREFIX}bridge:${day}:${unit ?? 'free'}:${n}`;
  const [stored] = useState(() => readStored(saveKey));
  const load = useBridgeTargets({ day, n, free: !unit, frozen: !!stored });
  // Ziele einfrieren, sobald sie erstmals da sind (die Daten können nach dem Öffnen eintreffen).
  const [targets, setTargets] = useState<BridgeTarget[] | null>(() => stored?.targets ?? null);
  if (!targets && load.state === 'ready') setTargets(load.targets);

  const close = (): void => {
    blur();
    back();
  };
  // Ohne Claude oder ohne passende Ziele: im Tagesweg geht es mit Satzbau weiter (ohne KI erfüllbar, der alte Weg).
  const orderInstead = (): void => {
    if (!unit) return;
    blur();
    if (startOrderRound(day, unit)) go({ name: 'drill', kind: 'order', ctx: 'duty' });
  };
  const frame = (body: ReactNode, state: string): ReactNode => (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="bridge" data-state={state} data-mode={unit ? 'duty' : 'free'}>
      {body}
    </div>
  );
  const unavailable = (text: string, testId: string): ReactNode =>
    frame(
      <>
        <ExerciseTop onClose={close} ctx={unit ? 'duty' : 'xtra'} />
        <div className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5" data-testid={testId}>
          <p className="lx-t-support m-0 text-muted">{text}</p>
          {unit ? (
            <Button variant="primary" className="self-start" onClick={orderInstead} data-testid="bx-order-instead">
              {t('axBOrderInstead')}
            </Button>
          ) : (
            <Button variant="secondary" className="self-start" onClick={close} data-testid="bx-back">
              {t('axBBack')}
            </Button>
          )}
        </div>
      </>,
      'unavailable',
    );

  if (!ai && !stored) return unavailable(t('axBUnavailable'), 'bx-unavailable');
  if (!targets)
    return frame(
      <>
        <ExerciseTop onClose={close} ctx={unit ? 'duty' : 'xtra'} />
        <Skeleton className="h-64 w-full" />
      </>,
      'loading',
    );
  if (!targets.length) return unavailable(t('axBNone'), 'bx-none');
  return frame(<Round targets={targets} unit={unit} saveKey={saveKey} stored={stored} onClose={close} />, 'open');
}

type RoundProps = { targets: BridgeTarget[]; unit: Unit | null; saveKey: string; stored: Stored | null; onClose: () => void };
type Res = { out: BridgeOut; given: string; now: number };

function Round({ targets, unit, saveKey, stored, onClose }: RoundProps) {
  const { t, lang } = useT();
  const ask = useAsk(applyBridge);
  const [pos, setPos] = useState(() => stored?.pos ?? 0);
  const [results, setResults] = useState<Done[]>(() => stored?.results ?? []);
  const [text, setText] = useState('');
  const [miss, setMiss] = useState(false);
  const [limited, setLimited] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  const [saved, setSaved] = useState<BridgeSaved | null>(null);
  /** „Nochmal selbst schreiben“: `null` = zu, sonst der Text im Feld; `redoDone` = der abgeschlossene zweite Versuch. */
  const [redo, setRedo] = useState<string | null>(null);
  const [redoDone, setRedoDone] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const shownAt = useRef(0);
  const durations = useRef<number[]>([]);
  const lastNow = useRef(0);
  const [startedAt] = useState(() => performance.now());
  /** Marke dieser Runde für `app/profile.abm` (dieselbe Runde zählt höchstens einmal, auch bei doppeltem „Fertig“). */
  const [round] = useState(() => `${saveKey.slice(KEY_PREFIX.length)}:${Date.now().toString(36)}`.slice(-40));
  const [endedAt, setEndedAt] = useState(0);

  useEffect(() => {
    shownAt.current = performance.now();
  }, [pos]);
  useEffect(() => {
    if (pos >= targets.length) local.remove(saveKey);
    else local.set(saveKey, JSON.stringify({ targets, pos, results }));
  }, [saveKey, targets, pos, results]);

  const cur = targets[pos] ?? null;
  const pat = cur ? patternById(cur.pat) : null;
  const finished = pos >= targets.length;
  const busy = isBusy(ask.phase);
  const inText = !!cur && bridgeWordInText(text, { word: cur.word.word, kind: cur.word.kind });
  const situation = cur?.frame ? (lang === 'en' ? cur.frame.en : cur.frame.de) : null;
  // Satzanfang zum Übernehmen: nur, wenn er als Ganzes vorne steht (ein „…“ mitten im Satzanfang lässt sich nicht einsetzen).
  const starter = cur?.frame?.starter ?? null;
  const starterHead = starter && starter.indexOf('…') === starter.length - 1 ? starter.replace(/\s*…$/, '') : null;

  const check = async (): Promise<void> => {
    const given = text.trim();
    if (!cur || !pat || !given || res || busy) return;
    blur();
    // Wort zuerst lokal: fehlt es, erst ein Hinweis ohne KI und ohne Verbrauch; ein zweiter Druck prüft trotzdem (gebeugte Formen, Ersatzwort).
    if (!bridgeWordInText(given, { word: cur.word.word, kind: cur.word.kind }) && !miss) {
      setMiss(true);
      return;
    }
    if (!takeTutorCall()) {
      setLimited(true);
      return;
    }
    setLimited(false);
    const ms = Math.max(0, Math.round(performance.now() - shownAt.current));
    const out = await ask.run({
      word: { word: cur.word.word, meaning: cur.word.de || 'any common meaning', kind: cur.word.kind, example: cur.word.example },
      pat: { id: pat.id, name: pat.name.en, form: pat.form.en, use: pat.use.en, example: pat.ex[0]?.en ?? '', trap: { bad: pat.trap.bad, good: pat.trap.good } },
      ...(cur.frame ? { situation: cur.frame.en, starter: cur.frame.starter } : {}),
      sentence: given,
      uiLang: lang,
      ctx: tutorCtx(useLive.getState().docs['app/profile']),
    });
    // KI nicht erreichbar oder unlesbar: nicht als falsch werten, „Prüfen“ fragt erneut.
    if (!out) return;
    // Zeit der Prüfung = Kennung des Ergebnisses und Schlüssel des Rückflusses: je Satz eine eigene, auch wenn die Uhr steht oder zurückspringt.
    const now = Math.max(Date.now(), lastNow.current + 1);
    lastNow.current = now;
    setMiss(false);
    setRes({ out, given, now });
    setResults((l) => [...l, { w: wordMark(out.word.v), p: patMark(out.pat.v), ok: bridgeVerdict(out) === 'ok' }]);
    setSaved(null);
    // Übernommener Satzanfang: das Muster stand schon im vorgegebenen Teil – kein Beleg „frei verwendet“ (Prüfbefund 13.11.2026).
    const s = await saveBridge({ day: useClock.getState().today, now, target: cur, sentence: given, out, ms }, situation ?? pat.name[lang], { starterUsed: starterUsed(given, starterHead) });
    setSaved((prev) => prev ?? s);
  };

  const next = (): void => {
    const last = pos + 1 >= targets.length;
    // Nur geprüfte Sätze sind eine Messung; die Zeit läuft vom Zeigen der Aufgabe bis „Weiter“ (Schreiben, Prüfung, Rückmeldung lesen).
    if (res) durations.current.push(Math.round(performance.now() - shownAt.current));
    setPos((p) => p + 1);
    setText('');
    setMiss(false);
    setLimited(false);
    setRes(null);
    setSaved(null);
    setRedo(null);
    setRedoDone(null);
    setRevealed(false);
    setEndedAt(performance.now());
    if (!last) return;
    blur();
    if (durations.current.length) void saveBridgeStat(durations.current, round);
    // Tagesweg: nach dem letzten Satz ist Schritt 3 erledigt; als Anwenden-Tag zählt er nur, wenn mindestens ein Satz geprüft wurde.
    if (unit) unitDone(unit, undefined, { apDone: !!res || results.length > 0 });
  };

  const finishRedo = (): void => {
    if (redo === null || !redo.trim()) return;
    blur();
    setRedoDone(redo.trim());
    setRedo(null);
    setRevealed(true);
  };

  if (finished || !cur || !pat) {
    const right = results.filter((r) => r.ok).length;
    return (
      <>
        <ExerciseTop onClose={onClose} ctx={unit ? 'duty' : 'xtra'} />
        <SessionEnd right={right} total={Math.max(1, results.length)} ms={Math.max(1, endedAt - startedAt)} title={t('axBEndTitle')} next={{ label: t('axBBack'), run: onClose }} />
      </>
    );
  }

  const o = res?.out ?? null;
  const fix = !!res && !!o && hasFix(o, res.given);
  const example = !cur.frame ? (pat.ex[0]?.en ?? null) : null;

  const row = (mark: Mark, title: ReactNode, label: string, why: string, testId: string, v: string): ReactNode => (
    <li className="flex items-start gap-3" data-testid={testId} data-mark={mark} data-v={v}>
      <span className={`mt-0.5 flex size-6 flex-none items-center justify-center rounded-full ${TONE[mark]}`} aria-hidden="true">
        <Icon name={ICON[mark]} size={14} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="lx-t-body">
          {title} <span className="lx-t-meta text-muted">· {label}</span>
        </span>
        <span className="lx-t-support text-muted" lang={lang} data-testid={`${testId}-why`}>
          {why}
        </span>
      </span>
    </li>
  );

  const head = o && (
    <div className="flex flex-col gap-3" data-testid="bx-result">
      <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label={t('axBResult')}>
        {row(wordMark(o.word.v), <strong lang="en">{cur.word.word}</strong>, t(WORD_LABEL[o.word.v]), o.word.why || t(WORD_FALLBACK[o.word.v]), 'bx-row-word', o.word.v)}
        {row(patMark(o.pat.v), <strong>{pat.name[lang]}</strong>, t(PAT_LABEL[o.pat.v]), o.pat.why || t(PAT_FALLBACK[o.pat.v]), 'bx-row-pat', o.pat.v)}
      </ul>
      {o.extra && (
        <p className="lx-t-support m-0" data-testid="bx-extra">
          <span className="text-muted">{t('axBExtra')} </span>
          <span lang="en" className="text-wrong-text line-through decoration-wrong">
            {o.extra.from}
          </span>{' '}
          → <strong lang="en">{o.extra.to}</strong>. {o.extra.why}
        </p>
      )}
      <p className="lx-t-body m-0" data-testid="bx-keep">
        <strong>{t('axBKeep')}</strong> <span lang={lang}>{o.keep || `${pat.name[lang]}: ${pat.form[lang]}`}</span>
      </p>
    </div>
  );

  const act = res && o && (
    <div className="flex flex-col gap-3">
      {fix && !revealed && redo === null && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setRedo(res.given)} data-testid="bx-redo">
            {t('axBRedo')}
          </Button>
          <Button variant="quiet" onClick={() => setRevealed(true)} data-testid="bx-reveal">
            {t('axBReveal')}
          </Button>
        </div>
      )}
      {fix && !revealed && redo !== null && (
        <div className="flex flex-col gap-2" data-testid="bx-redo-box">
          <p className="lx-t-support m-0 text-muted">{t('axBRedoHint')}</p>
          <SentenceInput mode="free" value={redo} onChange={setRedo} onSubmit={finishRedo} testId="bx-redo-input" />
          <Button variant="secondary" className="self-start" onClick={finishRedo} disabled={!redo.trim()} data-testid="bx-redo-done">
            {t('axBRedoDone')}
          </Button>
        </div>
      )}
      {revealed && redoDone && (
        <p className="lx-t-body m-0" data-testid="bx-redo-text">
          <span className="lx-t-label block text-muted">{t('axBRedoYours')}</span>
          <span lang="en">{redoDone}</span>
        </p>
      )}
      {bridgeNeedsFix(o) && !fix && (
        <p className="lx-t-support m-0 text-muted" data-testid="bx-fixed-unsure">
          {t('axBFixedUnsure')}
        </p>
      )}
      {(revealed || !fix) && o.better && (
        <Fold label={t('axBBetter')} testId="bx-better">
          <p className="lx-t-body m-0" lang="en" data-testid="bx-better-text">
            {o.better}
          </p>
        </Fold>
      )}
    </div>
  );

  const ev = saved?.word?.ev ? saved.word.own : null;
  const tail = saved && (saved.repair || ev !== null || saved.pat || !saved.out) && (
    <div className="flex flex-col gap-1" aria-live="polite" data-testid="bx-notes">
      {ev !== null && (
        <p className="lx-t-meta m-0 text-muted" data-testid="bx-ev" data-own={ev}>
          {t(ev >= 2 ? 'axBEvDone' : 'axBEv', { word: cur.word.word, n: ev })}
        </p>
      )}
      {saved.pat && (
        <p className="lx-t-meta m-0 text-muted" data-testid="bx-pat-counted">
          {t('axBPatCounted')}
        </p>
      )}
      {saved.repair && (
        <p className="lx-t-meta m-0 text-muted" data-testid="bx-repair-note">
          {t('axBRepairNote')}
        </p>
      )}
      {!saved.out && (
        <p className="lx-t-meta m-0 text-muted" role="alert" data-testid="bx-savefail">
          {t('axSaveFail')}
        </p>
      )}
    </div>
  );

  const fb: ShellFeedback | null =
    res && o
      ? {
          verdict: bridgeVerdict(o),
          head,
          comparison: fix && revealed ? { given: res.given, ops: alignWords(res.given, o.fixed.trim()), correct: o.fixed.trim() } : null,
          explanation: null,
          act,
          tail,
          depth: 'full',
          auto: false,
        }
      : null;

  const prompt = (
    // UX-Nachprüfung Politur W1b: nach dem Prüfen klappen Situation, „Benutze:“ und Satzanfang ein – die Urteilszeilen nennen Wort und Muster
    // schon, und „Weiter“ bleibt am kurzen Bildschirm (375 × 700) im Bild. Der eigene Satz steht weiter im Feld darunter.
    <div className="lx-t-support flex flex-col gap-3 empty:hidden" data-testid="bx-task" data-word={cur.word.word} data-pat={cur.pat} data-slot-no={cur.slot} data-starter={starter ?? ''}>
      {!res && (
        <>
          {situation && (
            <p className="m-0" data-testid="bx-situation">
              <span className="text-muted">{t('axBSituation')}: </span>
              {situation}
            </p>
          )}
          <div className="flex flex-col gap-1.5" data-testid="bx-use">
            <p className="lx-t-label m-0 text-muted">{t('axBUse')}</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              <li className="flex flex-col" data-testid="bx-word" data-in={inText ? 'true' : 'false'}>
                <span>
                  <span className="text-muted">{t('axBWordLabel')}: </span>
                  <strong lang="en" className="lx-t-body font-semibold">
                    {cur.word.word}
                  </strong>
                  {cur.word.de && (
                    <span lang="de" className="text-muted" data-testid="bx-meaning">
                      {' '}
                      ({cur.word.de})
                    </span>
                  )}
                </span>
                <span className="lx-t-meta text-muted">
                  <span data-testid="bx-word-why" data-why={cur.whyWord}>
                    {t(WORD_WHY[cur.whyWord], { n: Math.min(2, cur.word.own + 1) })}
                  </span>
                  {!res && (
                    <span className={`ml-2 inline-flex items-center gap-1 ${inText ? 'text-ok-text' : 'text-subtle'}`} role="status" data-testid="bx-word-dot">
                      <span className={`inline-block size-2 rounded-full ${inText ? 'bg-ok' : 'bg-line-strong'}`} aria-hidden="true" />
                      {t(inText ? 'axBInText' : 'axBNotInText')}
                    </span>
                  )}
                </span>
              </li>
              <li className="flex flex-col" data-testid="bx-pat">
                <span>
                  <span className="text-muted">{t('axBPatLabel')}: </span>
                  <strong className="lx-t-body font-semibold">{pat.name[lang]}</strong>
                  <span className="text-muted" data-testid="bx-form">
                    {' '}
                    ({pat.form[lang]})
                  </span>
                </span>
                <span className="lx-t-meta text-muted" data-testid="bx-pat-why" data-why={cur.whyPat}>
                  {t(PAT_WHY[cur.whyPat])}
                </span>
              </li>
            </ul>
          </div>
          {starter ? (
            <div className="flex flex-col gap-1" data-testid="bx-starter">
              <span className="text-muted">{t(starterHead && !res ? 'axBStarterTap' : 'axBStarter')}</span>
              {starterHead && !res ? (
                <Button variant="quiet" className="self-start text-left" onClick={() => setText((cur0) => (cur0.trim() ? cur0 : `${starterHead} `))} disabled={!!text.trim() || busy} data-testid="bx-starter-use">
                  <span lang="en">{starter}</span>
                </Button>
              ) : (
                <span lang="en">{starter}</span>
              )}
            </div>
          ) : example ? (
            <p className="m-0" data-testid="bx-example">
              <span className="text-muted">{t('axBExample')}</span> <span lang="en">{example}</span>
            </p>
          ) : null}
        </>
      )}
    </div>
  );

  const last = pos + 1 >= targets.length;
  // Politur P1: der letzte Knopf eines Tagesschritts nennt das Ziel („Weiter: Grammatik“ / „Fertig für heute“), wie jeder Abschluss.
  return (
    <>
      {/* UX-Nachprüfung Politur K1: Kopf wie bei den anderen Übungen – Titel „Anwenden“ mit Zähler, nicht „Heute · Schritt 3: Anwenden“. */}
      <ExerciseTop onClose={onClose} progress={{ n: pos + 1, total: targets.length }} ctx={unit ? 'duty' : 'xtra'} area="words" areaLabel={t('axBBarTitle')} />
      <div data-testid="bx-item" data-pos={pos}>
        <ExerciseShell
          meta={{ ex: 'bridge', id: `${cur.word.key}|${cur.pat}`, kind: 'produce' }}
          status={{ area: 'words', state: null, kindLabel: t('axBKind'), badge: t('axBSentenceOf', { n: pos + 1, total: targets.length }), badgeTone: 'neutral' }}
          task={{ text: t('axBTask'), purpose: t('axBPurpose'), open: true }}
          prompt={prompt}
          answer={
            <div className="flex flex-col gap-3">
              <SentenceInput mode="free" value={text} onChange={setText} onSubmit={() => (res ? next() : void check())} disabled={!!res} placeholder={t('axBInput')} testId="bx-input" />
              {busy && <AiRunPanel phase={ask.phase} error={null} onStop={ask.stop} skeleton={false} />}
              {!busy && !res && ask.error && <AiRunPanel phase="error" error={ask.error} onRetry={() => void check()} skeleton={false} />}
            </div>
          }
          hint={!res && limited ? { text: t('axLimit'), tone: 'near' } : !res && miss ? { text: t('axBWordMissing', { word: cur.word.word }), tone: 'near' } : null}
          state={!res && (miss || limited) ? 'retry' : undefined}
          secondary={[{ id: 'skip', label: t('rxSkip'), onClick: next, testId: 'bx-skip', disabled: busy }]}
          primary={
            res
              ? { label: last ? ((unit ? stepNextLabel(t) : null) ?? t('axDone')) : t('rxNext'), onClick: next, testId: 'bx-next' }
              : { label: miss ? t('axBCheckAnyway') : t('rxCheck'), onClick: () => void check(), testId: 'bx-check', disabled: !text.trim() || busy, busy, busyLabel: t('exChecking') }
          }
          feedback={fb}
        />
      </div>
    </>
  );
}
