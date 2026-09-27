import { useEffect, useMemo, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useSettings } from '../../app/settings';
import type { InputRoute } from '../../app/nav';
import { processErrors } from '../../domain/input/review';
import { feedbackFits } from '../../domain/input/feedbackLang';
import { wordCount } from '../../domain/input/textStats';
import type { ArticleItem } from '../../domain/input/types';
import { EnglishText } from '../../engine/EnglishText';
import { MarkedText } from '../../engine/MarkedText';
import { useT } from '../../i18n';
import { readingCheck } from '../../prompts/readingCheck';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { AiRunPanel } from '../input/AiRunPanel';
import { markTaskSeen, startAiTask, stopAiTask, useAiTasks } from '../input/aiTasks';
import { addRadar, saveReadingSummary } from '../input/complete';
import { clearDraft, loadDraft } from '../input/draft';
import { DraftArea } from '../input/DraftArea';
import { useInputLibrary } from '../input/library';

// Anwenden beim Lesen (Plan §4.1 Nr. 5, F17): Zusammenfassung in 2–4 Sätzen, freiwillig.
// „Prüfen lassen" läuft als App-Aufgabe weiter, auch wenn Emrah den Bildschirm wechselt (M14).
// Ohne KI wird gespeichert und die Kernaussagen erscheinen zum Vergleich – ohne Urteil.

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

type Props = { readingId: string; item: ArticleItem; route: InputRoute; onSkip?: (() => void) | undefined; onSaved: () => void };

export function SummaryStep({ readingId, item, route, onSkip, onSaved }: Props) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const doc = useInputLibrary((s) => s.docs.reading.get(readingId));
  const task = useAiTasks((s) => s.tasks[`read:${readingId}`]);
  const saved = str(doc?.summary).trim();
  const [text, setText] = useState(() => saved || loadDraft(`read:${readingId}`));
  const [busy, setBusy] = useState(false);
  const words = wordCount(text);
  const canSend = words >= 12;

  useEffect(() => {
    if (task && task.status !== 'running') markTaskSeen(task.key);
  }, [task]);

  const runCheck = (summary: string) => {
    const uiLang = useSettings.getState().lang;
    void startAiTask({
      key: `read:${readingId}`,
      kind: 'read',
      route,
      template: readingCheck,
      vars: { title: item.title, text: item.text, keypoints: item.keypoints, summary, uiLang },
      save: async (data) => {
        await saveReadingSummary(readingId, summary, wordCount(summary), { ...data, lang: uiLang, pv: 'reading-check@1' });
        // Britische Formen sind nie ein Fehler (F11) und kommen nie ins Radar.
        await addRadar(processErrors(data.language.errors, summary).errors, summary, 'r');
      },
    });
  };

  const submit = async (check: boolean) => {
    setBusy(true);
    try {
      // Erst den Text sichern – er geht nie verloren, auch wenn die Prüfung scheitert.
      await saveReadingSummary(readingId, text.trim(), words, null);
      clearDraft(`read:${readingId}`);
      if (check && ai) runCheck(text.trim());
      else toast(t('rdSummarySaved'));
      onSaved();
    } catch {
      toast(t('inSaveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const res = obj(doc?.res);
  const hasRes = !!doc?.res && typeof res.score === 'number';

  if (!saved) {
    return (
      <section className="flex flex-col gap-3" data-testid="summary-step">
        <h3 className="text-base font-semibold">{t('rdSummaryTask')}</h3>
        <p className="text-xs text-subtle">{t('rdSummaryHint')}</p>
        <DraftArea value={text} onChange={setText} label={t('rdSummaryOf')} draftKey={`read:${readingId}`} rows={5} testId="summary-draft" />
        <div className="flex flex-wrap gap-2">
          {ai ? (
            <Button variant="primary" onClick={() => void submit(true)} disabled={!canSend} busy={busy} data-testid="summary-check" data-ai="">
              {t('rdCheck')}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void submit(false)} disabled={!canSend} busy={busy} data-testid="summary-save">
              {t('rdSaveSummary')}
            </Button>
          )}
          {onSkip && (
            <Button variant="ghost" onClick={onSkip} data-testid="summary-skip">
              {t('rdSkip')}
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4" data-testid="summary-result">
      <div className="flex flex-col gap-1">
        <p className="lx-eyebrow">{t('rdSummaryOf')}</p>
        {hasRes ? (
          <ReviewedSummary summary={saved} res={res} total={item.keypoints.length} item={item} onRecheck={ai ? () => runCheck(saved) : null} uiLang={lang} />
        ) : (
          <EnglishText text={saved} area="read" source={item.ref} title={item.title} className="text-base" />
        )}
      </div>
      {task?.status === 'running' && <AiRunPanel phase={task.phase} error={null} onStop={() => stopAiTask(task.key)} note={t('inAiBackground')} />}
      {task?.status === 'error' && <AiRunPanel phase="error" error={task.error} onRetry={() => runCheck(saved)} />}
      {!hasRes && task?.status !== 'running' && (
        <>
          {!ai && <p className="text-sm text-muted">{t('inSavedNoCheck')}</p>}
          {ai && task?.status !== 'error' && (
            <div>
              <Button onClick={() => runCheck(saved)} data-testid="summary-check" data-ai="">
                {t('rdCheck')}
              </Button>
            </div>
          )}
          {item.keypoints.length > 0 && (
            <div className="flex flex-col gap-1" data-testid="keypoints">
              <p className="lx-eyebrow">{t('rdCompare')}</p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {item.keypoints.map((k) => (
                  <li key={k}>
                    <EnglishText text={k} area="read" source={item.ref} title={item.title} as="span" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ReviewedSummary({ summary, res, total, item, onRecheck, uiLang }: { summary: string; res: Doc; total: number; item: ArticleItem; onRecheck: (() => void) | null; uiLang: 'de' | 'en' }) {
  const { t } = useT();
  const [active, setActive] = useState<number | null>(null);
  const covered = strList(res.covered);
  const language = obj(res.language);
  const { errors, usHints } = useMemo(
    () =>
      processErrors(
        (Array.isArray(language.errors) ? language.errors : []).map((e) => {
          const o = obj(e);
          return { orig: str(o.orig), fix: str(o.fix), why: str(o.why), cat: str(o.cat) };
        }),
        summary,
      ),
    [language.errors, summary],
  );
  const spans = errors.map((e) => e.span);
  const tips = strList(language.tips);
  const feedback = str(res.feedback);
  const fits = feedbackFits(res.lang, [feedback, ...tips, ...errors.map((e) => e.why)], uiLang);
  const other = uiLang === 'de' ? 'en' : 'de';
  const n = Math.min(covered.length, total || covered.length);
  const activeErr = active !== null ? errors[active] : undefined;

  return (
    <div className="flex flex-col gap-3" data-testid="reading-review">
      <p className="text-base font-semibold" data-testid="covered">
        {total ? t('rdCovered', { n, total }) : t('inDots', { n: Math.round(Number(res.score) || 0) })}
      </p>
      <MarkedText
        text={summary}
        marks={spans.flatMap((s, i) => (s ? [{ i, span: s, sev: 'minor' as const }] : []))}
        active={active}
        onMark={(i) => setActive(active === i ? null : i)}
        area="read"
        source={item.ref}
        title={item.title}
        label={(i) => `${errors[i]?.orig ?? ''} → ${errors[i]?.fix ?? ''}`}
        className="text-base"
      />
      {fits ? (
        <>
          {activeErr && (
            <div className="rounded-xl bg-surface px-3 py-2 text-sm" data-testid="error-detail">
              <p>
                <span className="text-muted">{t('wrYouWrote')}: </span>
                <span lang="en" className="lx-diff-off">
                  {activeErr.orig}
                </span>
              </p>
              <p>
                <span className="text-muted">{t('wrBetter')}: </span>
                <span lang="en" className="font-medium text-accent-text">
                  {activeErr.fix}
                </span>
              </p>
              {activeErr.why && <p className="text-muted">{activeErr.why}</p>}
            </div>
          )}
          {usHints.map((h) => (
            <p key={h.orig} className="text-sm text-muted" data-testid="us-hint">
              <span lang="en">{h.orig}</span> → {t('wrUsHint', { us: h.us })}
            </p>
          ))}
          {feedback && <p className="text-sm">{feedback}</p>}
          {tips.length > 0 && (
            <div>
              <p className="lx-eyebrow">{t('rdTips')}</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {tips.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted" data-testid="recheck-lang">
          <span>{t('inRecheckLang', { lang: t(`inLangName_${other}`), ui: t(`inLangName_${uiLang}`) })}</span>
          {onRecheck && (
            <Button variant="ghost" onClick={onRecheck} data-ai="">
              {t('rdCheck')}
            </Button>
          )}
        </div>
      )}
      {str(res.model_summary) && (
        <div className="flex flex-col gap-1">
          <p className="lx-eyebrow">{t('rdModel')}</p>
          <EnglishText text={str(res.model_summary)} area="read" source={item.ref} title={item.title} className="text-base" />
        </div>
      )}
    </div>
  );
}
