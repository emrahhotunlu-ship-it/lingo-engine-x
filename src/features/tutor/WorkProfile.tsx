import { useId, useState } from 'react';
import { useLive } from '../../data/live';
import { cleanCtx2, CTX2_LIMITS, saveCtx2, SIT_CHIPS, startCtx2, WHO_CHIPS } from '../../domain/tutor/ctx2';
import { useT, type MessageKey } from '../../i18n';
import { useCapabilities } from '../../platform/capabilities';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';

// „Mein Arbeitsalltag“ (Lernplattform 3.0 P46, KI-Tutor T4): Rolle, Branche, Gesprächspartner, Situationen und Fachwörter als Daten statt Freitext, gespeichert in
// `app/profile.ctx2`. Der bisherige Freitext `app/profile.ctx` (Einstellungen) bleibt unverändert; das Formular wird daraus nur vorbelegt. Gespeichert wird erst auf
// „Speichern“ (ein Schreibvorgang, nur bei Änderung). Die Auswahl gilt auch für alle anderen Vorlagen, die `tutorCtx()` lesen.

const WHO_LABEL: Record<string, MessageKey> = {
  CFO: 'ttWpWhoCFO',
  'IT lead': 'ttWpWhoIT',
  procurement: 'ttWpWhoProc',
  partner: 'ttWpWhoPartner',
  'own team': 'ttWpWhoTeam',
  investor: 'ttWpWhoInvestor',
};
const SIT_LABEL: Record<string, MessageKey> = {
  negotiation: 'ttWpSitNeg',
  objection: 'ttWpSitObj',
  'status update': 'ttWpSitStatus',
  'client email': 'ttWpSitMail',
  presentation: 'ttWpSitPres',
  'small talk': 'ttWpSitSmall',
  escalation: 'ttWpSitEsc',
};

type Tr = (key: MessageKey) => string;

/** Anzeigename einer Situation (bekannte Auswahlwerte übersetzt, eigene Einträge unverändert). */
export const clinicSitLabel = (value: string, t: Tr): string => (SIT_LABEL[value] ? t(SIT_LABEL[value]) : value);
const whoLabel = (value: string, t: Tr): string => (WHO_LABEL[value] ? t(WHO_LABEL[value]) : value);

const CHIP = 'lx-hit inline-flex items-center rounded-full px-3 text-sm';

function ChipPicker({ legend, presets, label, values, max, maxLen, onChange, testId }: { legend: string; presets: readonly string[]; label: (v: string) => string; values: string[]; max: number; maxLen: number; onChange: (v: string[]) => void; testId: string }) {
  const { t } = useT();
  const id = useId();
  const [own, setOwn] = useState('');
  const all = [...presets, ...values.filter((v) => !presets.includes(v))];
  const toggle = (v: string): void => onChange(values.includes(v) ? values.filter((x) => x !== v) : values.length >= max ? values : [...values, v]);
  const add = (): void => {
    const v = own.replace(/\s+/g, ' ').trim().slice(0, maxLen);
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange(values.length >= max ? values : [...values, v]);
    setOwn('');
  };
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" data-testid={testId}>
      <legend className="lx-t-label mb-1 p-0">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((v) => {
          const on = values.includes(v);
          return (
            <button key={v} type="button" aria-pressed={on} onClick={() => toggle(v)} data-value={v} className={`${CHIP} ${on ? 'bg-accent-soft font-semibold text-accent-text' : 'bg-surface-strong text-fg hover:bg-surface'}`}>
              {label(v)}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          {t('ttWpOwn')}
        </label>
        <input
          id={id}
          type="text"
          value={own}
          maxLength={maxLen}
          placeholder={t('ttWpOwn')}
          lang="en"
          onChange={(e) => setOwn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className="lx-glass min-h-11 min-w-0 flex-1 rounded-[var(--radius-control)] px-3 text-base text-fg placeholder:text-subtle"
          data-testid={`${testId}-own`}
        />
        <Button variant="secondary" onClick={add} disabled={!own.trim()} data-testid={`${testId}-add`}>
          {t('ttWpAdd')}
        </Button>
      </div>
    </fieldset>
  );
}

export function WorkProfile() {
  const { t } = useT();
  const db = useCapabilities((s) => s.db);
  const profile = useLive((s) => s.docs['app/profile']);
  const [start] = useState(() => startCtx2(profile, Date.now()));
  const [role, setRole] = useState(start.role);
  const [field, setField] = useState(start.field);
  const [who, setWho] = useState(start.who);
  const [sit, setSit] = useState(start.sit);
  const [terms, setTerms] = useState(start.terms.join('\n'));
  const [busy, setBusy] = useState(false);
  const roleId = useId();
  const fieldId = useId();
  const termsId = useId();
  if (db !== 'ready') return null;

  const save = async (): Promise<void> => {
    setBusy(true);
    const next = cleanCtx2({ role, field, who, sit, terms: terms.split(/[,\n]/) }, Date.now());
    const r = await saveCtx2(next);
    setBusy(false);
    if (r === 'saved' || r === 'unchanged') toast(t('ttWpSaved'));
    else toast(t('ttWpSaveFailed'), 'error');
  };

  const input = 'lx-glass min-h-11 w-full rounded-[var(--radius-control)] px-3 text-base text-fg placeholder:text-subtle';
  return (
    <section className="flex flex-col gap-4" data-testid="work-profile">
      <p className="lx-t-meta m-0 text-muted">{t('ttWpLead')}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={roleId} className="lx-t-label">
          {t('ttWpRole')}
        </label>
        <input id={roleId} type="text" value={role} maxLength={CTX2_LIMITS.role} lang="en" placeholder={t('ttWpRolePh')} onChange={(e) => setRole(e.target.value)} className={input} data-testid="wp-role" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="lx-t-label">
          {t('ttWpField')}
        </label>
        <input id={fieldId} type="text" value={field} maxLength={CTX2_LIMITS.field} lang="en" placeholder={t('ttWpFieldPh')} onChange={(e) => setField(e.target.value)} className={input} data-testid="wp-field" />
      </div>
      <ChipPicker legend={t('ttWpWho')} presets={WHO_CHIPS} label={(v) => whoLabel(v, t)} values={who} max={CTX2_LIMITS.who} maxLen={CTX2_LIMITS.whoLen} onChange={setWho} testId="wp-who" />
      <ChipPicker legend={t('ttWpSit')} presets={SIT_CHIPS} label={(v) => clinicSitLabel(v, t)} values={sit} max={CTX2_LIMITS.sit} maxLen={CTX2_LIMITS.sitLen} onChange={setSit} testId="wp-sit" />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={termsId} className="lx-t-label">
          {t('ttWpTerms')}
        </label>
        <textarea id={termsId} value={terms} rows={3} lang="en" spellCheck={false} placeholder="audit trail, archive, retention" onChange={(e) => setTerms(e.target.value)} className={`${input} py-2`} data-testid="wp-terms" />
        <p className="lx-t-meta m-0 text-subtle">{t('ttWpTermsHint')}</p>
      </div>
      <p className="lx-t-meta m-0 text-subtle">{t('ttWpFree')}</p>
      <div>
        <Button variant="primary" onClick={() => void save()} busy={busy} data-testid="wp-save">
          {t('ttWpSave')}
        </Button>
      </div>
    </section>
  );
}
