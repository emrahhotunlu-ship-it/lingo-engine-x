import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, EnglishText, ExerciseShell, Icon, lookupOpenMs, MicButton, PrimaryAction, SentenceInput, useHotkeys, useT, type MessageKey } from '../sharedUi';
import { hasTarget } from '../prompts/common';
import type { UseVerdict } from '../prompts/common';
import type { UseModel, UseTarget } from '../domain/use';
import type { LearnRun, LearnView, UseRow, UseState } from './learnRun';

// Großpaket A S5c-3: Anwenden und eigener Satz (Bilder s2-07 … s2-12). Die Karte rechnet nichts selbst: Prüfen, Nochmal, Aufdecken,
// „War das auch richtig?“, „Später prüfen lassen“ und Weiter gehen an die Steuerung (`learnRun.ts`).
// Reihenfolge nach dem Prüfen (Bild s2-08): Wörter mit Urteil · dein Text mit markierten Stellen · je Wort ein Satz warum (falsch vor fast
// richtig, höchstens zwei offen) · noch etwas · bessere Fassung erst nach „Nochmal selbst schreiben“ oder auf Wunsch · was das für den Plan heißt.

type UseView = Extract<LearnView, { k: 'use' }>;
type Judged = Extract<UseState, { s: 'judged' }>;
type T = ReturnType<typeof useT>['t'];

/** Minuten im Kopf (Bild s2-07 „ca. 3 Min.“): Text mit mehreren Wörtern bzw. ein Satz. */
const MIN: Record<UseModel['form'], number> = { transfer: 3, own: 1 };
/** Ab dieser Stufe ist der eigene Satz frei (ohne Lage, plan.md §7). */
const FREE_LV = 6;
/** Gesprochen zählt der Text, wenn mindestens dieser Anteil diktiert wurde. */
const SPOKEN_SHARE = 0.5;

const TONE: Record<UseVerdict, { text: string; line: string; icon: 'check' | 'minus' | 'close' | 'info' }> = {
  ok: { text: 'text-ok-text', line: 'decoration-ok', icon: 'check' },
  odd: { text: 'text-near-text', line: 'decoration-near', icon: 'minus' },
  wrong: { text: 'text-wrong-text', line: 'decoration-wrong', icon: 'close' },
  thin: { text: 'text-muted', line: 'decoration-line-strong', icon: 'info' },
  unused: { text: 'text-muted', line: 'decoration-line-strong', icon: 'info' },
};

/** Lage-Text der Karte (`null` = freier eigener Satz ab Stufe 6). */
export function sitKey(m: UseModel): MessageKey | null {
  if (m.form === 'own' && (m.targets[0]?.lv ?? 0) >= FREE_LV) return null;
  return `vmSit_${m.frame}_${m.sit}` as MessageKey;
}

const numKey = (n: number) => `vmNum_${Math.min(5, Math.max(1, n))}` as MessageKey;

/** „lead time und sign off on“: Stichwörter mit „und“ verbunden (englisch ausgezeichnet). */
function wordList(t: T, ws: readonly string[]): ReactNode {
  return ws.map((w, i) => (
    <span key={w}>
      {i > 0 ? (i === ws.length - 1 ? ` ${t('vmUseAnd')} ` : ', ') : ''}
      <span lang="en" className="font-medium">
        {w}
      </span>
    </span>
  ));
}

/** Text mit unterstrichenen Fundstellen je Urteil; ohne Fundstelle wird das Zielwort selbst gesucht. */
function Marked({ text, rows, targets, testId }: { text: string; rows: readonly UseRow[]; targets: readonly UseTarget[]; testId: string }) {
  const low = text.toLowerCase();
  const spans: { a: number; b: number; v: UseVerdict; key: string }[] = [];
  for (const r of rows) {
    if (r.v === 'unused') continue;
    const tg = targets.find((x) => x.key === r.key);
    const needles = [r.at, tg?.word ?? ''].map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const n of needles) {
      const a = low.indexOf(n);
      if (a < 0) continue;
      const b = a + n.length;
      if (!spans.some((s) => a < s.b && s.a < b)) spans.push({ a, b, v: r.v, key: r.key });
      break;
    }
  }
  spans.sort((x, y) => x.a - y.a);
  const out: ReactNode[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.a > at) out.push(text.slice(at, s.a));
    out.push(
      <span key={s.key} className={`underline decoration-2 underline-offset-4 ${TONE[s.v].line}`} data-v={s.v} data-testid={`${testId}-mark`}>
        {text.slice(s.a, s.b)}
      </span>,
    );
    at = s.b;
  }
  if (at < text.length) out.push(text.slice(at));
  return (
    <p className="lx-t-body whitespace-pre-wrap" lang="en" data-testid={testId}>
      {out}
    </p>
  );
}

const isField = (el: EventTarget | null) => el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);

export function UseCard({ view, run }: { view: UseView; run: LearnRun }) {
  const key = `${view.task.path}|${view.n}|${view.later?.t ?? ''}`;
  return <UseInner key={key} view={view} run={run} />;
}

function UseInner({ view, run }: { view: UseView; run: LearnRun }) {
  const { t } = useT();
  const { m, st } = view;
  const own = m.form === 'own';
  const later = view.later;
  const [text, setText] = useState(view.text);
  const [redo, setRedo] = useState<string | null>(null);
  const dictated = useRef(0);
  const shownAt = useRef(0);
  const lookupAtStart = useRef(0);
  const firstKeyAt = useRef<number | null>(null);
  const firstKeyLookup = useRef(0);
  useEffect(() => {
    shownAt.current = performance.now();
    lookupAtStart.current = lookupOpenMs();
  }, []);

  const measure = () => {
    const ms = Math.max(0, Math.round(performance.now() - shownAt.current - (lookupOpenMs() - lookupAtStart.current)));
    const fk = firstKeyAt.current === null ? ms : Math.max(0, Math.round(firstKeyAt.current - shownAt.current - firstKeyLookup.current));
    return { ms, fk };
  };
  const onType = (v: string) => {
    if (firstKeyAt.current === null && v.trim()) {
      firstKeyAt.current = performance.now();
      firstKeyLookup.current = lookupOpenMs() - lookupAtStart.current;
    }
    setText(v);
  };
  const onDictate = (said: string) => {
    const add = said.trim();
    if (!add) return;
    dictated.current += add.length;
    onType(text.trim() ? `${text.trimEnd()} ${add}` : add);
  };
  const spoken = () => text.trim().length > 0 && dictated.current >= text.trim().length * SPOKEN_SHARE;
  // Enter = Weiter, sobald das Ergebnis steht (nie aus einem Eingabefeld heraus: dort prüft Enter).
  useHotkeys({ enter: st.s === 'judged' || st.s === 'self' ? () => run.next() : undefined }, isField);
  const check = () => run.useCheck(later ? later.text : text, later ? later.spoken : spoken(), measure());
  const next = () => run.next();

  const sk = sitKey(m);
  const words = st.s === 'judged' ? st.rows : null;
  const shownText = st.s === 'write' || st.s === 'checking' ? text : view.text;

  // Kopf: Art · Minuten bzw. Stufe · geprüft von Claude / ohne Claude / gemerkter Text.
  const detail = [
    own ? t('vmUseLevel', { lv: m.targets[0]?.lv ?? 0 }) : t('vmUseMin', { min: MIN[m.form] }),
    later && st.s !== 'judged' ? t('vmUseSaved') : null,
    st.s === 'judged' ? t('vmUseByClaude') : st.s === 'self' ? t('vmUseNoClaude') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const kindLabel = `${t(own ? 'vmKindOwn' : 'vmKindUse')} · ${detail}`;
  const taskText = later ? t('vmTask_later') : own ? t('vmTask_own', { w: m.targets[0]?.word ?? '' }) : t('vmTask_use', { n: t(numKey(m.targets.length)) });
  const purpose = later ? t('vmWozu_later') : t(own ? 'vmWozu_own' : 'vmWozu_use');

  const situation = (
    <div className="lx-card flex flex-col gap-1.5 p-4" data-testid="vm-use-sit">
      <p className="lx-t-label text-muted">
        {t(`vmFrame_${m.frame}` as MessageKey)} · {t(`vmTone_${m.frame}` as MessageKey)}
      </p>
      {sk ? <p className="lx-t-body">{t(sk)}</p> : null}
      {own ? <p className="lx-t-support text-muted">{t('vmUseOwnHint')}</p> : null}
    </div>
  );

  const chips = (
    <div className="flex flex-col gap-1.5">
      <p className="lx-t-label text-muted">{t('vmUseWords')}</p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" data-testid="vm-use-words">
        {m.targets.map((tg) => {
          const r = words?.find((w) => w.key === tg.key) ?? null;
          const used = !r && hasTarget(shownText, tg);
          return (
            <li
              key={tg.key}
              className={`lx-chip ${r ? `${TONE[r.v].text} border-current` : ''}`}
              data-used={used ? '' : undefined}
              data-v={r?.v}
              data-testid="vm-use-chip"
              title={tg.de}
            >
              {r ? <Icon name={TONE[r.v].icon} size={14} aria-hidden="true" /> : used ? <Icon name="check" size={14} aria-hidden="true" /> : null}
              <span lang="en">{tg.head}</span>
              {r ? <span className="sr-only">{t(`vmUseV_${r.v}` as MessageKey)}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );

  let answer: ReactNode;
  let bar: ReactNode;
  if (st.s === 'write' || st.s === 'checking') {
    const busy = st.s === 'checking';
    answer = (
      <div className="flex flex-col gap-2">
        {later ? (
          <div className="lx-card p-4" data-testid="vm-use-saved">
            <p className="lx-t-label text-muted">{t(own ? 'vmUseYourSentence' : 'vmUseYourText')}</p>
            <p className="lx-t-body whitespace-pre-wrap" lang="en">
              {later.text}
            </p>
          </div>
        ) : (
          <SentenceInput mode="free" tall={!own} value={text} onChange={onType} onSubmit={check} testId="vm-use-input" placeholder={t(own ? 'vmUsePlaceholderOwn' : 'vmUsePlaceholder')} disabled={busy} />
        )}
        {st.s === 'write' && st.fail ? (
          <p className="lx-t-support text-wrong-text" role="alert" data-testid="vm-use-fail">
            {t(st.fail as MessageKey)}
          </p>
        ) : null}
      </div>
    );
    const ready = (later ? later.text : text).trim().length > 0;
    bar = (
      <>
        {later ? (
          <Button variant="secondary" size="lg" className="lx-actionbar-main" onClick={() => run.useDrop()} disabled={busy} data-testid="vm-use-drop">
            {t('vmUseDrop')}
          </Button>
        ) : (
          <MicButton onText={onDictate} disabled={busy} />
        )}
        <PrimaryAction onClick={check} disabled={!ready || busy} busy={busy} busyLabel={t('vmUseChecking')} testId="vm-use-check">
          {st.s === 'write' && st.fail ? t('vmUseRetry') : t('vmBtnCheck')}
        </PrimaryAction>
      </>
    );
  } else if (st.s === 'judged') {
    answer = <JudgedBody t={t} view={view} st={st} redo={redo} setRedo={setRedo} run={run} />;
    const redoOpen = redo !== null && st.redo === null;
    bar = (
      <>
        {st.redo === null ? (
          <Button
            variant="secondary"
            size="lg"
            className="lx-actionbar-main"
            onClick={() => (redoOpen ? run.useRedo(redo) : setRedo(view.text))}
            disabled={redoOpen && !redo.trim()}
            data-testid="vm-use-redo"
          >
            {redoOpen ? t('vmUseRedoDone') : t('vmUseRedo')}
          </Button>
        ) : null}
        <PrimaryAction onClick={next} iconAfter="arrowRight" testId="vm-use-next">
          {t('vmBtnNext')}
        </PrimaryAction>
      </>
    );
  } else {
    answer = <SelfBody t={t} view={view} later={st.later} run={run} />;
    bar = (
      <PrimaryAction onClick={next} iconAfter="arrowRight" testId="vm-use-next">
        {t('vmBtnNext')}
      </PrimaryAction>
    );
  }

  return (
    <ExerciseShell
      meta={{ ex: `vm:${m.form}`, id: `${view.task.path}:${view.n}`, kind: 'word' }}
      status={{ area: 'words', state: null, kindLabel }}
      task={{ text: taskText, purpose, open: true, reason: () => null }}
      prompt={
        <div className="flex flex-col gap-3">
          {situation}
          {chips}
        </div>
      }
      answer={answer}
      secondary={[]}
      primary={{ label: t('vmBtnCheck'), onClick: check, testId: 'vm-use-primary' }}
      barOverride={bar}
      keysHint={null}
    />
  );
}

function JudgedBody({ t, view, st, redo, setRedo, run }: { t: T; view: UseView; st: Judged; redo: string | null; setRedo: (v: string) => void; run: LearnRun }) {
  const { m } = view;
  const own = m.form === 'own';
  const open = new Set(st.open);
  // Falsch vor fast richtig (offen), dann der Rest in Reihenfolge der Ziele.
  const rows = [...st.rows].sort((a, b) => (open.has(a.key) ? st.open.indexOf(a.key) : 99) - (open.has(b.key) ? st.open.indexOf(b.key) : 99));
  const why = (r: UseRow) => r.why || t(r.v === 'thin' ? 'vmUseWhy_thin' : r.v === 'unused' ? 'vmUseWhy_unused' : 'vmUseWhy_ok');
  const up = st.rows.filter((r) => r.fx === 'up').map((r) => r.head);
  const soon = st.rows.filter((r) => r.fx === 'soon').map((r) => r.head);
  const none = st.rows.filter((r) => r.fx === 'none').map((r) => r.head);
  const evidence = m.evidence || !!view.later;
  const ev = own ? (st.rows[0] ?? null) : null;
  const redoOpen = redo !== null && st.redo === null;
  return (
    <div className="flex flex-col gap-4" data-testid="vm-use-judged">
      <div className="lx-card flex flex-col gap-1.5 p-4">
        <p className="lx-t-label text-muted">{t(own ? 'vmUseYourSentence' : 'vmUseYourText')}</p>
        <Marked text={view.text} rows={st.rows} targets={m.targets} testId="vm-use-text" />
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0" data-testid="vm-use-rows">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start gap-3" data-testid="vm-use-row" data-v={r.v}>
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface ${TONE[r.v].text}`} aria-hidden="true">
              <Icon name={TONE[r.v].icon} size={14} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="lx-t-body">
                <strong lang="en">{r.head}</strong> <span className={`lx-t-meta ${TONE[r.v].text}`}>· {t(`vmUseV_${r.v}` as MessageKey)}</span>
              </p>
              {open.has(r.key) || r.v === 'ok' || r.v === 'thin' || r.v === 'unused' ? (
                <p className="lx-t-support text-muted" data-testid="vm-use-why">
                  {why(r)}
                </p>
              ) : (
                <details>
                  <summary className="lx-t-support text-muted cursor-pointer">{t('vmUseShowWhy')}</summary>
                  <p className="lx-t-support text-muted" data-testid="vm-use-why">
                    {why(r)}
                  </p>
                </details>
              )}
            </div>
          </li>
        ))}
      </ul>
      {st.extra ? (
        <p className="lx-t-support" data-testid="vm-use-extra">
          <span className="text-subtle">{t('vmUseExtra')}: </span>
          <span lang="en" className="text-wrong-text line-through decoration-wrong">
            {st.extra.from}
          </span>{' '}
          → <strong lang="en">{st.extra.to}</strong>. {st.extra.why}
        </p>
      ) : null}
      {redoOpen ? (
        <div className="flex flex-col gap-1.5" data-testid="vm-use-redo-box">
          <p className="lx-t-support text-muted">{t('vmUseRedoHint')}</p>
          <SentenceInput mode="free" tall={!own} value={redo} onChange={setRedo} onSubmit={() => run.useRedo(redo)} testId="vm-use-redo-input" />
        </div>
      ) : null}
      {st.redo ? (
        <div className="lx-card flex flex-col gap-1 p-4" data-testid="vm-use-redo-text">
          <p className="lx-t-label text-muted">{t('vmUseRedoYours')}</p>
          <p className="lx-t-body whitespace-pre-wrap" lang="en">
            {st.redo}
          </p>
        </div>
      ) : null}
      {st.reveal ? (
        <div className="flex flex-col gap-3" data-testid="vm-use-better">
          {st.fixed ? (
            <div className="flex flex-col gap-1">
              <p className="lx-t-label text-muted">{t(st.fixedUnsure ? 'vmUseFixedUnsure' : 'vmUseFixed')}</p>
              <EnglishText as="p" text={st.fixed} area="trainer" source={view.task.path} testId="vm-use-fixed" />
            </div>
          ) : null}
          {st.better ? (
            <div className="flex flex-col gap-1">
              <p className="lx-t-label text-muted">{t('vmUseBetter')}</p>
              <EnglishText as="p" text={st.better} area="trainer" source={view.task.path} testId="vm-use-better-text" />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {!st.reveal && !redoOpen && (st.fixed || st.better) ? (
          <Button variant="quiet" onClick={() => run.useReveal()} data-testid="vm-use-reveal">
            {t('vmUseShowBetter')}
          </Button>
        ) : null}
        {st.recheck === 'can' && st.rows.some((r) => r.v !== 'ok') ? (
          <Button variant="quiet" onClick={() => run.useRecheck()} data-testid="vm-use-recheck">
            {t('vmBtnAlsoRight')}
          </Button>
        ) : null}
      </div>
      {st.recheck !== 'can' ? (
        <p className="lx-t-support text-muted" role="status" data-testid="vm-use-recheck-state">
          {t(st.recheck === 'busy' ? 'vmUseRecheckBusy' : st.recheck === 'done' ? 'vmUseRecheckDone' : 'vmUseRecheckFailed')}
        </p>
      ) : null}
      <p className="lx-t-meta text-muted flex items-start gap-2" data-testid="vm-use-fx">
        <Icon name="history" size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          {evidence ? (
            t('vmUseFxEvidence')
          ) : (
            <>
              {t('vmUseFxHead')}{' '}
              {[
                up.length ? <span key="up">{fxPart(t, up, up.length === 1 ? 'vmUseFxUp1' : 'vmUseFxUpN')}</span> : null,
                soon.length ? <span key="soon">{fxPart(t, soon, soon.length === 1 ? 'vmUseFxSoon1' : 'vmUseFxSoonN')}</span> : null,
                none.length ? <span key="none">{fxPart(t, none, 'vmUseFxNone')}</span> : null,
              ]
                .filter(Boolean)
                .map((n, i) => (
                  <span key={i}>
                    {i > 0 ? '; ' : ''}
                    {n}
                  </span>
                ))}
              .
            </>
          )}
        </span>
      </p>
      {ev && ev.ev !== null ? (
        <p className="lx-t-meta text-muted" data-testid="vm-use-ev">
          {ev.ev >= 2 ? t('vmUseEvDone') : `${t('vmUseEv', { n: ev.ev })} ${t('vmUseEvNext')}`}
        </p>
      ) : null}
    </div>
  );
}

/** „lead time und sign off on rücken weiter“: Wörter an der Stelle `{w}`. */
function fxPart(t: T, ws: readonly string[], k: MessageKey): ReactNode {
  const [a, b = ''] = t(k, { w: '\u0000' }).split('\u0000');
  return (
    <>
      {a}
      {wordList(t, ws)}
      {b}
    </>
  );
}

/** Ohne Claude (Bild s2-12): dein Text, das Muster je Wort (Beispielsätze mit markiertem Wort, Wortpartner), „Später prüfen lassen“. */
function SelfBody({ t, view, later, run }: { t: T; view: UseView; later: boolean; run: LearnRun }) {
  const { m } = view;
  const own = m.form === 'own';
  return (
    <div className="flex flex-col gap-4" data-testid="vm-use-self">
      <p className="lx-t-support text-muted" role="status" data-testid="vm-use-noai">
        {t(own ? 'vmUseNoAiOwn' : 'vmUseNoAi')}
      </p>
      <div className="lx-card flex flex-col gap-1.5 p-4">
        <p className="lx-t-label text-muted">{t(own ? 'vmUseYourSentence' : 'vmUseYourText')}</p>
        <p className="lx-t-body whitespace-pre-wrap" lang="en" data-testid="vm-use-text">
          {view.text}
        </p>
      </div>
      <div className="flex flex-col gap-3" data-testid="vm-use-model">
        <p className="lx-t-label text-muted">{t(own ? 'vmUseModelOwn' : 'vmUseModel')}</p>
        {m.targets.map((tg) => (
          <div key={tg.key} className="flex flex-col gap-1">
            <p className="lx-t-body">
              <strong lang="en">{tg.head}</strong>
              {tg.de ? (
                <span className="text-muted" lang="de">
                  {' '}
                  · {tg.de}
                </span>
              ) : null}
            </p>
            {tg.shows.map((s, i) => (
              <EnglishText key={i} as="p" className="lx-t-support" text={s.text} area="trainer" source={tg.path} title={tg.head} highlight={s.end > s.start ? [s.start, s.end] : null} />
            ))}
            {tg.partners.length ? (
              <p className="lx-t-meta text-muted">
                <span className="text-subtle">{t('vmPartners')}: </span>
                <span lang="en">{tg.partners.join(' · ')}</span>
              </p>
            ) : null}
          </div>
        ))}
      </div>
      {view.later ? null : later ? (
        <div className="flex flex-col items-start gap-2" data-testid="vm-use-later-on">
          <p className="lx-t-support text-muted">{t('vmUseLaterOn')}</p>
          <Button variant="ghost" onClick={() => run.useLater(false)} data-testid="vm-use-later-undo">
            {t('vmBtnUndo')}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => run.useLater(true)} data-testid="vm-use-later">
          {t('vmBtnLater')}
        </Button>
      )}
    </div>
  );
}
