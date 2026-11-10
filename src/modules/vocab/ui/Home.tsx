import { useEffect, useMemo, useState } from 'react';
import { getWriter, Icon, toast, useClock, useLive, useT, VButton, VChip, VRow, type MessageKey } from '../sharedUi';
import { logError } from '../shared';
import { lexOf } from '../data/lex';
import { groupOf } from '../domain/ladder';
import type { SessionKind } from '../domain/session';
import { FREE_KINDS } from '../domain/types';
import { groupCounts } from '../domain/stats';
import type { Lex } from '../domain/types';
import { readMistakes } from './mistakes';
import { usePlaceSub } from './Overview';

// Großpaket B3 (docs/umbau/design/grosspaket-b.md): Reiter Wörter im neuen Aussehen (Vorschau H12 `tw-practice`, Suche, Filterchips, Wortzeilen).
// Eine rote Linie (Kap. 2 Nr. 1): oben EINE Karte „Wörter üben“ mit dem einen Hauptknopf; erledigt ist Zustand (Kap. 2 Nr. 2), dann nur ein
// leiser Knopf „Noch 5 Wörter“ als Extra. Darunter die Wortliste (ersetzt die alte Liste hinter „Alle Wörter“, B2), freie Runden
// (Freies Üben, Heute neu, Wochenrunde, Fehlwörter, Anwenden) und die Wege zu Übersicht, Einstufung, Hinzufügen und Wortfeldern.
// Zahlen auf Chips und Zeilen kommen aus DERSELBEN Liste, die darunter steht (Kap. 2 Nr. 2: Zähler und Inhalt sagen dasselbe).

type Doc = Record<string, unknown>;
type Group = 'all' | 'produce' | 'onway' | 'recognize' | 'fresh' | 'paused';
const GROUP_LABEL = { produce: 'vmOvProduce', onway: 'vmOvOnway', recognize: 'vmOvRecognize' } as const satisfies Record<ReturnType<typeof groupOf>, MessageKey>;
type Sort = 'stage' | 'az';
type Word = { path: string; head: string; de: string; lex: Lex; paused: boolean; order: number };
const EMPTY = new Map<string, Doc>();
const PAGE = 20;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export type HomeProps = {
  /** Pflicht „Wörter“ von Heute (dieselbe Quelle wie die Heute-Seite): offen, erledigt oder ohne Tagesplan. */
  duty: 'open' | 'done' | null;
  onRound: (kind: SessionKind) => void;
  onWord: (path: string) => void;
  onStats: () => void;
  onPlace: () => void;
  onAdd: () => void;
  onAtlas: () => void;
};

/** Alle Lexeme (auch pausierte), ohne Doppel (`lex.of`: die Zeile des führenden Lexems zählt), live. */
function useAllWords(): { words: Word[]; ready: boolean } {
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const chunk = useLive((s) => s.collections.chunk) ?? EMPTY;
  const ready = useLive((s) => s.collections.vocab !== undefined);
  const words = useMemo(() => {
    const out: Word[] = [];
    let i = 0;
    for (const [kind, m] of [
      ['vocab', vocab],
      ['chunk', chunk],
    ] as const) {
      for (const [id, doc] of m) {
        const lex = lexOf(doc);
        if (!lex || lex.of) continue;
        const head = str(kind === 'chunk' ? doc.en : doc.word).trim();
        if (!head) continue;
        out.push({ path: `${kind}/${id}`, head, de: str(doc.de), lex, paused: doc.hidden === true, order: typeof doc.order === 'number' ? doc.order : i++ });
      }
    }
    return out;
  }, [vocab, chunk]);
  return { words, ready };
}

const inGroup = (w: Word, g: Group): boolean => {
  if (g === 'paused') return w.paused;
  if (w.paused) return false;
  if (g === 'all') return true;
  if (g === 'fresh') return w.lex.intro === null;
  return w.lex.intro !== null && groupOf(w.lex.lv) === g;
};

/** Suchtext ohne Groß/klein und Akzente (Treffer im englischen Kopf oder in der Bedeutung). */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function WordsHome({ duty, onRound, onWord, onStats, onPlace, onAdd, onAtlas }: HomeProps) {
  const { t, tn, lang } = useT();
  const day = useClock((s) => s.today);
  const { words, ready } = useAllWords();
  const [group, setGroup] = useState<Group>('all');
  const [sort, setSort] = useState<Sort>('stage');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const place = usePlaceSub();
  const done = duty !== null && duty !== 'open';

  // Fehlwörter der letzten 14 Tage: dieselbe Rechnung wie die Runde (`readMistakes`), einmal je Lerntag gelesen.
  useEffect(() => {
    let live = true;
    readMistakes(useClock.getState().now)
      .then((p) => live && setMistakes(p.length))
      .catch((e: unknown) => logError('vocab:home-mistakes', e));
    return () => {
      live = false;
    };
  }, [day]);

  const active = useMemo(() => words.filter((w) => !w.paused), [words]);
  const g = useMemo(() => groupCounts(active.map((w) => w.lex)), [active]);
  const paused = words.length - active.length;
  const introducedToday = useMemo(() => active.filter((w) => w.lex.intro === day).length, [active, day]);
  const weekable = useMemo(() => active.some((w) => w.lex.intro !== null && w.lex.lv >= 3), [active]);
  const usable = useMemo(() => active.some((w) => w.lex.intro !== null && w.lex.lv >= 4 && w.lex.lv <= 6), [active]);

  const list = useMemo(() => {
    const nq = norm(q);
    const collator = new Intl.Collator(lang === 'de' ? 'de-DE' : 'en-US', { sensitivity: 'base' });
    const hit = words.filter((w) => inGroup(w, group) && (!nq || norm(w.head).includes(nq) || norm(w.de).includes(nq)));
    return hit.sort((a, b) => (sort === 'az' ? collator.compare(a.head, b.head) : (b.lex.intro === null ? -1 : b.lex.lv) - (a.lex.intro === null ? -1 : a.lex.lv) || a.order - b.order));
  }, [words, group, sort, q, lang]);

  // Neue Auswahl (Filter, Suche, Sortierung): Liste wieder von oben, Auswahl leeren.
  const reset = () => {
    setShown(PAGE);
    setSel(new Set());
  };

  const chips: { id: Group; label: MessageKey; n: number }[] = [
    { id: 'all', label: 'vmWhAll', n: g.total },
    { id: 'produce', label: 'vmOvProduce', n: g.produce },
    { id: 'onway', label: 'vmOvOnway', n: g.onway },
    { id: 'recognize', label: 'vmOvRecognize', n: g.recognize },
    ...(g.fresh > 0 ? [{ id: 'fresh' as const, label: 'vmWhFresh' as const, n: g.fresh }] : []),
    ...(paused > 0 ? [{ id: 'paused' as const, label: 'vmWhPaused' as const, n: paused }] : []),
  ];

  const toggle = (path: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(path)) n.delete(path);
      else n.add(path);
      return n;
    });

  /** Mehrere Wörter pausieren bzw. fortsetzen (wie „Pausieren“ auf der Wort-Seite; schreibt nur, was sich ändert). */
  const applyPause = async () => {
    const w = getWriter();
    if (!w || !sel.size) return;
    const target = group !== 'paused';
    setBusy(true);
    let ok = true;
    for (const path of sel) {
      try {
        await w.transform(path, (cur) => (cur ? (cur.hidden === target ? null : { update: { hidden: target } }) : null));
      } catch (err: unknown) {
        ok = false;
        logError('vocab:home-pause', err, path);
      }
    }
    setBusy(false);
    setSel(new Set());
    setSelecting(false);
    toast(ok ? t(target ? 'vmWhPausedToast' : 'vmWhResumedToast') : t('vmWpSaveError'), ok ? 'info' : 'error');
  };

  return (
    <div className="lx-vw" data-testid="vocab-home">
      <section className="lx-vw-practice" data-testid="vh-today" data-state={done ? 'done' : 'open'} aria-labelledby="vw-practice-t">
        <span className="lx-vw-practice-t">
          <b id="vw-practice-t">
            {done ? (
              <span className="lx-vw-done" role="status" data-testid="vh-done">
                <Icon name="check" size={18} />
                {t('vmHomeDone')}
              </span>
            ) : (
              t('vmWhPracticeT')
            )}
          </b>
          <span>{t(done ? 'vmWhPracticeSubDone' : 'vmWhPracticeSub')}</span>
        </span>
        {done ? (
          <VButton variant="sec" size="sm" onClick={() => onRound('more5')} data-testid="vh-more">
            {t('vmWhMoreBtn')}
          </VButton>
        ) : (
          <VButton variant="pri" onClick={() => onRound('pflicht')} data-testid="vh-go">
            {t('vmWhGo')}
          </VButton>
        )}
      </section>

      {/* Großpaket WT (Emrah 10.11.2026): schnell 10, 20 oder 30 Wörter üben – fällige und wackelige zuerst, neue nur, wenn nichts ansteht. Extra, nie Pflicht. */}
      <section className="lx-vw-quick" aria-labelledby="vw-quick-t" data-testid="vw-quick">
        <span className="lx-vw-quick-t" id="vw-quick-t">
          {t('vmWhQuick')}
        </span>
        <div className="lx-vw-quick-row">
          {(['free10', 'free20', 'free30'] as const).map((k) => (
            <VButton key={k} variant="sec" size="sm" onClick={() => onRound(k)} data-testid={`vw-quick-${FREE_KINDS[k]}`}>
              {t('vmWhQuickN', { n: FREE_KINDS[k] ?? 20 })}
            </VButton>
          ))}
        </div>
      </section>

      <div className="lx-vw-search">
        <Icon name="search" size={18} />
        <input
          type="search"
          className="lx-vw-search-in"
          value={q}
          onChange={(e) => (setQ(e.target.value), reset())}
          placeholder={t('vmWhSearch')}
          aria-label={t('vmWhSearch')}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={80}
          data-testid="vocab-search"
        />
      </div>

      <div className="lx-vw-chiprow" role="group" aria-label={t('vmWhFilterAria')} data-testid="vw-chips" data-hscroll="">
        {chips.map((c) => (
          <VChip key={c.id} count={c.n} selected={group === c.id} onClick={() => (setGroup(c.id), reset())} data-testid={`vw-chip-${c.id}`}>
            {t(c.label)}
          </VChip>
        ))}
      </div>

      <div className="lx-vw-listhead">
        <h2 className="lx-vg-lbl" data-testid="vw-count" data-n={list.length}>
          {tn('vmWhCount', list.length)}
        </h2>
        <span className="lx-vw-tools">
          <button
            type="button"
            className="lx-vw-tool"
            onClick={() => (setSort((s) => (s === 'stage' ? 'az' : 'stage')), reset())}
            aria-label={t('vmWhSortAria', { s: t(sort === 'stage' ? 'vmWhSortStage' : 'vmWhSortAz') })}
            data-testid="vocab-sort"
            data-sort={sort}
          >
            <Icon name="sort" size={16} />
            {t(sort === 'stage' ? 'vmWhSortStage' : 'vmWhSortAz')}
          </button>
          {list.length > 0 && (
            <button type="button" className="lx-vw-tool" aria-pressed={selecting} onClick={() => (setSelecting((v) => !v), setSel(new Set()))} data-testid="vocab-select">
              {t(selecting ? 'vmWhSelectDone' : 'vmWhSelect')}
            </button>
          )}
        </span>
      </div>

      {!ready ? (
        <div className="lx-v-sk" style={{ height: 240 }} aria-hidden="true" />
      ) : list.length === 0 ? (
        <p className="lx-vw-empty" data-testid="vw-empty">
          {q.trim() ? t('vmWhNoHit', { q: q.trim() }) : t('vmWhEmpty')}
        </p>
      ) : (
        <ul className="lx-vw-words" data-testid="vw-list">
          {list.slice(0, shown).map((w) => {
            const picked = sel.has(w.path);
            return (
              <li key={w.path}>
                <button
                  type="button"
                  className="lx-vw-word"
                  data-paused={w.paused ? '' : undefined}
                  aria-pressed={selecting ? picked : undefined}
                  onClick={() => (selecting ? toggle(w.path) : onWord(w.path))}
                  data-testid="vw-word"
                  data-path={w.path}
                  data-lv={w.lex.intro === null ? 0 : w.lex.lv}
                >
                  {selecting && (
                    <span className="lx-vw-pick" aria-hidden="true">
                      {picked && <Icon name="check" size={14} />}
                    </span>
                  )}
                  <span className="lx-vw-word-t">
                    <b lang="en">{w.head}</b>
                    {w.de && <span>{w.de}</span>}
                  </span>
                  {w.paused ? (
                    <span className="lx-vw-pill" aria-label={t('vmWhPaused')}>
                      <Icon name="lock" size={14} />
                    </span>
                  ) : (
                    // ux-reviewer 05.11.2026 Nr. 9: kein „S6“ ohne Erklärung – die Pille nennt die Gruppe in denselben Worten wie die Filter.
                    <span className="lx-vw-pill" data-lv={w.lex.intro === null ? undefined : w.lex.lv}>
                      {w.lex.intro === null ? t('vmWhFresh') : t(GROUP_LABEL[groupOf(w.lex.lv)])}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > shown && (
        <button type="button" className="lx-vg-quiet" onClick={() => setShown((n) => n + PAGE)} data-testid="vw-more">
          {t('vmWhShowMore', { n: list.length - shown })}
        </button>
      )}
      {selecting && (
        <div className="lx-vw-bulk" data-testid="vocab-bulk">
          <span className="lx-v-num">{tn('vmWhPicked', sel.size)}</span>
          <VButton variant="pri" size="sm" icon={group === 'paused' ? 'play' : 'eyeOff'} disabled={!sel.size} busy={busy} onClick={() => void applyPause()} data-testid="vocab-bulk-hide">
            {t(group === 'paused' ? 'vmWhResumeN' : 'vmWhPauseN', { n: sel.size })}
          </VButton>
        </div>
      )}

      <h2 className="lx-vg-lbl lx-vw-sec">{t('vmWhMoreHead')}</h2>
      <div className="lx-vg-rows" data-testid="vw-rounds">
        <VRow icon="plus" title={t('vmWhNew5')} sub={t('vmWhNew5Sub')} onClick={() => onRound('new5')} data-testid="vw-new5" />
        <VRow icon="cards" title={t('vmWhFree')} sub={t('vmWhFreeSub')} onClick={() => onRound('free')} data-testid="vw-free" />
        {introducedToday > 0 && <VRow icon="refresh" title={t('vmWhEvening')} sub={tn('vmWhEveningSub', Math.min(introducedToday, 8))} onClick={() => onRound('evening')} data-testid="vw-evening" />}
        {mistakes > 0 && <VRow icon="target" title={t('vmWhMistakes')} sub={tn('vmWhMistakesSub', mistakes)} onClick={() => onRound('mistakes')} data-testid="vw-mistakes" />}
        {weekable && <VRow icon="history" title={t('vmWhWeek')} sub={t('vmWhWeekSub')} onClick={() => onRound('week')} data-testid="vw-week" />}
        {usable && <VRow icon="briefcase" title={t('vmWhUse')} sub={t('vmWhUseSub')} onClick={() => onRound('use')} data-testid="vw-use" />}
      </div>

      <h2 className="lx-vg-lbl lx-vw-sec">{t('vmWhToolsHead')}</h2>
      <div className="lx-vg-rows" data-testid="vw-links">
        <VRow icon="chart" title={t('vmWhStats')} sub={t('vmWhStatsSub', { produce: g.produce, total: g.total })} onClick={onStats} data-testid="vo-open" />
        <VRow icon="plus" title={t('nbWsHAddLabel')} sub={t('vmWhAddSub')} onClick={onAdd} data-testid="vocab-add" />
        <VRow icon="target" title={t('vmPlEntry')} sub={place.sub} onClick={onPlace} data-testid="vo-place" />
        <VRow icon="map" title={t('atTitle')} sub={t('atSub')} onClick={onAtlas} data-testid="vw-atlas" />
      </div>
    </div>
  );
}
