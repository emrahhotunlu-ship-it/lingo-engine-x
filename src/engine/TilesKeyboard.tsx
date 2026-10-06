import { useEffect, useRef, useState } from 'react';
import { isTilePrefix, pickTile } from '../domain/srs/exercise';
import type { Tile } from '../domain/drills/order';
import { inputProfile } from '../platform/input';

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

export const hasFinePointer = (): boolean => inputProfile() === 'keys';

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
      // Wörter sammeln, bis sie genau einen freien Baustein ergeben (auch Mehrwort-Bausteine wie „a bit of a stretch“).
      // Ist das Gesammelte der Anfang eines freien Mehrwort-Bausteins, bleibt es im Feld stehen (kein Fehler).
      const complete = flush || /\s$/.test(value);
      const words = value.split(/\s+/).filter(Boolean);
      let acc: string[] = [];
      words.forEach((w, i) => {
        const cand = [...acc, w].join(' ');
        // Das letzte Wort ohne Leertaste ist noch nicht fertig getippt: stehen lassen.
        if (i === words.length - 1 && !complete) {
          acc = [...acc, w];
          return;
        }
        const id = pickTile(tiles, next, cand, 'words');
        if (id !== null) {
          next = [...next, id];
          acc = [];
        } else if (isTilePrefix(tiles, next, cand)) {
          acc = [...acc, w];
        } else {
          rest.push(...acc, w);
          bad = cand;
          acc = [];
        }
      });
      setText([...rest, ...acc].join(' ') + (complete && acc.length ? ' ' : ''));
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
