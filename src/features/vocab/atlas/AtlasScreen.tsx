import { lazy, Suspense, useMemo, useState } from 'react';
import { flags } from '../../../app/flags';
import { skyTones, skyVeil } from '../../../domain/atlas/sky';
import { unitState, type UnitState } from '../../../domain/metrics/definitions';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { useLive } from '../../../data/live';
import { atlasEntries, atlasId, bandOf, ATLAS_BANDS, type AtlasBand, type AtlasEntry } from '../../../domain/atlas/atlas';
import { atlasGate } from '../../../domain/atlas/capacity';
import { PACK, PACK_CATS, packDoc, type PackCat } from '../../../domain/c1pack/pack';
import { toast } from '../../../ui/Toast';
import { Button } from '../../../ui/Button';
import { addAtlasCard } from './add';
import { useVocabCards } from '../hub/data';
import { useT, type MessageKey } from '../../../i18n';
import { ScreenHeader } from '../../learn/ui';

// Wort-Himmel (P59) nur bei Bedarf laden: der Start der App wird dadurch nicht schwerer.
const WordSky = lazy(() => import('./WordSky').then((m) => ({ default: m.WordSky })));

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
  const words = useMemo(() => atlasEntries(), []);
  const [bandOpen, setBandOpen] = useState<AtlasBand | null>(null);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(40);
  const hasCard = (e: AtlasEntry): boolean => vocab.has(atlasId(e));
  const packTotal = rows.length;
  const packKnown = rows.filter((r) => r.have).length;
  const total = packTotal + words.length;
  const known = packKnown + words.filter(hasCard).length;
  const query = q.trim().toLowerCase();
  const hits = query ? words.filter((e) => e.w.startsWith(query) || e.d.toLowerCase().includes(query)).slice(0, 30) : [];
  const cards = useVocabCards();
  const gate = useMemo(() => atlasGate({ cards, today, nowMs: now }), [cards, today, now]);
  const profile = useLive((s) => s.docs['app/profile']);
  const sky = flags.fx.sky;
  const tones = useMemo(() => {
    if (!sky) return [];
    const st = new Map<string, UnitState>();
    for (const c of cards) if (c.kind === 'vocab') st.set(c.id, unitState(c));
    return skyTones(
      words.map(atlasId),
      (id) => vocab.has(id),
      (id) => st.get(id),
    );
  }, [sky, cards, words, vocab]);
  const veil = useMemo(() => (sky ? skyVeil(profile, now) : null), [sky, profile, now]);
  const add = async (e: AtlasEntry) => {
    // Nie still scheitern: voll oder heute genug neue Wörter → ruhiger Hinweis, nichts wird geschrieben.
    if (gate.state === 'full') {
      toast(t('atCapFull', { n: num(gate.total) }));
      return;
    }
    if (gate.state === 'enough') {
      toast(t('atCapToday', { n: num(gate.limit) }));
      return;
    }
    const ok = await addAtlasCard(e, today, now);
    toast(ok ? t('atAdded', { word: e.w }) : t('atNotAdded'));
  };
  const entryRow = (e: AtlasEntry) => {
    const h = hasCard(e);
    return (
      <li key={e.w} className="flex flex-col gap-0.5 border-b border-line px-4 py-2.5 last:border-b-0" data-testid="atlas-word" data-have={h ? 'true' : 'false'}>
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-medium" lang="en">
            {e.w}
          </span>
          {h ? (
            <span className="flex-none text-xs text-muted">{t('atHave')}</span>
          ) : (
            <Button variant="ghost" icon="plus" onClick={() => void add(e)} data-testid="atlas-add">
              {t('atAdd')}
            </Button>
          )}
        </span>
        <span className="text-sm text-muted">{e.d}</span>
        <span className="text-sm text-muted" lang="en">
          {e.x}
        </span>
      </li>
    );
  };

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
      <div className={sky ? 'lx-atlas-grid' : 'contents'}>
        {sky && (
          <div className="lx-atlas-sky">
            <Suspense fallback={<div className="lx-sky-skeleton" aria-hidden="true" />}>
              <WordSky entries={words} tones={tones} veil={veil} onAdd={(e) => void add(e)} />
            </Suspense>
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
          {gate.state !== 'ok' && (
            <p className="m-0 text-sm text-gold-text" role="status" data-testid="atlas-cap" data-state={gate.state}>
              {gate.state === 'full' ? t('atCapFull', { n: num(gate.total) }) : t('atCapToday', { n: num(gate.limit) })}
            </p>
          )}
          <input
            type="search"
            className="lx-field text-base"
            placeholder={t('atSearch')}
            aria-label={t('atSearch')}
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-testid="atlas-search"
          />
          {query && (
            <ul className="lx-glass flex flex-col rounded-[var(--radius-card)]" data-testid="atlas-hits">
              {hits.length ? hits.map(entryRow) : <li className="px-4 py-3 text-sm text-muted">{t('atNoHits')}</li>}
            </ul>
          )}
          <h2 className="text-lg font-semibold">{t('atWordsTitle')}</h2>
          <ul className="flex flex-col gap-3" data-testid="atlas-freq">
            {ATLAS_BANDS.map((b) => {
              const list = words.filter((e) => bandOf(e) === b);
              if (!list.length) return null;
              const have = list.filter(hasCard).length;
              const isOpen = bandOpen === b;
              return (
                <li key={b} className="lx-glass rounded-[var(--radius-card)]" data-testid="atlas-fband" data-band={b}>
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setBandOpen(isOpen ? null : b);
                      setShown(40);
                    }}
                    data-testid="atlas-fband-toggle"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-base font-semibold">{t(`atFband_${b}`)}</span>
                      <span className="lx-tnum text-xs text-muted">{t('atBandCount', { have: num(have), total: num(list.length) })}</span>
                    </span>
                    <span className="h-1.5 w-16 flex-none rounded-full bg-surface" aria-hidden="true" data-testid="atlas-fband-bar" data-pct={Math.round((have / list.length) * 100)}>
                      <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${Math.round((have / list.length) * 100)}%` }} />
                    </span>
                  </button>
                  {isOpen && (
                    <>
                      <ul className="flex flex-col border-t border-line">{list.slice(0, shown).map(entryRow)}</ul>
                      {shown < list.length && (
                        <div className="border-t border-line p-3">
                          <Button variant="secondary" onClick={() => setShown((n) => n + 60)} data-testid="atlas-more">
                            {t('atMore')}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <h2 className="text-lg font-semibold">{t('atPackTitle')}</h2>
          <ul className="flex flex-col gap-3">
            {PACK_CATS.map((c) => {
              const list = rows.filter((r) => r.e.cat === c);
              const have = list.filter((r) => r.have).length;
              const isOpen = open === c;
              return (
                <li key={c} className="lx-glass rounded-[var(--radius-card)]" data-testid="atlas-band" data-cat={c}>
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : c)}
                    data-testid="atlas-band-toggle"
                  >
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
          <p className="text-xs text-subtle" data-testid="atlas-credits">
            {t('atCredits')}
          </p>
        </div>
      </div>
    </div>
  );
}
