import { motion } from 'framer-motion';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { TONE_MESSAGES, TONE_REGISTERS, type ToneRegister } from '../../content/tones/messages';
import { wordCount } from '../../domain/input/textStats';
import { messageFor, repairsFromTones, TONE_MIN_WORDS, TONE_TEXT_MAX, toneId, type ToneItem, type ToneVerdict } from '../../domain/tones/tones';
import { EnglishText } from '../../engine/EnglishText';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT, type MessageKey } from '../../i18n';
import { toneCheck, type ToneCheckOut } from '../../prompts/toneCheck';
import { Button, IconButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCompanionSee } from '../companion/seeing';
import { AiRunPanel, isBusy } from '../input/AiRunPanel';
import { clearDraft, loadDraft } from '../input/draft';
import { DraftArea } from '../input/DraftArea';
import { SummaryActions } from '../learn/ui';
import { flush } from '../progress/persist';
import { saveRepairs } from '../repair/store';
import { recordTonesDone, saveToneItem } from './persist';
import { unitResult } from '../../domain/speak/unitResult';
import { tonesResume, type TonesSnap } from '../speak/resumable';
import { TargetBar } from '../speak/TargetBar';
import { finishUnit, unitBlockOf } from '../speak/unit';
import { useUnitCtx } from '../speak/useUnit';

// „Eine Botschaft, drei Tonlagen“ (Lernberatung 27.09., Vorschlag 8 / V7): ein Sachverhalt,
// dreimal formuliert – Slack an einen Kollegen, Mail an den CFO des Kunden, Satz im Meeting →
// tone-check@1 → je Fassung Tonurteil (zu direkt, zu steif, passend) mit Begründung und
// Musterfassung, dazu echte Fehler. Die Fehler gehen als Reparatur-Sätze in die Wiederholung
// (Quelle `tone`). Freiwillig (Extra), keine Pflicht, keine Selbstbewertung (A7). Ohne Claude
// wird gespeichert, ohne zu prüfen. Englische Wörter sind überall antippbar.

type Phase = 'write' | 'result';

const MAX_WORDS: Readonly<Record<ToneRegister, number>> = { slack: 60, cfo: 150, meeting: 60 };
const ROWS: Readonly<Record<ToneRegister, number>> = { slack: 3, cfo: 6, meeting: 3 };
const VERDICT_KEY: Readonly<Record<ToneVerdict, MessageKey>> = { too_direct: 'tnVerdict_too_direct', too_stiff: 'tnVerdict_too_stiff', fits: 'tnVerdict_fits' };
const VERDICT_TONE: Readonly<Record<ToneVerdict, string>> = { too_direct: 'bg-gold-soft text-gold-text', too_stiff: 'bg-gold-soft text-gold-text', fits: 'bg-accent-soft text-accent-text' };

const EMPTY: Record<ToneRegister, string> = { slack: '', cfo: '', meeting: '' };

export function TonesScreen() {
  const { t, tn, lang } = useT();
  const go = useNav((s) => s.go);
  const ai = useAiAvailable();
  const [day] = useState(() => useClock.getState().today);
  const unit = useNav((s) => (s.route.name === 'tones' ? unitBlockOf(s.route.unit) : null));
  const ctx = useUnitCtx('task.tones', unit);
  // Fortsetzen (G3): derselbe Sachverhalt; die Entwürfe liegen schon in `lx:draft:tones:*`.
  const [restored] = useState<TonesSnap | null>(() => tonesResume.take());
  const [shift, setShift] = useState(0);
  const msg = useMemo(() => (shift === 0 && restored ? TONE_MESSAGES.find((m) => m.id === restored.msg) : undefined) ?? messageFor(TONE_MESSAGES, day, shift), [day, shift, restored]);
  const [phase, setPhase] = useState<Phase>('write');
  const [t0, setT0] = useState(() => Date.now());
  const key = (r: ToneRegister) => `tones:${day}:${msg?.id ?? ''}:${r}`;
  // Entwürfe des Sachverhalts laden (Bequemlichkeit, localStorage).
  const draftsOf = (id: string | undefined): Record<ToneRegister, string> => {
    const next = { ...EMPTY };
    if (id) for (const r of TONE_REGISTERS) next[r] = loadDraft(`tones:${day}:${id}:${r}`);
    return next;
  };
  const [texts, setTexts] = useState<Record<ToneRegister, string>>(() => draftsOf(msg?.id));
  const [fb, setFb] = useState<ToneCheckOut | null>(null);
  const [repairs, setRepairs] = useState<{ state: 'idle' | 'saved' | 'failed'; n: number }>({ state: 'idle', n: 0 });
  const [saveFailed, setSaveFailed] = useState(false);
  const ask = useAsk(toneCheck);
  const finished = useRef<ToneItem | null>(null);
  const [doneItem, setDoneItem] = useState<ToneItem | null>(null);
  const infoId = useId();
  const [info, setInfo] = useState(false);
  const message = msg ? (lang === 'de' ? msg.de : msg.en) : '';

  useEffect(() => {
    if (!msg) return;
    if (phase === 'write') tonesResume.set({ msg: msg.id, step: 0, ...(unit ? { unit } : {}) });
    else tonesResume.clear();
  }, [phase, msg, unit]);

  useCompanionSee({ area: 'write', label: t('tnTitle'), phase: phase === 'result' ? 'feedback' : 'idle', ...(message ? { detail: message } : {}) });
  useHotkeys({ escape: () => go({ name: 'today' }) }, () => false);

  const busy = isBusy(ask.phase);
  const ready = TONE_REGISTERS.every((r) => wordCount(texts[r]) >= TONE_MIN_WORDS[r]);
  const anyText = TONE_REGISTERS.some((r) => texts[r].trim());

  const finish = async (out: ToneCheckOut | null) => {
    if (!msg || finished.current) return;
    const item: ToneItem = {
      id: toneId(msg.id, t0),
      t: t0,
      day,
      msg: msg.id,
      kind: msg.kind,
      texts: { slack: texts.slack.trim().slice(0, TONE_TEXT_MAX), cfo: texts.cfo.trim().slice(0, TONE_TEXT_MAX), meeting: texts.meeting.trim().slice(0, TONE_TEXT_MAX) },
      fb: out,
      ms: Math.max(0, Date.now() - t0),
      lang,
      ai: !!out,
    };
    finished.current = item;
    setDoneItem(item);
    setFb(out);
    setPhase('result');
    for (const r of TONE_REGISTERS) clearDraft(key(r));
    const add = out ? repairsFromTones(item.texts, out.corrections, message) : [];
    const [a, b, c] = await Promise.all([saveToneItem(item), recordTonesDone(item, message), add.length ? saveRepairs(add) : Promise.resolve(true)]);
    if (add.length) setRepairs({ state: c ? 'saved' : 'failed', n: add.length });
    setSaveFailed(!a || !b);
  };

  const check = async () => {
    if (!msg || !ready || busy) return;
    const r = await ask.run({ message: msg.en, texts: { slack: texts.slack.trim(), cfo: texts.cfo.trim(), meeting: texts.meeting.trim() }, uiLang: lang });
    if (!r) return;
    await finish(r);
  };

  const other = () => {
    const next = shift + 1;
    setShift(next);
    setTexts(draftsOf(messageFor(TONE_MESSAGES, day, next)?.id));
  };

  /** „Nochmal, aber besser“ (N74): derselbe Sachverhalt, drei neue Fassungen aus dem Kopf. */
  const again = () => {
    finished.current = null;
    setDoneItem(null);
    setFb(null);
    setRepairs({ state: 'idle', n: 0 });
    setSaveFailed(false);
    setTexts({ ...EMPTY });
    setT0(Date.now());
    setPhase('write');
  };

  /** Tageseinheit: Block 3 melden (Mail an den CFO als Haupttext, Musterfassung, Korrekturen). */
  const reportUnit = () => {
    const it = finished.current;
    if (!unit || !it) return;
    const model = it.fb?.versions.find((v) => v.reg === 'cfo')?.model ?? null;
    const text = TONE_REGISTERS.map((r) => it.texts[r]).filter(Boolean).join('\n\n');
    finishUnit('task.tones', unit, unitResult('task.tones', `tones/${it.day.slice(0, 7)}#${it.id}`, text, it.fb?.corrections ?? [], model));
  };

  const retrySave = async () => {
    const it = finished.current;
    if (!it) return;
    const [a, b] = await Promise.all([saveToneItem(it), flush()]);
    setSaveFailed(!a || !b);
  };

  if (!msg) return null;
  const statusParts = [t(`tnKind_${msg.kind}`), phase === 'write' ? t('tnStatusWrite') : t('tnStatusDone')];

  return (
    <motion.section
      className="flex flex-col gap-5 py-4 sm:py-8"
      data-testid="tones"
      data-phase={phase}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      aria-labelledby={`${infoId}-title`}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconButton icon="close" label={t('inLeave')} onClick={() => go({ name: 'today' })} data-testid="tones-close" className="-ml-2" />
          <span className="inline-block h-4 w-0.5 rounded-full" style={{ background: 'var(--lx-ch-write)' }} aria-hidden="true" />
          <h1 id={`${infoId}-title`} className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
            {t('tnTitle')}
          </h1>
        </div>
        <p className="lx-tnum text-xs font-medium text-muted" data-testid="tones-status">
          {statusParts.join(' · ')}
        </p>
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-medium" data-testid="task">
            {phase === 'write' ? t('tnTask') : t('tnTaskResult')}
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
            {t('tnPurpose')}
          </p>
        )}
      </header>

      <div className="flex max-w-3xl flex-col gap-5">
        <Card channel="write" className="flex flex-col gap-3" data-testid="tones-message" data-msg={msg.id} data-kind={msg.kind}>
          <p className="lx-eyebrow">{t('tnMessage')}</p>
          <p className="text-base leading-relaxed">{message}</p>
          {phase === 'write' && !anyText && !busy && (
            <div>
              <Button variant="ghost" icon="refresh" onClick={other} data-testid="tones-other">
                {t('tnOther')}
              </Button>
            </div>
          )}
        </Card>

        {phase === 'write' && (
          <>
            <TargetBar text={TONE_REGISTERS.map((r) => texts[r]).join('\n')} ctx={ctx} />
            {TONE_REGISTERS.map((r) => (
              <div key={r} className="flex flex-col gap-1" data-testid="tones-field" data-reg={r}>
                <DraftArea
                  value={texts[r]}
                  onChange={(v) => setTexts((cur) => ({ ...cur, [r]: v.slice(0, TONE_TEXT_MAX) }))}
                  label={t(`tnReg_${r}`)}
                  draftKey={key(r)}
                  min={TONE_MIN_WORDS[r]}
                  max={MAX_WORDS[r]}
                  rows={ROWS[r]}
                  disabled={busy}
                  testId={`tones-draft-${r}`}
                />
                <p className="text-xs text-muted">{t(`tnRegHint_${r}`)}</p>
              </div>
            ))}
            {!ai && (
              <p className="text-sm text-muted" data-testid="tones-noai-hint">
                {t('tnNoAi')}
              </p>
            )}
            <AiRunPanel phase={ask.phase} error={ask.phase === 'error' ? ask.error : null} onStop={ask.stop} onRetry={() => void check()} />
            {!busy && (
              <div className="flex flex-wrap items-center gap-3">
                {ai && ask.phase !== 'error' && (
                  <Button variant="primary" size="lg" iconAfter="arrowRight" disabled={!ready} onClick={() => void check()} data-testid="tones-check" data-ai="">
                    {t('tnCheck')}
                  </Button>
                )}
                {(!ai || ask.phase === 'error') && (
                  <Button variant="ghost" onClick={() => void finish(null)} disabled={!ready} data-testid="tones-noai">
                    {t('tnSaveNoAi')}
                  </Button>
                )}
                {!ready && <p className="text-xs text-muted">{t('tnMinHint')}</p>}
              </div>
            )}
          </>
        )}

        {phase === 'result' && doneItem && (
          <Result item={doneItem} fb={fb} title={message} />
        )}
        {phase === 'result' && repairs.state === 'saved' && (
          <p className="flex items-center gap-2 text-sm text-accent-text" role="status" data-testid="tones-repairs" data-n={repairs.n}>
            <Icon name="check" size={16} />
            {tn('tnRepairsSaved', repairs.n)}
          </p>
        )}
        {phase === 'result' && repairs.state === 'failed' && (
          <p className="text-sm text-danger-text" role="alert" data-testid="tones-repairs-failed">
            {t('tnRepairsFailed')}
          </p>
        )}
        {phase === 'result' && saveFailed && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-danger-text" role="alert" data-testid="tones-save-failed">
            <span>{t('tnSaveFailed')}</span>
            <Button onClick={() => void retrySave()} icon="refresh">
              {t('tnRetrySave')}
            </Button>
          </div>
        )}
        {phase === 'result' &&
          (unit ? (
            <div>
              <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={reportUnit} data-testid="tones-unit-next">
                {t('nbSprechenUnitDone')}
              </Button>
            </div>
          ) : (
            <>
              <div>
                <Button icon="refresh" onClick={again} data-testid="tones-again">
                  {t('nbSprechenAgain')}
                </Button>
              </div>
              <SummaryActions onBack={() => undefined} />
            </>
          ))}
      </div>
    </motion.section>
  );
}

/** Ergebnis: je Tonlage die eigene Fassung, das Tonurteil mit Grund und die Musterfassung; dann echte Fehler und der Merksatz. */
function Result({ item, fb, title }: { item: ToneItem; fb: ToneCheckOut | null; title: string }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-4" data-testid="tones-result" data-ai={fb ? 'yes' : 'no'}>
      <div className="lx-glass flex flex-col gap-1 rounded-[var(--radius-card)] p-5" data-testid="unit-done" data-state="done">
        <p className="lx-eyebrow text-accent-text">{t('tnDone')}</p>
        {fb && <p className="text-base" data-testid="tones-tip">{fb.tip}</p>}
      </div>
      {TONE_REGISTERS.map((r) => {
        const v = fb?.versions.find((x) => x.reg === r) ?? null;
        return (
          <Card as="div" key={r} className="flex flex-col gap-3" data-testid="tones-version" data-reg={r} data-tone={v?.tone ?? ''}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="lx-eyebrow">{t(`tnReg_${r}`)}</p>
              {v && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT_TONE[v.tone]}`} data-testid="tones-verdict">
                  {t(VERDICT_KEY[v.tone])}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted">{t('tnYours')}</p>
              <EnglishText as="div" text={item.texts[r]} area="write" title={title} className="text-base leading-relaxed text-muted" />
            </div>
            {v && (
              <>
                <p className="text-sm" data-testid="tones-why">{v.why}</p>
                <div className="flex flex-col gap-1 border-l-2 pl-3" style={{ borderColor: 'var(--lx-ch-write)' }}>
                  <p className="text-xs text-muted">{t('tnModel')}</p>
                  <EnglishText as="div" text={v.model} area="write" title={title} className="text-base leading-relaxed" testId="tones-model" />
                </div>
              </>
            )}
          </Card>
        );
      })}
      {fb && (
        <Card as="div" className="flex flex-col gap-3" data-testid="tones-corrections" data-n={fb.corrections.length}>
          <p className="lx-eyebrow">{t('tnCorrections')}</p>
          {fb.corrections.length === 0 && <p className="text-sm text-muted">{t('tnNoCorrections')}</p>}
          <ul className="flex flex-col gap-3">
            {fb.corrections.map((c, i) => (
              <li key={`${c.reg}-${c.wrong}-${i}`} className="flex flex-col gap-1" data-testid="tones-correction" data-reg={c.reg}>
                <p className="text-xs text-muted">{t(`tnReg_${c.reg}`)}</p>
                <p className="text-sm text-muted line-through decoration-danger-text/60" lang="en">
                  {c.wrong}
                </p>
                <EnglishText text={c.right} area="write" title={title} className="text-base font-medium" />
                <p className="text-sm text-muted">{c.why}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
