import { useId, useMemo, useState } from 'react';
import { useClock } from '../../../app/clock';
import type { SheetProps } from '../../../app/registry';
import { selectAiAvailable } from '../../../ai/scope';
import { takeTutorCall } from '../../../ai/tutorBudget';
import { useAsk } from '../../../ai/useAsk';
import { useLive } from '../../../data/live';
import { meaningForTask } from '../../../domain/srs/cards';
import { sayOwnPick, sayOwnScene } from '../../../domain/srs/offers';
import type { TrainCard } from '../../../domain/srs/types';
import { readCtx2 } from '../../../domain/tutor/ctx2';
import { useT, type MessageKey } from '../../../i18n';
import { useCapabilities } from '../../../platform/capabilities';
import { activateCheck, type ActivateCheckOut, type ActivateCheckVars } from '../../../prompts/activateCheck';
import { AiRunPanel, isBusy } from '../../../ui/AiRunPanel';
import { Button } from '../../../ui/Button';
import { Sheet } from '../../../ui/Sheet';
import { useVocabCards } from './data';

// „Sag es selbst“ (Wort-Lernen 2, Teil 2; freiwillig, kein Vorwurf, 2–3 Minuten): zwei Wörter von gestern oder vorgestern in eigenen Sätzen, je Wort eine
// Mini-Szene aus dem Berufsprofil. Claude prüft mit `activate-check@1` (Format „Mini-Szene“, ein Aufruf je Satz, nur auf Knopfdruck, Tutor-Tagesbremse,
// kein automatischer Neuversuch). Reine Übung: Es wird NICHTS gespeichert – keine Wiederholung, kein Fehlersatz, nichts zur Pflicht oder Serie.

const SENTENCE_MAX = 300;

export function sayOwnVars(card: TrainCard, sentence: string, scene: string, lang: 'de' | 'en'): ActivateCheckVars {
  return {
    targets: [{ word: card.word, meaning: meaningForTask(card, lang) ?? '', kind: card.kind === 'chunk' ? 'phrase' : 'word', shown: true }],
    sentence,
    uiLang: lang,
    task: { fmt: 'sc', scene, counterpart: '', textType: '', tone: 'free', tense: 'free', shape: 'free' },
  };
}

export function SayOwnSheet({ onClose }: SheetProps) {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const cards = useVocabCards();
  const profile = useLive((s) => s.docs['app/profile']);
  const ai = useCapabilities(selectAiAvailable);
  // Beim Öffnen festgelegt: Neuzeichnen oder neue Daten würfeln nichts neu (Kap. 15).
  const [picks] = useState(() => sayOwnPick(cards, today, lang));
  const ctx = useMemo(() => readCtx2(profile), [profile]);
  const [i, setI] = useState(0);
  const card = picks[i];
  return (
    <Sheet open onClose={onClose} title={t('pxWwSayOwnTitle')} closeLabel={t('close')}>
      <div className="flex flex-col gap-4" data-testid="say-own" data-n={picks.length}>
        {!ai ? (
          <p className="text-sm text-muted">{t('pxWwSayOwnNoAi')}</p>
        ) : card ? (
          <SayOwnItem
            key={card.key}
            card={card}
            scene={sayOwnScene(ctx, i)}
            last={i >= picks.length - 1}
            pos={i + 1}
            total={picks.length}
            onNext={() => (i >= picks.length - 1 ? onClose() : setI(i + 1))}
          />
        ) : null}
        <p className="m-0 text-sm text-muted" data-testid="say-own-extra">
          {t('pxWwSayOwnExtra')}
        </p>
      </div>
    </Sheet>
  );
}

function SayOwnItem({ card, scene, last, pos, total, onNext }: { card: TrainCard; scene: string; last: boolean; pos: number; total: number; onNext: () => void }) {
  const { t, lang } = useT();
  const ask = useAsk(activateCheck);
  const [text, setText] = useState('');
  const [limited, setLimited] = useState(false);
  const fieldId = useId();
  const busy = isBusy(ask.phase);
  const out: ActivateCheckOut | null = ask.data;
  const meaning = meaningForTask(card, lang) ?? '';
  const check = async () => {
    const s = text.trim();
    if (!s || busy) return;
    if (!takeTutorCall()) {
      setLimited(true);
      return;
    }
    setLimited(false);
    await ask.run(sayOwnVars(card, s.slice(0, SENTENCE_MAX), scene, lang));
  };
  const shownFix = out && out.verdict !== 'correct' && out.fixed.trim() && out.fixed.trim() !== text.trim() ? out.fixed.trim() : '';
  return (
    <div className="flex flex-col gap-3" data-testid="say-own-item" data-key={card.key} data-pos={pos}>
      <p className="lx-eyebrow m-0 lx-tnum">
        {pos} / {total}
      </p>
      <div className="rounded-2xl bg-surface p-4">
        <p className="lx-t-meta m-0 text-subtle">{t('pxWwSayOwnScene')}</p>
        <p className="m-0 mt-1" lang="en" data-testid="say-own-scene">
          {scene}
        </p>
      </div>
      <label htmlFor={fieldId} className="font-medium" data-testid="say-own-task">
        {t('pxWwSayOwnTask', { word: card.word, meaning })}
      </label>
      <textarea
        id={fieldId}
        className="lx-field min-h-20"
        lang="en"
        rows={3}
        value={text}
        maxLength={SENTENCE_MAX}
        placeholder={t('pxWwSayOwnPh', { word: card.word })}
        onChange={(e) => setText(e.target.value)}
        readOnly={!!out}
        autoCapitalize="sentences"
        spellCheck={false}
        data-testid="say-own-input"
      />
      {!out && (
        <div>
          <Button variant="primary" onClick={() => void check()} disabled={!text.trim() || busy} data-testid="say-own-check">
            {t('pxWwSayOwnCheck')}
          </Button>
        </div>
      )}
      {limited && (
        <p className="m-0 text-sm text-muted" role="status" data-testid="say-own-budget">
          {t('pxWwSayOwnBudget')}
        </p>
      )}
      <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => void check()} />
      {out && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4" data-testid="say-own-result" data-verdict={out.verdict} role="status">
          <p className={`m-0 font-semibold ${out.verdict === 'correct' ? 'text-ok-text' : out.verdict === 'minor' ? 'text-near-text' : 'text-wrong-text'}`}>{t(`pxWwSayOwn_${out.verdict}` as MessageKey)}</p>
          <p className="m-0 text-sm" lang={lang}>
            {out.why}
          </p>
          {shownFix && (
            <p className="m-0" lang="en" data-testid="say-own-fixed">
              {shownFix}
            </p>
          )}
          {out.better.trim() && (
            <div className="border-t border-line pt-2" data-testid="say-own-better">
              <p className="lx-t-meta m-0 text-subtle">{t('pxWwSayOwnBetter')}</p>
              <p className="m-0" lang="en">
                {out.better}
              </p>
              {out.whyBetter.trim() && (
                <p className="m-0 mt-1 text-sm text-muted" lang={lang}>
                  {out.whyBetter}
                </p>
              )}
            </div>
          )}
          <div className="pt-1">
            <Button variant="secondary" {...(last ? {} : { iconAfter: 'arrowRight' as const })} onClick={onNext} data-testid="say-own-next">
              {last ? t('pxWwSayOwnDone') : t('pxWwSayOwnNext')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
