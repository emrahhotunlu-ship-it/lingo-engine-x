import { useId, useState } from 'react';
import { changeCtx, normCtx } from '../../app/actions';
import { useLive } from '../../data/live';
import { useT } from '../../i18n';
import { useCapabilities } from '../../platform/capabilities';
import { WORK_MAX } from '../../prompts/work';
import { Button } from '../../ui/Button';
import { SaveStatus } from '../../ui/SaveStatus';

// Beruflicher Kontext (Funktionsabgleich M22): Freitext ≤ 400 Zeichen in `app/profile.ctx`
// (Feld der alten App). prompts/work.ts liest ihn für Fachwörter, Schreib- und Hörtexte und
// Szenen; leer = Standardtext. Gespeichert wird nur auf „Speichern" (ein Schreibvorgang).

export function WorkContextSection() {
  const { t, num } = useT();
  const id = useId();
  const db = useCapabilities((s) => s.db);
  const saved = useLive((s) => s.docs['app/profile']?.ctx);
  const stored = typeof saved === 'string' ? saved : '';
  const [text, setText] = useState(stored);
  const [busy, setBusy] = useState(false);
  // UX-Prüfung WL2 S8: ein Speichern-Muster in „Mein Kontext“ – Zweitknopf, erst bei Änderung aktiv, Rückmeldung daneben statt Hinweis über der Seite.
  const [status, setStatus] = useState<'saved' | 'failed' | null>(null);
  // Neuer Stand aus der Datenbank (anderes Gerät), solange hier nichts geändert wurde.
  const [base, setBase] = useState(stored);
  if (stored !== base) {
    setBase(stored);
    if (normCtx(text) === normCtx(base)) setText(stored);
  }
  if (db !== 'ready') return null;
  const changed = normCtx(text) !== stored;
  const save = async () => {
    setBusy(true);
    setStatus(null);
    const ok = await changeCtx(text);
    setBusy(false);
    if (ok) setText(normCtx(text));
    setStatus(ok ? 'saved' : 'failed');
  };
  return (
    <section className="flex flex-col gap-3" data-testid="work-ctx">
      <h3 className="lx-eyebrow">{t('ctxTitle')}</h3>
      <label htmlFor={id} className="text-sm text-muted">
        {t('ctxHint')}
      </label>
      <textarea
        id={id}
        value={text}
        rows={3}
        maxLength={WORK_MAX}
        onChange={(e) => {
          setText(e.target.value);
          setStatus(null);
        }}
        placeholder={t('ctxPlaceholder')}
        autoCapitalize="sentences"
        spellCheck={false}
        data-testid="work-ctx-input"
        className="lx-glass w-full resize-y rounded-[var(--radius-control)] px-4 py-3 text-base leading-relaxed text-fg placeholder:text-subtle"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="lx-tnum text-xs text-subtle" aria-live="polite">
          {t('ctxCount', { n: num(text.length), max: num(WORK_MAX) })}
        </span>
        <span className="flex flex-wrap items-center gap-3">
          <SaveStatus status={status} saved={t('ctxSaved')} failed={t('ctxSaveFailed')} testId="work-ctx-status" />
          <Button variant="secondary" onClick={() => void save()} disabled={!changed} busy={busy} data-testid="work-ctx-save">
            {t('ctxSave')}
          </Button>
        </span>
      </div>
    </section>
  );
}
