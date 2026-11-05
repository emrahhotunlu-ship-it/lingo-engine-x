import { useId, useState, type ReactNode, type Ref } from 'react';
import { AiMark, Button, Icon, retireRepairs, useT, type MessageKey } from '../sharedUi';
import { errorEdits, RULE_ID } from '../shared';
import type { Edit, GreetCheck, PointCheck } from '../shared';
import { selfFixOk, errorsOf, praiseOf, repairsOf, wordUses, type ApplyRun, type WordUse } from '../domain/result';
import { lengthState, type LengthGoal } from '../domain/kinds';
import type { SaveResult } from './save';
import type { Rule, Targets } from './hooks';

// Ergebnis einer Prüfung (F3). Feste Reihenfolge (Nachtrag learning-scientist Muss 2, ui-standard §4): Zusammenfassung: Kernpunkte → richtig wiedergegeben →
// eigene Worte → Länge → Fehlerstellen; Antwort: Pflichtpunkte → Ton → Länge → Fehlerstellen; Mail schreiben: Gesamturteil und Ton → Länge → Fehlerstellen.
// Jede Fehlerstelle: deins → richtig → warum (ein Satz). Ohne Fehler „Das sitzt“ mit Zitat und Grund (Muss 5, nie Claudes Gesamturteil als Grund). Danach
// Lernwörter, bessere Fassung, Folgen. Ein Punkt „teilweise“/„fehlt“ trägt sein Warum (Prüfbefund T2).
// Farbe nie allein: ✓/✕ steht immer mit Wort.
// W5: Anrede und Gruß stehen beim Ton (K7); „So klingt es gehobener“ (K1) kommt NACH den Fehlerstellen und „Das sitzt“, als eigener Block ohne Durchstreichen
// (ein Vorschlag, kein Fehler); die Starthilfe (K9) ist unten vermerkt.

const TONE_KEY: Record<string, MessageKey> = { fits: 'axToneFits', 'too-direct': 'axToneDirect', 'too-informal': 'axToneInformal', 'too-stiff': 'axToneStiff' };
const GREET_KEY: Record<GreetCheck['fit'], MessageKey> = { fits: 'axGreetFits', off: 'axGreetOff', missing: 'axGreetMissing' };
const COVER_KEY: Record<PointCheck['covered'], MessageKey> = { yes: 'axCovYes', partly: 'axCovPartly', no: 'axCovNo' };
const KIND_KEY: Record<Edit['kind'], MessageKey> = {
  grammar: 'axKind_grammar',
  word: 'axKind_word',
  collocation: 'axKind_collocation',
  spelling: 'axKind_spelling',
  punctuation: 'axKind_punctuation',
  register: 'axKind_register',
};
export const kindLabel = (k: Edit['kind']): MessageKey => KIND_KEY[k];

export type SelfState = { spots: Edit[]; fixes: string[] } | null;

type Props = {
  run: ApplyRun;
  save: SaveResult | null;
  targets: Targets;
  /** Beschriftung je Punkt (Pflichtpunkt in der Oberflächensprache bzw. Kernpunkt auf Englisch). */
  pointLabels: readonly string[];
  goal: LengthGoal;
  self: SelfState;
  checksLeft: number;
  tpl: string;
  onRevise: () => void;
  onDone: () => void;
  /** Überschrift (nur für Screenreader) – nach dem Prüfen springt der Fokus hierher, ohne die Tastatur zu öffnen. */
  headRef?: Ref<HTMLHeadingElement>;
};

function Mark({ ok, partly }: { ok: boolean; partly?: boolean }) {
  return (
    <span className={`flex size-6 flex-none items-center justify-center rounded-full ${ok ? 'bg-ok-soft text-ok-text' : partly ? 'bg-surface-strong text-muted' : 'bg-wrong-soft text-wrong-text'}`} aria-hidden="true">
      <Icon name={ok ? 'check' : partly ? 'minus' : 'close'} size={14} />
    </span>
  );
}

function Block({ title, testId, children, data }: { title: string; testId: string; children: ReactNode; data?: Record<`data-${string}`, string | number> }) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId} {...data}>
      <h3 className="lx-ax-small m-0 text-subtle">{title}</h3>
      {children}
    </section>
  );
}

const ruleState = (rule: Rule | null, run: ApplyRun): WordUse['state'] | null => {
  if (!rule) return null;
  const hit = run.feedback.used.find((u) => u.pat === (rule.patId ?? RULE_ID));
  return hit ? (hit.ok ? 'ok' : 'bad') : 'none';
};

export function ApplyResult({ run, save, targets, pointLabels, goal, self, checksLeft, tpl, onRevise, onDone, headRef }: Props) {
  const { t, lang } = useT();
  const [reported, setReported] = useState(false);
  const f = run.feedback;
  const errs = errorEdits(f.edits);
  const errors = errorsOf(f);
  const len = lengthState(run.text, goal);
  const uses = wordUses(targets.words, f, run.text);
  const rs = ruleState(targets.rule, run);
  // L7: „Das sitzt“ und „Keine Fehler gefunden“ hängen an der belegten Fehlerliste, wie `ok` im gespeicherten Eintrag.
  const praise = errs.length === 0 ? praiseOf(f) : null;
  const sentGoal = goal.sentences ? (goal.sentences[0] === goal.sentences[1] ? String(goal.sentences[0]) : `${goal.sentences[0]}–${goal.sentences[1]}`) : '';
  const useKey: Record<WordUse['state'], MessageKey> = { ok: 'axWordOk', bad: 'axWordBad', none: 'axWordNone', open: 'axWordOpen' };
  const wordsOk = len.words >= goal.words[0] && len.words <= goal.words[1];
  const sentState: 'ok' | 'short' | 'long' = !goal.sentences ? 'ok' : len.sentences < goal.sentences[0] ? 'short' : len.sentences > goal.sentences[1] ? 'long' : 'ok';
  const praiseItem = praise?.by === 'used' ? (praise.item === RULE_ID ? (targets.rule?.label ?? '') : praise.item) : '';

  const points = f.points && (
    <Block title={t(run.kind === 'summary' ? 'axPointsSummary' : 'axPointsReply')} testId="ax-points">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {f.points.map((p, k) => (
          <li key={p.i} className="flex items-start gap-2" data-testid={`ax-point-${p.i}`} data-covered={p.covered}>
            <Mark ok={p.covered === 'yes'} partly={p.covered === 'partly'} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="lx-ax-text" lang={run.kind === 'summary' ? 'en' : lang}>
                {pointLabels[k] ?? `#${p.i}`} <span className="text-muted">· {t(COVER_KEY[p.covered])}</span>
              </span>
              {p.quote && (
                <span className="lx-ax-hint text-muted [overflow-wrap:anywhere]" lang="en">
                  {t('axQuote', { s: p.quote })}
                </span>
              )}
              {f.doubted?.includes(p.i) && (
                <span className="lx-ax-hint" lang={lang} data-testid={`ax-point-doubt-${p.i}`}>
                  <span className="text-muted">{t('axWhyLabel')}: </span>
                  {t('axCovDoubt')}
                </span>
              )}
              {p.covered !== 'yes' && p.why && (
                <span className="lx-ax-hint" lang={lang} data-testid={`ax-point-why-${p.i}`}>
                  <span className="text-muted">{t('axWhyLabel')}: </span>
                  {p.why}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Block>
  );

  const faithful = f.faithful && (
    <Block title={t('axFaithful')} testId="ax-faithful" data={{ 'data-ok': String(f.faithful.ok) }}>
      <p className="lx-ax-text m-0 flex items-start gap-2">
        <Mark ok={f.faithful.ok} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span>{f.faithful.ok ? t('axFaithOk') : t('axFaithBad')}</span>
          {!f.faithful.ok && f.faithful.quote && (
            <span className="lx-ax-hint [overflow-wrap:anywhere]" lang="en">
              {t('axQuote', { s: f.faithful.quote })}
            </span>
          )}
          {f.faithful.why && (
            <span className="lx-ax-hint text-muted" lang={lang}>
              {f.faithful.why}
            </span>
          )}
        </span>
      </p>
    </Block>
  );

  const own = run.copy && (
    <Block title={t('axOwn')} testId="ax-own" data={{ 'data-hint': String(run.copy.hint), 'data-ratio': Math.round(run.copy.ratio * 100) }}>
      <p className="lx-ax-text m-0 flex items-start gap-2">
        <Mark ok={!run.copy.hint} />
        <span>{run.copy.hint ? t('axOwnBad', { p: Math.round(run.copy.ratio * 100) }) : t('axOwnOk')}</span>
      </p>
      {run.copy.runs.length > 0 && (
        <p className="lx-ax-hint m-0 whitespace-pre-wrap text-muted [overflow-wrap:anywhere]" lang="en" data-testid="ax-own-text">
          {segments(run.text, run.copy.runs)}
        </p>
      )}
      {run.peeked && <p className="lx-ax-hint m-0 text-subtle" data-testid="ax-peeked">{t('axPeeked')}</p>}
    </Block>
  );

  const greet = f.greet && (
    <p className="lx-ax-text m-0 flex items-start gap-2" data-testid="ax-greet" data-fit={f.greet.fit}>
      <Mark ok={f.greet.fit === 'fits'} partly={f.greet.fit === 'off'} />
      <span>
        {t('axGreetLabel')} · {t(GREET_KEY[f.greet.fit])}
        {f.greet.why ? (
          <span className="text-muted" lang={lang}>
            {' '}
            · {f.greet.why}
          </span>
        ) : null}
      </span>
    </p>
  );

  const tone = f.tone && (
    <Block title={t('axTone')} testId="ax-tone" data={{ 'data-fit': f.tone.fit }}>
      <p className="lx-ax-text m-0 flex items-start gap-2">
        <Mark ok={f.tone.fit === 'fits'} />
        <span>
          {t(TONE_KEY[f.tone.fit] ?? 'axToneFits')}
          {f.tone.why ? <span className="text-muted"> · {f.tone.why}</span> : null}
        </span>
      </p>
      {greet}
    </Block>
  );

  const style = f.style.length > 0 && (
    <Block title={t('axStyle')} testId="ax-style" data={{ 'data-n': f.style.length }}>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {f.style.map((x, k) => (
          <li key={`${x.from}-${k}`} className="lx-card flex flex-col gap-1 p-3" data-testid={`ax-style-${k}`}>
            <span className="lx-ax-text [overflow-wrap:anywhere]" lang="en">
              <span className="text-muted">{t('axYours')}: </span>
              {x.from}
            </span>
            <span className="lx-ax-text [overflow-wrap:anywhere]" lang="en">
              <span className="text-muted">{t('axStyleBetter')}: </span>
              <strong>{x.to}</strong>
            </span>
            <span className="lx-ax-hint" lang={lang}>
              <span className="text-muted">{t('axWhyLabel')}: </span>
              {x.why}
            </span>
          </li>
        ))}
      </ol>
    </Block>
  );

  const length = (
    <Block title={t('axLength')} testId="ax-length" data={{ 'data-state': len.state, 'data-words': len.words }}>
      <p className="lx-ax-text m-0 flex items-start gap-2">
        <Mark ok={len.state === 'ok'} partly={len.state !== 'ok'} />
        <span>
          {/* T6: Wörter zuerst; passen sie, aber die Sätze nicht, sagt der Satz genau das (nie „passt“ neben einem gelben Zeichen). */}
          {!wordsOk ? (
            <>
              {t(len.words < goal.words[0] ? 'axLenShort' : 'axLenLong', { n: len.words, min: goal.words[0], max: goal.words[1] })}
              {goal.sentences ? <span className="text-muted"> · {t('axLenSent', { n: len.sentences, goal: sentGoal })}</span> : null}
            </>
          ) : sentState !== 'ok' ? (
            t(sentState === 'short' ? 'axLenSentShort' : 'axLenSentLong', { n: len.sentences, goal: sentGoal })
          ) : (
            <>
              {t('axLenOk', { n: len.words })}
              {goal.sentences ? <span className="text-muted"> · {t('axLenSent', { n: len.sentences, goal: sentGoal })}</span> : null}
            </>
          )}
        </span>
      </p>
    </Block>
  );

  const spots = (
    <Block title={t('axSpots')} testId="ax-spots" data={{ 'data-errors': errors }}>
      {errs.length === 0 ? (
        <p className="lx-ax-text m-0" data-testid="ax-nospots">
          {t('axNoSpots')}
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {errs.map((e, k) => {
            const si = self ? self.spots.indexOf(e) : -1;
            const tried = si >= 0 ? (self?.fixes[si] ?? '') : '';
            const fixed = si >= 0 && selfFixOk(tried, e);
            return (
              <li key={`${e.from}-${k}`} className="lx-card flex flex-col gap-1 p-3" data-testid={`ax-spot-${k}`} data-self={si >= 0 ? (fixed ? 'ok' : 'tried') : 'none'} data-kind={e.kind}>
                <span className="lx-ax-small text-subtle">{t(KIND_KEY[e.kind])}</span>
                <span className="lx-ax-text [overflow-wrap:anywhere]" lang="en">
                  <span className="text-muted">{t('axYours')}: </span>
                  <s className="text-wrong-text">{e.from}</s>
                </span>
                <span className="lx-ax-text [overflow-wrap:anywhere]" lang="en">
                  <span className="text-muted">{t('axRight')}: </span>
                  <strong className="text-ok-text">{e.to}</strong>
                </span>
                <span className="lx-ax-hint" lang={lang}>
                  <span className="text-muted">{t('axWhyLabel')}: </span>
                  {e.why}
                </span>
                {si >= 0 && (
                  <span className="lx-ax-hint text-muted" data-testid={`ax-spot-self-${k}`}>
                    {fixed ? `✓ ${t('axSelfOk')}` : tried.trim() && tried.trim() !== e.from ? t('axSelfTried', { s: tried.trim() }) : null}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Block>
  );

  const sits = praise && (praise.by !== 'used' || praiseItem) && (
    <section className="lx-card flex flex-col gap-1 p-4" data-testid="ax-sits" data-by={praise.by}>
      <h3 className="lx-ax-task m-0">{t('axSits')}</h3>
      {praise.by !== 'tone' && (
        <p className="lx-ax-text m-0 [overflow-wrap:anywhere]" lang="en">
          {t('axQuote', { s: praise.quote })}
        </p>
      )}
      <p className="lx-ax-hint m-0 text-muted" lang={lang}>
        {praise.by === 'used' ? t('axSitsUsed', { item: praiseItem }) : praise.why}
      </p>
    </section>
  );

  const first = run.kind === 'write' ? (
    <Block title={t('axTone')} testId="ax-gist">
      <p className="lx-ax-text m-0" lang={lang}>
        {f.gist}
      </p>
      {f.tone && (
        <p className="lx-ax-hint m-0 text-muted" data-testid="ax-tone" data-fit={f.tone.fit}>
          {t(TONE_KEY[f.tone.fit] ?? 'axToneFits')}
          {f.tone.why ? ` · ${f.tone.why}` : ''}
        </p>
      )}
      {greet}
    </Block>
  ) : null;

  const order: ReactNode[] =
    run.kind === 'summary' ? [points, faithful, own, length, spots] : run.kind === 'reply' ? [points, tone, length, spots] : [first, length, spots];

  return (
    <div className="flex scroll-mt-28 flex-col gap-6" data-testid="ax-result" data-kind={run.kind} data-errors={errors} data-check={run.check}>
      <h2 ref={headRef} tabIndex={-1} className="sr-only" data-testid="ax-result-head">
        {t('axResultTitle')}
      </h2>
      {order.map((node, k) => (node ? <div key={k}>{node}</div> : null))}
      {sits}
      {style}
      {(uses.length > 0 || rs) && (
        <Block title={t('axWords')} testId="ax-words">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {uses.map((u, k) => (
              <li key={u.word} className="lx-ax-text flex items-center gap-2" data-testid={`ax-word-${k}`} data-state={u.state}>
                <Mark ok={u.state === 'ok'} partly={u.state === 'none' || u.state === 'open'} />
                <span lang="en" className="font-semibold">
                  {u.word}
                </span>
                <span className="text-muted">· {t(useKey[u.state])}</span>
              </li>
            ))}
            {targets.rule && rs && (
              <li className="lx-ax-text flex items-center gap-2" data-testid="ax-rule-state" data-state={rs}>
                <Mark ok={rs === 'ok'} partly={rs === 'none'} />
                <span className="font-semibold">{t('axRule', { name: targets.rule.label })}</span>
                <span className="text-muted">· {t(useKey[rs])}</span>
              </li>
            )}
          </ul>
        </Block>
      )}
      {/* „Melden“ gehört zur Fassung von Claude: nur mit aufgeklapptem Inhalt (UX-Befund 8). */}
      <Fold label={t('axBetter')} testId="ax-better">
        <p className="lx-ax-text m-0 whitespace-pre-wrap" lang="en" data-testid="ax-better-text">
          {f.upgraded}
        </p>
        <AiMark
          variant="edit"
          tpl={tpl}
          id={`${run.id}:${run.check}`}
          onReport={() => {
            if (reported) return;
            setReported(true);
            const wrongs = repairsOf(run).map((r) => r.wrong);
            if (wrongs.length) void retireRepairs(wrongs, 'write');
          }}
          data-testid="ax-mark"
        />
      </Fold>
      <div className="flex flex-col gap-1" aria-live="polite">
        {save && save.repairs > 0 && !reported && (
          <p className="lx-ax-hint m-0 text-muted" data-testid="ax-repairs">
            {t(save.repairs === 1 ? 'axRepairs_one' : 'axRepairs_other', { n: save.repairs })}
          </p>
        )}
        {run.helped && (
          <p className="lx-ax-hint m-0 text-subtle" data-testid="ax-helped">
            {t('axHelped')}
          </p>
        )}
        {run.pasted && (
          <p className="lx-ax-hint m-0 text-subtle" data-testid="ax-notcounted">
            {t('axNotCounted')}
          </p>
        )}
        {save && (!save.out || !save.repairsOk) && (
          <p className="lx-ax-hint m-0 text-muted" role="alert" data-testid="ax-savefail">
            {t('axSaveFail')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="lg" onClick={onDone} data-testid="ax-done">
          {t('axDone')}
        </Button>
        {checksLeft > 0 && (
          <Button variant="secondary" onClick={onRevise} data-testid="ax-revise">
            {t('axRevise')}
          </Button>
        )}
        {checksLeft > 0 && (
          <span className="lx-ax-small text-subtle" data-testid="ax-left">
            {t(checksLeft === 1 ? 'axChecksLeft_one' : 'axChecksLeft_other', { n: checksLeft })}
          </span>
        )}
      </div>
    </div>
  );
}

/** Aufklappbarer Abschnitt in den Rollen des Moduls (Beschriftung in Text-Größe, ≥ 44 px Tippfläche); Inhalt nur aufgeklappt im Baum. */
export function Fold({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-2" data-open={String(open)}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} data-testid={testId} className="lx-ax-text inline-flex min-h-11 items-center gap-2 self-start rounded-lg font-semibold text-muted transition-colors hover:text-fg">
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={18} />
        {label}
      </button>
      {open && (
        <div id={id} className="flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  );
}

/** Text mit markierten Übernahmen aus dem Artikel. */
function segments(text: string, runs: ReadonlyArray<{ start: number; end: number }>): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  runs.forEach((r, k) => {
    if (r.start > at) out.push(text.slice(at, r.start));
    out.push(
      <mark key={k} className="rounded bg-accent-soft px-0.5 text-fg" data-testid="ax-copy-run">
        {text.slice(r.start, r.end)}
      </mark>,
    );
    at = r.end;
  });
  if (at < text.length) out.push(text.slice(at));
  return out;
}
