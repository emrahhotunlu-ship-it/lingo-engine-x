import { motion } from 'framer-motion';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { SITUATIONS } from '../../content/say/situations';
import { wordCount } from '../../domain/input/textStats';
import { repairsFromCorrections, situationFor } from '../../domain/say/say';
import { SAY_MIN_WORDS, SAY_TIME_MS, sayId, sayPath, type SayFeedback, type SayItem } from '../../domain/say/sayDoc';
import { EnglishText } from '../../engine/EnglishText';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { sayCheck, type SayCheckOut } from '../../prompts/sayCheck';
import { patternHints } from '../patterns/store';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCompanionSee } from '../companion/seeing';
import { AiRunPanel, isBusy } from '../input/AiRunPanel';
import { clearDraft, loadDraft } from '../input/draft';
import { DraftArea } from '../input/DraftArea';
import { ExerciseTop, SummaryActions } from '../learn/ui';
import { useToday } from '../today/state';
import { flush } from '../progress/persist';
import { saveRepairs } from '../repair/store';
import { TakeChunkButton } from '../speak/TakeChunkButton';
import { recordSayDone, saveSayItem } from './persist';
import { SpeakButton } from '../../engine/SpeakButton';
import { unitResult } from '../../domain/speak/unitResult';
import { sayResume, type SaySnap } from '../speak/resumable';
import { TargetBar } from '../speak/TargetBar';
import { finishUnit, unitBlockOf } from '../speak/unit';
import { useUnitCtx } from '../speak/useUnit';
import type { Situation } from '../../content/say/situations';
import type { WeekTheme } from '../../domain/week/types';

// „Sag es“ (Lernberatung 27.09., V1/V2): Situation → 3–6 eigene Sätze (sanfte Zeitanzeige 3 Min.,
// nur Anzeige) → Prüfen → Rückmeldung in drei Schichten (Korrekturen, C1-Aufwertung, bessere
// Fassung) → „Nochmal, aber besser“: Rückmeldung ausgeblendet, dieselbe Antwort aus dem Kopf neu
// (2 Min.) → zweite Prüfung → beide Fassungen nebeneinander, darunter die bessere Fassung.
// Die Korrekturen des ERSTEN Durchgangs gehen automatisch in die Reparatur-Sätze (`app/repair`).
// Erledigt (`act.say`) nach dem zweiten Durchgang. Ohne Claude blockiert der Baustein die Pflicht
// nie: die Antwort wird dann ohne Prüfung gespeichert. Keine Selbstbewertung (A7).

// Neubau N71 „Laut zuerst“: vor dem Schreiben ein Zeitbalken (60 s) – laut sprechen, dann
// tippen oder mit der Diktiertaste der iPhone-Tastatur diktieren; nach der Rückmeldung die bessere
// Fassung per Sprachausgabe anhören und nachsprechen. In der Tageseinheit (Block 3, N75) ist die
// Situation die Kernaufgabe der Woche, das Ziel „2 deiner Wendungen · Werkzeug“ steht über dem
// Feld, und nach der Rückmeldung geht es mit „Weiter“ zu Block 4 (der zweite Durchgang ist Block 5).

type Phase = 'aloud' | 'write1' | 'feedback' | 'write2' | 'final';

/** Schritt in der Übungsleiste: 1 Sprechen und Schreiben · 2 Rückmeldung und zweiter Versuch · 3 Vergleich. */
const STEP_OF: Record<Phase, number> = { aloud: 1, write1: 1, feedback: 2, write2: 2, final: 3 };

/** Gespeicherte Rückmeldung (Fortsetzen) grob prüfen, bevor sie angezeigt/gespeichert wird. */
function isSayOut(v: unknown): v is SayCheckOut {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.corrections) && Array.isArray(o.upgrades) && typeof o.better === 'string' && typeof o.praise === 'string';
}

/** Laut sprechen: sanfte Zeitanzeige (nur Anzeige, bricht nichts ab). */
export const ALOUD_MS = 60_000;

/** Situation der Tageseinheit: die Kernaufgabe der Woche (Kennung `wk-<thema>`). */
function themeSituation(theme: WeekTheme): Situation {
  return { id: `wk-${theme.id}`, kind: theme.kind === 'life' ? 'life' : 'job', de: theme.task.de, en: theme.task.en };
}

const MAX_WORDS = 120;
const TEXT_MAX = 1500;

const fbOf = (o: SayCheckOut | null): SayFeedback | null =>
  o ? { corrections: o.corrections, upgrades: o.upgrades.map((u) => ({ from: u.from, to: u.to, why: u.why, ...(u.phrase ? { phrase: u.phrase, de: u.de, def: u.def } : {}) })), better: o.better, praise: o.praise } : null;

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Sanfte Zeitanzeige: zählt herunter, danach ein ruhiger Hinweis – nie ein Abbruch. */
function SoftTimer({ start, total, testId = 'say-timer', aloud = false }: { start: number; total: number; testId?: string; aloud?: boolean }) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = total - (now - start);
  const pct = Math.max(0, Math.min(1, left / total));
  return (
    <div className="flex items-center gap-3" data-testid={testId} data-left={Math.max(0, Math.ceil(left / 1000))}>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${pct * 100}%` }} />
      </div>
      <span className="lx-tnum text-xs text-muted">{aloud ? (left > 0 ? t('nbSprechenAloudLeft', { t: fmt(left) }) : t('nbSprechenAloudUp')) : left > 0 ? t('sayTimeLeft', { t: fmt(left) }) : t('sayTimeUp')}</span>
    </div>
  );
}

export function SayScreen() {
  const { t, tn, lang } = useT();
  const back = useNav((s) => s.back);
  const unit = useNav((s) => (s.route.name === 'say' ? unitBlockOf(s.route.unit) : null));
  const ctx = useUnitCtx('task.say', unit);
  const dutyToday = useToday().duties.items.some((d) => d.id === 'ch:say') || !!unit;
  const ai = useAiAvailable();
  const [day] = useState(() => useClock.getState().today);
  // Fortsetzen nach Neuladen (G3): Schritt, Situation und Beginn kommen aus der Momentaufnahme.
  const [restored] = useState<SaySnap | null>(() => sayResume.take());
  const [shift, setShift] = useState(0);
  const sit = useMemo(() => {
    const theme = ctx?.theme ?? null;
    if (restored) {
      if (theme && restored.sit === `wk-${theme.id}`) return themeSituation(theme);
      const hit = SITUATIONS.find((s) => s.id === restored.sit);
      if (hit) return hit;
    }
    if (theme) return themeSituation(theme);
    return situationFor(SITUATIONS, day, shift);
  }, [day, shift, ctx?.theme, restored]);
  const [phase, setPhase] = useState<Phase>(() => restored?.phase ?? 'aloud');
  const [t0] = useState(() => restored?.t0 ?? Date.now());
  const [passStart, setPassStart] = useState(() => Date.now());
  const key1 = `say:${day}:${sit?.id ?? ''}:1`;
  const key2 = `say:${day}:${sit?.id ?? ''}:2`;
  const [text1, setText1] = useState(() => restored?.a1 ?? loadDraft(key1));
  const [text2, setText2] = useState('');
  const [fb1, setFb1] = useState<SayCheckOut | null>(() => (restored?.phase === 'write2' && isSayOut(restored.fb1) ? restored.fb1 : null));
  const [fb2, setFb2] = useState<SayCheckOut | null>(null);
  const [repairs, setRepairs] = useState<{ state: 'idle' | 'saved' | 'failed'; n: number }>({ state: 'idle', n: 0 });
  const [saveFailed, setSaveFailed] = useState(false);
  const ask1 = useAsk(sayCheck);
  const ask2 = useAsk(sayCheck);
  const finished = useRef<SayItem | null>(null);
  const [doneItem, setDoneItem] = useState<SayItem | null>(null);
  const infoId = useId();
  const [info, setInfo] = useState(false);
  const situation = sit ? (lang === 'de' ? sit.de : sit.en) : '';
  const itemId = useMemo(() => (sit ? sayId(sit.id, t0) : ''), [sit, t0]);

  // Schritt für das Fortsetzen melden; das reguläre Ende löscht ihn.
  useEffect(() => {
    if (!sit) return;
    if (phase === 'aloud' || phase === 'write1') sayResume.set({ phase, sit: sit.id, t0, ...(unit ? { unit } : {}) });
    else if (phase === 'write2') sayResume.set({ phase, sit: sit.id, t0, a1: text1.slice(0, TEXT_MAX), ...(fb1 ? { fb1 } : {}), ...(unit ? { unit } : {}) });
    else if (phase === 'final') sayResume.clear();
  }, [phase, sit, t0, unit, text1, fb1]);

  useCompanionSee({ area: 'write', label: t('sayTitle'), phase: phase === 'feedback' || phase === 'final' ? 'feedback' : 'idle', ...(situation ? { detail: situation } : {}) });
  useHotkeys({ escape: back }, () => false);

  const words1 = wordCount(text1);
  const words2 = wordCount(text2);
  const busy1 = isBusy(ask1.phase);
  const busy2 = isBusy(ask2.phase);

  const item = (a2: string, f1: SayCheckOut | null, f2: SayCheckOut | null, now: number): SayItem | null =>
    sit ? { id: itemId, t: t0, day, sit: sit.id, kind: sit.kind, a1: text1.trim().slice(0, TEXT_MAX), a2: a2.trim().slice(0, TEXT_MAX), fb1: fbOf(f1), fb2: fbOf(f2), ms: Math.max(0, now - t0), lang, ai: !!f1 } : null;

  const check1 = async () => {
    if (!sit || words1 < SAY_MIN_WORDS || busy1) return;
    const r = await ask1.run({ situation: sit.en, kind: sit.kind, text: text1.trim(), uiLang: lang, watch: await patternHints() });
    if (!r) return;
    setFb1(r);
    setPhase('feedback');
    clearDraft(key1);
    // Zwischenstand sichern (derselbe Eintrag wird am Ende ersetzt).
    const it = item('', r, null, Date.now());
    if (it) void saveSayItem(it);
    // Alle Korrekturen des ERSTEN Durchgangs → Reparatur-Sätze (src 'say', ctx = Situation).
    const add = repairsFromCorrections(text1, r.corrections, situation);
    if (add.length) {
      const ok = await saveRepairs(add);
      setRepairs({ state: ok ? 'saved' : 'failed', n: add.length });
    }
  };

  const finish = async (a2: string, f2: SayCheckOut | null) => {
    if (finished.current) return;
    const it = item(a2, fb1, f2, Date.now());
    if (!it) return;
    finished.current = it;
    setDoneItem(it);
    setPhase('final');
    clearDraft(key1);
    clearDraft(key2);
    const [a, b] = await Promise.all([saveSayItem(it), recordSayDone(it, situation)]);
    setSaveFailed(!a || !b);
  };

  const retrySave = async () => {
    const it = finished.current;
    if (!it) return;
    const [a, b] = await Promise.all([saveSayItem(it), flush()]);
    setSaveFailed(!a || !b);
  };

  const check2 = async () => {
    if (!sit || words2 < SAY_MIN_WORDS || busy2) return;
    const r = await ask2.run({ situation: sit.en, kind: sit.kind, text: text2.trim(), uiLang: lang, watch: await patternHints() });
    if (!r) return;
    setFb2(r);
    await finish(text2, r);
  };

  /** Tageseinheit: Block 3 abschließen und an P1 melden (Text, bessere Fassung, Korrekturen). */
  const reportUnit = () => {
    const it = finished.current;
    if (!unit || !it) return;
    finishUnit('task.say', unit, unitResult('task.say', `${sayPath(it.day)}#${it.id}`, it.a2 || it.a1, fb1?.corrections ?? [], fb1?.better ?? null));
  };

  const again = () => {
    setPassStart(Date.now());
    setText2(loadDraft(key2));
    setPhase('write2');
  };

  if (!sit) return null;
  const pass = phase === 'write2' ? 2 : phase === 'write1' ? 1 : null;
  const statusParts = [t(`sayKind_${sit.kind}`), pass ? t('sayPass', { n: pass }) : t('sayDone')];

  const situationCard = (
    <Card channel="speak" className="flex flex-col gap-3" data-testid="say-situation" data-sit={sit.id} data-kind={sit.kind}>
      <p className="lx-eyebrow">{t('saySituation')}</p>
      <p className="text-base leading-relaxed">{situation}</p>
      {(phase === 'write1' || phase === 'aloud') && !text1.trim() && !busy1 && !ctx?.theme && (
        <div>
          <Button variant="ghost" icon="refresh" onClick={() => setShift((n) => n + 1)} data-testid="say-other">
            {t('sayOther')}
          </Button>
        </div>
      )}
    </Card>
  );

  return (
    <motion.section
      className="flex flex-col gap-5 py-4 sm:py-8"
      data-testid="say"
      data-phase={phase}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      aria-labelledby={`${infoId}-title`}
    >
      <header className="flex flex-col gap-3">
        <ExerciseTop onClose={back} closeLabel={t('inLeave')} closeTestId="say-close" progress={{ n: STEP_OF[phase], total: 3 }} ctx={dutyToday ? 'duty' : 'extra'} duty="ch:say" />
        <h1 id={`${infoId}-title`} className="text-lg font-semibold tracking-tight">
          {t('sayTitle')}
        </h1>
        <p className="lx-tnum text-xs font-medium text-muted" data-testid="say-status">
          {statusParts.join(' · ')}
        </p>
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-medium" data-testid="task">
            {phase === 'write2' ? t('sayAgainTask') : t('sayTask')}
          </p>
          <button
            type="button"
            className="-m-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
            aria-label={t('inInfo')}
            aria-expanded={info}
            aria-controls={`${infoId}-purpose`}
            onClick={() => setInfo((v) => !v)}
            data-testid="purpose-info"
          >
            <Icon name="info" size={18} />
          </button>
        </div>
        {info && (
          <p id={`${infoId}-purpose`} className="text-sm text-muted" data-testid="purpose">
            {t('sayPurpose')}
          </p>
        )}
      </header>

      <div className="flex max-w-3xl flex-col gap-5">
        {phase !== 'final' && situationCard}

        {phase === 'aloud' && (
          <div className="flex flex-col gap-4" data-testid="say-aloud">
            <p className="lx-eyebrow">{t('nbSprechenAloudTitle')}</p>
            <p className="text-base">{t('nbSprechenAloudTask')}</p>
            <SoftTimer start={passStart} total={ALOUD_MS} testId="say-aloud-timer" aloud />
            <div>
              <Button
                variant="primary"
                size="lg"
                icon="check"
                onClick={() => {
                  setPassStart(Date.now());
                  setPhase('write1');
                }}
                data-testid="say-aloud-done"
              >
                {t('nbSprechenAloudDone')}
              </Button>
            </div>
          </div>
        )}

        {phase === 'write1' && (
          <>
            <TargetBar text={text1} ctx={ctx} />
            <SoftTimer start={passStart} total={SAY_TIME_MS.first} />
            <p className="text-sm text-muted" data-testid="say-dictate-hint">
              {t('nbSprechenDictateHint')}
            </p>
            <DraftArea value={text1} onChange={(v) => setText1(v.slice(0, TEXT_MAX))} label={t('sayDraftLabel')} draftKey={key1} min={SAY_MIN_WORDS} max={MAX_WORDS} rows={7} disabled={busy1} testId="say-draft" />
            {!ai && (
              <p className="text-sm text-muted" data-testid="say-noai-hint">
                {t('sayNoAi')}
              </p>
            )}
            <AiRunPanel phase={ask1.phase} error={ask1.phase === 'error' ? ask1.error : null} onStop={ask1.stop} onRetry={() => void check1()} />
            {!busy1 && (
              <div className="flex flex-wrap items-center gap-3">
                {ai && ask1.phase !== 'error' && (
                  <Button variant="primary" size="lg" iconAfter="arrowRight" disabled={words1 < SAY_MIN_WORDS} onClick={() => void check1()} data-testid="say-check" data-ai="">
                    {t('sayCheck')}
                  </Button>
                )}
                {(!ai || ask1.phase === 'error') && (
                  <Button variant="ghost" onClick={() => void finish('', null).then(reportUnit)} disabled={words1 < SAY_MIN_WORDS} data-testid="say-noai">
                    {t('saySaveNoAi')}
                  </Button>
                )}
                {words1 < SAY_MIN_WORDS && <p className="text-xs text-muted">{t('sayMinHint', { n: SAY_MIN_WORDS })}</p>}
              </div>
            )}
          </>
        )}

        {phase === 'feedback' && fb1 && (
          <>
            <Feedback fb={fb1} situationTitle={situation} sourceRef={`${sayPath(day)}#${itemId}`} />
            {repairs.state === 'saved' && (
              <p className="flex items-center gap-2 text-sm text-accent-text" role="status" data-testid="say-repairs" data-n={repairs.n}>
                <Icon name="check" size={16} />
                {tn('sayRepairsSaved', repairs.n)}
              </p>
            )}
            {repairs.state === 'failed' && (
              <p className="text-sm text-danger-text" role="alert" data-testid="say-repairs-failed">
                {t('sayRepairsFailed')}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {unit ? (
                <Button
                  variant="primary"
                  size="lg"
                  iconAfter="arrowRight"
                  onClick={() => {
                    void finish('', null).then(reportUnit);
                  }}
                  data-testid="say-unit-next"
                >
                  {t('nbSprechenUnitDone')}
                </Button>
              ) : (
                <Button variant="primary" size="lg" icon="refresh" onClick={again} data-testid="say-again">
                  {t('sayAgain')}
                </Button>
              )}
            </div>
          </>
        )}

        {phase === 'write2' && (
          <>
            <TargetBar text={text2} ctx={ctx} />
            <SoftTimer start={passStart} total={SAY_TIME_MS.second} />
            <DraftArea value={text2} onChange={(v) => setText2(v.slice(0, TEXT_MAX))} label={t('sayDraftLabel2')} draftKey={key2} min={SAY_MIN_WORDS} max={MAX_WORDS} rows={7} disabled={busy2} testId="say-draft2" />
            <AiRunPanel phase={ask2.phase} error={ask2.phase === 'error' ? ask2.error : null} onStop={ask2.stop} onRetry={() => void check2()} />
            {!busy2 && (
              <div className="flex flex-wrap items-center gap-3">
                {ai && ask2.phase !== 'error' && (
                  <Button variant="primary" size="lg" iconAfter="arrowRight" disabled={words2 < SAY_MIN_WORDS} onClick={() => void check2()} data-testid="say-check2" data-ai="">
                    {t('sayCheck')}
                  </Button>
                )}
                {(!ai || ask2.phase === 'error') && (
                  <Button variant="ghost" onClick={() => void finish(text2, null)} disabled={words2 < SAY_MIN_WORDS} data-testid="say-noai">
                    {t('sayFinishNoAi')}
                  </Button>
                )}
                {words2 < SAY_MIN_WORDS && <p className="text-xs text-muted">{t('sayMinHint', { n: SAY_MIN_WORDS })}</p>}
              </div>
            )}
          </>
        )}

        {phase === 'final' && doneItem && (
          <FinalView item={doneItem} fb1={fb1} fb2={fb2} situation={situation} saveFailed={saveFailed} onRetrySave={() => void retrySave()} unit={!!unit} />
        )}
      </div>
    </motion.section>
  );
}

/** Rückmeldung in drei Schichten: Korrekturen · C1-Aufwertung · bessere Fassung (englische Wörter antippbar). */
function Feedback({ fb, situationTitle, sourceRef }: { fb: SayCheckOut; situationTitle: string; sourceRef: string }) {
  const { t, lang } = useT();
  return (
    <div className="flex flex-col gap-4" data-testid="say-feedback">
      <p className="text-sm font-medium text-accent-text" data-testid="say-praise">
        {fb.praise}
      </p>
      <Card as="div" className="flex flex-col gap-3" data-testid="say-corrections" data-n={fb.corrections.length}>
        <p className="lx-eyebrow">{t('sayCorrections')}</p>
        {fb.corrections.length === 0 && <p className="text-sm text-muted">{t('sayNoCorrections')}</p>}
        <ul className="flex flex-col gap-3">
          {fb.corrections.map((c, i) => (
            <li key={`${c.wrong}-${i}`} className="flex flex-col gap-1" data-testid="say-correction">
              <p className="text-sm text-muted line-through decoration-danger-text/60" lang="en">
                {c.wrong}
              </p>
              <EnglishText text={c.right} area="write" title={situationTitle} className="text-base font-medium" testId="say-right" />
              <p className="text-sm text-muted">{c.why}</p>
            </li>
          ))}
        </ul>
      </Card>
      {fb.upgrades.length > 0 && (
        <Card as="div" className="flex flex-col gap-3" data-testid="say-upgrades">
          <p className="lx-eyebrow">{t('sayUpgrades')}</p>
          <ul className="flex flex-col gap-4">
            {fb.upgrades.map((u, i) => (
              <li key={`${u.to}-${i}`} className="flex flex-col gap-1" data-testid="say-upgrade">
                <p className="text-sm text-muted" lang="en">
                  {u.from}
                </p>
                <EnglishText text={u.to} area="write" title={situationTitle} className="text-base font-medium" />
                <p className="text-sm text-muted">{u.why}</p>
                {u.phrase && (
                  <div>
                    <TakeChunkButton
                      compact
                      input={{ en: u.phrase, de: u.de, def: u.def, kind: 'phrase', register: 'neutral', why: u.why, whyLang: lang, level: 'C1', src: { kind: 'say', ref: sourceRef, title: situationTitle.slice(0, 120), utterance: u.from.slice(0, 200), upgraded: u.to } }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card as="div" channel="speak" className="flex flex-col gap-2" data-testid="say-better">
        <div className="flex items-center justify-between gap-2">
          <p className="lx-eyebrow">{t('sayBetter')}</p>
          <SpeakButton text={fb.better} label={t('nbSprechenPlayBetter')} testId="say-better-play" />
        </div>
        <EnglishText as="div" text={fb.better} area="write" title={situationTitle} className="text-base leading-relaxed" />
        <p className="text-sm text-muted" data-testid="say-shadow">
          {t('nbSprechenShadow')}
        </p>
      </Card>
    </div>
  );
}

/** Abschluss: beide Fassungen nebeneinander, darunter die bessere Fassung. */
function FinalView({ item, fb1, fb2, situation, saveFailed, onRetrySave, unit }: { item: SayItem; fb1: SayCheckOut | null; fb2: SayCheckOut | null; situation: string; saveFailed: boolean; onRetrySave: () => void; unit: boolean }) {
  const { t } = useT();
  const better = fb2?.better ?? fb1?.better ?? '';
  const open = fb2?.corrections ?? [];
  return (
    <div className="flex flex-col gap-5" data-testid="say-final">
      <div className="lx-glass flex flex-col gap-1 rounded-[var(--radius-card)] p-5" data-testid="unit-done" data-state="done">
        <p className="lx-eyebrow text-accent-text">{t('sayDone')}</p>
        <p className="text-base">{situation}</p>
      </div>
      {item.a2 ? (
        <section aria-label={t('sayBoth')} className="grid gap-3 sm:grid-cols-2" data-testid="say-compare">
          <Card as="div" className="flex flex-col gap-2" data-testid="say-before">
            <p className="lx-eyebrow">{t('sayBefore')}</p>
            <EnglishText as="div" text={item.a1} area="write" title={situation} className="text-base leading-relaxed text-muted" />
          </Card>
          <Card as="div" channel="speak" className="flex flex-col gap-2" data-testid="say-after">
            <p className="lx-eyebrow">{t('sayAfter')}</p>
            <EnglishText as="div" text={item.a2} area="write" title={situation} className="text-base leading-relaxed" />
          </Card>
        </section>
      ) : (
        <Card as="div" className="flex flex-col gap-2" data-testid="say-before">
          <p className="lx-eyebrow">{t('sayDraftLabel')}</p>
          <EnglishText as="div" text={item.a1} area="write" title={situation} className="text-base leading-relaxed" />
        </Card>
      )}
      {open.length > 0 && (
        <Card as="div" className="flex flex-col gap-3" data-testid="say-open">
          <p className="lx-eyebrow">{t('sayStillOpen')}</p>
          <ul className="flex flex-col gap-3">
            {open.map((c, i) => (
              <li key={`${c.wrong}-${i}`} className="flex flex-col gap-1">
                <p className="text-sm text-muted line-through" lang="en">
                  {c.wrong}
                </p>
                <EnglishText text={c.right} area="write" title={situation} className="text-base font-medium" />
                <p className="text-sm text-muted">{c.why}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {better && (
        <Card as="div" channel="speak" className="flex flex-col gap-2" data-testid="say-better">
          <div className="flex items-center justify-between gap-2">
            <p className="lx-eyebrow">{t('sayBetter')}</p>
            <SpeakButton text={better} label={t('nbSprechenPlayBetter')} testId="say-better-play" />
          </div>
          <EnglishText as="div" text={better} area="write" title={situation} className="text-base leading-relaxed" />
        </Card>
      )}
      {saveFailed && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-danger-text" role="alert" data-testid="say-save-failed">
          <span>{t('saySaveFailed')}</span>
          <Button onClick={onRetrySave} icon="refresh">
            {t('sayRetrySave')}
          </Button>
        </div>
      )}
      {/* In der Tageseinheit führt P1 nach der Meldung weiter (Zwischenkarte); sonst zurück zur Herkunft. */}
      {!unit && <SummaryActions onBack={() => undefined} />}
    </div>
  );
}
