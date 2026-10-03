import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useNav, type Route } from '../../app/nav';
import { HubSections } from '../../app/shell/Hub';
import { placesOf } from '../../app/shell/tabs';
import { useWeek } from '../../app/useWeek';
import { themeTextFor } from '../../content/nb/load';
import { useLive } from '../../data/live';
import { isDictWord } from '../../domain/lexicon/dict';
import { newShare } from '../../domain/input/newShare';
import { readingMinutes } from '../../domain/input/textStats';
import type { Domain } from '../../domain/input/types';
import { statusIndex } from '../../domain/input/wordStatus';
import { lemmaCandidates } from '../../domain/text/lemma';
import { useT } from '../../i18n';
import { ChannelIcon, type Channel } from '../../ui/Card';
import { Icon, type IconName } from '../../ui/Icon';
import { InputIcon, type InputIconName } from '../../ui/InputIcon';
import { useFeedItems, loadFeedOnce } from '../discover/feedStore';
import { dbArticles, dbListening, findArticle, findListening, listenRows, listensOn, pickArticle, pickListening, readDoneBefore, readingsOn, listenDoneBefore } from '../input/derive';
import { ensureLibrary, useInputLibrary } from '../input/library';
import { useInputPos } from '../input/resume';
import { useInputContext } from '../input/useInputContext';
import { LEGACY_ARTICLES, LEGACY_LISTENING } from '../../domain/input/items';
import { TabTitle } from '../system/Chrome';

// Reiter „Lesen“ (Neubau plan.md §1.3, N50, H1, H8, H22, H26): Chips · Heute neu (Text zum
// Wochenthema, Text/Hörtext des Tages, Beiträge von heute) · Weiterlesen · Bibliothek · Neu
// hinzufügen · Verlauf. Jede Kachel nennt Niveau, „x % neu“ und Minuten; ein Tipp öffnet den Text.
// „% neu“ rechnet lokal aus Wortschatz und Wörterbuch – erst nach dem ersten Bild (Wörterbuch lazy).

type Chip = 'all' | 'read' | 'listen' | 'work' | 'life';
const CHIPS: readonly Chip[] = ['all', 'read', 'listen', 'work', 'life'];

type Tile = {
  key: string;
  mode: 'read' | 'listen';
  title: string;
  level: string | null;
  domain: Domain;
  text: string;
  route: Route;
  own?: boolean;
  done?: boolean;
  eyebrow?: string;
  testId?: string;
  module?: string;
  channel: Channel;
};

const PAGE = 20;

const match = (t: Tile, chip: Chip): boolean => chip === 'all' || (chip === 'read' || chip === 'listen' ? t.mode === chip : t.domain === chip);

type Doc = Readonly<Record<string, unknown>>;

/** Wortschatz als Prüf-Funktion (Grundformen über `knownBy` in `newShare`). */
function useVocabFn(): (w: string) => boolean {
  const vocab = useLive((s) => s.collections.vocab);
  return useMemo(() => {
    const idx = statusIndex([...(vocab ?? new Map<string, Doc>()).values()].map((d) => ({ word: typeof d.word === 'string' ? d.word : '', stage: typeof d.stage === 'number' ? d.stage : 0 })));
    return (w: string) => idx.has(w) || lemmaCandidates(w).some((c) => idx.has(c));
  }, [vocab]);
}

export function LibraryScreen() {
  const { t } = useT();
  const ai = useAiAvailable();
  const go = useNav((s) => s.go);
  const input = useInputContext();
  const { theme } = useWeek();
  const status = useInputLibrary((s) => s.status);
  const articles = useInputLibrary((s) => s.docs.articles);
  const lpool = useInputLibrary((s) => s.docs.lpool);
  const reading = useInputLibrary((s) => s.docs.reading);
  const picks = useInputLibrary((s) => s.picks);
  const profile = useLive((s) => s.docs['app/profile']);
  const feed = useFeedItems();
  const pos = useInputPos((s) => s.pos);
  const vocabFn = useVocabFn();
  const [chip, setChip] = useState<Chip>('all');
  const [shown, setShown] = useState(PAGE);
  const [dictReady, setDictReady] = useState(false);

  useEffect(() => {
    void ensureLibrary();
    void loadFeedOnce();
    // Wörterbuch erst nach dem ersten Bild laden (Leistung: nie im Startpfad, Reiterwechsel < 100 ms).
    const id = window.setTimeout(() => {
      isDictWord('ready');
      setDictReady(true);
    }, 120);
    return () => window.clearTimeout(id);
  }, []);

  const dbA = useMemo(() => dbArticles(articles), [articles]);
  const dbL = useMemo(() => dbListening(lpool), [lpool]);
  const rows = useMemo(() => listenRows(profile), [profile]);
  const readToday = useMemo(() => new Set(readingsOn(reading, input.day).map((r) => (typeof r.doc.articleId === 'string' ? r.doc.articleId : ''))), [reading, input.day]);
  const heardToday = useMemo(() => new Set(listensOn(rows, input.day).map((r) => r.id)), [rows, input.day]);

  const today = useMemo<Tile[]>(() => {
    const out: Tile[] = [];
    const tt = theme ? themeTextFor(theme.id) : null;
    if (theme && tt) {
      out.push({ key: `theme:${tt.id}`, mode: 'read', title: tt.title, level: 'B2+', domain: theme.kind === 'life' ? 'life' : 'work', text: tt.text, route: { name: 'read', ctx: 'extra', id: tt.id }, eyebrow: t('nbLesenThemeText'), testId: 'lib-theme', channel: 'read', done: readToday.has(tt.id) });
    }
    if (status === 'ready') {
      // Wie der Leser: heute Gelesenes zuerst (Zustand), sonst die gemerkte bzw. berechnete Wahl des Tages.
      const readRow = readingsOn(reading, input.day)[0];
      const readId = typeof readRow?.doc.articleId === 'string' ? readRow.doc.articleId : null;
      const pr = readId ?? picks[`read|${input.day}`];
      const a = pr ? findArticle(pr, dbA) : pickArticle({ day: input.day, target: input.target, domain: input.domain }, dbA, readDoneBefore(reading, input.day));
      if (a) out.push({ key: `pick-read:${a.id}`, mode: 'read', title: a.title, level: a.level, domain: a.domain, text: a.text, route: { name: 'read', ctx: 'extra' }, eyebrow: t('nbLesenPickRead'), testId: 'module', module: 'read', channel: 'read', done: readToday.has(a.id), own: articles.get(a.id)?.src === 'own' });
      const pl = listensOn(rows, input.day)[0]?.id ?? picks[`listen|${input.day}`];
      const l = pl ? findListening(pl, dbL) : pickListening({ day: input.day, target: input.target, domain: input.domain }, dbL, listenDoneBefore(rows, input.day));
      if (l) out.push({ key: `pick-listen:${l.id}`, mode: 'listen', title: l.title, level: l.level, domain: l.domain, text: l.text, route: { name: 'listen', ctx: 'extra' }, eyebrow: t('nbLesenPickListen'), testId: 'module', module: 'listen', channel: 'listen', done: heardToday.has(l.id) });
    }
    for (const f of feed.items.filter((x) => x.d === input.day && x.kind !== 'watch').slice(0, 4)) {
      out.push({ key: `feed:${f.feedId}|${f.itemId}`, mode: f.kind === 'listen' ? 'listen' : 'read', title: f.title, level: f.level ?? null, domain: f.domain, text: f.excerpt ?? f.gist, route: { name: 'discoverItem', feedId: f.feedId, itemId: f.itemId, ctx: 'extra' }, eyebrow: t('nbLesenKindPost'), testId: 'lib-feed', channel: 'discover' });
    }
    return out;
  }, [theme, status, picks, input.day, input.target, input.domain, dbA, dbL, reading, rows, feed.items, articles, readToday, heardToday, t]);

  const library = useMemo<Tile[]>(() => {
    const out: Tile[] = [];
    const seen = new Set(today.map((x) => x.key.split(':').slice(1).join(':')));
    for (const a of [...dbA].sort((x, y) => (x.id < y.id ? 1 : -1))) {
      if (seen.has(a.id)) continue;
      const own = articles.get(a.id)?.src === 'own';
      out.push({ key: `a:${a.id}`, mode: 'read', title: a.title, level: a.level, domain: a.domain, text: a.text, route: { name: 'read', ctx: 'extra', id: a.id }, own, testId: 'lib-item', channel: 'read', done: readToday.has(a.id) });
    }
    for (const l of [...dbL].sort((x, y) => (x.id < y.id ? 1 : -1))) {
      if (seen.has(l.id)) continue;
      out.push({ key: `l:${l.id}`, mode: 'listen', title: l.title, level: l.level, domain: l.domain, text: l.text, route: { name: 'listen', ctx: 'extra', id: l.id }, testId: 'lib-item', channel: 'listen', done: heardToday.has(l.id) });
    }
    for (const a of LEGACY_ARTICLES) if (!seen.has(a.id)) out.push({ key: `a:${a.id}`, mode: 'read', title: a.title, level: a.level, domain: a.domain, text: a.text, route: { name: 'read', ctx: 'extra', id: a.id }, testId: 'lib-item', channel: 'read', done: readToday.has(a.id) });
    for (const l of LEGACY_LISTENING) if (!seen.has(l.id)) out.push({ key: `l:${l.id}`, mode: 'listen', title: l.title, level: l.level, domain: l.domain, text: l.text, route: { name: 'listen', ctx: 'extra', id: l.id }, testId: 'lib-item', channel: 'listen', done: heardToday.has(l.id) });
    return out;
  }, [dbA, dbL, articles, today, readToday, heardToday]);

  const shares = useMemo(() => {
    const m = new Map<string, number>();
    if (!dictReady) return m;
    const visible = [...today, ...library.filter((x) => match(x, chip)).slice(0, shown)];
    for (const tile of visible) m.set(tile.key, newShare(tile.text, { vocab: vocabFn, dict: isDictWord }).pct);
    return m;
  }, [dictReady, today, library, chip, shown, vocabFn]);

  const resume = (['read', 'listen', 'discover'] as const).map((id) => ({ id, p: pos[id] })).filter((x): x is { id: 'read' | 'listen' | 'discover'; p: NonNullable<typeof x.p> } => !!x.p);
  const todayShown = today.filter((x) => match(x, chip));
  const libShown = library.filter((x) => match(x, chip));

  const meta = (tile: Tile): string => {
    const parts: string[] = [];
    if (tile.level) parts.push(tile.level);
    const p = shares.get(tile.key);
    if (p !== undefined) parts.push(t('nbLesenNewPct', { p }));
    parts.push(t('nbLesenMin', { n: readingMinutes(tile.text) }));
    return parts.join(' · ');
  };

  return (
    <div className="flex flex-col gap-7 py-6 sm:py-10" data-testid="library">
      <TabTitle title={t('nbShTabRead')} />
      <div role="radiogroup" aria-label={t('nbLesenChips')} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-testid="lib-chips" data-hscroll="">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={chip === c}
            onClick={() => {
              setChip(c);
              setShown(PAGE);
            }}
            data-testid="lib-chip"
            data-chip={c}
            className={`min-h-11 flex-none rounded-full px-4 text-sm transition-colors ${chip === c ? 'bg-accent-soft font-semibold text-accent-text' : 'bg-surface text-muted hover:text-fg'}`}
          >
            {t(`nbLesenChip_${c}`)}
          </button>
        ))}
      </div>

      {todayShown.length > 0 && (
        <Section title={t('nbLesenToday')} testId="lib-today">
          <div className="flex flex-col gap-3">
            {todayShown.map((tile, i) => (
              <button
                key={tile.key}
                type="button"
                onClick={() => go(tile.route)}
                data-testid={tile.testId}
                data-module={tile.module}
                data-key={tile.key}
                data-done={tile.done || undefined}
                className={`lx-glass flex w-full flex-col gap-1 rounded-[var(--radius-card)] text-left transition-colors hover:bg-surface-strong ${i === 0 ? 'p-5' : 'p-4'}`}
                style={{ boxShadow: `inset 3px 0 0 0 var(--lx-ch-${tile.channel}), var(--lx-shadow)` }}
              >
                <span className="lx-eyebrow">{tile.eyebrow}</span>
                <span className={`font-semibold tracking-tight ${i === 0 ? 'text-xl' : 'text-base'}`} lang="en">
                  {tile.title}
                </span>
                <span className="lx-tnum flex flex-wrap items-center gap-x-2 text-sm text-muted" data-testid="lib-meta">
                  <span>{meta(tile)}</span>
                  {tile.done && (
                    <span className="text-accent-text" data-testid="module-done">
                      · {t(tile.mode === 'listen' ? 'nbLesenHeardToday' : 'nbLesenReadToday')}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {resume.length > 0 && (
        <Section title={t('nbLesenResume')} testId="lib-resume">
          <List>
            {resume.map(({ id, p }) => (
              <Row key={id} icon={id === 'listen' ? 'headphones' : id === 'discover' ? 'compass' : 'article'} channel={id === 'discover' ? 'discover' : id} title={p.title} sub={t(id === 'listen' ? 'nbLesenKindListen' : id === 'discover' ? 'nbLesenKindPost' : 'nbLesenKindRead')} onClick={() => go(p.route)} testId="lib-resume-row" />
            ))}
          </List>
        </Section>
      )}

      <Section title={t('nbLesenLibrary')} testId="lib-library">
        {libShown.length === 0 ? (
          <p className="text-sm text-muted">{t('nbLesenEmpty')}</p>
        ) : (
          <List>
            {libShown.slice(0, shown).map((tile) => (
              <Row
                key={tile.key}
                icon={tile.mode === 'listen' ? 'headphones' : 'article'}
                channel={tile.channel}
                title={tile.title}
                sub={[tile.own ? t('nbLesenOwnBadge') : null, meta(tile), tile.done ? t(tile.mode === 'listen' ? 'nbLesenHeardToday' : 'nbLesenReadToday') : null].filter(Boolean).join(' · ')}
                onClick={() => go(tile.route)}
                testId={tile.testId ?? 'lib-item'}
                dataKey={tile.key}
                lang="en"
              />
            ))}
          </List>
        )}
        {libShown.length > shown && (
          <button type="button" className="self-start text-sm font-medium text-accent-text" onClick={() => setShown((n) => n + PAGE)} data-testid="lib-more">
            {t('nbLesenMore')}
          </button>
        )}
        <List>
          <Row icon="compass" channel="discover" title={t('nbLesenAllPosts')} sub={t('nbLesenAllPostsSub')} onClick={() => go({ name: 'discover' })} testId="module" module="discover" />
        </List>
      </Section>

      <Section title={t('nbLesenActions')} testId="lib-actions">
        <List>
          <Row icon="plus" channel="read" title={t('nbLesenOwn')} sub={t('nbLesenOwnSub')} onClick={() => go({ name: 'read', ctx: 'extra', mode: 'own' })} testId="lib-own" />
          <Row icon="sparkle" channel="read" title={t('nbLesenNewText')} sub={t('nbLesenNewTextSub')} onClick={() => go({ name: 'read', ctx: 'extra', mode: 'gen' })} testId="lib-new-text" />
          <Row icon="headphones" channel="listen" title={t('nbLesenNewListen')} sub={t('nbLesenNewListenSub')} onClick={() => go({ name: 'listen', ctx: 'extra', mode: 'gen' })} testId="lib-new-listen" />
          {ai && <Row icon="headphones" channel="listen" title={t('nbLesenDlgRow')} sub={t('nbLesenDlgRowSub')} onClick={() => go({ name: 'listenDialog', ctx: 'extra' })} testId="lib-dialog" />}
        </List>
      </Section>

      <List>
        <Row icon="history" channel="read" title={t('nbLesenHistory')} sub={t('nbLesenHistorySub')} onClick={() => go({ name: 'history', kind: 'read' })} testId="lib-history" />
      </List>
      <HubSections places={placesOf('read')} />
    </div>
  );
}

function Section({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title} data-testid={testId}>
      <h2 className="lx-eyebrow">{title}</h2>
      {children}
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">{children}</ul>;
}

const INPUT_ICONS = new Set<string>(['article', 'headphones', 'compass', 'history', 'pen']);

function Row({ icon, channel, title, sub, onClick, testId, module, dataKey, lang }: { icon: InputIconName | IconName; channel: Channel; title: string; sub: string; onClick: () => void; testId: string; module?: string; dataKey?: string; lang?: string }) {
  return (
    <li className="[content-visibility:auto]">
      <button type="button" onClick={onClick} data-testid={testId} data-module={module} data-key={dataKey} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-strong">
        <ChannelIcon channel={channel}>{INPUT_ICONS.has(icon) ? <InputIcon name={icon as InputIconName} /> : <Icon name={icon as IconName} />}</ChannelIcon>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium [overflow-wrap:anywhere]" lang={lang}>
            {title}
          </span>
          <span className="lx-tnum text-sm text-muted [overflow-wrap:anywhere]">{sub}</span>
        </span>
        <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
      </button>
    </li>
  );
}
