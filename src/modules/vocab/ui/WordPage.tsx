import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, EnglishText, getDb, useClock, getWriter, Icon, ipaOf, readDoc, Skeleton, speak, toast, useLive, useSpeech, useT, type MessageKey } from '../sharedUi';
import { addDays, dayKey, logError } from '../shared';
import { lexOf } from '../data/lex';
import { writeManage } from '../data/store';
import { readVlogRange } from '../data/history';
import { partnersOf } from '../domain/band';
import { sentencesOf } from '../domain/card';
import { needsKnow, reportPatch } from '../domain/know';
import type { VocabAi } from '../aiPort';
import { fillKnowOne } from './know';
import { groupOf } from '../domain/ladder';
import { againTomorrow, restartLex } from '../domain/manage';
import { attemptsOf, daysUntil, HISTORY_DAYS, timeline, timelineStart, type Attempt, type Cell } from '../domain/stats';
import type { Lex } from '../domain/types';
import type { VlogTuple } from '../domain/vlog';

// Großpaket A S6: Wort-Seite (Bild s2-01/s2-03, B2 und N5). Stand mit Stufe und beiden Spuren, nächster Schritt, Verlauf der letzten 6 Wochen
// (alle Versuche aufklappbar, frühere nachladbar), Ursprungssatz, Wortpartner, Deine Sätze, Belege aus anderen Bereichen und die Aktionen.
// Liest live (`useLive`) und den Verlauf einmal je Zeitraum; schreibt nur über den einen Schreibpfad (Pausieren, Verwalten).

type Doc = Record<string, unknown>;
type T = (k: MessageKey, v?: Record<string, string | number>) => string;

export type WordPageProps = {
  /** `vocab/<id>` oder `chunk/<id>`. */
  path: string;
  /** „Dieses Wort üben“: kommt vom Bereich (Route der Lernrunde). */
  onPractice: (path: string) => void;
  /** „Claude fragen“: kommt vom Bereich (Begleiter), weil das Modul ihn nicht kennt (Isolation). Fehlt er, kein Knopf. */
  onAsk?: (text: string) => void;
  /** Claude für „Fehlt etwas? Jetzt ergänzen“ (Großpaket W3); fehlt = kein Knopf. */
  ai?: VocabAi;
};

const LOCALES = { de: 'de-DE', en: 'en-US' } as const;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const dayMs = (day: string) => new Date(`${day}T12:00:00`).getTime();
const fmt = (lang: 'de' | 'en', ms: number, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALES[lang], o).format(ms);
/** „Sa, 21.11.“ */
const dayDate = (lang: 'de' | 'en', ms: number) => fmt(lang, ms, { weekday: 'short', day: 'numeric', month: 'numeric' });
/** „21.11.“ */
const shortDate = (lang: 'de' | 'en', ms: number) => fmt(lang, ms, { day: 'numeric', month: 'numeric' });

const SRC_KEYS: Record<string, MessageKey> = {
  lookup: 'nbWsSrc_lookup',
  read: 'nbWsSrc_read',
  translate: 'nbWsSrc_translate',
  preply: 'nbWsSrc_preply',
  lesson: 'nbWsSrc_lesson',
  job: 'nbWsSrc_job',
  ai: 'nbWsSrc_ai',
  user: 'nbWsSrc_user',
  scene: 'nbWsSrc_scene',
};
const POS_KEYS: Record<string, MessageKey> = {
  noun: 'pos_noun',
  verb: 'pos_verb',
  adj: 'pos_adj',
  adv: 'pos_adv',
  prep: 'pos_prep',
  conj: 'pos_conj',
  phrase: 'pos_phrase',
  phrasal: 'pos_phrasal',
  pron: 'pos_pron',
  det: 'pos_det',
};
const posLabel = (raw: unknown, t: T): string | null => {
  const p = str(raw).toLowerCase();
  const k = p.startsWith('adj') ? 'adj' : p.startsWith('adv') ? 'adv' : p;
  const key = POS_KEYS[k];
  return key ? t(key) : null;
};

function docOf(s: { collections: Partial<Record<string, ReadonlyMap<string, Doc>>> }, path: string): Doc | null {
  const [col, id] = path.split('/', 2);
  if ((col !== 'vocab' && col !== 'chunk') || !id) return null;
  return s.collections[col]?.get(id) ?? null;
}

async function readOr(path: string): Promise<Doc | null> {
  const db = getDb();
  if (!db) return null;
  const d = await readDoc(db, path);
  return d.status === 'valid' ? d.doc : null;
}

// ---------------------------------------------------------------- Texte aus dem Lernstand

/** „Nächster Schritt“ je Stufe (Aufstiegsregeln ladder.ts `canAscend`). */
export function nextStepText(lex: Lex, t: T): string {
  if (lex.intro === null) return t('vmWpNextNew');
  const f = lex.ev.f.length;
  switch (lex.lv) {
    case 1:
    case 2:
      return t('vmWpNext12');
    case 3: {
      const n = Math.max(1, 2 - f);
      return n === 1 ? t('vmWpNext3One') : t('vmWpNext3', { n });
    }
    case 4: {
      const n = Math.max(0, 3 - f);
      return n === 0 ? t('vmWpNext4Week') : t('vmWpNext4', { n });
    }
    case 5:
      return t('vmWpNext5');
    case 6:
      return lex.pri === 'core' ? t('vmWpNext6Core', { n: Math.min(2, lex.ev.o), s: Math.min(1, lex.ev.s) }) : t('vmWpNext6', { n: Math.min(2, lex.ev.o) });
    default:
      return t('vmWpNext7');
  }
}

/** Zustand der Spur „Verstehen“ bzw. „Selbst schreiben“. */
export function trackStatus(lex: Lex, track: 'u' | 'b'): MessageKey {
  if (track === 'u') return lex.intro === null ? 'vmWpStNew' : lex.lv >= 3 ? 'vmWpStSure' : 'vmWpStLearning';
  if (!lex.b) return 'vmWpStNotYet';
  return lex.lv >= 6 ? 'vmWpStProduce' : 'vmWpStOnway';
}

/** Ergebnis eines Versuchs in Worten (frei richtig · mit Hilfe · fast richtig · falsch · nicht gewusst · nur Übung). */
export function outcomeKey(a: Attempt): MessageKey {
  if (a.mig) return 'vmWpOutMig';
  if (a.note <= 0) return 'vmWpOutPractice';
  if (a.outcome === 'ok' || a.outcome === 'syn') return a.hint > 0 || a.note === 2 ? 'vmWpOutHelp' : 'vmWpOutOk';
  if (a.outcome === 'dunno') return 'vmWpOutDunno';
  if (a.outcome === 'wrong' || a.outcome === 'other') return 'vmWpOutWrong';
  return 'vmWpOutAlmost';
}

function fxText(a: Attempt, t: T): string {
  if (a.fx === 'up') return t('vmWpFxUp', { lv: a.lv });
  if (a.fx === 'down') return t('vmWpFxDown', { lv: a.lv });
  return t(a.fx === 'stay' ? 'vmWpFxStay' : 'vmWpFxNone');
}

// ---------------------------------------------------------------- Bausteine

const CELL_CLASS: Record<Cell, string> = { ok: 'bg-ok', help: 'bg-near', wrong: 'bg-wrong', none: 'bg-subtle' };
const CELL_KEY: Record<Cell, MessageKey> = { ok: 'vmWpCellOk', help: 'vmWpCellHelp', wrong: 'vmWpCellWrong', none: 'vmWpCellNone' };

type Partner = { p: string; de: string };

/** Ein ergänzter Eintrag als „schlecht“ markieren (nie löschen); nur auf dem frischen Stand, nur bei Treffer. */
async function report(path: string, what: { kind: 'sent' | 'col'; text: string }): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  let hit = false;
  try {
    await writer.transform(path, (cur) => {
      const patch = cur ? reportPatch(cur, what) : null;
      if (!patch) return null;
      hit = true;
      return { update: patch };
    });
  } catch (err) {
    logError('vocab:know-report', err, path);
    return false;
  }
  return hit;
}

function KnowSection({ path, doc, head, partners, isChunk, ai }: { path: string; doc: Doc; head: string; partners: Partner[]; isChunk: boolean; ai?: VocabAi }) {
  const { t } = useT();
  const now = useClock((s) => s.now);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<'idle' | 'busy' | 'none' | 'error'>('idle');
  // Alle Sätze zum Lesen (auch Claude-Sätze in der Satzbank-Quarantäne, Emrahs Wahl „A“), ohne den Ursprungssatz (der steht darüber).
  const sents = useMemo(() => sentencesOf(doc, now, null, { read: true }).filter((x) => x.src !== 'ex'), [doc, now]);
  const aiSents = useMemo(() => new Set((Array.isArray(doc.sb) ? doc.sb : []).filter((x): x is Doc => !!x && typeof x === 'object' && (x as Doc).src === 'ai').map((x) => str(x.en))), [doc]);
  const aiCols = useMemo(() => new Set((Array.isArray(doc.col) ? doc.col : []).filter((x): x is Doc => !!x && typeof x === 'object' && (x as Doc).ai === 1).map((x) => str(x.p).toLowerCase())), [doc]);
  const canFill = !!ai && !isChunk && ai.ready() && needsKnow(doc);
  const fill = (): void => {
    const writer = getWriter();
    if (!ai || !writer || busy === 'busy') return;
    setBusy('busy');
    const docs = new Map<string, Doc>([[path, doc]]);
    const ctx = str(useLive.getState().docs['app/profile']?.ctx);
    fillKnowOne({ ai, writer, docs, path, ctx, nowMs: Date.now() })
      .then((ok) => setBusy(ok ? 'idle' : 'none'))
      .catch((err: unknown) => {
        logError('vocab:know-one', err, path);
        setBusy('error');
      });
  };
  const flag = (what: { kind: 'sent' | 'col'; text: string }): void => {
    void report(path, what).then((ok) => toast(t(ok ? 'vmWpReported' : 'vmWpReportFailed')));
  };
  return (
    <>
      {partners.length > 0 && (
        <section className="flex flex-col gap-1.5" data-testid="vw-partners">
          <Label>{t('vmWpPartners')}</Label>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {partners.map((p) => (
              <li key={p.p} className="lx-t-body flex flex-wrap items-baseline gap-x-2" data-testid="vw-partner">
                <span lang="en">{p.p}</span>
                {p.de && <span className="text-muted">({p.de})</span>}
                {aiCols.has(p.p.toLowerCase()) && (
                  <button type="button" className="lx-link text-subtle" onClick={() => flag({ kind: 'col', text: p.p })} data-testid="vw-partner-report">
                    {t('vmWpReport')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {sents.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="vw-examples">
          <Label>{t('vmWpExamples')}</Label>
          {sents.map((x) => (
            <div key={x.key} className="flex flex-col gap-1" data-testid="vw-example">
              <EnglishText as="p" className="lx-t-body m-0" text={x.en} area="lookup" source={path} title={head} highlight={x.mark ?? null} />
              <div className="flex flex-wrap gap-x-4">
                {x.de && (
                  <button type="button" className="lx-link self-start" aria-expanded={!!open[x.key]} onClick={() => setOpen((o) => ({ ...o, [x.key]: !o[x.key] }))} data-testid="vw-example-de-toggle">
                    {t(open[x.key] ? 'vmWpHideDe' : 'vmWpShowDe')}
                  </button>
                )}
                {aiSents.has(x.en) && (
                  <button type="button" className="lx-link text-subtle" onClick={() => flag({ kind: 'sent', text: x.en })} data-testid="vw-example-report">
                    {t('vmWpReport')}
                  </button>
                )}
              </div>
              {x.de && open[x.key] && (
                <p className="lx-t-support m-0 text-muted" lang="de" data-testid="vw-example-de">
                  {x.de}
                </p>
              )}
            </div>
          ))}
          {(aiSents.size > 0 || aiCols.size > 0) && <p className="lx-t-meta m-0 text-subtle">{t('vmWpKnowNote')}</p>}
        </section>
      )}
      {canFill && (
        <div className="flex flex-col items-start gap-1" data-testid="vw-fill">
          <Button variant="secondary" onClick={fill} disabled={busy === 'busy'} data-testid="vw-fill-btn">
            {t(busy === 'busy' ? 'vmWpFillBusy' : 'vmWpFill')}
          </Button>
          {busy === 'none' && <p className="lx-t-support m-0 text-muted" data-testid="vw-fill-none">{t('vmWpFillNone')}</p>}
          {busy === 'error' && <p className="lx-t-support m-0 text-muted" data-testid="vw-fill-error">{t('vmWpFillError')}</p>}
        </div>
      )}
    </>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="lx-t-label text-muted">{children}</div>;
}

/** Sieben Felder in drei Tönen (erkennst du · auf dem Weg · bildest du selbst), gefüllt bis zur Stufe. */
function StageBar({ lv }: { lv: number }) {
  const tone = (i: number) => (i <= 2 ? 'bg-subtle' : i <= 5 ? 'bg-muted' : 'bg-fg');
  return (
    <div className="flex gap-1" aria-hidden="true" data-testid="vw-stagebar">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <i key={i} className={`block h-1.5 flex-1 rounded-full ${i <= lv ? tone(i) : 'border-line-strong border'}`} data-on={i <= lv ? '1' : '0'} />
      ))}
    </div>
  );
}

function Timeline({ cells, start }: { cells: (Cell | null)[]; start: string }) {
  const { t, lang } = useT();
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }} role="img" aria-label={t('vmWpTimelineLabel')} data-testid="vw-timeline">
        {cells.map((c, i) => (
          <i key={i} className={`block h-[18px] rounded-[3px] ${c ? CELL_CLASS[c] : 'bg-surface-strong'}`} data-cell={c ?? ''} title={t(c ? CELL_KEY[c] : 'vmWpCellEmpty')} />
        ))}
      </div>
      <div className="lx-t-meta text-subtle flex justify-between">
        <span>{shortDate(lang, dayMs(start))}</span>
        <span>{t('vmWpToday')}</span>
      </div>
      <div className="lx-t-meta text-muted flex flex-wrap gap-x-3.5 gap-y-1">
        {(['ok', 'help', 'wrong', 'none'] as const).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <i className={`inline-block h-[9px] w-[9px] rounded-[2px] ${CELL_CLASS[c]}`} aria-hidden="true" />
            {t(CELL_KEY[c])}
          </span>
        ))}
      </div>
    </div>
  );
}

function SpeakRow({ text, testId }: { text: string; testId: string }) {
  const { t } = useT();
  const status = useSpeech((s) => s.status);
  if (status === 'unsupported' || status === 'novoice' || !text) return null;
  return (
    <div className="flex items-center gap-2">
      <Button variant="quiet" icon="speaker" onClick={() => void speak(text)} data-testid={`${testId}-normal`}>
        {t('vmWpListen')}
      </Button>
      <button type="button" className="min-h-11 rounded-full border border-line px-3 text-xs font-semibold text-muted" onClick={() => void speak(text, { rate: 0.8 })} aria-label={t('vmWpListenSlow')} data-testid={`${testId}-slow`}>
        0,8×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Verlauf laden

type History = { status: 'loading' | 'ready' | 'error'; tuples: VlogTuple[]; from: string; more: boolean };

/** Verlauf ab `from` bis heute; „Frühere laden“ erweitert um weitere 6 Wochen, solange es davor noch etwas geben kann. */
function useHistory(path: string, firstDay: string | null, nowMs: number): [History, () => void] {
  const today = dayKey(nowMs);
  const [from, setFrom] = useState(() => timelineStart(nowMs));
  const [h, setH] = useState<History>({ status: 'loading', tuples: [], from, more: false });
  useEffect(() => {
    let live = true;
    readVlogRange(readOr, from, today)
      .then((tuples) => {
        if (live) setH({ status: 'ready', tuples, from, more: firstDay !== null && firstDay < from });
      })
      .catch((err: unknown) => {
        logError('vocab:word-history', err, path);
        if (live) setH((cur) => ({ ...cur, status: 'error' }));
      });
    return () => {
      live = false;
    };
  }, [path, from, today, firstDay]);
  return [h, () => setFrom((f) => addDays(f, -HISTORY_DAYS))];
}

// ---------------------------------------------------------------- Seite

export function WordPage({ path, onPractice, onAsk, ai }: WordPageProps) {
  const { t } = useT();
  const status = useLive((s) => s.status);
  const doc = useLive((s) => docOf(s, path));
  const lex = useMemo(() => lexOf(doc), [doc]);
  if (status !== 'ready')
    return (
      <div className="flex flex-col gap-3 p-4" data-testid="vw-loading" aria-busy="true">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  if (!doc || !lex)
    return (
      <section className="mx-auto flex max-w-xl flex-col gap-3 p-4" data-testid="vw-missing">
        <p className="lx-t-support text-muted">{t('vmWpMissing')}</p>
      </section>
    );
  return <WordBody path={path} doc={doc} lex={lex} onPractice={onPractice} onAsk={onAsk} {...(ai ? { ai } : {})} />;
}

function WordBody({ path, doc, lex, onPractice, onAsk, ai }: { path: string; doc: Doc; lex: Lex } & Omit<WordPageProps, 'path'>) {
  const { t, lang } = useT();
  const isChunk = path.startsWith('chunk/');
  const head = str(isChunk ? doc.en : doc.word);
  const de = str(doc.de);
  const ipa = isChunk ? null : ipaOf(head);
  const pos = isChunk ? t('pos_phrase') : posLabel(doc.pos, t);
  const hidden = doc.hidden === true;
  const now = useClock((s) => s.now);
  const origin = str(doc.ex).replace(/\[([^\]]*)\]/g, '$1');
  // Markiertes Wort im Ursprungssatz („[…]“ in `ex`) als Hervorhebung (ux-reviewer S6c).
  const mark = ((): [number, number] | null => {
    const m = /\[([^\]]*)\]/.exec(str(doc.ex));
    if (!m) return null;
    const start = str(doc.ex).slice(0, m.index).replace(/\[([^\]]*)\]/g, '$1').length;
    return [start, start + m[1]!.length];
  })();
  const added = str(isChunk ? doc.created : doc.added);
  const srcKey = SRC_KEYS[str(doc.src)];
  const partners = partnersOf(doc.col, 4);
  const firstDay = lex.mig ? dayKey(lex.mig.t) : (lex.intro ?? (/^\d{4}-\d{2}-\d{2}$/.test(added) ? added : null));
  const [hist, loadEarlier] = useHistory(path, firstDay, now);
  const attempts = useMemo(() => attemptsOf(hist.tuples, path), [hist.tuples, path]);
  const own = attempts.filter((a) => !a.ext);
  const ext = attempts.filter((a) => a.ext).reverse();
  const cells = useMemo(() => timeline(own, now, HISTORY_DAYS), [own, now]);
  const [all, setAll] = useState(false);
  const due = (lex.b ? Math.min(lex.u.due, lex.b.due) : lex.u.due) < new Date(`${addDays(dayKey(now), 1)}T04:00:00`).getTime() && lex.intro !== null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-2 pb-8 sm:px-0" data-testid="vword" data-path={path}>
      {/* Kopf: Wort mit Ton, Lautschrift · Wortart, Bedeutung groß */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <h1 className="lx-t-display min-w-0 break-words" lang="en" data-testid="vw-head">
            {head}
          </h1>
        </div>
        {(ipa || pos) && (
          <p className="lx-t-support text-muted" data-testid="vw-ipa">
            {ipa && <span lang="en">/{ipa.replace(/^\/|\/$/g, '')}/</span>}
            {ipa && pos ? ' · ' : ''}
            {pos}
          </p>
        )}
      </div>
      {de && (
        <p className="lx-t-title" data-testid="vw-de">
          {de}
        </p>
      )}
      <SpeakRow text={head} testId="vw-listen" />
      {hidden && (
        <p className="lx-t-support bg-surface rounded-[var(--radius-control)] p-3" data-testid="vw-paused">
          {t('vmWpPaused')}
        </p>
      )}

      {/* Stand · Stufe N von 7 */}
      <section className="lx-card flex flex-col gap-2 p-4" data-testid="vw-stage" data-lv={lex.intro === null ? 0 : lex.lv}>
        <Label>{lex.intro === null ? t('vmWpStageNew') : t('vmWpStage', { lv: lex.lv })}</Label>
        <StageBar lv={lex.intro === null ? 0 : lex.lv} />
        <div className="lx-t-meta text-subtle flex justify-between" aria-hidden="true">
          <span>{t('vmWpGrpRecognize')}</span>
          <span>{t('vmWpGrpOnway')}</span>
          <span>{t('vmWpGrpProduce')}</span>
        </div>
        <div className="border-line flex flex-col gap-1.5 border-t pt-2">
          <TrackRow name={t('vmWpTrackU')} st={t(trackStatus(lex, 'u'))} due={lex.intro === null ? null : lex.u.due} testId="vw-track-u" />
          <TrackRow name={t('vmWpTrackB')} st={t(trackStatus(lex, 'b'))} due={lex.b ? lex.b.due : null} testId="vw-track-b" />
        </div>
        <p className="lx-t-support text-muted" data-testid="vw-next" data-group={groupOf(lex.lv)}>
          {nextStepText(lex, t)}
        </p>
      </section>

      {/* Verlauf · 6 Wochen */}
      <section className="lx-card flex flex-col gap-2 p-4" data-testid="vw-history" data-status={hist.status}>
        <Label>{t('vmWpHistory')}</Label>
        {hist.status === 'loading' && <Skeleton className="h-12 w-full" />}
        {hist.status === 'error' && <p className="lx-t-support text-muted">{t('vmWpHistoryError')}</p>}
        {hist.status === 'ready' && <Timeline cells={cells} start={timelineStart(now)} />}
        {hist.status === 'ready' && own.length === 0 && !hist.more && <p className="lx-t-support m-0 text-muted" data-testid="vw-history-empty">{t('vmWpHistoryEmpty')}</p>}
        {hist.status === 'ready' && (own.length > 0 || hist.more) && (
          <button type="button" className="lx-link self-start" onClick={() => setAll((v) => !v)} aria-expanded={all} data-testid="vw-history-all">
            {all ? t('vmWpHistoryLess') : t('vmWpHistoryAll')}
          </button>
        )}
        {all && (
          <div className="flex flex-col" data-testid="vw-attempts">
            {[...own].reverse().map((a, i) => (
              <AttemptRow key={`${a.t}-${a.form}-${i}`} a={a} t={t} lang={lang} first={i === 0} />
            ))}
            {hist.more && (
              <button type="button" className="lx-link mt-2 self-start" onClick={loadEarlier} data-testid="vw-history-earlier">
                {t('vmWpHistoryEarlier')}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Ursprungssatz */}
      {origin && (
        <section className="flex flex-col gap-1.5" data-testid="vw-origin">
          <Label>{srcKey && added ? t('vmWpOriginFrom', { src: t(srcKey), date: /^\d{4}-\d{2}-\d{2}$/.test(added) ? dayDate(lang, dayMs(added)) : added }) : t('vmWpOrigin')}</Label>
          <EnglishText as="p" className="lx-t-body m-0 text-lg" testId="vw-origin-text" text={origin} area="lookup" source={path} title={head} highlight={mark} />
          <SpeakRow text={origin} testId="vw-origin-listen" />
        </section>
      )}

      {/* Wortpartner und Beispielsätze (Großpaket W3): von Claude Ergänztes ist automatisch geprüft und lässt sich melden. */}
      <KnowSection path={path} doc={doc} head={head} partners={partners} isChunk={isChunk} {...(ai ? { ai } : {})} />

      {/* Deine Sätze */}
      <section className="flex flex-col gap-2" data-testid="vw-own">
        <Label>{t('vmWpOwn')}</Label>
        {(lex.os ?? []).length === 0 && <p className="lx-t-support text-muted">{t('vmWpOwnNone')}</p>}
        {(lex.os ?? []).map(([at, text, spoken]) => (
          <div key={at} className="flex items-start gap-2" data-testid="vw-own-item">
            <span className="text-ok mt-0.5 shrink-0" aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="lx-t-body" lang="en">
                {text}
              </p>
              <span className="lx-t-meta text-muted">{t('vmWpOwnMeta', { date: shortDate(lang, at), how: t(spoken ? 'vmWpOwnSpoken' : 'vmWpOwnTyped') })}</span>
            </div>
          </div>
        ))}
        {lex.lv >= 5 && lex.lv < 7 && <p className="lx-t-support text-muted">{t('vmWpOwnHint')}</p>}
      </section>

      {/* Auch woanders gesehen */}
      {ext.length > 0 && (
        <section className="flex flex-col gap-1.5" data-testid="vw-seen">
          <Label>{t('vmWpSeen')}</Label>
          <p className="lx-t-body">
            {ext
              .slice(0, 4)
              .map((a) => t(a.form === 'choice' ? 'vmWpSeenRead' : a.outcome === 'ok' ? 'vmWpSeenUsed' : 'vmWpSeenWrong', { date: shortDate(lang, a.t) }))
              .join(' · ')}
          </p>
        </section>
      )}

      <Actions path={path} lex={lex} head={head} de={de} hidden={hidden} due={due} onPractice={onPractice} onAsk={onAsk} />
    </div>
  );
}

function TrackRow({ name, st, due, testId }: { name: string; st: string; due: number | null; testId: string }) {
  const { t, lang } = useT();
  const now = useClock((s) => s.now);
  const when = due === null ? null : daysUntil(due, now) === 0 ? t('vmWpDueToday') : t('vmWpDueOn', { date: dayDate(lang, due) });
  return (
    <div className="lx-t-support flex flex-wrap items-baseline justify-between gap-x-3" data-testid={testId}>
      <span className="text-muted">{name}</span>
      <span>
        <b>{st}</b>
        {when && <span className="text-muted"> · {when}</span>}
      </span>
    </div>
  );
}

function AttemptRow({ a, t, lang, first }: { a: Attempt; t: T; lang: 'de' | 'en'; first: boolean }) {
  const cell: Cell = a.note <= 0 ? 'none' : a.note === 1 ? 'wrong' : a.note === 2 || a.hint > 0 ? 'help' : 'ok';
  return (
    <div className={`flex items-start gap-3 py-2.5 ${first ? '' : 'border-line border-t'}`} data-testid="vw-attempt" data-fx={a.fx}>
      <i className={`mt-1.5 block h-2 w-2 shrink-0 rounded-full ${CELL_CLASS[cell]}`} aria-hidden="true" />
      <span className="flex min-w-0 flex-col">
        <b className="lx-t-support">
          {dayDate(lang, a.t)} · {t(`vmF_${a.form}` as MessageKey)}
        </b>
        <span className="lx-t-meta text-muted">
          {t(outcomeKey(a))} · {fxText(a, t)}
        </span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- Aktionen

function Actions({ path, lex, head, de, hidden, due, onPractice, onAsk }: { path: string; lex: Lex; head: string; de: string; hidden: boolean; due: boolean } & Omit<WordPageProps, 'path'>) {
  const { t } = useT();
  const [busy, setBusy] = useState<null | 'pause' | 'tomorrow' | 'restart'>(null);
  const [manage, setManage] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const fail = (): void => {
    toast(t('vmWpSaveError'), 'error');
  };

  const togglePause = async () => {
    const w = getWriter();
    if (!w) return fail();
    setBusy('pause');
    try {
      await w.transform(path, (cur) => (cur ? (cur.hidden === !hidden ? null : { update: { hidden: !hidden } }) : null));
    } catch (err) {
      logError('vocab:word-pause', err, path);
      fail();
    } finally {
      setBusy(null);
    }
  };
  const manageWith = async (kind: 'tomorrow' | 'restart') => {
    const w = getWriter();
    if (!w) return fail();
    setBusy(kind);
    try {
      const now = Date.now();
      const ok = await writeManage(w, path, (l) => (kind === 'tomorrow' ? againTomorrow(l, now) : restartLex(l, now)));
      if (kind === 'tomorrow') toast(t(ok ? 'vmWpTomorrowDone' : 'vmWpTomorrowAlready'));
      else if (ok) toast(t('vmWpRestartDone'));
      else fail();
      setConfirm(false);
    } catch (err) {
      logError('vocab:word-manage', err, path);
      fail();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-3 pt-2" data-testid="vw-actions">
      {!hidden && lex.intro !== null && (
        <div className="flex flex-col gap-1">
          <Button variant="primary" onClick={() => onPractice(path)} data-testid="vw-practice">
            {t('vmWpPractice')}
          </Button>
          <p className="lx-t-meta text-muted">{t(due ? 'vmWpPracticeDue' : 'vmWpPracticeNotDue')}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {onAsk && (
          <Button variant="secondary" icon="ask" onClick={() => onAsk(t('vmWpAskText', { w: head, de }))} data-testid="vw-ask">
            {t('vmWpAsk')}
          </Button>
        )}
        <Button variant="secondary" icon={hidden ? 'play' : 'eyeOff'} busy={busy === 'pause'} onClick={() => void togglePause()} data-testid="vw-pause">
          {t(hidden ? 'vmWpResume' : 'vmWpPause')}
        </Button>
        {lex.intro !== null && (
          <Button variant="ghost" iconAfter={manage ? 'chevronDown' : 'chevronRight'} onClick={() => setManage((v) => !v)} aria-expanded={manage} data-testid="vw-manage">
            {t('vmWpManage')}
          </Button>
        )}
      </div>
      {manage && lex.intro !== null && (
        <div className="lx-card flex flex-col gap-3 p-4" data-testid="vw-manage-panel">
          <div className="flex flex-col gap-1">
            <Button variant="secondary" icon="refresh" busy={busy === 'tomorrow'} onClick={() => void manageWith('tomorrow')} data-testid="vw-tomorrow">
              {t('vmWpTomorrow')}
            </Button>
            <p className="lx-t-meta text-muted">{t('vmWpTomorrowSub')}</p>
          </div>
          {!confirm ? (
            <div className="flex flex-col gap-1">
              <Button variant="secondary" icon="undo" onClick={() => setConfirm(true)} data-testid="vw-restart">
                {t('vmWpRestart')}
              </Button>
              <p className="lx-t-meta text-muted">{t('vmWpRestartSub')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2" role="group" data-testid="vw-restart-confirm">
              <p className="lx-t-support">{t('vmWpRestartAsk')}</p>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)} data-testid="vw-restart-no">
                  {t('vmWpCancel')}
                </Button>
                <Button variant="primary" className="flex-1" busy={busy === 'restart'} onClick={() => void manageWith('restart')} data-testid="vw-restart-yes">
                  {t('vmWpRestartYes')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
