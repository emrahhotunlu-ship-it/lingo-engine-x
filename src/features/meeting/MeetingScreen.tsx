import { motion } from 'framer-motion';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useCollection } from '../../data/watch';
import { cleanMeetingInput, listMeetings, MEETING_FIELD_MAX, MEETING_WANT_MAX, meetingId, meetingPath, readMeeting, type DebriefEntry, type MeetingInput, type MeetingItem, type MeetingPrep } from '../../domain/meeting/meetingDoc';
import { aiSceneId } from '../../domain/speak/sceneDoc';
import { EnglishText } from '../../engine/EnglishText';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { meetingDebrief, type DebriefItemOut } from '../../prompts/meetingDebrief';
import { meetingPrep } from '../../prompts/meetingPrep';
import { Button, IconButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCompanionSee } from '../companion/seeing';
import { AiRunPanel, isBusy } from '../input/AiRunPanel';
import { createSceneDoc, takeChunk } from '../speak/persist';
import { TakeChunkButton, type TakeInput } from '../speak/TakeChunkButton';
import { TitleActions } from '../system/Chrome';
import { workContext } from '../speak/useSceneLibrary';
import { addMeetingDebrief, saveMeeting, setMeetingPrep, setMeetingScene } from './persist';

// „Mein nächster Termin“ (Lernberatung 27.09., V4 / Vorschlag 6): Emrah beschreibt in zwei
// Minuten einen echten Termin (mit wem, worum, was heikel ist, Freitext). meeting-prep@1 baut
// daraus eine 10-Minuten-Vorbereitung: 6–8 Schlüsselwendungen („Alle als Wendungen merken“, mit
// Ursprungssatz), die drei wahrscheinlichsten Einwände mit Antwortbausteinen und eine Generalprobe,
// die im vorhandenen Rollenspiel startet (Szene im Format von scene-gen@2 → `scene/sc-ai…`).
// Nach dem Termin – später über „Meine Termine“ – die Nachbesprechung: „Was wolltest du sagen und
// konntest es nicht?“ → meeting-debrief@1 → beste Formulierung, sofort als Wendungen gemerkt.
// Gespeichert in `meeting/<Monat>`; nur echte Eingaben, nie Beispiel-Termine. Freiwillig.


type View = { kind: 'list' } | { kind: 'form' } | { kind: 'detail'; id: string };

const EMPTY: MeetingInput = { who: '', topic: '', tricky: '', notes: '', when: '' };

const fieldClass = 'lx-glass w-full rounded-[var(--radius-control)] px-4 py-3 text-base text-fg placeholder:text-subtle disabled:opacity-70';

/** iPhone-Tastatur: das fokussierte Feld bleibt über der Tastatur sichtbar (visualViewport). */
function keepVisible(el: HTMLElement): void {
  window.setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 300);
}

function useKeyboardFollow(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const keep = () => {
      const el = document.activeElement;
      if (el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) el.scrollIntoView({ block: 'nearest' });
    };
    vv.addEventListener('resize', keep);
    return () => vv.removeEventListener('resize', keep);
  }, []);
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="lx-eyebrow">{label}</span>
      {children}
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </label>
  );
}

export function MeetingScreen() {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const route = useNav((s) => s.route);
  const docs = useCollection('meeting');
  const all = useMemo(() => listMeetings(docs).map(readMeeting).filter((m): m is MeetingItem => !!m), [docs]);
  const [view, setView] = useState<View>(() => (route.name === 'meeting' && route.id ? { kind: 'detail', id: route.id } : { kind: 'list' }));
  /** Gerade angelegt, aber noch nicht aus dem Abo zurück: so lange die eigene Fassung zeigen. */
  const [local, setLocal] = useState<MeetingItem | null>(null);
  const infoId = useId();
  const [info, setInfo] = useState(false);
  useKeyboardFollow();

  useCompanionSee({ area: 'business', label: t('mtTitle'), phase: 'idle' });
  useHotkeys({ escape: () => (view.kind === 'list' ? go({ name: 'speak' }) : setView({ kind: 'list' })) }, () => false);

  const current = view.kind === 'detail' ? (all.find((m) => m.id === view.id) ?? (local?.id === view.id ? local : null)) : null;
  const loading = docs === undefined;
  // Leere Liste → gleich die Eingabe (ohne Umweg über einen leeren Bildschirm).
  const showForm = view.kind === 'form' || (view.kind === 'list' && !loading && all.length === 0);

  const back = () => (view.kind === 'list' || (showForm && all.length === 0) ? go({ name: 'speak' }) : setView({ kind: 'list' }));

  return (
    <motion.section
      className="flex flex-col gap-5 py-4 sm:py-8"
      data-testid="meeting"
      data-view={showForm ? 'form' : view.kind}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      aria-labelledby={`${infoId}-title`}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconButton icon={view.kind === 'list' || (showForm && all.length === 0) ? 'close' : 'arrowLeft'} label={t('inLeave')} onClick={back} data-testid="meeting-close" className="-ml-2" />
          <span className="inline-block h-4 w-0.5 rounded-full" style={{ background: 'var(--lx-ch-business)' }} aria-hidden="true" />
          <h1 id={`${infoId}-title`} className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
            {t('mtTitle')}
          </h1>
          <TitleActions />
        </div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-medium" data-testid="task">
            {view.kind === 'detail' ? t('mtTaskDetail') : t('mtTask')}
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
            {t('mtPurpose')}
          </p>
        )}
      </header>

      <div className="flex max-w-3xl flex-col gap-5">
        {view.kind === 'list' && loading && (
          <div className="flex flex-col gap-3" role="status" aria-label={t('loadingData')}>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {view.kind === 'list' && !loading && all.length > 0 && <MeetingList items={all} onOpen={(id) => setView({ kind: 'detail', id })} onNew={() => setView({ kind: 'form' })} />}
        {showForm && (
          <MeetingForm
            onCreated={(item) => {
              setLocal(item);
              setView({ kind: 'detail', id: item.id });
            }}
          />
        )}
        {view.kind === 'detail' && current && <MeetingDetail key={current.id} item={current} lang={lang} onUpdated={setLocal} />}
        {view.kind === 'detail' && !current && !loading && (
          <div className="flex flex-col items-start gap-3" data-testid="meeting-missing">
            <p className="text-base text-muted">{t('mtMissing')}</p>
            <Button icon="arrowLeft" onClick={() => setView({ kind: 'list' })}>
              {t('mtToList')}
            </Button>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function MeetingList({ items, onOpen, onNew }: { items: MeetingItem[]; onOpen: (id: string) => void; onNew: () => void }) {
  const { t, tn } = useT();
  return (
    <div className="flex flex-col gap-4" data-testid="meeting-list">
      <div>
        <Button variant="primary" size="lg" icon="plus" onClick={onNew} data-testid="meeting-new">
          {t('mtNew')}
        </Button>
      </div>
      <h2 className="lx-eyebrow">{t('mtListTitle')}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onOpen(m.id)}
              data-testid="meeting-item"
              data-id={m.id}
              className="lx-glass flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left hover:bg-surface-strong"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-medium">{m.who}</span>
                <span className="truncate text-sm text-muted">{m.topic}</span>
                <span className="lx-tnum text-xs text-subtle">
                  {[m.when || m.day, m.prep ? t('mtStatus_prep') : t('mtStatus_open'), m.debrief.length ? tn('mtDebriefCount', m.debrief.length) : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Icon name="arrowRight" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MeetingForm({ onCreated }: { onCreated: (item: MeetingItem) => void }) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(meetingPrep);
  const [v, setV] = useState<MeetingInput>(EMPTY);
  const [missing, setMissing] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const busy = isBusy(ask.phase);
  const set = (k: keyof MeetingInput) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value }));

  const create = async (withPrep: boolean) => {
    const clean = cleanMeetingInput(v);
    setMissing(!clean);
    if (!clean || busy) return;
    setSaveFailed(false);
    const prep = withPrep ? await ask.run({ ctx: workContext(), ...clean, uiLang: lang }) : null;
    if (withPrep && !prep) return;
    const t0 = Date.now();
    const item: MeetingItem = { ...clean, id: meetingId(t0), t: t0, day: useClock.getState().today, prep: prep ? { phrases: prep.phrases, objections: prep.objections, scene: { ...prep.scene } } : null, sceneId: null, debrief: [], lang };
    const ok = await saveMeeting(item);
    if (!ok) {
      setSaveFailed(true);
      return;
    }
    onCreated(item);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="meeting-form">
      <Field label={t('mtWho')}>
        <input value={v.who} onChange={set('who')} onFocus={(e) => keepVisible(e.currentTarget)} maxLength={MEETING_FIELD_MAX.who} disabled={busy} autoCapitalize="sentences" className={fieldClass} data-testid="meeting-who" />
      </Field>
      <Field label={t('mtTopic')}>
        <textarea value={v.topic} onChange={set('topic')} onFocus={(e) => keepVisible(e.currentTarget)} maxLength={MEETING_FIELD_MAX.topic} rows={2} disabled={busy} autoCapitalize="sentences" className={`${fieldClass} resize-none`} data-testid="meeting-topic" />
      </Field>
      <Field label={t('mtTricky')}>
        <textarea value={v.tricky} onChange={set('tricky')} onFocus={(e) => keepVisible(e.currentTarget)} maxLength={MEETING_FIELD_MAX.tricky} rows={2} disabled={busy} autoCapitalize="sentences" className={`${fieldClass} resize-none`} data-testid="meeting-tricky" />
      </Field>
      <Field label={t('mtNotes')} hint={t('mtFieldHint')}>
        <textarea value={v.notes} onChange={set('notes')} onFocus={(e) => keepVisible(e.currentTarget)} maxLength={MEETING_FIELD_MAX.notes} rows={3} disabled={busy} autoCapitalize="sentences" className={`${fieldClass} resize-y`} data-testid="meeting-notes" />
      </Field>
      <Field label={t('mtWhen')}>
        <input type="date" value={v.when} onChange={set('when')} disabled={busy} className={`${fieldClass} lx-tnum`} data-testid="meeting-when" />
      </Field>
      {missing && (
        <p className="text-sm text-danger-text" role="alert" data-testid="meeting-required">
          {t('mtRequired')}
        </p>
      )}
      {!ai && (
        <p className="text-sm text-muted" data-testid="meeting-noai">
          {t('mtNoAi')}
        </p>
      )}
      <AiRunPanel phase={ask.phase} error={ask.phase === 'error' ? ask.error : null} onStop={ask.stop} onRetry={() => void create(true)} />
      {saveFailed && (
        <p className="text-sm text-danger-text" role="alert" data-testid="meeting-save-failed">
          {t('mtSaveFailed')}
        </p>
      )}
      {!busy && (
        <div className="flex flex-wrap items-center gap-3">
          {ai && ask.phase !== 'error' && (
            <Button variant="primary" size="lg" icon="sparkle" onClick={() => void create(true)} data-testid="meeting-create" data-ai="">
              {t('mtCreate')}
            </Button>
          )}
          <Button variant={ai ? 'ghost' : 'primary'} size={ai ? 'md' : 'lg'} onClick={() => void create(false)} data-testid="meeting-save-only">
            {t('mtSaveOnly')}
          </Button>
        </div>
      )}
    </div>
  );
}

function MeetingDetail({ item, lang, onUpdated }: { item: MeetingItem; lang: 'de' | 'en'; onUpdated: (m: MeetingItem) => void }) {
  const { t } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(meetingPrep);
  const [saveFailed, setSaveFailed] = useState(false);
  const title = `${item.who} – ${item.topic}`.slice(0, 120);
  const ref = `${meetingPath(item.day)}#${item.id}`;
  const busy = isBusy(ask.phase);

  const prepareLater = async () => {
    if (busy) return;
    setSaveFailed(false);
    const prep = await ask.run({ ctx: workContext(), who: item.who, topic: item.topic, tricky: item.tricky, notes: item.notes, uiLang: lang });
    if (!prep) return;
    const p: MeetingPrep = { phrases: prep.phrases, objections: prep.objections, scene: { ...prep.scene } };
    const next: MeetingItem = { ...item, prep: p };
    // Nur die Vorbereitung nachtragen – Szene und Nachbesprechung aus anderen Tabs bleiben stehen.
    const ok = await setMeetingPrep(item.day, item.id, p);
    if (!ok) setSaveFailed(true);
    else onUpdated(next);
  };

  return (
    <div className="flex flex-col gap-5" data-testid="meeting-detail" data-id={item.id}>
      <Card as="div" channel="business" className="flex flex-col gap-1" data-testid="meeting-head">
        <p className="text-base font-semibold">{item.who}</p>
        <p className="text-sm text-muted">{item.topic}</p>
        {item.tricky && <p className="text-sm text-muted">{item.tricky}</p>}
        {item.when && <p className="lx-tnum text-xs text-subtle">{item.when}</p>}
      </Card>

      {!item.prep && (
        <div className="flex flex-col gap-3">
          <AiRunPanel phase={ask.phase} error={ask.phase === 'error' ? ask.error : null} onStop={ask.stop} onRetry={() => void prepareLater()} />
          {ai && !busy && ask.phase !== 'error' && (
            <div>
              <Button variant="primary" size="lg" icon="sparkle" onClick={() => void prepareLater()} data-testid="meeting-prepare" data-ai="">
                {t('mtPrepare')}
              </Button>
            </div>
          )}
          {!ai && <p className="text-sm text-muted">{t('mtNoAi')}</p>}
          {saveFailed && (
            <p className="text-sm text-danger-text" role="alert">
              {t('mtSaveFailed')}
            </p>
          )}
        </div>
      )}

      {item.prep && item.prep.phrases.length > 0 && <PhraseSection item={item} title={title} sourceRef={ref} lang={lang} />}
      {item.prep && item.prep.objections.length > 0 && (
        <Card as="div" className="flex flex-col gap-4" data-testid="meeting-objections">
          <p className="lx-eyebrow">{t('mtObjections')}</p>
          <ol className="flex flex-col gap-5">
            {item.prep.objections.map((o, i) => (
              <li key={`${o.q}-${i}`} className="flex flex-col gap-2" data-testid="meeting-objection">
                <EnglishText text={o.q} area="business" title={title} className="text-base font-medium" />
                <p className="text-sm text-muted">{o.why}</p>
                <ObjectionAnswers answers={o.answers} title={title} />
              </li>
            ))}
          </ol>
        </Card>
      )}
      {item.prep?.scene && <Rehearsal item={item} lang={lang} />}
      <Debrief item={item} title={title} sourceRef={ref} lang={lang} />
    </div>
  );
}

/** Antwortbausteine erst nach eigenem Versuch zeigen (Erst selbst antworten, dann zeigen). */
function ObjectionAnswers({ answers, title }: { answers: readonly string[]; title: string }) {
  const { t } = useT();
  const inputId = useId();
  const [own, setOwn] = useState('');
  const [shown, setShown] = useState(false);
  if (!shown) {
    return (
      <div className="mt-1 flex flex-col gap-2" data-testid="meeting-own">
        <label htmlFor={inputId} className="text-sm text-muted">
          {t('mtOwnFirst')}
        </label>
        <textarea
          id={inputId}
          lang="en"
          rows={2}
          value={own}
          onChange={(e) => setOwn(e.target.value)}
          onFocus={(e) => keepVisible(e.currentTarget)}
          placeholder={t('mtOwnPlaceholder')}
          className={fieldClass}
          data-testid="meeting-own-input"
        />
        <div>
          <Button variant="secondary" disabled={!own.trim()} onClick={() => setShown(true)} data-testid="meeting-show-answers">
            {t('mtShowAnswers')}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid="meeting-answers">
      <p className="text-sm text-muted" lang="en" data-testid="meeting-own-answer">
        <span className="text-subtle">{t('mtOwnYours')}: </span>
        {own.trim()}
      </p>
      <p className="lx-eyebrow mt-1">{t('mtAnswers')}</p>
      <ul className="flex flex-col gap-1.5">
        {answers.map((a, k) => (
          <li key={`${a}-${k}`} className="flex gap-2">
            <span className="mt-2 inline-block size-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
            <EnglishText text={a} area="business" title={title} className="text-base" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhraseSection({ item, title, sourceRef, lang }: { item: MeetingItem; title: string; sourceRef: string; lang: 'de' | 'en' }) {
  const { t, tn } = useT();
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'done' | 'none' | 'failed'; n: number }>({ kind: 'idle', n: 0 });
  const phrases = item.prep?.phrases ?? [];
  const inputs: TakeInput[] = phrases.map((p) => ({ en: p.en, de: p.de, def: p.def, kind: 'phrase', register: 'neutral', why: '', whyLang: lang, level: 'C1', src: { kind: 'meeting', ref: sourceRef, title, utterance: item.topic.slice(0, 200), upgraded: p.example } }));

  const takeAll = async () => {
    setState({ kind: 'saving', n: 0 });
    let taken = 0;
    let failed = false;
    for (const i of inputs) {
      const r = await takeChunk({ ...i, nowMs: Date.now() });
      if (r === 'taken') taken++;
      else if (r === 'error' || r === 'invalid') failed = true;
    }
    setState({ kind: failed ? 'failed' : taken ? 'done' : 'none', n: taken });
  };

  return (
    <Card as="div" className="flex flex-col gap-4" data-testid="meeting-phrases" data-n={phrases.length}>
      <p className="lx-eyebrow">{t('mtPhrases')}</p>
      <ul className="flex flex-col gap-4">
        {phrases.map((p, i) => (
          <li key={`${p.en}-${i}`} className="flex flex-col gap-1" data-testid="meeting-phrase">
            <EnglishText text={p.en} area="business" title={title} className="text-base font-semibold" />
            <p className="text-sm text-muted">{p.de}</p>
            <EnglishText text={p.example} area="business" title={title} className="text-sm leading-relaxed" />
            <div>{inputs[i] && <TakeChunkButton compact input={inputs[i]} />}</div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        {state.kind !== 'done' && state.kind !== 'none' && (
          <Button icon="bookmarkPlus" busy={state.kind === 'saving'} disabled={state.kind === 'saving'} onClick={() => void takeAll()} data-testid="meeting-take-all">
            {t('mtTakeAll')}
          </Button>
        )}
        {state.kind === 'done' && (
          <p className="flex items-center gap-2 text-sm text-accent-text" role="status" data-testid="meeting-take-all-done" data-n={state.n}>
            <Icon name="check" size={16} />
            {tn('mtTakeAllDone', state.n)}
          </p>
        )}
        {state.kind === 'none' && (
          <p className="flex items-center gap-2 text-sm text-accent-text" role="status" data-testid="meeting-take-all-done" data-n={0}>
            <Icon name="check" size={16} />
            {t('mtTakeAllNone')}
          </p>
        )}
        {state.kind === 'failed' && (
          <p className="text-sm text-danger-text" role="alert" data-testid="meeting-take-all-failed">
            {t('mtTakeAllFailed')}
          </p>
        )}
      </div>
    </Card>
  );
}

function Rehearsal({ item, lang }: { item: MeetingItem; lang: 'de' | 'en' }) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const scene = item.prep?.scene ?? {};
  const persona = (scene.persona && typeof scene.persona === 'object' ? scene.persona : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const situation = lang === 'de' ? str(scene.situation_de) || str(scene.situation) : str(scene.situation);

  const start = async () => {
    if (busy) return;
    if (item.sceneId) {
      go({ name: 'roleplay', sceneId: item.sceneId });
      return;
    }
    setBusy(true);
    setFailed(false);
    const t0 = Date.now();
    const id = aiSceneId(t0);
    const ok = await createSceneDoc(id, { ...scene, id, ts: t0, src: 'ai', pv: `${meetingPrep.id}@${meetingPrep.version}`, meeting: item.id });
    if (!ok) {
      setBusy(false);
      setFailed(true);
      return;
    }
    await setMeetingScene(item.day, item.id, id);
    go({ name: 'roleplay', sceneId: id });
  };

  return (
    <Card as="div" channel="speak" className="flex flex-col gap-3" data-testid="meeting-rehearsal">
      <p className="lx-eyebrow">{t('mtRehearsal')}</p>
      {(str(persona.name) || str(persona.role)) && (
        <p className="text-base font-medium">
          {[str(persona.name), str(persona.role)].filter(Boolean).join(' · ')}
        </p>
      )}
      {situation && <p className="text-sm leading-relaxed text-muted">{situation}</p>}
      <div>
        <Button variant="primary" icon="chat" busy={busy} disabled={busy} onClick={() => void start()} data-testid="meeting-rehearsal-start">
          {t('mtRehearsalStart')}
        </Button>
      </div>
      {failed && (
        <p className="text-sm text-danger-text" role="alert">
          {t('mtRehearsalFailed')}
        </p>
      )}
    </Card>
  );
}

function Debrief({ item, title, sourceRef, lang }: { item: MeetingItem; title: string; sourceRef: string; lang: 'de' | 'en' }) {
  const { t, tn } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(meetingDebrief);
  const [want, setWant] = useState('');
  const [result, setResult] = useState<DebriefItemOut[] | null>(null);
  /** Beginn der gerade gezeigten Nachbesprechung: sie steht nicht noch einmal unter „Bisher“. */
  const [batchT, setBatchT] = useState<number | null>(null);
  const [saved, setSaved] = useState<{ state: 'idle' | 'saved' | 'failed'; n: number }>({ state: 'idle', n: 0 });
  const busy = isBusy(ask.phase);

  const run = async () => {
    const text = want.trim();
    if (!text || busy) return;
    setSaved({ state: 'idle', n: 0 });
    const r = await ask.run({ who: item.who, topic: item.topic, want: text, uiLang: lang });
    if (!r) return;
    setResult(r.items);
    setWant('');
    const now = Date.now();
    setBatchT(now);
    const entries: DebriefEntry[] = r.items.map((x, i) => ({ t: now + i, want: x.want, en: x.en, phrase: x.phrase, de: x.de, def: x.def, why: x.why }));
    const okDoc = await addMeetingDebrief(item.day, item.id, entries);
    // Sofort als Wendungen (mit Ursprungssatz = beste Formulierung).
    let inReview = 0;
    let failed = !okDoc;
    for (const x of r.items) {
      if (!x.phrase) continue;
      const res = await takeChunk({ en: x.phrase, de: x.de, def: x.def, kind: 'phrase', register: 'neutral', why: x.why, whyLang: lang, level: 'C1', src: { kind: 'meeting', ref: sourceRef, title, utterance: text.slice(0, 200), upgraded: x.en }, nowMs: now });
      if (res === 'taken' || res === 'exists') inReview++;
      else if (res === 'error' || res === 'invalid') failed = true;
    }
    setSaved({ state: failed ? 'failed' : 'saved', n: inReview });
  };

  const prev = item.debrief.filter((d) => batchT === null || d.t < batchT);
  return (
    <Card as="div" className="flex flex-col gap-4" data-testid="meeting-debrief">
      <p className="lx-eyebrow">{t('mtDebrief')}</p>
      <Field label={t('mtDebriefQ')} hint={t('mtFieldHint')}>
        <textarea
          value={want}
          onChange={(e) => setWant(e.target.value.slice(0, MEETING_WANT_MAX))}
          onFocus={(e) => keepVisible(e.currentTarget)}
          rows={4}
          disabled={busy || !ai}
          autoCapitalize="sentences"
          className={`${fieldClass} resize-y`}
          data-testid="meeting-debrief-input"
        />
      </Field>
      {!ai && <p className="text-sm text-muted">{t('mtDebriefNoAi')}</p>}
      <AiRunPanel phase={ask.phase} error={ask.phase === 'error' ? ask.error : null} onStop={ask.stop} onRetry={() => void run()} />
      {ai && !busy && (
        <div>
          <Button variant="primary" icon="sparkle" disabled={!want.trim()} onClick={() => void run()} data-testid="meeting-debrief-go" data-ai="">
            {t('mtDebriefGo')}
          </Button>
        </div>
      )}
      {result && (
        <ul className="flex flex-col gap-4" data-testid="meeting-debrief-result">
          {result.map((x, i) => (
            <li key={`${x.en}-${i}`} className="flex flex-col gap-1" data-testid="meeting-debrief-item">
              <p className="text-sm text-muted">{x.want}</p>
              <EnglishText text={x.en} area="business" title={title} className="text-base font-medium" />
              {x.phrase && (
                <p className="text-sm">
                  <span className="font-semibold" lang="en">
                    {x.phrase}
                  </span>
                  <span className="text-muted"> – {lang === 'de' ? x.de : x.def}</span>
                </p>
              )}
              <p className="text-sm text-muted">{x.why}</p>
            </li>
          ))}
        </ul>
      )}
      {saved.state === 'saved' && saved.n > 0 && (
        <p className="flex items-center gap-2 text-sm text-accent-text" role="status" data-testid="meeting-debrief-saved" data-n={saved.n}>
          <Icon name="check" size={16} />
          {tn('mtDebriefSaved', saved.n)}
        </p>
      )}
      {saved.state === 'failed' && (
        <p className="text-sm text-danger-text" role="alert" data-testid="meeting-debrief-failed">
          {t('mtDebriefSaveFailed')}
        </p>
      )}
      {prev.length > 0 && (
        <div className="flex flex-col gap-3" data-testid="meeting-debrief-prev" data-n={prev.length}>
          <p className="lx-eyebrow">{t('mtDebriefPrev')}</p>
          <ul className="flex flex-col gap-3">
            {prev.map((d, i) => (
              <li key={`${d.t}-${i}`} className="flex flex-col gap-0.5">
                <EnglishText text={d.en} area="business" title={title} className="text-base" />
                {d.want && <p className="text-xs text-muted">{d.want}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
