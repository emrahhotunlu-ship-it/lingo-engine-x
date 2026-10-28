import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { closeContext } from '../../app/shell/contextColumn';
import { useLookup } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { Button, IconButton } from '../Button';
import { closeTopBandLayer, inTextField, setBandKeysOpen, useBand } from './bandStore';

// Übungsrahmen mit Band (Relaunch Stufe 1 P3 S1-BAND, stufe1-plan §6.4, Vorschau `band`/`sheet`/`kbdhelp`):
// - `BandSheet`: das Mehr-Blatt am Handy (höchstens 85 % hoch). Es hängt IM Ergebnis-Abschnitt (die Übung bleibt EIN Baum,
//   Tests und Vorleseprogramme finden „Beispiele“ & Co. weiter in der Rückmeldung) und steht per `position: fixed` über allem.
// - `KeysHelp`: Tastenübersicht (⏎, T, W, 1–4, Esc, ?) – öffnet mit „?“ oder dem Knopf „?“ am Laptop.
// - `ExerciseKeys`: Esc-Reihenfolge der Übungsebene (Tastenübersicht → Mehr-Blatt → Menü → Kontextspalte, NIE die Übung)
//   und „?“. Hängt in `app/shell/Player.tsx` und greift nur, solange ein Übungsgerüst steht (`shells > 0`).

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Fokus bleibt im Dialog (aria-modal): Tab am Ende springt nach vorn und umgekehrt. */
function trapTab(e: ReactKeyboardEvent<HTMLElement>): void {
  if (e.key !== 'Tab') return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null && el.tabIndex >= 0);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === e.currentTarget)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Mehr-Blatt des Bands (Handy und Tablet ohne Kontextspalte). Esc schließt es über `ExerciseKeys` (oberstes eigenes Element). */
export function BandSheet({ open, onClose, title, children, next }: { open: boolean; onClose: () => void; title: string; children: ReactNode; /** „Weiter“ am Fuß des Blatts (Konzept 12.1). */ next?: { label: string; onClick: () => void } }) {
  const { t } = useT();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const id = window.setTimeout(() => panel.current?.focus(), 30);
    return () => {
      window.clearTimeout(id);
      if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="lx-band-layer" data-band-layer="" data-slot="more-sheet">
      <div className="lx-band-scrim" aria-hidden="true" data-testid="band-more-scrim" onClick={onClose} />
      <div ref={panel} className="lx-band-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} data-band-layer="" data-testid="band-more" onKeyDown={trapTab}>
        {/* Griff wie am Menü-Blatt (Punkt 15, N7): zeigt, dass es ein Blatt ist. */}
        <div aria-hidden="true" className="lx-band-grip" data-testid="sheet-grip" />
        <div className="lx-band-sheet-head">
          <h2 className="lx-t-task m-0">{title}</h2>
          <IconButton icon="close" label={t('bandMoreClose')} onClick={onClose} data-testid="band-more-close" />
        </div>
        <div className="lx-band-sheet-body">{children}</div>
        {next && (
          <div className="lx-band-sheet-foot">
            <Button variant="primary" size="lg" iconAfter="arrowRight" className="w-full sm:w-full" onClick={next.onClick} data-testid="band-more-next">
              {next.label}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const KEYS: ReadonlyArray<{ k: string; label: MessageKey }> = [
  { k: '⏎', label: 'bandKeyEnter' },
  { k: 'T', label: 'bandKeyHint' },
  { k: 'W', label: 'bandKeyDontKnow' },
  { k: '1–4', label: 'bandKeyChoice' },
  { k: 'Esc', label: 'bandKeyEsc' },
  { k: '?', label: 'bandKeyHelp' },
];

/** Tastenübersicht (Vorschau `kbdhelp`): ruhige Karte in der Mitte. */
function KeysHelp() {
  const { t } = useT();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    panel.current?.querySelector<HTMLElement>('[data-testid="keys-close"]')?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <div className="lx-band-layer lx-keys-layer" data-band-layer="">
      <div className="lx-band-scrim" aria-hidden="true" onClick={() => setBandKeysOpen(false)} />
      <div ref={panel} className="lx-keys" role="dialog" aria-modal="true" aria-label={t('bandKeys')} data-band-layer="" data-testid="keys-help" onKeyDown={trapTab}>
        <div className="lx-band-sheet-head">
          <h2 className="lx-t-task m-0">{t('bandKeys')}</h2>
          <IconButton icon="close" label={t('bandKeysClose')} onClick={() => setBandKeysOpen(false)} data-testid="keys-close" />
        </div>
        <dl className="lx-keys-list">
          {KEYS.map((r) => (
            <div key={r.k} className="lx-keys-row">
              <dt>
                <kbd>{r.k}</kbd>
              </dt>
              <dd>{t(r.label)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Esc und „?“ der Übungsebene; zeichnet die Tastenübersicht. */
export function ExerciseKeys() {
  const shells = useBand((s) => s.shells);
  const keysOpen = useBand((s) => s.keysOpen);
  const active = shells > 0;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
      if (e.key === 'Escape') {
        // Wortfenster, Wortgruppen-Auswahl und Claude haben ihre eigene Esc-Regel.
        const lk = useLookup.getState();
        if (lk.req || lk.pick) return;
        if (document.querySelector('[data-testid="companion"]')) return;
        const s = useBand.getState();
        const wasMenu = !s.keysOpen && !s.moreOpen && s.menuOpen;
        if (closeTopBandLayer()) {
          e.preventDefault();
          e.stopPropagation();
          if (wasMenu) document.querySelector<HTMLElement>('[data-testid="exercise-menu"]')?.focus();
          return;
        }
        // Fremde Blätter (Einstellungen, Wortkarte, Stufenaufstieg …) schließen sich selbst.
        if (document.querySelector('[role="dialog"]:not([data-band-layer])')) return;
        if (closeContext()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // Nie die Übung: Esc verlässt die Runde nicht (dafür gibt es ✕ und „Pause, später weiter“).
        e.preventDefault();
        if (inTextField(e.target) && e.target instanceof HTMLElement) e.target.blur();
        return;
      }
      if (e.key === '?' && !inTextField(e.target)) {
        if (document.querySelector('[role="dialog"]:not([data-band-layer])')) return;
        e.preventDefault();
        setBandKeysOpen(!useBand.getState().keysOpen);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);
  useEffect(() => {
    if (!active) setBandKeysOpen(false);
  }, [active]);
  return active && keysOpen ? <KeysHelp /> : null;
}
