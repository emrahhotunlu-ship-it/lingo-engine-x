import { Fragment } from 'react';
import { useT, type MessageKey } from '../i18n';
import { IconButton } from '../ui/Button';
import { speak, useSpeech } from '../platform/speech';
import { openWord } from '../app/route';
import type { CardView } from '../coach/cardView';

// Gemeinsame Bausteine der Trainer-Bildschirme.

const LV_KEYS: readonly MessageKey[] = ['cLv0', 'cLv1', 'cLv2', 'cLv3', 'cLv4'];

/** Sicherheit eines Worts: fünf Punkte und ein Wort (Emrahs Wunsch: Status statt Erklärtext). */
export function Certainty({ lv }: { lv: number }) {
  const { t } = useT();
  const n = Math.max(0, Math.min(4, lv));
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-muted" data-testid="certainty">
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= n ? 'bg-accent' : 'bg-track'}`} />
        ))}
      </span>
      {t(LV_KEYS[n]!)}
    </span>
  );
}

export function Speak({ text, testId }: { text: string; testId?: string }) {
  const { t } = useT();
  const status = useSpeech((s) => s.status);
  if (status === 'unsupported' || status === 'novoice' || !text.trim()) return null;
  return <IconButton icon="speaker" label={t('cPlay')} onClick={() => void speak(text)} data-testid={testId ?? 'speak'} className="shrink-0" />;
}

/** Englischer Text, jedes Wort antippbar (Bedeutung aus dem eingebauten Wörterbuch). */
export function TapText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/([A-Za-z][A-Za-z'-]*)/);
  return (
    <span lang="en" className={className}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <button key={i} type="button" onClick={() => openWord(p)} className="rounded-sm decoration-accent/50 underline-offset-4 hover:underline focus-visible:underline">
            {p}
          </button>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </span>
  );
}

const POS_KEY: Record<string, MessageKey> = { n: 'cPosN', v: 'cPosV', adj: 'cPosAdj', adv: 'cPosAdv', pv: 'cPosPv', phr: 'mwPosPhr' };

export function PosLabel({ pos }: { pos: string }) {
  const { t } = useT();
  const key = POS_KEY[pos];
  return key ? <span className="text-2xs text-muted">{t(key)}</span> : null;
}

/** Wort mit Lautschrift, Aussprache, Bedeutung, Beispielen und Wortfamilie. */
export function WordDetails({ view, compact = false }: { view: CardView; compact?: boolean }) {
  const { t } = useT();
  return (
    <div data-testid="word-details">
      <div className="flex items-center gap-2">
        <p className="text-2xl font-semibold tracking-tight" lang="en">
          {view.word}
        </p>
        <Speak text={view.word} />
      </div>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
        {view.ipa && <span className="font-mono text-xs">/{view.ipa}/</span>}
        <PosLabel pos={view.pos} />
        {view.business && <span className="rounded-full bg-surface px-2 text-2xs">{t('cWorkWord')}</span>}
      </p>
      <p className="mt-3 text-lg">{view.de}</p>
      {view.en && (
        <p className="mt-1 text-sm text-muted" lang="en">
          {view.en}
        </p>
      )}
      {view.ex.length > 0 && (
        <div className="mt-4">
          <p className="lx-eyebrow text-muted">{t('cExamples')}</p>
          <ul className="mt-2 space-y-2.5">
            {view.ex.slice(0, compact ? 2 : 3).map(([en, de]) => (
              <li key={en} className="text-sm leading-relaxed">
                <span className="flex items-start gap-1">
                  <TapText text={en} />
                  <Speak text={en} testId="speak-example" />
                </span>
                {de && <span className="block text-muted">{de}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!compact && view.more.length > 0 && (
        <div className="mt-4">
          <p className="lx-eyebrow text-muted">{t('cMoreMeanings')}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {view.more.map((m) => (
              <li key={m.p + m.de}>
                <PosLabel pos={m.p} /> {m.de}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!compact && (view.fam.length > 0 || view.syn.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {view.fam.length > 0 && (
            <div>
              <p className="lx-eyebrow text-muted">{t('cFamily')}</p>
              <p className="mt-1 text-sm" lang="en">
                <TapText text={view.fam.join(', ')} />
              </p>
            </div>
          )}
          {view.syn.length > 0 && (
            <div>
              <p className="lx-eyebrow text-muted">{t('cSimilar')}</p>
              <p className="mt-1 text-sm">
                <TapText text={view.syn.join(', ')} />
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
