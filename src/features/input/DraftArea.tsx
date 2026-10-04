import { useEffect, useId, useImperativeHandle, useRef, type Ref } from 'react';
import { wordCount } from '../../domain/text/textStats';
import { useT } from '../../i18n';
import { saveDraft } from './draft';

// Schreibfeld (Plan §4.3): 16 px (kein Zoom am iPhone), Großschreibung am Satzanfang, ohne
// Rechtschreibprüfung (Emrah soll selbst schreiben), Wortzähler. Der Entwurf wird 800 ms nach
// der letzten Eingabe lokal gesichert (Bequemlichkeit, nie Lernstand). Mit `visualViewport`
// bleiben Feld und Zähler über der Bildschirmtastatur sichtbar (A7.4, Hinweis H5).

export type DraftHandle = { insert(text: string): void; focus(): void };

type Props = {
  value: string;
  onChange: (v: string) => void;
  label: string;
  draftKey: string;
  min?: number | undefined;
  max?: number | undefined;
  rows?: number;
  disabled?: boolean;
  handle?: Ref<DraftHandle>;
  testId?: string;
};

export function DraftArea({ value, onChange, label, draftKey, min, max, rows = 8, disabled, handle, testId = 'draft' }: Props) {
  const { t } = useT();
  const id = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const counter = useRef<HTMLParagraphElement>(null);
  const n = wordCount(value);

  useImperativeHandle(
    handle,
    () => ({
      insert(text: string) {
        const el = area.current;
        const cur = el?.value ?? value;
        const start = el ? el.selectionStart : cur.length;
        const end = el ? el.selectionEnd : cur.length;
        const clean = text.replace(/…$/, '').replace(/\.\.\.$/, '');
        const before = cur.slice(0, start);
        const pad = before && !/\s$/.test(before) ? ' ' : '';
        const next = `${before}${pad}${clean}${cur.slice(end)}`;
        onChange(next);
        const pos = before.length + pad.length + clean.length;
        requestAnimationFrame(() => {
          if (!area.current) return;
          area.current.focus({ preventScroll: true });
          area.current.setSelectionRange(pos, pos);
        });
      },
      focus() {
        area.current?.focus();
      },
    }),
    [onChange, value],
  );

  // Entwurf 800 ms nach der letzten Änderung sichern.
  useEffect(() => {
    const id = window.setTimeout(() => saveDraft(draftKey, value), 800);
    return () => window.clearTimeout(id);
  }, [draftKey, value]);

  // iPhone-Tastatur: Zähler sichtbar halten, wenn sich der sichtbare Bereich ändert.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const keep = () => {
      if (document.activeElement === area.current) counter.current?.scrollIntoView({ block: 'nearest' });
    };
    vv.addEventListener('resize', keep);
    return () => vv.removeEventListener('resize', keep);
  }, []);

  const range = min !== undefined && max !== undefined;
  const state = range ? (n < min ? 'short' : n > max ? 'long' : 'ok') : 'free';
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="lx-eyebrow">
        {label}
      </label>
      <textarea
        id={id}
        ref={area}
        value={value}
        rows={rows}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => window.setTimeout(() => counter.current?.scrollIntoView({ block: 'nearest' }), 300)}
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
        lang="en"
        data-testid={testId}
        className="lx-glass min-h-40 w-full resize-y rounded-[var(--radius-control)] px-4 py-3 text-base leading-relaxed text-fg placeholder:text-subtle disabled:opacity-70"
      />
      <p
        ref={counter}
        className={`lx-tnum text-xs font-medium ${state === 'ok' ? 'text-accent-text' : 'text-muted'}`}
        data-testid="word-count"
        data-n={n}
        data-min={min}
        data-max={max}
        aria-live="polite"
      >
        {range ? t('wrWords', { n, min, max }) : t('inDraftWords', { n })}
      </p>
    </div>
  );
}
