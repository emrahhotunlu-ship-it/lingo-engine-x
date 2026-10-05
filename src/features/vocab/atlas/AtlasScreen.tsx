import { useMemo, useState } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { useLive } from '../../../data/live';
import { PACK, PACK_CATS, packDoc, type PackCat } from '../../../domain/c1pack/pack';
import { useT, type MessageKey } from '../../../i18n';
import { ScreenHeader } from '../../learn/ui';

// Atlas (Gesamtkonzept 3.3, erste Ausbaustufe): das C1-Paket nach Bändern – wie viele Einträge je Band schon als Karte
// in deinem Wortschatz liegen und was noch kommt. Nur Lesen: es schreibt nichts, neue Einträge kommen wie bisher
// über den täglichen Zulauf. Der Atlas wächst mit dem Paket; die Zahl 8.000 bleibt das Ziel (Zielkarte unter Fortschritt).

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const BAND: Record<PackCat, MessageKey> = {
  colloc: 'atBandColloc',
  frame: 'atBandFrame',
  phrasal: 'atBandPhrasal',
  word: 'atBandWord',
  tech: 'atBandTech',
  family: 'atBandFamily',
  idiom: 'atBandIdiom',
};

export function AtlasScreen() {
  const { t, num } = useT();
  const back = useNav((s) => s.back);
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const chunk = useLive((s) => s.collections.chunk) ?? EMPTY;
  const [open, setOpen] = useState<PackCat | null>(null);

  const rows = useMemo(
    () =>
      PACK.map((e) => {
        const d = packDoc(e, today, now);
        const have = d ? (d.kind === 'chunk' ? chunk.has(d.id) : vocab.has(d.id)) : false;
        return { e, have };
      }),
    [today, now, vocab, chunk],
  );
  const total = rows.length;
  const known = rows.filter((r) => r.have).length;

  return (
    <div className="flex flex-col gap-4 py-6 sm:gap-6 sm:py-10" data-testid="atlas">
      <ScreenHeader
        title={t('atTitle')}
        back={back}
        lead={
          <span className="lx-tnum block text-sm" data-testid="atlas-total">
            {t('atLead', { known: num(known), total: num(total) })}
          </span>
        }
      />
      <ul className="flex flex-col gap-3">
        {PACK_CATS.map((c) => {
          const list = rows.filter((r) => r.e.cat === c);
          const have = list.filter((r) => r.have).length;
          const isOpen = open === c;
          return (
            <li key={c} className="lx-glass rounded-[var(--radius-card)]" data-testid="atlas-band" data-cat={c}>
              <button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c)} data-testid="atlas-band-toggle">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-base font-semibold">{t(BAND[c])}</span>
                  <span className="lx-tnum text-xs text-muted">{t('atBandCount', { have: num(have), total: num(list.length) })}</span>
                </span>
                <span className="h-1.5 w-16 flex-none rounded-full bg-surface" aria-hidden="true">
                  <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${list.length ? Math.round((have / list.length) * 100) : 0}%` }} />
                </span>
              </button>
              {isOpen && (
                <ul className="flex flex-col border-t border-line">
                  {list.map(({ e, have: h }) => (
                    <li key={e.id} className="flex flex-col gap-0.5 border-b border-line px-4 py-2.5 last:border-b-0" data-testid="atlas-entry" data-have={h ? 'true' : 'false'}>
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium" lang="en">
                          {e.en}
                        </span>
                        <span className="flex-none text-xs text-muted">{h ? t('atHave') : t('atNot')}</span>
                      </span>
                      <span className="text-sm text-muted">{e.de}</span>
                      <span className="text-sm text-muted" lang="en">
                        {e.ex}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
