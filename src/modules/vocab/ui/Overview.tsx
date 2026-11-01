import { useEffect, useMemo, useState } from 'react';
import { getDb, getWriter, Icon, readDoc, Segmented, Skeleton, Switch, toast, useClock, useLive, useT, type MessageKey } from '../sharedUi';
import { logError } from '../shared';
import { lexOf } from '../data/lex';
import { readVlogRecent } from '../data/history';
import { MIN_OPTIONS, NEW_OPTIONS, RET_OPTIONS, writeVocabSettings, type SettingsPatch } from '../data/settings';
import { vcfgSchema } from '../data/schemas';
import { Catalog, forecastMinutes, type Item } from '../domain/catalog';
import { outlook, type Outlook } from '../domain/overview';
import { YOUNG_MAX_LV } from '../domain/planner';
import { avg, boostExtraMinutes, groupCounts, rateOf, RET_GAP, RET_MIN_SAMPLE, RET_WINDOW_DAYS, retention, retentionGap, safetyMinutes, youngBoost, type Retention } from '../domain/stats';
import { DEFAULT_CFG, type Lex, type VocabCfg } from '../domain/types';

// Großpaket A S6: Übersicht Wörter (Bild s2-05/s2-06: B1, M18, M63, N7) und Einstellungen Wörter (Bild s2-13: B9, F3, F5).
// Liest live (`useLive`), den Verlauf der letzten 30 Lerntage einmal; schreibt nur über den einen Schreibpfad (data/settings.ts).
// Zeit nur über die App-Uhr (`useClock`), nie `Date.now()` im Zeichnen.

type Doc = Record<string, unknown>;
type T = (k: MessageKey, v?: Record<string, string | number>) => string;
const EMPTY = new Map<string, Doc>();
const LOCALES = { de: 'de-DE', en: 'en-US' } as const;
const pct = (x: number) => Math.round(x * 100);

/** Einstellungen aus dem Profil (wie api.ts `vocabCfg`, hier ohne Import von api.ts, damit kein Kreis entsteht). */
function cfgOf(profile: Doc | null | undefined): VocabCfg {
  const raw = profile && typeof profile.vcfg === 'object' ? vcfgSchema.safeParse(profile.vcfg) : null;
  const npd = profile && typeof profile.newPerDay === 'number' && (NEW_OPTIONS as readonly number[]).includes(profile.newPerDay) ? profile.newPerDay : DEFAULT_CFG.newPerDay;
  if (!raw?.success) return { ...DEFAULT_CFG, newPerDay: npd };
  return { min: raw.data.min, ret: raw.data.ret, mod: raw.data.mod, newPerDay: npd, restDow: raw.data.rd ?? null, anki: raw.data.anki === 1, pre: raw.data.pre !== 0 };
}

/** Alle sichtbaren Lexeme (pausierte zählen nicht), live. */
function useWords(): { items: Item[]; lexes: Lex[]; cfg: VocabCfg; ready: boolean } {
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const chunk = useLive((s) => s.collections.chunk) ?? EMPTY;
  const profile = useLive((s) => s.docs['app/profile']);
  const ready = useLive((s) => s.collections.vocab !== undefined);
  return useMemo(() => {
    const items: Item[] = [];
    let i = 0;
    for (const [kind, m] of [
      ['vocab', vocab],
      ['chunk', chunk],
    ] as const) {
      for (const [id, doc] of m) {
        const lex = lexOf(doc);
        if (lex && doc.hidden !== true) items.push({ path: `${kind}/${id}`, lex, order: typeof doc.order === 'number' ? doc.order : i++ });
      }
    }
    return { items, lexes: items.map((x) => x.lex), cfg: cfgOf(profile), ready };
  }, [vocab, chunk, profile, ready]);
}

type RetState = { status: 'loading' } | { status: 'ok'; r: Retention } | { status: 'error' };

async function readOr(path: string): Promise<Record<string, unknown> | null> {
  const db = getDb();
  if (!db) return null;
  const d = await readDoc(db, path);
  return d.status === 'valid' ? d.doc : null;
}

/** Verlauf der letzten 30 Lerntage, einmal je Lerntag gelesen. */
function useRetention(day: string, nowMs: number): RetState {
  const [st, setSt] = useState<RetState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    readVlogRecent(readOr, nowMs, RET_WINDOW_DAYS)
      .then((tuples) => live && setSt({ status: 'ok', r: retention(tuples, nowMs) }))
      .catch((e: unknown) => {
        logError('vocab:overview', e);
        if (live) setSt({ status: 'error' });
      });
    return () => {
      live = false;
    };
    // Einmal je Lerntag: `nowMs` tickt alle 30 s, der Verlauf ändert sich innerhalb der Übersicht nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);
  return st;
}

// ---------- Übersicht

export type OverviewProps = {
  /** „Alle Wörter“: kommt vom Bereich (Route der Liste). */
  onOpenList: () => void;
};

export function Overview({ onOpenList }: OverviewProps) {
  const { t } = useT();
  const now = useClock((s) => s.now);
  const day = useClock((s) => s.today);
  const { items, lexes, cfg, ready } = useWords();
  const g = useMemo(() => groupCounts(lexes), [lexes]);
  const cat = useMemo(() => new Catalog(items), [items]);
  const out = useMemo(() => outlook(cat, {}, now, cfg, 14), [cat, now, cfg]);
  const youngMin = useMemo(() => avg(forecastMinutes(cat, {}, now, 14, (l) => l.lv <= YOUNG_MAX_LV)), [cat, now]);
  const ret = useRetention(day, now);
  if (!ready) return <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />;
  return (
    <div className="flex flex-col gap-4" data-testid="vo">
      <p className="lx-t-support m-0 text-muted">{t('vmOvSub')}</p>
      <section className="lx-card flex flex-col gap-3 p-4 sm:p-5" data-testid="vo-counts" aria-labelledby="vo-counts-title">
        <h3 id="vo-counts-title" className="m-0 flex items-baseline gap-3">
          <span className="lx-tnum text-5xl font-semibold tracking-tight" data-testid="vo-produce-big">
            {g.produce}
          </span>
          <span className="text-lg text-muted">{t('vmOvProduceBig')}</span>
        </h3>
        <ul className="m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-line">
          <CountRow mark="bg-text" label={t('vmOvProduce')} range="S6–S7" n={g.produce} testId="vo-produce" />
          <CountRow mark="bg-subtle" label={t('vmOvOnway')} range="S3–S5" n={g.onway} testId="vo-onway" />
          <CountRow mark="border border-subtle" label={t('vmOvRecognize')} range="S1–S2" n={g.recognize} testId="vo-recognize" />
          {g.fresh > 0 && <CountRow mark="" label={t('vmOvFresh')} n={g.fresh} testId="vo-fresh" />}
          <CountRow mark="" label={t('vmOvAll')} n={g.total} testId="vo-total" strong />
        </ul>
      </section>
      <OutlookCard out={out} goal={cfg.min} t={t} />
      <RetentionCard st={ret} cfg={cfg} youngMin={youngMin} t={t} />
      <button type="button" className="lx-card flex w-full items-center gap-3 p-4 text-left" onClick={onOpenList} data-testid="vo-list">
        <Icon name="cards" size={20} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{t('vmOvList')}</span>
          <span className="text-sm text-muted">{t('vmOvListSub')}</span>
        </span>
        <Icon name="chevronRight" size={18} />
      </button>
    </div>
  );
}

function CountRow({ mark, label, range, n, testId, strong }: { mark: string; label: string; range?: string; n: number; testId: string; strong?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2" data-testid={testId} data-n={n}>
      <span className="flex min-w-0 items-center gap-2">
        {mark && <span className={`inline-block h-2.5 w-4 flex-none rounded-sm ${mark}`} aria-hidden="true" />}
        <span className={strong ? 'text-muted' : ''}>{label}</span>
        {range && <span className="text-xs text-subtle">{range}</span>}
      </span>
      <span className="lx-tnum font-semibold">{n}</span>
    </li>
  );
}

function OutlookCard({ out, goal, t }: { out: Outlook; goal: number; t: T }) {
  const { lang } = useT();
  const totals = out.days.map((d) => Math.round(d.review + d.fresh));
  const top = Math.max(goal, ...totals, 1);
  const even = totals.every((x) => Math.abs(x - out.avg) <= 3);
  const empty = totals.every((x) => x === 0);
  const wd = new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'short' });
  const date = new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'long', day: 'numeric', month: 'numeric' });
  const at = (d: string) => new Date(`${d}T12:00:00`).getTime();
  return (
    <section className="lx-card flex flex-col gap-3 p-4 sm:p-5" data-testid="vo-outlook" data-avg={out.avg} data-peak={out.peak}>
      <h3 className="lx-eyebrow m-0">{t('vmOvOutlookTitle')}</h3>
      <ol className="m-0 grid list-none items-end gap-1 p-0" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }} aria-label={t('vmOvOutlookAria')}>
        {out.days.map((d, i) => {
          const n = totals[i]!;
          return (
            <li key={d.d} className="flex min-w-0 flex-col items-center gap-1" data-testid="vo-day" data-d={d.d} data-min={n} aria-label={t('vmOvBarAria', { day: date.format(at(d.d)), n })}>
              <span className={`lx-tnum lx-t-meta ${i === 0 ? 'font-semibold' : 'text-muted'}`} aria-hidden="true">
                {n || '–'}
              </span>
              <span className="flex h-16 w-full items-end" aria-hidden="true">
                <span className={`block w-full rounded-sm ${i === 0 ? 'bg-accent' : 'bg-surface-strong'}`} style={{ height: `${Math.max(4, Math.round((n / top) * 100))}%` }} />
              </span>
              <span className="lx-t-meta text-subtle" aria-hidden="true">
                {wd.format(at(d.d)).replace('.', '').slice(0, 2)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="lx-t-support m-0 text-muted" data-testid="vo-outlook-note">
        {empty ? t('vmOvOutlookEmpty', { goal }) : even ? t('vmOvOutlookEven', { n: out.avg, goal }) : t('vmOvOutlookUneven', { n: out.avg, peak: out.peak, goal })}
      </p>
    </section>
  );
}

function RetentionCard({ st, cfg, youngMin, t }: { st: RetState; cfg: VocabCfg; youngMin: number; t: T }) {
  if (st.status === 'loading') return <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" />;
  if (st.status === 'error')
    return (
      <section className="lx-card p-4 sm:p-5" data-testid="vo-ret" data-status="error">
        <h3 className="lx-eyebrow m-0">{t('vmOvRetTitle')}</h3>
        <p className="lx-t-support m-0 mt-2 text-muted">{t('vmOvRetError')}</p>
      </section>
    );
  const r = st.r;
  const all = rateOf(r.all);
  const mature = rateOf(r.mature);
  const young = rateOf(r.young);
  const gap = retentionGap(cfg.ret, r);
  const boost = youngBoost(cfg.ret, r);
  const extra = boost ? Math.max(1, Math.round(boostExtraMinutes(youngMin, cfg.ret, boost))) : 0;
  const verdict = all === null ? null : all >= cfg.ret - 0.005 ? 'vmOvRetOn' : all >= cfg.ret - RET_GAP ? 'vmOvRetNear' : 'vmOvRetBelow';
  return (
    <section className="lx-card flex flex-col gap-3 p-4 sm:p-5" data-testid="vo-ret" data-status={all === null ? 'few' : 'ok'} data-gap={gap?.group ?? ''}>
      <h3 className="lx-eyebrow m-0">{t('vmOvRetTitle')}</h3>
      <p className="m-0 flex items-baseline gap-3">
        <span className="lx-tnum text-5xl font-semibold tracking-tight" data-testid="vo-ret-all">
          {all === null ? '–' : `${pct(all)} %`}
        </span>
        <span className="text-muted">{t('vmOvRetGoal', { n: pct(cfg.ret) })}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <RateChip label={t('vmOvRetMature')} v={mature} testId="vo-ret-mature" />
        <RateChip label={t('vmOvRetYoung')} v={young} testId="vo-ret-young" />
      </div>
      {all === null ? (
        <p className="lx-t-support m-0 text-muted" data-testid="vo-ret-note">
          {t('vmOvRetFew', { n: r.all.all, min: RET_MIN_SAMPLE })}
        </p>
      ) : (
        <p className="lx-t-support m-0 text-muted" data-testid="vo-ret-note">
          {t('vmOvRetWhat')} {t(verdict as MessageKey)}
        </p>
      )}
      {gap && (
        <p className="lx-t-support bg-surface m-0 rounded-[var(--radius-control)] p-3" data-testid="vo-ret-gap" role="note">
          {gap.group === 'young' && extra > 0 ? t('vmOvRetGapYoung', { rate: pct(gap.rate), min: extra }) : t('vmOvRetGapMature', { rate: pct(gap.rate) })}
        </p>
      )}
    </section>
  );
}

function RateChip({ label, v, testId }: { label: string; v: number | null; testId: string }) {
  return (
    <span className="bg-surface flex items-center justify-between rounded-[var(--radius-control)] px-3 py-2" data-testid={testId}>
      <span className="text-sm text-muted">{label}</span>
      <span className="lx-tnum font-semibold">{v === null ? '–' : `${pct(v)} %`}</span>
    </span>
  );
}

// ---------- Einstellungen Wörter

export function WordSettings() {
  const { t } = useT();
  const now = useClock((s) => s.now);
  const { items, lexes, cfg, ready } = useWords();
  const [pending, setPending] = useState<SettingsPatch>({});
  const cat = useMemo(() => new Catalog(items), [items]);
  const out = useMemo(() => outlook(cat, {}, now, cfg, 14), [cat, now, cfg]);
  if (!ready) return <Skeleton className="h-48 w-full rounded-[var(--radius-card)]" />;
  const min = pending.min ?? cfg.min;
  const ret = pending.ret ?? cfg.ret;
  const npd = pending.newPerDay ?? cfg.newPerDay;
  const anki = pending.anki !== undefined ? pending.anki === 1 : !!cfg.anki;
  const pre = pending.pre !== undefined ? pending.pre === 1 : cfg.pre !== false;
  const mins = safetyMinutes(avg(out.days.map((d) => d.review)), avg(out.days.map((d) => d.fresh)), cfg.ret, RET_OPTIONS);
  const save = (p: SettingsPatch) => {
    const w = getWriter();
    if (!w) return;
    setPending((x) => ({ ...x, ...p }));
    void writeVocabSettings(w, p).then((ok) => {
      setPending((x) => {
        const n = { ...x };
        for (const k of Object.keys(p) as (keyof SettingsPatch)[]) delete n[k];
        return n;
      });
      if (!ok) toast(t('vmWpSaveError'));
    });
  };
  const counted = lexes.filter((l) => l.intro !== null).length;
  return (
    <section className="flex flex-col gap-5" data-testid="vs">
      <h3 className="lx-eyebrow m-0">{t('vmSetTitle')}</h3>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-sm font-medium">{t('vmSetMin')}</p>
        <Segmented label={t('vmSetMin')} value={String(min)} columns={4} testId="vs-min" options={MIN_OPTIONS.map((n) => ({ value: String(n), label: String(n), testId: `vs-min-${n}` }))} onChange={(v) => save({ min: Number(v) as SettingsPatch['min'] })} />
        <p className="m-0 text-sm text-muted">{t('vmSetMinHint')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-sm font-medium">{t('vmSetNew')}</p>
        <Segmented
          label={t('vmSetNew')}
          value={String(npd)}
          columns={4}
          testId="vs-new"
          options={NEW_OPTIONS.map((n) => ({ value: String(n), label: String(n), testId: `vs-new-${n}` }))}
          onChange={(v) => save({ newPerDay: Number(v) as SettingsPatch['newPerDay'] })}
        />
        <p className="m-0 text-sm text-muted">{t('vmSetNewHint')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-sm font-medium" id="vs-ret-label">
          {t('vmSetRet')}
        </p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="vs-ret-label" data-testid="vs-ret">
          {RET_OPTIONS.map((r) => {
            const on = r === ret;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={on}
                className={`flex flex-col items-center gap-0.5 rounded-[var(--radius-control)] border px-2 py-3 ${on ? 'border-accent bg-accent-soft' : 'border-line'}`}
                onClick={() => save({ ret: r })}
                data-testid={`vs-ret-${pct(r)}`}
                data-min={mins[String(r)]}
              >
                <span className="lx-tnum text-lg font-semibold">{pct(r)} %</span>
                <span className="lx-tnum text-xs text-muted">{t('vmSetRetMin', { n: mins[String(r)] ?? 0 })}</span>
              </button>
            );
          })}
        </div>
        <p className="m-0 text-sm text-muted">{t('vmSetRetHint', { n: counted })}</p>
      </div>
      <p className="m-0 text-xs text-subtle" data-testid="vs-when">
        {t('vmSetFromTomorrow')}
      </p>
      <div className="flex flex-col gap-1">
        <Switch checked={anki} onChange={(v) => save({ anki: v ? 1 : 0 })} label={t('vmSetAnki')} testId="vs-anki" />
        <p className="m-0 text-sm text-muted">{t('vmSetAnkiHint')}</p>
      </div>
      <div className="flex flex-col gap-1">
        <Switch checked={pre} onChange={(v) => save({ pre: v ? 1 : 0 })} label={t('vmSetPre')} testId="vs-pre" />
        <p className="m-0 text-sm text-muted">{t('vmSetPreHint')}</p>
      </div>
    </section>
  );
}
