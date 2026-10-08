import { useState } from 'react';
import { kindEnabled } from '../../app/flags';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { C1_KINDS } from '../../domain/c1x/types';
import { preloadC1x } from '../../domain/c1x/preload';
import { contrastTasks } from '../../domain/tutor/contrast';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { logWarn } from '../../platform/diagnostics';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { patternById } from '../../domain/grammar/patterns';
import { startGrammar } from '../grammar/session';

// Kontrast-Runde (Lernplattform 3.0 P49): 8 Aufgaben zu zwei verwechselten Mustern im Wechsel (A, B, A, B …). Freiwillig (Kontext `xtra`), nie Pflicht,
// ohne Claude. Der Knopf baut die Aufgaben aus festen Inhalten (`domain/tutor/contrast.ts`); gibt es auf einer Seite zu wenig, sagt er das ehrlich.

type Props = { a: string; b: string; nameA: string; nameB: string; testId?: string };

export function ContrastButton({ a, b, nameA, nameB, testId = 'dx-contrast' }: Props) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const api = useHiddenInput();
  const [busy, setBusy] = useState(false);
  const start = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      // Die Bündel der angebotenen Aufgabenarten sind schon geladen oder werden jetzt geholt (löst immer auf).
      await preloadC1x(C1_KINDS.filter((k) => kindEnabled(k)));
      const day = useClock.getState().today;
      const docs = useLive.getState().collections.grammar ?? new Map<string, Record<string, unknown>>();
      const tasks = contrastTasks({ a, b }, { grammarDocs: docs, seed: `${day}|contrast|${a}|${b}` });
      if (!tasks.length) {
        toast(t('ttDxContrastFew'));
        return;
      }
      const first = startGrammar({ mode: 'xtra', tasks });
      if (first === 'typed') api.focusNow();
      else api.blur();
      go({ name: 'grammarSession', mode: 'xtra' });
    } catch (err) {
      logWarn('diagnose:contrast', err);
      toast(t('ttDxContrastBusy'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="secondary" icon="sort" onClick={() => void start()} disabled={busy} aria-label={t('ttDxContrastAria', { a: nameA, b: nameB })} data-testid={testId} data-pair={`${a}|${b}`}>
      {t('ttDxContrast')}
    </Button>
  );
}

/** „Muster üben“ aus einem Befund der Diagnose: vier Aufgaben nur zu diesem Muster (wie im Themenblatt). */
export function PatternPracticeButton({ pat, name, testId = 'dx-practice' }: { pat: string; name: string; testId?: string }) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const api = useHiddenInput();
  const topic = patternById(pat)?.topic;
  if (!topic) return null;
  const start = (): void => {
    const first = startGrammar({ mode: 'topic', topic, pat });
    if (first === 'typed') api.focusNow();
    else api.blur();
    go({ name: 'grammarSession', mode: 'topic', topic });
  };
  return (
    <Button variant="secondary" icon="arrowRight" onClick={start} data-testid={testId} data-pat={pat}>
      {t('ttDxActPattern', { name })}
    </Button>
  );
}
