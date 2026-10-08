import { useId, useState } from 'react';
import { useLive } from '../../data/live';
import { cleanIi, CUE_IDS, CUE_MAX, formatTime, isCueId, readIi, type CueId } from '../../domain/studytime';
import { useT } from '../../i18n';
import { useCapabilities } from '../../platform/capabilities';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { ReminderGuide } from './ReminderGuide';
import { saveIi } from './studyTimeSave';
import { CUE_LABEL, ifThenLine } from './studyTimeText';

// Einstellungen › Lernen › „Deine Lernzeit“ (Lernplattform 3.0 P53): Uhrzeit und ein fester Moment im Alltag (Chip oder eigener Text ≤ 40 Zeichen) mit
// Wenn-Dann-Vorschau („Wenn ich …, starte ich meine Englisch-Runde.“), gespeichert in
// `app/profile.ii`. Ein Vorschlag, keine Bedingung: Plan und Serie bleiben unberührt. Sie erscheint nur auf der Abschlusskarte („Morgen um 7:30 · …“).
// Dazu die Anleitung „Erinnerung im iPhone einrichten“. Gespeichert wird erst auf „Lernzeit speichern“ (ein Schreibvorgang, nur bei Änderung).

const CHIP = 'lx-hit inline-flex items-center rounded-full px-3 text-sm';
const INPUT = 'lx-glass min-h-11 w-full rounded-[var(--radius-control)] px-3 text-base text-fg placeholder:text-subtle';

export function StudyTime() {
  const { t, lang } = useT();
  const db = useCapabilities((s) => s.db);
  const profile = useLive((s) => s.docs['app/profile']);
  const saved = readIi(profile);
  const [time, setTime] = useState(saved?.t ?? '');
  const [preset, setPreset] = useState<CueId | null>(saved && isCueId(saved.cue) ? saved.cue : null);
  const [own, setOwn] = useState(saved && !isCueId(saved.cue) ? saved.cue : '');
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(false);
  const timeId = useId();
  const ownId = useId();
  if (db !== 'ready' || !profile) return null;
  const ifThen = ifThenLine(preset ?? own, t);

  const save = async (): Promise<void> => {
    const next = cleanIi(time, preset ?? own);
    if (!next) {
      toast(t('moStNeedTime'));
      return;
    }
    setBusy(true);
    const r = await saveIi(next);
    setBusy(false);
    if (r === 'saved' || r === 'unchanged') toast(t('moStSaved'));
    else toast(t('moStSaveFailed'), 'error');
  };
  const remove = async (): Promise<void> => {
    setBusy(true);
    const r = await saveIi(null);
    setBusy(false);
    if (r === 'saved' || r === 'unchanged') {
      setTime('');
      setPreset(null);
      setOwn('');
      toast(t('moStRemoved'));
    } else toast(t('moStSaveFailed'), 'error');
  };

  return (
    <section className="flex flex-col gap-4" data-testid="study-time">
      <h3 className="lx-eyebrow">{t('moStTitle')}</h3>
      <p className="lx-t-meta m-0 text-muted">{t('moStLead')}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={timeId} className="lx-t-label">
          {t('moStTime')}
        </label>
        <input id={timeId} type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} className={`${INPUT} max-w-40`} data-testid="study-time-input" />
      </div>
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" data-testid="study-cue">
        <legend className="lx-t-label mb-1 p-0">{t('moStCue')}</legend>
        <div className="flex flex-wrap gap-2">
          {CUE_IDS.map((id) => {
            const on = preset === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setPreset(on ? null : id);
                  if (!on) setOwn('');
                }}
                data-value={id}
                className={`${CHIP} ${on ? 'bg-accent-soft font-semibold text-accent-text' : 'bg-surface-strong text-fg hover:bg-surface'}`}
              >
                {t(CUE_LABEL[id])}
              </button>
            );
          })}
        </div>
        <label htmlFor={ownId} className="sr-only">
          {t('moStOwn')}
        </label>
        <input
          id={ownId}
          type="text"
          value={own}
          maxLength={CUE_MAX}
          placeholder={t('moStOwn')}
          onChange={(e) => {
            setOwn(e.target.value);
            if (e.target.value.trim()) setPreset(null);
          }}
          className={INPUT}
          data-testid="study-cue-own"
        />
      </fieldset>
      {ifThen ? (
        <p className="m-0 text-sm text-fg" data-testid="study-ifthen">
          {ifThen}
        </p>
      ) : (
        <p className="lx-t-meta m-0 text-muted" data-testid="study-cue-hint">
          {t('moStNoCueHint')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void save()} busy={busy} data-testid="study-time-save">
          {t('moStSave')}
        </Button>
        {saved && (
          <Button variant="ghost" onClick={() => void remove()} disabled={busy} data-testid="study-time-remove">
            {t('moStRemove')}
          </Button>
        )}
      </div>
      <div>
        <Button variant="secondary" onClick={() => setGuide(true)} data-testid="reminder-guide-open">
          {t('moStGuideOpen')}
        </Button>
      </div>
      <ReminderGuide open={guide} onClose={() => setGuide(false)} time={saved ? formatTime(saved.t, lang) : null} />
    </section>
  );
}
