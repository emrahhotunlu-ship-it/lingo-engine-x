import { useNav } from '../../../app/nav';
import { C1_GUIDE, filledSentence, rightFill, type CheckLine, type CheckTally } from '../../../domain/c1/check/score';
import { CHECK_PARTS } from '../../../domain/c1/check/select';
import type { C1Check } from '../../../domain/c1/c1doc';
import type { C1Input, C1Kind } from '../../../domain/c1x/types';
import { patternById } from '../../../domain/grammar/patterns';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useT, type MessageKey } from '../../../i18n';
import { ActionBar, PrimaryAction } from '../../../ui/ActionBar';
import { Button } from '../../../ui/Button';
import { toast } from '../../../ui/Toast';
import { startGrammar, useGrammarSession } from '../../grammar/session';
import { useC1CheckSheet } from './store';

// Ergebnis des C1-Checks (Lernplattform 3.0 §4.3, P40): „27 von 36“ mit Spanne und Richtwert-Satz („nicht geeicht“), je Teil „5 von 8“, Verlauf erst ab
// 3 Checks, die zwei schwächsten Muster mit „Üben“, die Zahl der Fehlersätze und danach jede Aufgabe mit Lösung und freiwilligem „Warum?“.
// Kein Urteil in Prozent, kein „bestanden“: der Check misst nur.

export type CheckResultData = { tally: CheckTally; inp: C1Input; form: string; repairs: number };
type SaveState = 'saving' | 'saved' | 'failed';
type SaveWhy = 'rejected' | 'blocked';

const PART_KEY: Record<string, MessageKey> = { mcc: 'pxCkPart_mcc', ocl: 'pxCkPart_ocl', wf: 'pxCkPart_wf', kwt: 'pxCkPart_kwt' };
const LEX_KEY: Record<string, MessageKey> = {
  'lx.colloc': 'pxCkPat_colloc',
  'lx.wf-noun': 'pxCkPat_wfNoun',
  'lx.wf-adj': 'pxCkPat_wfAdj',
  'lx.wf-adv': 'pxCkPat_wfAdv',
  'lx.wf-verb': 'pxCkPat_wfVerb',
  'lx.wf-neg': 'pxCkPat_wfNeg',
};

/** Name einer Mustergruppe (Grammatik: Mustername; Wortschatz: Gruppe). */
export function groupName(g: string, lang: 'de' | 'en', t: (k: MessageKey) => string): string {
  const lex = LEX_KEY[g];
  if (lex) return t(lex);
  if (g.startsWith('lx.wf')) return t('pxCkPat_wf');
  const p = patternById(g);
  return p ? p.name[lang] : g;
}

const dateText = (d: string, lang: 'de' | 'en'): string =>
  new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

function Review({ line, n }: { line: CheckLine; n: number }) {
  const { t, lang } = useT();
  const fill = rightFill(line.item) ?? '';
  const right = filledSentence(line.item, fill) ?? fill;
  const full = line.score.got >= line.score.max && line.score.max > 0;
  const rule = line.rule ? (lang === 'de' ? line.rule.de : line.rule.en) : null;
  return (
    <li className="lx-inset flex flex-col gap-1.5" data-testid="ck-review" data-id={line.item.id} data-full={full ? 'true' : 'false'}>
      <p className="lx-t-meta lx-tnum text-muted">
        {n}. {t(PART_KEY[line.item.kind] ?? 'pxCkPart_mcc')} · {t('pxCkResPoints', { a: Math.min(line.score.got, line.score.max), b: line.score.max })}
      </p>
      <p lang="en">{right}</p>
      <p className="text-sm text-muted">
        {t('pxCkResYours', { a: line.given.trim() ? line.given.trim() : t('pxCkResNoAnswer') })}
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted" data-testid="ck-why">
          {t('pxCkResWhy')}
        </summary>
        <p className="mt-1.5 leading-relaxed">{line.item.why.ok[lang]}</p>
        {rule && <p className="mt-1 leading-relaxed text-muted">{rule}</p>}
      </details>
    </li>
  );
}

export function CheckResult({ data, history, saveState, saveWhy = null, onRetrySave, onClose }: { data: CheckResultData; history: readonly C1Check[]; saveState: SaveState; saveWhy?: SaveWhy | null; onRetrySave: () => void; onClose: () => void }) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const { tally } = data;
  const guide = Math.round(C1_GUIDE * tally.max);

  const practice = (g: string): void => {
    const pat = patternById(g);
    const kind: C1Kind | null = g === 'lx.colloc' ? 'mcc' : g.startsWith('lx.wf') ? 'wf' : null;
    const first = pat ? startGrammar({ mode: 'topic', topic: pat.topic, pat: pat.id }) : kind ? startGrammar({ mode: 'xtra', kind }) : null;
    if (first === null || !useGrammarSession.getState().tasks.length) {
      toast(t('pxCkPracticeEmpty'));
      return;
    }
    if (first === 'typed') api.focusNow();
    else api.blur();
    useC1CheckSheet.getState().close();
    if (pat) go({ name: 'grammarSession', mode: 'topic', topic: pat.topic });
    else go({ name: 'grammarSession', mode: 'xtra' });
  };

  return (
    <section className="flex flex-col gap-4" data-testid="ck-result" aria-labelledby="px-ck-res" data-pts={tally.pts}>
      <div className="flex flex-col gap-1">
        <h2 id="px-ck-res" className="lx-t-answer lx-tnum tracking-tight" data-testid="ck-res-total">
          {t('pxCkResTitle', { a: tally.pts, b: tally.max })}
        </h2>
        <p className="lx-tnum text-muted" data-testid="ck-res-range">
          {t('pxCkResRange', { lo: tally.range[0], hi: tally.range[1] })}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-muted" data-testid="ck-res-guide">
        {t('pxCkResGuide', { n: guide })}
      </p>
      {data.inp === 'touch' && (
        <p className="text-sm text-muted" data-testid="ck-res-touch">
          {t('pxCkResTouch')}
        </p>
      )}

      <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="ck-res-parts">
        {CHECK_PARTS.map((k, i) => (
          <li key={k} className="lx-inset lx-tnum" data-testid={`ck-res-part-${k}`}>
            {t('pxCkResPart', { name: t(PART_KEY[k] ?? 'pxCkPart_mcc'), a: tally.p[i] ?? 0, b: tally.pMax[i] ?? 0 })}
          </li>
        ))}
      </ul>

      {history.length >= 3 && (
        <div className="flex flex-col gap-1.5" data-testid="ck-res-history">
          <h3 className="lx-eyebrow">{t('pxCkResHistory')}</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {history.map((c) => (
              <li key={`${c.d}-${c.f}-${c.inp}`} className="lx-tnum">
                {t('pxCkResHistoryLine', { d: dateText(c.d, lang), a: c.pts, b: c.max })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2" data-testid="ck-res-weak">
        <h3 className="lx-eyebrow">{t('pxCkResWeak')}</h3>
        {tally.weak.length === 0 ? (
          <p className="text-sm text-muted">{t('pxCkResWeakNone')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {tally.weak.map(([g, lost]) => (
              <li key={g} className="lx-inset flex items-center justify-between gap-3" data-testid="ck-weak" data-pat={g}>
                <span className="flex flex-col">
                  <span>{groupName(g, lang, t)}</span>
                  <span className="text-xs text-muted">{lost === 1 ? t('pxCkResWeakLost1') : t('pxCkResWeakLost', { n: lost })}</span>
                </span>
                <Button variant="secondary" onClick={() => practice(g)} data-testid="ck-practice">
                  {t('pxCkPractice')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.repairs > 0 && (
        <p className="text-sm text-muted" data-testid="ck-res-repairs">
          {data.repairs === 1 ? t('pxCkResRepairs1') : t('pxCkResRepairs', { n: data.repairs })}
        </p>
      )}

      <p className="text-sm text-muted" role="status" data-testid="ck-save" data-state={saveState} data-why={saveWhy ?? undefined}>
        {saveState === 'saving'
          ? t('pxCkSaving')
          : saveState === 'saved'
            ? t('pxCkSaved')
            : saveWhy === 'rejected'
              ? t('pxCkSaveRejected')
              : saveWhy === 'blocked'
                ? t('pxCkSaveBlocked')
                : t('pxCkSaveFailed')}
      </p>
      {saveState === 'failed' && saveWhy !== 'rejected' && (
        <div>
          <Button variant="secondary" onClick={onRetrySave} data-testid="ck-save-retry">
            {t('pxCkSaveRetry')}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="lx-eyebrow">{t('pxCkResReview')}</h3>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {tally.lines.map((l, i) => (
            <Review key={l.item.id} line={l} n={i + 1} />
          ))}
        </ol>
      </div>

      <ActionBar placement="column" stateKey="ck-result">
        <PrimaryAction onClick={onClose} testId="ck-done">
          {t('pxCkDone')}
        </PrimaryAction>
      </ActionBar>
    </section>
  );
}
