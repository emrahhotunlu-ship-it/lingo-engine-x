import { useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useSettings } from '../../app/settings';
import { dayKey } from '../../domain/date';
import { parseFallbackLines } from '../../domain/teacher/fallback';
import { EnglishText } from '../../engine/EnglishText';
import { startClaudeDrill } from '../companion/drill';
import { useT } from '../../i18n';
import { teacherFeedback, RAW_MAX, type TeacherOut } from '../../prompts/teacherFeedback';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { toast } from '../../ui/Toast';
import { addTeacherWord, applyTeacherCorrections, saveTeacherFeedback } from './actions';

// Lehrer-Feedback einfügen (28.09.2026, ersetzt die Preply-Brücke): großes Textfeld, „Verarbeiten“
// (nur auf Tipp, A6.2/A6.3), Ergebnis als Kartenvorschläge (→ Wortschatz), Korrekturen
// (→ Reparatur-Sätze) und „Jetzt üben“ (nutzt die vorhandene Übung „Mach mir eine Übung dazu“,
// keine neue Übungs-Engine). Ohne Claude: Hinweis + einfacher Zeilen-Rückfall.

const busy = (p: string) => p === 'queued' || p === 'thinking' || p === 'streaming' || p === 'slow';

export function TeacherFeedbackScreen() {
  const { t } = useT();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const lang = useSettings((s) => s.lang);
  const ai = useAiAvailable();
  const today = useClock((s) => s.today);
  const ask = useAsk(teacherFeedback);
  const [raw, setRaw] = useState('');
  const [savedRaw, setSavedRaw] = useState('');
  const [wordsDone, setWordsDone] = useState<ReadonlySet<number>>(new Set());
  const [corrOff, setCorrOff] = useState<ReadonlySet<number>>(new Set());
  const [corrDone, setCorrDone] = useState(false);
  const out: TeacherOut | null = ask.data;

  const run = async () => {
    setWordsDone(new Set());
    setCorrOff(new Set());
    setCorrDone(false);
    const r = await ask.run({ uiLang: lang, raw, today: dayKey(Date.now()) });
    if (r) {
      setSavedRaw(raw);
      void saveTeacherFeedback(raw, r, lang);
    }
  };

  const takeWord = async (i: number) => {
    const w = out?.words[i];
    if (!w || wordsDone.has(i)) return;
    const res = await addTeacherWord({ word: w.en, de: w.de, pos: w.pos || null, ex: w.ex }, today);
    if (res === 'created' || res === 'extended' || res === 'exists') setWordsDone((s) => new Set(s).add(i));
    else toast(t('lkSaveFailed'), 'error');
  };

  const takeCorrections = async () => {
    if (!out) return;
    const sel = out.corrections.map((_, i) => i).filter((i) => !corrOff.has(i));
    const ok = await applyTeacherCorrections(out.corrections, sel, out.title);
    if (ok) {
      setCorrDone(true);
      toast(t('tfRepairSaved'));
    } else toast(t('lkSaveFailed'), 'error');
  };

  const practice = () => {
    if (!out) return;
    const context = [`Corrections: ${out.corrections.map((c) => `${c.wrong} -> ${c.right}`).join('; ')}`, out.tasks.length ? `Tasks: ${out.tasks.join('; ')}` : ''].filter(Boolean).join('\n');
    startClaudeDrill(context || savedRaw);
    go({ name: 'claudeDrill' });
  };

  const fallback = !ai ? parseFallbackLines(raw) : [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6 sm:py-10" data-testid="teacher-feedback">
      <header className="flex flex-col gap-1">
        <p className="lx-eyebrow">{t('tfEyebrow')}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t('tfTitle')}</h1>
        <p className="text-sm text-muted">{t('tfIntro')}</p>
      </header>

      <Card className="flex flex-col gap-3">
        <textarea
          className="lx-field min-h-36"
          value={raw}
          maxLength={RAW_MAX}
          placeholder={t('tfPlaceholder')}
          onChange={(e) => setRaw(e.target.value)}
          data-testid="tf-input"
        />
        {ai ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon="sparkle" disabled={raw.trim().length < 20 || busy(ask.phase)} onClick={() => void run()} data-testid="tf-go" data-ai="">
              {t('tfProcess')}
            </Button>
            {busy(ask.phase) && (
              <Button variant="ghost" onClick={ask.stop}>
                {t('aiStop')}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted" data-testid="tf-no-ai">
            {t('tfNoAi')}
          </p>
        )}
        {busy(ask.phase) && <p className="text-sm text-muted">{ask.phase === 'slow' ? t('aiSlow') : t('aiThinking')}</p>}
        {ask.error && (
          <p className="text-sm text-danger-text" role="alert" data-testid="tf-error">
            {t(ask.error)}
          </p>
        )}
      </Card>

      {!ai && fallback.length > 0 && (
        <Card className="flex flex-col gap-2" data-testid="tf-fallback">
          <p className="lx-eyebrow">{t('tfFallbackTitle')}</p>
          <ul className="flex flex-col gap-1.5">
            {fallback.map((w) => (
              <li key={w.en} className="text-sm">
                <EnglishText as="span" text={w.en} area="lookup" source={null} /> – {w.de}
              </li>
            ))}
          </ul>
          <p className="text-xs text-subtle">{t('tfFallbackHint')}</p>
        </Card>
      )}

      {out && out.words.length > 0 && (
        <Card className="flex flex-col gap-3" data-testid="tf-words">
          <p className="lx-eyebrow">{t('tfWordsTitle')}</p>
          <ul className="flex flex-col gap-3">
            {out.words.map((w, i) => (
              <li key={`${w.en}-${i}`} className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0" data-testid="tf-word">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">
                    <EnglishText as="span" text={w.en} area="lookup" source="teacher-feedback" /> — {w.de}
                  </p>
                  {w.ex && <EnglishText as="p" className="text-sm text-muted" text={w.ex} area="lookup" source={null} />}
                </div>
                <Button variant={wordsDone.has(i) ? 'ghost' : 'secondary'} disabled={wordsDone.has(i)} onClick={() => void takeWord(i)} data-testid="tf-word-take">
                  {wordsDone.has(i) ? t('lkSaved') : t('vcAddOne')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {out && out.corrections.length > 0 && (
        <Card className="flex flex-col gap-3" data-testid="tf-corrections">
          <p className="lx-eyebrow">{t('tfCorrectionsTitle')}</p>
          <ul className="flex flex-col gap-2">
            {out.corrections.map((c, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!corrOff.has(i)}
                  disabled={corrDone}
                  onChange={() =>
                    setCorrOff((s) => {
                      const n = new Set(s);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })
                  }
                  aria-label={`${c.wrong} → ${c.right}`}
                  data-testid="tf-corr-check"
                />
                <div>
                  <EnglishText as="p" text={c.wrong} area="lookup" source={null} className="text-danger-text line-through" />
                  <EnglishText as="p" text={c.right} area="lookup" source="teacher-feedback" />
                  <p className="text-xs text-muted">{c.why}</p>
                </div>
              </li>
            ))}
          </ul>
          <div>
            <Button variant={corrDone ? 'ghost' : 'primary'} disabled={corrDone} onClick={() => void takeCorrections()} data-testid="tf-corr-apply">
              {corrDone ? t('lkSaved') : t('tfCorrectionsApply')}
            </Button>
          </div>
        </Card>
      )}

      {out && out.tasks.length > 0 && (
        <Card className="flex flex-col gap-3" data-testid="tf-tasks">
          <p className="lx-eyebrow">{t('tfTasksTitle')}</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {out.tasks.map((task, i) => (
              <li key={i}>{task}</li>
            ))}
          </ul>
          <div>
            <Button variant="secondary" icon="arrowRight" onClick={practice} data-testid="tf-practice">
              {t('tfPractice')}
            </Button>
          </div>
        </Card>
      )}

      {out && !out.words.length && !out.corrections.length && !out.tasks.length && (
        <p className="text-sm text-muted" data-testid="tf-empty">
          {t('tfEmpty')}
        </p>
      )}

      <div>
        <Button variant="ghost" onClick={back} data-testid="tf-back">
          {t('close')}
        </Button>
      </div>
    </div>
  );
}
