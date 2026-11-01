import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Choices, EnglishText, ExerciseShell, getDb, getWriter, Icon, KineticGap, readDoc, Skeleton, toast, useClock, useHiddenInput, useHotkeys, useT, type ShellSecondary } from '../sharedUi';
import { loadAtlasText, logError } from '../shared';
import { writePlace } from '../data/place';
import { readPlace } from '../data/refill';
import { headwordOf } from '../domain/dupes';
import { VMOD_PLACE_PATH } from '../registry';
import { type BandAnswers, buildPlaceTest, PLACE_BANDS, placeGoesOn, type PlaceResult, type PlaceTest, PROD_N, prodRight, REC_N, scoreBand, scorePlace } from '../domain/place';
import type { BandRaw } from '../domain/sources';
import { SRC_ORDER, SRC_WEIGHTS, type Src } from '../domain/sources';

// Großpaket A Schritt 7c (Bilder s3-01 bis s3-04, Emrah 01.11.2026): Einstufungstest der Wörter-App (Route `vplace`). Vier Ansichten:
// Start, Erkennen (6 je Stufe), Selbst bilden (2 je Stufe), Ergebnis. Keine Rückmeldung je Wort; am Ende steht alles. Gespeichert wird nur
// `vmod/place` (Grenze und gekonnte Stichwörter); Wörter und Plan ändern sich nicht.

export type PlaceTop = (p: { onClose: () => void; progress: { n: number; total: number } | null }) => ReactNode;

type Phase = { k: 'intro' } | { k: 'load' } | { k: 'run'; tt: PlaceTest; b: number; i: number } | { k: 'save' } | { k: 'result'; r: PlaceResult; tt: PlaceTest; ans: BandAnswers[] } | { k: 'empty' };

const STEPS = REC_N + PROD_N;
const LOCALES = { de: 'de-DE', en: 'en-US' } as const;

/** Letzte Einstufung (Zeitpunkt und gekonnte Stichwörter) für eine Wiederholung; `null` ohne Datenbank oder Dokument. */
async function readPrev(): Promise<{ t: number; ok: string[] } | null> {
  const db = getDb();
  if (!db) return null;
  const d = await readDoc(db, VMOD_PLACE_PATH);
  if (d.status !== 'valid') return null;
  const p = readPlace(d.doc);
  return p ? { t: typeof d.doc.t === 'number' ? d.doc.t : 0, ok: p.ok } : null;
}

export function PlaceScreen({ onClose, onDone, renderTop }: { onClose: () => void; onDone: () => void; renderTop?: PlaceTop }) {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const [phase, setPhase] = useState<Phase>({ k: 'intro' });
  const answers = useRef<BandAnswers[]>([]);
  // Doppeltipp auf die letzte Antwort wertet nur einmal aus (data-guard S7c).
  const finished = useRef(false);
  const num = (n: number) => n.toLocaleString(LOCALES[lang]);

  const start = () => {
    setPhase({ k: 'load' });
    answers.current = [];
    finished.current = false;
    Promise.all([loadAtlasText(), readPrev()])
      .then(([text, prev]) => {
        const atlas = JSON.parse(text) as { items?: BandRaw[] };
        // Fest je Lerntag und Einstufung: Neuladen zeigt dieselben Wörter; eine neue Einstufung bringt andere und lässt früher Gekonntes weg
        // (english-teacher S7c).
        const tt = buildPlaceTest(atlas.items ?? [], `${today}|${prev?.t ?? 0}`, new Set((prev?.ok ?? []).map(headwordOf)));
        setPhase(tt.bands.length ? { k: 'run', tt, b: 0, i: 0 } : { k: 'empty' });
      })
      .catch((err: unknown) => {
        logError('vocab:place-load', err);
        setPhase({ k: 'empty' });
      });
  };

  const finish = (tt: PlaceTest) => {
    if (finished.current) return;
    finished.current = true;
    const ans = answers.current.map((a) => ({ rec: [...a.rec], prod: [...a.prod] }));
    const r = scorePlace(tt, ans);
    setPhase({ k: 'save' });
    const w = getWriter();
    void (w ? writePlace(w, r, Date.now()) : Promise.resolve(false)).then((ok) => {
      if (!ok) toast(t('vmPlSaveError'));
      setPhase({ k: 'result', r, tt, ans });
    });
  };

  /** Antwort der aktuellen Aufgabe ablegen und weiter; am Ende einer Stufe auswerten (Stopp nach zwei unsicheren in Folge). */
  const answer = (tt: PlaceTest, b: number, i: number, a: number | string) => {
    const cur = answers.current[b] ?? { rec: [], prod: [] };
    if (i < REC_N) cur.rec[i] = typeof a === 'number' ? a : -1;
    else cur.prod[i - REC_N] = typeof a === 'string' ? a : '';
    answers.current[b] = cur;
    if (i + 1 < STEPS) {
      setPhase({ k: 'run', tt, b, i: i + 1 });
      return;
    }
    const oks = tt.bands.slice(0, b + 1).map((band, k) => scoreBand(band, answers.current[k] ?? { rec: [], prod: [] }).ok);
    if (placeGoesOn(oks) && b + 1 < tt.bands.length) setPhase({ k: 'run', tt, b: b + 1, i: 0 });
    else finish(tt);
  };

  const frame = (progress: { n: number; total: number } | null, body: ReactNode) => (
    <div className="lx-vm-frame mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="vplace">
      {renderTop?.({ onClose, progress })}
      {body}
    </div>
  );

  switch (phase.k) {
    case 'intro':
      return frame(null, <Intro num={num} onGo={start} onLater={onClose} />);
    case 'load':
    case 'save':
      return frame(
        null,
        <div className="flex flex-col gap-3 px-4 sm:px-0" data-testid="vp-loading" aria-busy="true">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>,
      );
    case 'empty':
      return frame(
        null,
        <section className="mx-auto flex max-w-xl flex-col items-start gap-3 p-4" data-testid="vp-empty">
          <h2 className="lx-t-title">{t('vmPlEmptyTitle')}</h2>
          <p className="lx-t-support text-muted">{t('vmPlEmpty')}</p>
          <Button variant="primary" onClick={onClose} data-testid="vp-back">
            {t('vmBack')}
          </Button>
        </section>,
      );
    case 'run': {
      const tt = phase.tt;
      const band = tt.bands[phase.b]!;
      // Fortschritt über alle Stufen, die noch kommen können (der Test kann früher enden).
      const total = tt.bands.length * STEPS;
      return frame(
        { n: phase.b * STEPS + phase.i + 1, total },
        <Item key={`${phase.b}-${phase.i}`} band={band} i={phase.i} num={num} onAnswer={(a) => answer(tt, phase.b, phase.i, a)} />,
      );
    }
    case 'result':
      return frame(null, <Result r={phase.r} test={phase.tt} answers={phase.ans} num={num} onDone={onDone} />);
  }
}

// ---------- Start (Bild s3-01)

function Intro({ num, onGo, onLater }: { num: (n: number) => string; onGo: () => void; onLater: () => void }) {
  const { t } = useT();
  return (
    <section className="flex w-full flex-col gap-4 px-4 sm:px-0" data-testid="vp-intro">
      <div className="lx-card mx-auto flex w-full max-w-xl flex-col gap-4 p-5">
        <div className="lx-t-label text-muted">{t('vmPlIntroLabel')}</div>
        <h2 className="lx-t-title m-0">{t('vmPlIntroTitle')}</h2>
        <p className="lx-t-body m-0">{t('vmPlIntroHow', { rec: REC_N, prod: PROD_N })}</p>
        <ol className="m-0 flex list-none flex-col gap-1 p-0" data-testid="vp-intro-bands">
          {PLACE_BANDS.map(([lo, hi], k) => (
            <li key={lo} className="lx-t-support flex items-center gap-3">
              <span className="lx-tnum text-subtle w-4 text-right">{k + 1}</span>
              <span className="lx-tnum">
                {num(lo)}–{num(hi)}
              </span>
            </li>
          ))}
        </ol>
        <p className="lx-t-support text-muted m-0">{t('vmPlIntroWhy')}</p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" className="w-full" onClick={onGo} data-testid="vp-go">
            {t('vmPlGo')}
          </Button>
          <Button variant="quiet" className="w-full" onClick={onLater} data-testid="vp-later">
            {t('vmPlLater')}
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------- Erkennen (s3-02) und Selbst bilden (s3-03)

function Item({ band, i, num, onAnswer }: { band: PlaceTest['bands'][number]; i: number; num: (n: number) => string; onAnswer: (a: number | string) => void }) {
  const { t } = useT();
  const api = useHiddenInput();
  const rec = i < REC_N ? band.rec[i]! : null;
  const prod = rec ? null : band.prod[i - REC_N]!;
  const [chosen, setChosen] = useState<number | null>(null);
  const typed = useRef('');
  const [hasInput, setHasInput] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!prod || focused.current) return;
    focused.current = true;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) api.focusNow();
  }, [api, prod]);
  const ready = rec ? chosen !== null : hasInput;
  const go = () => {
    if (!ready) return;
    onAnswer(rec ? chosen! : typed.current);
  };
  useHotkeys({ enter: go }, api.isInput);

  const range = `${num(band.lo)}–${num(band.hi)}`;
  const kindLabel = rec ? t('vmPlStepRec', { range, n: i + 1, total: REC_N }) : t('vmPlStepProd', { range, n: i - REC_N + 1, total: PROD_N });
  const secondary: ShellSecondary[] = [{ id: 'dontKnow', label: t('vmBtnDunno'), onClick: () => onAnswer(rec ? -1 : ''), testId: 'vp-dunno', variant: 'quiet' }];
  const note = (
    <p className="lx-t-meta text-muted m-0" data-testid="vp-note">
      {t('vmPlNoFeedback')}
    </p>
  );

  let prompt: ReactNode;
  let answer: ReactNode;
  if (rec) {
    prompt = <EnglishText as="p" testId="vp-sentence" text={rec.x} area="trainer" title={rec.w} highlight={[rec.start, rec.end]} exclude={[rec.start, rec.end]} />;
    answer = (
      <div className="flex flex-col gap-3">
        <Choices options={rec.opts} chosen={chosen} correct={null} revealed={false} onPick={setChosen} lang="de" label={t('vmPlRecLabel', { w: rec.w })} testId="vp-choices" />
        {note}
      </div>
    );
  } else {
    const p = prod!;
    const gap = (
      // Nur der Anfangsbuchstabe steht fest; die Lücke verrät die Länge nicht (Kap. 4, ux-reviewer S7c). Weitere Plätze kommen beim Tippen.
      <KineticGap
        label={t('vmPlGapLabel', { de: p.de })}
        maxLength={40}
        state="input"
        mask={[{ kind: 'slot', hint: p.first }]}
        silent
        onChange={(v) => {
          typed.current = v;
          setHasInput(v.trim().length > 0);
        }}
        onEnter={go}
      />
    );
    prompt = (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-2xl font-semibold" lang="de" data-testid="vp-de">
          {p.de}
        </p>
        <EnglishText as="p" testId="vp-sentence" text={p.x} area="trainer" title={p.w} slot={{ start: p.start, end: p.end, node: <span className="lx-vp-gap">{gap}</span> }} />
      </div>
    );
    answer = (
      <div className="flex flex-col gap-1">
        <p className="lx-t-support text-muted m-0" data-testid="vp-oneword">
          {t('vmPlOneWord')}
        </p>
        {note}
      </div>
    );
  }
  return (
    <ExerciseShell
      meta={{ ex: rec ? 'vm:place-rec' : 'vm:place-prod', id: `place:${band.lo}:${i}`, kind: 'word' }}
      status={{ area: 'words', state: null, kindLabel, noInfo: true }}
      task={{ text: t(rec ? 'vmPlTaskRec' : 'vmPlTaskProd'), purpose: t('vmPlPurpose'), open: false }}
      prompt={prompt}
      answer={answer}
      secondary={secondary}
      primary={{ label: t('vmBtnNext'), onClick: go, testId: 'vp-next', disabled: !ready, arrow: true }}
      sideNote={t('vmPlNoFeedback')}
      keysHint={null}
      {...(rec ? { choiceCount: rec.opts.length } : {})}
    />
  );
}

// ---------- Ergebnis (s3-04)

const SRC_KEY: Record<Src, 'vmPlSrcCol' | 'vmPlSrcJob' | 'vmPlSrcOwn' | 'vmPlSrcBand'> = { col: 'vmPlSrcCol', job: 'vmPlSrcJob', own: 'vmPlSrcOwn', band: 'vmPlSrcBand' };
// Abstufungen von Akzent und Neutral wie s3-04/s3-07 (Grün heißt „richtig“ und bleibt dafür frei; ux-reviewer S7c).
const SRC_BAR: Record<Src, string> = { col: 'lx-vp-src-col', job: 'lx-vp-src-job', own: 'lx-vp-src-own', band: 'lx-vp-src-band' };

function Result({ r, test, answers, num, onDone }: { r: PlaceResult; test: PlaceTest; answers: BandAnswers[]; num: (n: number) => string; onDone: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const firstLo = r.bands[0]?.lo ?? PLACE_BANDS[0]![0];
  const lastHi = r.bands[r.bands.length - 1]?.hi ?? PLACE_BANDS[PLACE_BANDS.length - 1]![1];
  const title = r.edge <= firstLo ? t('vmPlEdgeLow', { n: num(firstLo) }) : r.edge >= lastHi ? t('vmPlEdgeTop', { n: num(lastHi) }) : t('vmPlEdge', { n: num(r.edge) });
  const tested = testedWords(test, answers);
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-2 sm:px-0" data-testid="vp-result">
      <div className="lx-card flex flex-col gap-4 p-5">
        <div className="lx-t-label text-muted">{t('vmPlResultLabel')}</div>
        <h2 className="lx-t-title m-0" data-testid="vp-edge" data-edge={r.edge}>
          {title}
        </h2>
        <ul className="m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-line" data-testid="vp-bands">
          {r.bands.map((b) => (
            <li key={b.lo} className="flex items-center gap-3 py-2" data-testid={`vp-band-${b.lo}`} data-s={b.s}>
              <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${b.s === 'ok' ? 'bg-ok-soft text-ok-text' : b.s === 'bad' ? 'bg-wrong-soft text-wrong-text' : 'border-line border'}`} aria-hidden="true">
                {b.s === 'ok' ? <Icon name="check" size={14} /> : b.s === 'bad' ? <Icon name="close" size={14} /> : null}
              </span>
              <span className="lx-tnum min-w-0 flex-1">
                {num(b.lo)}–{num(b.hi)}
              </span>
              <span className={`lx-t-support lx-tnum ${b.s === 'ok' ? '' : 'text-muted'}`}>
                {b.s === 'skip' ? t('vmPlBandSkip') : t(b.s === 'ok' ? 'vmPlBandOk' : 'vmPlBandBad', { r: b.r, rt: REC_N, p: b.p, pt: PROD_N })}
              </span>
            </li>
          ))}
        </ul>
        <p className="lx-t-body m-0" data-testid="vp-ok">
          {t('vmPlFrom', { n: num(r.edge) })}
          {r.ok.length > 0 && (
            <>
              {' '}
              <b>{r.ok.length === 1 ? t('vmPlOk1') : t('vmPlOkN', { n: num(r.ok.length) })}</b> {t(r.ok.length === 1 ? 'vmPlOkTail1' : 'vmPlOkTail')}
            </>
          )}
        </p>
        <p className="lx-t-support text-muted m-0">
          <b className="text-fg">{t('vmPlWhyHead')}</b> {t('vmPlWhy')}
        </p>
      </div>
      <div className="lx-card flex flex-col gap-3 p-5" data-testid="vp-mix">
        <h3 className="lx-t-label text-muted m-0">{t('vmPlMixTitle')}</h3>
        <div className="flex h-2.5 gap-1 overflow-hidden rounded-full" aria-hidden="true">
          {SRC_ORDER.map((s) => (
            <span key={s} className={`${SRC_BAR[s]} rounded-full`} style={{ flex: SRC_WEIGHTS[s] }} />
          ))}
        </div>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {SRC_ORDER.map((s) => (
            <li key={s} className="lx-t-support flex items-center gap-2" data-testid={`vp-mix-${s}`}>
              <span className={`inline-block h-2.5 w-2.5 flex-none rounded-full ${SRC_BAR[s]}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">{t(SRC_KEY[s])}</span>
              <span className="lx-tnum text-muted">{t('vmPlPct', { n: Math.round(SRC_WEIGHTS[s] * 100) })}</span>
            </li>
          ))}
        </ul>
        <p className="lx-t-meta text-muted m-0">{t('vmPlMixNote')}</p>
      </div>
      <Button variant="primary" onClick={onDone} data-testid="vp-done">
        {t('vmDoneFinish')}
      </Button>
      {tested.length > 0 && (
        <div className="flex flex-col gap-2 pb-6">
          <button type="button" className="lx-t-support text-accent self-center underline-offset-4 hover:underline" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="vp-words-toggle">
            {t(open ? 'vmPlWordsHide' : 'vmPlWordsShow')}
          </button>
          {open && (
            <ul className="lx-card m-0 flex list-none flex-col px-4 py-1 [&>li+li]:border-t [&>li+li]:border-line" data-testid="vp-words">
              {tested.map((w) => (
                <li key={`${w.lo}-${w.w}`} className="flex items-start gap-3 py-2" data-ok={w.ok ? 1 : 0}>
                  <span className={`mt-0.5 flex-none ${w.ok ? 'text-ok-text' : 'text-muted'}`} aria-label={t(w.ok ? 'vmPlWordOk' : 'vmPlWordNo')}>
                    <Icon name={w.ok ? 'check' : 'close'} size={16} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span lang="en" className="font-medium">
                      {w.w}
                    </span>
                    <span className="lx-t-support text-muted" lang="de">
                      {w.de}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** Getestete Wörter aller gelaufenen Stufen mit Bedeutung und richtig/falsch. */
function testedWords(test: PlaceTest, answers: BandAnswers[]): { w: string; de: string; ok: boolean; lo: number }[] {
  const out: { w: string; de: string; ok: boolean; lo: number }[] = [];
  test.bands.forEach((b, k) => {
    const a = answers[k];
    if (!a) return;
    b.rec.forEach((it, i) => {
      if (a.rec[i] !== undefined) out.push({ w: it.w, de: it.opts[it.right]!, ok: a.rec[i] === it.right, lo: b.lo });
    });
    b.prod.forEach((it, i) => {
      if (a.prod[i] !== undefined) out.push({ w: it.w, de: it.de, ok: prodRight(it, a.prod[i]), lo: b.lo });
    });
  });
  return out;
}
