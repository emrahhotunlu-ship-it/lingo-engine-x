import { useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { useCollection } from '../../data/watch';
import { answerDiff } from '../../domain/answer/diff';
import { buildSituation, checkSituation, letterHint, situationEligible, situationRound, type SituationExercise } from '../../domain/chunks/situation';
import type { CheckResult } from '../../domain/srs/types';
import type { SceneView } from '../../domain/speak/types';
import { EnglishText } from '../../engine/EnglishText';
import { SpeakButton } from '../../engine/SpeakButton';
import { Button, IconButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';

// M15: Wendungen „aus der Situation heraus“ (Übungsrunde in Sprechen). Szene und Absicht stehen
// da, die Wendung wird frei getippt; „Tipp“ deckt Platzhalter bzw. Anfangsbuchstaben auf und
// zählt als Hilfe. Nach dem Prüfen: Ergebnis, „Damals hattest du gesagt“, aufgewertete Fassung.
// Automatische Einstufung, keine Selbstbewertung (CLAUDE.md A7). Diese Übungsrunde plant nichts
// ein – die Abfrageart für den Chunk-Trainer (FSRS) liefert domain/chunks/situation.ts.

type Props = { scenes: readonly SceneView[]; onClose: () => void; minStage?: number };

export function useSituationPool(scenes: readonly SceneView[] | null, lang: 'de' | 'en', minStage: number): SituationExercise[] | null {
  const chunks = useCollection('chunk');
  return useMemo(() => {
    if (!chunks || !scenes) return null;
    const byId = new Map(scenes.map((s) => [s.id, s]));
    const out: SituationExercise[] = [];
    for (const [id, doc] of chunks) {
      if (!situationEligible(doc, minStage)) continue;
      const src = doc.src && typeof doc.src === 'object' ? (doc.src as Record<string, unknown>) : {};
      const ex = buildSituation(id, doc, byId.get(String(src.scene)) ?? null, lang);
      if (ex) out.push(ex);
    }
    return situationRound(out);
  }, [chunks, scenes, lang, minStage]);
}

export function SituationDrill({ scenes, onClose, minStage = 0 }: Props) {
  const { t, lang } = useT();
  const pool = useSituationPool(scenes, lang, minStage);
  // Die Runde wird einmal festgelegt (nie neu gewürfelt, Kap. 15).
  const [round, setRound] = useState<SituationExercise[] | null>(null);
  if (round === null && pool !== null) setRound(pool);
  const list = round ?? [];
  const [pos, setPos] = useState(0);
  const [given, setGiven] = useState('');
  const [hint, setHint] = useState<0 | 1 | 2>(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [right, setRight] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const ex = list[pos];

  if (round === null) return null;
  if (!list.length) {
    return (
      <Card channel="speak" data-testid="situation-drill" data-state="empty">
        <p className="text-sm text-muted">{t('sitEmpty')}</p>
        <div className="mt-3">
          <Button onClick={onClose}>{t('close')}</Button>
        </div>
      </Card>
    );
  }
  if (!ex) {
    return (
      <Card channel="speak" data-testid="situation-drill" data-state="done">
        <p className="text-base font-semibold" data-testid="situation-result">
          {t('drillResult', { right, n: list.length })}
        </p>
        <div className="mt-3">
          <Button onClick={onClose}>{t('close')}</Button>
        </div>
      </Card>
    );
  }

  const check = () => {
    if (!given.trim() || result) return;
    const r = checkSituation(given, ex);
    setResult(r);
    if (r.verdict === 'correct') setRight((n) => n + 1);
  };
  const next = () => {
    setPos((p) => p + 1);
    setGiven('');
    setHint(0);
    setResult(null);
    requestAnimationFrame(() => input.current?.focus());
  };

  return (
    <Card channel="speak" data-testid="situation-drill" data-state={result ? 'checked' : 'asking'} className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted" data-testid="status">
          {t('sitKind')} · <span className="lx-tnum">{t('sitProgress', { n: pos + 1, total: list.length })}</span>
        </p>
        <IconButton icon="close" label={t('close')} onClick={onClose} />
      </div>
      <p className="text-sm font-medium">{t('sitTask')}</p>
      <div className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 text-sm">
        <p className="font-semibold">{ex.sceneTitle}</p>
        {ex.situation && <p className="text-muted">{ex.situation}</p>}
        {ex.counterpart && <p className="text-xs text-subtle">{ex.counterpart}</p>}
      </div>
      <p className="text-base" data-testid="situation-intent">
        <span className="text-muted">{t('sitIntent')}</span> <span className="font-semibold">{ex.intent}</span>
      </p>
      {hint > 0 && (
        <p lang="en" aria-label={t('sitHint')} className="font-mono text-base tracking-widest text-muted" data-testid="situation-hint">
          {letterHint(ex.en, hint === 2)}
        </p>
      )}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (result) next();
          else check();
        }}
      >
        <input
          ref={input}
          lang="en"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={given}
          disabled={!!result}
          onChange={(e) => setGiven(e.target.value)}
          aria-label={t('sitInput')}
          data-testid="situation-input"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base text-fg outline-none focus:border-[var(--lx-accent)]"
        />
        {!result && hint < 2 && (
          <Button type="button" variant="ghost" icon="lightbulb" onClick={() => setHint((h) => (h === 0 ? 1 : 2))} data-testid="situation-tip">
            {t('sitTip')}
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={!result && !given.trim()} data-testid={result ? 'situation-next' : 'situation-check'}>
          {result ? t('sitNext') : t('sitCheck')}
        </Button>
      </form>
      {result && (
        <div className="flex flex-col gap-3" data-testid="situation-feedback" data-verdict={result.verdict}>
          <p className={`flex items-center gap-2 text-sm font-semibold ${result.verdict === 'correct' ? 'text-accent-text' : result.verdict === 'near' ? 'text-gold-text' : 'text-danger-text'}`}>
            <Icon name={result.verdict === 'wrong' ? 'close' : 'check'} size={16} />
            {result.verdict === 'correct' ? t('sitCorrect') : result.verdict === 'near' ? t('sitNear') : t('sitWrong')}
          </p>
          {result.verdict !== 'correct' && (
            <p lang="en" className="text-sm">
              {answerDiff(given, ex.en).map((p, k) => (
                <span key={k} className={p.ok ? undefined : 'lx-diff-off'}>
                  {p.text}
                </span>
              ))}
              <span aria-hidden="true" className="px-2 text-subtle">
                →
              </span>
              <span className="font-semibold">{ex.en}</span>
            </p>
          )}
          {result.variant === 'uk' && result.us && <p className="text-sm text-cyan-text">{t('anUsHint', { us: result.us })}</p>}
          {ex.then && (
            <p className="text-sm">
              <span className="text-muted">{t('sitThen')}</span> <span lang="en">„{ex.then}“</span>
            </p>
          )}
          {ex.upgraded && (
            <div className="flex items-start gap-1">
              <EnglishText text={ex.upgraded} area="speak" source={`chunk/${ex.chunkId}`} title={ex.en} className="min-w-0 flex-1 text-base" />
              <SpeakButton text={ex.upgraded} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
