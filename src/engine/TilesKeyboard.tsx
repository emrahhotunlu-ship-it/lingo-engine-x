import { useEffect, useRef, useState } from 'react';
import { pickTile } from '../domain/srs/exercise';
import type { Tile } from '../domain/drills/order';

// Bausteine mit der Tastatur (Emrah 02.10.2026: am Rechner tippen statt nur klicken). Ein Textfeld unter den
// Bausteinen: Wort + Leertaste legt den passenden freien Baustein, Rücktaste im leeren Feld nimmt den letzten
// zurück, Enter im leeren Feld prüft. Nur mit feinem Zeiger (Maus/Trackpad); am Handy bleibt es beim Tippen auf
// die Bausteine.

type Props = {
  tiles: readonly Tile[];
  placed: readonly number[];
  onChange: (placed: number[]) => void;
  onSubmit: () => void;
  locked: boolean;
  mode: 'letters' | 'words';
  label: string;
  hint: string;
  unknown: (token: string) => string;
};

export const hasFinePointer = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;

export function TilesKeyboard({ tiles, placed, onChange, onSubmit, locked, mode, label, hint, unknown }: Props) {
  const [text, setText] = useState('');
  const [miss, setMiss] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!locked) field.current?.focus();
  }, [locked]);

  /** Legt alle vollständigen Teile; unbekannte bleiben im Feld stehen. */
  const take = (value: string, flush: boolean): void => {
    let next = [...placed];
    const rest: string[] = [];
    let bad: string | null = null;
    if (mode === 'letters') {
      for (const ch of value.replace(/\s+/g, '')) {
        const id = pickTile(tiles, next, ch, 'letters');
        if (id === null) bad = ch;
        else next = [...next, id];
      }
      setText('');
    } else {
      const parts = value.split(/\s+/);
      const done = flush || /\s$/.test(value) ? parts : parts.slice(0, -1);
      const pending = flush || /\s$/.test(value) ? [] : [parts[parts.length - 1] ?? ''];
      for (const p of done) {
        if (!p) continue;
        const id = pickTile(tiles, next, p, 'words');
        if (id === null) {
          rest.push(p);
          bad = p;
        } else next = [...next, id];
      }
      setText([...rest, ...pending].join(' '));
    }
    setMiss(bad);
    if (next.length !== placed.length) onChange(next);
  };

  return (
    <div className="flex flex-col gap-1" data-testid="tiles-keyboard">
      <input
        ref={field}
        type="text"
        value={text}
        disabled={locked}
        lang="en"
        aria-label={label}
        placeholder={hint}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="lx-field text-base"
        data-testid="tiles-type"
        onChange={(ev) => take(ev.target.value, false)}
        onKeyDown={(ev) => {
          if (ev.key === 'Backspace' && !text && placed.length) {
            ev.preventDefault();
            onChange(placed.slice(0, -1));
            setMiss(null);
          } else if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.stopPropagation();
            if (text.trim()) take(text, true);
            else if (placed.length) onSubmit();
          }
        }}
      />
      {miss && (
        <p className="text-xs text-subtle" data-testid="tiles-type-miss">
          {unknown(miss)}
        </p>
      )}
    </div>
  );
}
