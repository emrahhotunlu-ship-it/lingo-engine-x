import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { lookupWord, type BankWord } from '../bank/words';
import { askText } from '../ai/stream';
import { isAiFailure } from '../ai/types';
import { useAiAvailable } from '../ai/scope';
import { useClock } from '../app/clock';
import { saveCards, useCoach } from '../coach/store';
import { introducedCard } from '../coach/session';
import { translatePrompt, TRANSLATE_ID, PROMPT_VERSION } from '../prompts/coach';
import { countAiCall } from './aiCount';
import { logWarn } from '../platform/diagnostics';
import { PosLabel, Speak } from './parts';

// Übersetzer (docs/neustart.md §8): Wörter kostenlos aus dem eingebauten Wörterbuch,
// ganze Sätze auf Knopfdruck mit Claude (zwischengespeichert: gleicher Text kostet nichts erneut).

export function AddToTraining({ id }: { id: string }) {
  const { t } = useT();
  const has = useCoach((s) => s.cards.has(id));
  return (
    <Button variant={has ? 'ghost' : 'secondary'} icon={has ? 'check' : 'plus'} disabled={has} onClick={() => void saveCards([[id, { ...introducedCard(Date.now()), add: Date.now() }]])} data-testid="add-to-training">
      {has ? t('cTrInTraining') : t('cTrLearn')}
    </Button>
  );
}

function Hit({ w }: { w: BankWord }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-line/50 py-3 last:border-0">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold" lang="en">
          {w.w} <PosLabel pos={w.p} />
        </p>
        <p className="text-sm">{w.de}</p>
        {w.ipa && <p className="font-mono text-2xs text-muted">/{w.ipa}/</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Speak text={w.w} />
        <AddToTraining id={w.i} />
      </div>
    </li>
  );
}

export function TranslateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const available = useAiAvailable();
  const [text, setText] = useState('');
  const [ai, setAi] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!open) ctl.current?.abort();
  }, [open]);

  const words = text.trim().split(/\s+/).filter(Boolean);
  const hits = words.length && words.length <= 3 ? lookupWord(text) : [];

  async function translate() {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setBusy(true);
    setFailed(false);
    setAi('');
    countAiCall(today);
    try {
      const res = await askText({ id: TRANSLATE_ID, version: PROMPT_VERSION, tier: 'quick', input: translatePrompt(text.trim()), cache: true, signal: c.signal, priority: 'user', onText: (u) => setAi(u.text) });
      setAi(res.text.trim());
    } catch (err) {
      if (!(isAiFailure(err) && err.kind === 'cancelled')) {
        logWarn('translate', err);
        setFailed(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('cTranslate')} closeLabel={t('cClose')}>
      <div data-testid="translate">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAi('');
          }}
          placeholder={t('cTrPlaceholder')}
          rows={2}
          autoCapitalize="off"
          className="w-full resize-none rounded-[var(--radius-control)] border border-line bg-surface p-3 text-base text-fg outline-none focus:border-accent"
          data-testid="translate-input"
        />
        {hits.length > 0 && (
          <ul className="mt-3" data-testid="translate-hits">
            {hits.map((w) => (
              <Hit key={w.i} w={w} />
            ))}
          </ul>
        )}
        {text.trim() && hits.length === 0 && words.length <= 3 && <p className="mt-3 text-sm text-muted">{t('cTrNoHit')}</p>}
        {text.trim() && available && (
          <div className="mt-4">
            <Button variant={hits.length ? 'ghost' : 'primary'} icon="sparkle" busy={busy} busyLabel={t('cAskThinking')} onClick={() => void translate()} data-testid="translate-ai">
              {t('cTrAi')}
            </Button>
          </div>
        )}
        {ai && (
          <p className="mt-4 whitespace-pre-wrap rounded-[var(--radius-control)] bg-surface p-3 text-base" data-testid="translate-result">
            {ai}
          </p>
        )}
        {failed && <p className="mt-3 text-sm text-danger-text">{t('cAskError')}</p>}
      </div>
    </Sheet>
  );
}
