import { useEffect, useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useT } from '../../i18n';
import { bizId } from '../../domain/business/bizDoc';
import { drillQuestions, drillScore, sentenceCase } from '../../domain/business/playbook';
import type { Playbook } from '../../domain/business/types';
import { Choices, type ChoiceItem } from '../../engine/Choices';
import { EnglishText } from '../../engine/EnglishText';
import { SpeakButton } from '../../engine/SpeakButton';
import { Button, IconButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { saveBizItem } from './persist';

// Baukasten-Drill (Plan §5.5, §4.3): 6 Situationen, Auswahl aus 3 Wendungen (Tippen oder
// Ziffern 1–3). Danach richtig/falsch mit Beispielsatz und Hinweis, am Ende „5 von 6“.
// Die Wahl entscheidet – keine Selbstbewertung. Gespeichert als `biz.play` + Log/Profil.

export function PlaybookDrill({ pb, onClose }: { pb: Playbook; onClose: () => void }) {
  const { t, lang } = useT();
  const [seed] = useState(() => Math.floor(Date.now() / 60_000));
  const qs = useMemo(() => drillQuestions(pb, seed), [pb, seed]);
  const [pos, setPos] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Array<{ chosen: number; answer: number }>>([]);
  const [saved, setSaved] = useState<'no' | 'ok' | 'failed'>('no');
  const [startedAt] = useState(() => Date.now());
  const q = qs[pos];
  const done = pos >= qs.length;

  const items: ChoiceItem[] = q ? q.order.map((k) => ({ id: String(k), label: sentenceCase(q.options[k] as string), lang: 'en', correct: k === q.answer })) : [];

  const choose = (id: string) => {
    if (chosen || !q) return;
    setChosen(id);
    setAnswers((a) => [...a, { chosen: Number(id), answer: q.answer }]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || chosen || !q) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 3) {
        const k = q.order[n - 1];
        if (k !== undefined) choose(String(k));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const finish = (all: Array<{ chosen: number; answer: number }>) => {
    if (saved !== 'no') return;
    const score = drillScore(all);
    const t0 = startedAt;
    setSaved('ok');
    void saveBizItem(
      { id: bizId('play', t0), t: t0, day: useClock.getState().today, kind: 'play', playbook: pb.id, drill: score },
      { lang, title: pb.title.en, n: score.n, right: score.right, activeMs: Date.now() - t0 },
    ).then((ok) => setSaved(ok ? 'ok' : 'failed'));
  };

  if (done) {
    const score = drillScore(answers);
    return (
      <Card channel="business" className="flex flex-col gap-3" data-testid="drill-result" data-right={score.right} data-n={score.n}>
        <p className="text-xl font-semibold">{t('drillResult', { right: score.right, n: score.n })}</p>
        {saved === 'failed' && (
          <p role="alert" className="text-sm text-danger-text">
            {t('repNotSaved')}
          </p>
        )}
        <div>
          <Button onClick={onClose}>{t('drillBack')}</Button>
        </div>
      </Card>
    );
  }
  if (!q) return null;
  const correct = chosen !== null && Number(chosen) === q.answer;
  return (
    <Card channel="business" className="flex flex-col gap-4" data-testid="drill-q" data-pos={pos}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">
          {pb.title[lang]} · <span className="lx-tnum">{t('sitProgress', { n: pos + 1, total: qs.length })}</span>
        </p>
        <IconButton icon="close" label={t('close')} onClick={onClose} />
      </div>
      <p className="text-sm font-medium">{t('drillTask')}</p>
      <p className="text-base">{q.situation[lang]}</p>
      <Choices items={items} chosen={chosen} onChoose={choose} label={t('drillTask')} />
      {chosen !== null && (
        <div className="flex flex-col gap-2" data-testid="drill-feedback" data-correct={correct}>
          <p className={`flex items-center gap-2 text-sm font-semibold ${correct ? 'text-accent-text' : 'text-danger-text'}`}>
            <Icon name={correct ? 'check' : 'close'} size={16} />
            {correct ? t('sitCorrect') : t('drillWrong', { right: sentenceCase(q.options[q.answer] as string) })}
          </p>
          <div className="flex items-start gap-1">
            <EnglishText text={q.ex} area="business" source={`playbook/${pb.id}`} title={pb.title.en} className="min-w-0 flex-1 text-base" />
            <SpeakButton text={q.ex} />
          </div>
          <p className="text-sm text-muted">{q.note[lang]}</p>
          <div>
            <Button
              variant="primary"
              iconAfter="arrowRight"
              onClick={() => {
                setChosen(null);
                if (pos + 1 >= qs.length) finish(answers);
                setPos((p) => p + 1);
              }}
              data-testid="drill-next"
            >
              {t('sitNext')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
