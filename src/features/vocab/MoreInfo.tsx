import { useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import type { TrainCard } from '../../domain/srs/types';
import { useT, type MessageKey } from '../../i18n';
import { isLeech, MnemonicBlock, storedMnemo } from './mnemonic';

// „Mehr Infos" nach der Antwort (Emrah 02.10.2026): in jeder Übungsart derselbe Block an derselben Stelle –
// englische Erklärung, Stil, typische Verbindungen mit Deutsch und die Merkhilfe. Bedeutung und Wortart stehen
// schon im Ergebnis (nichts doppelt, Kap. 15). Nur Daten der Karte, ohne Claude (die Merkhilfe darf Claude erzeugen).

type Row = { label: MessageKey; node: React.ReactNode };

export function MoreInfo({ card }: { card: TrainCard }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const ai = useAiAvailable();
  const rows: Row[] = [];
  if (card.def) rows.push({ label: 'trMoreDef', node: <span lang="en">{card.def}</span> });
  if (card.chunk?.register) rows.push({ label: 'trMoreRegister', node: card.chunk.register });
  const cols = card.col.filter((c) => c.p);
  if (!rows.length && !cols.length && !ai && !storedMnemo(card.doc, lang)) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="more-info">
      <button type="button" className="min-h-11 self-start text-sm font-medium text-accent-text underline" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="more-info-btn">
        {open ? t('trMoreLess') : t('trMore')}
      </button>
      {open && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 text-sm" data-testid="more-info-body">
          {rows.map((r, i) => (
            <p key={i}>
              <span className="text-muted">{t(r.label)}: </span>
              {r.node}
            </p>
          ))}
          {cols.length > 0 && (
            <div>
              <p className="text-muted">{t('trMoreCol')}:</p>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {cols.slice(0, 5).map((c, i) => (
                  <li key={i}>
                    <span lang="en" className="font-medium">
                      {c.p}
                    </span>
                    {lang === 'de' && c.de && (
                      <>
                        <span className="text-muted"> – </span>
                        <span lang="de">{c.de}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!isLeech(card.doc) && !storedMnemo(card.doc, lang) && <MnemonicBlock card={card} always />}
        </div>
      )}
    </div>
  );
}
