import { useMemo } from 'react';
import { useLive } from '../../data/live';
import { useT } from '../../i18n';
import { useDecks } from '../vocab/decksStore';

// Neubau N80/N33: Karten mit der Markierung „Mit Lehrer besprechen“ (`app/decks.flagged`, schreibt P3)
// erscheinen in der Preply-Vorbereitung – nur lesend, höchstens 12, als Wort der Karte.

type Doc = Record<string, unknown>;

export function flaggedWords(decks: Doc | null | undefined, vocab: ReadonlyMap<string, Doc> | undefined, max = 12): string[] {
  const ids = Array.isArray(decks?.flagged) ? (decks.flagged as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const out: string[] = [];
  for (const id of ids) {
    const w = vocab?.get(id)?.word;
    if (typeof w === 'string' && w.trim() && !out.includes(w)) out.push(w.trim());
    if (out.length >= max) break;
  }
  return out;
}

export function FlaggedCards() {
  const { t } = useT();
  // Liest das dauerhafte Abo aus decksStore (kein zweites onSnapshot auf `app/decks`, Kap. 3.4).
  const decks = useDecks((s) => s.raw);
  const vocab = useLive((s) => s.collections.vocab);
  const words = useMemo(() => flaggedWords(decks, vocab), [decks, vocab]);
  if (!words.length) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="pp-flagged" data-n={words.length}>
      <p className="text-sm font-semibold">{t('nbSprechenFlagged')}</p>
      <ul className="flex flex-wrap gap-2">
        {words.map((w) => (
          <li key={w} className="lx-chip" lang="en">
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}
