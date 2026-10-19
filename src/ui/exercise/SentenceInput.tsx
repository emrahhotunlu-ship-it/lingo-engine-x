import { useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { useT } from '../../i18n';

// Eingabebaustein für Sätze (§4.3/§4.4). `free`: einzeiliges, mit dem Text wachsendes Feld (Return = prüfen).
// `edit-span`: der Satz `base` im Fluss, an der Spanne [from,to) (in Wörtern von `base`) steht ein Eingabefeld
// mit dem Text `value` statt der alten Wörter. (Die Lücke mit Bewegung baut Teilpaket B in `src/engine`.)

type Common = { value: string; onChange: (v: string) => void; onSubmit: () => void; testId: string; disabled?: boolean };
type Free = Common & { mode: 'free'; maxWords?: number; /** Platzhalter im leeren Feld. */ placeholder?: string; /** Mehrzeilig vorgeben (Kundenmail, Kombi-Satz: 2–4 Sätze, mindestens 120 px). */ tall?: boolean };
type Edit = Common & { mode: 'edit-span'; base: string; span: readonly [number, number] };
export type SentenceInputProps = Free | Edit;

const textProps = { lang: 'en', autoCapitalize: 'off', autoCorrect: 'off', autoComplete: 'off', spellCheck: false, enterKeyHint: 'go' } as const;

export function SentenceInput(props: SentenceInputProps) {
  const { t } = useT();
  const area = useRef<HTMLTextAreaElement>(null);
  const { value, onChange, onSubmit, testId, disabled } = props;
  const isFree = props.mode === 'free';
  // Wachsendes einzeiliges Feld: Höhe folgt dem Inhalt (Zeilenumbruch nur durch Umbruch, nie durch Return).
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, isFree]);

  const onKey = (e: KeyboardEvent<HTMLElement>): void => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    onSubmit();
  };

  if (props.mode === 'free') {
    const max = props.maxWords;
    const handle = (e: ChangeEvent<HTMLTextAreaElement>): void => {
      const v = e.target.value.replace(/\n/g, ' ');
      if (max && v.trim().split(/\s+/).filter(Boolean).length > max && v.length > value.length) return;
      onChange(v);
    };
    return (
      <textarea
        ref={area}
        rows={1}
        className={`lx-field lx-t-prompt w-full resize-none overflow-hidden scroll-mb-40 ${props.tall ? 'min-h-[120px]' : 'min-h-14'}`}
        placeholder={props.placeholder}
        // Am Handy bleibt das Feld sichtbar, wenn die Tastatur aufgeht (UX-Prüfung 14.10.): nach der Tastatur-Animation in die Mitte rollen.
        onFocus={(e) => {
          const el = e.currentTarget;
          window.setTimeout(() => el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 320);
        }}
        data-sentence=""
        data-testid={testId}
        aria-label={t('exSentenceLabel')}
        value={value}
        disabled={disabled}
        onChange={handle}
        onKeyDown={onKey}
        {...textProps}
      />
    );
  }

  const words = props.base.split(/\s+/).filter(Boolean);
  const [from, to] = props.span;
  const before = words.slice(0, from).join(' ');
  const after = words.slice(to).join(' ');
  const size = Math.max(3, value.length + 1);
  return (
    <p className="lx-t-prompt" lang="en" data-testid={`${testId}-sentence`}>
      {before && <span>{before} </span>}
      <input
        type="text"
        className="lx-field lx-t-prompt inline-block min-h-11 max-w-full align-baseline"
        // `.lx-field` ist 100 % breit; im Satz soll das Feld die Lücke sein: feste Anfangsbreite, wächst mit dem Text.
        style={{ width: `calc(${Math.max(8, value.length + 2)}ch + 1.75rem)` }}
        data-testid={testId}
        aria-label={t('exSentenceLabel')}
        size={size}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        onFocus={(e) => {
          const el = e.currentTarget;
          window.setTimeout(() => el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 320);
        }}
        {...textProps}
      />
      {after && <span> {after}</span>}
    </p>
  );
}
