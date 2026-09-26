import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { logWarn } from '../../platform/diagnostics';
import { Icon } from '../../ui/Icon';

// Kopieren (Phase 5, E5-18): zuerst `navigator.clipboard.writeText`. Im iframe kann die
// Zwischenablage gesperrt sein (weder contract/ noch permissions.d.ts sichern sie zu) – dann wird
// der Text markiert, mit dem Hinweis „Markiert – jetzt kopieren".

export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    logWarn('copy:clipboard', err);
    return false;
  }
}

/** Markiert den Inhalt eines Elements (Rückfall ohne Zwischenablage). */
export function selectContents(el: HTMLElement | null): void {
  if (!el) return;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.focus();
    el.select();
    return;
  }
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

type State = 'idle' | 'copied' | 'manual';

/** Knopf „Kopieren" → 2 s „Kopiert ✓"; ohne Zwischenablage wird `target()` markiert. */
export function CopyButton({ text, target, testId, copiedTestId }: { text: string; target: () => HTMLElement | null; testId: string; copiedTestId?: string }) {
  const { t } = useT();
  const [state, setState] = useState<State>('idle');
  useEffect(() => {
    if (state !== 'copied') return;
    const id = window.setTimeout(() => setState('idle'), 2000);
    return () => window.clearTimeout(id);
  }, [state]);
  const run = async () => {
    const ok = await copyText(text);
    if (ok) setState('copied');
    else {
      selectContents(target());
      setState('manual');
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void run()}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-surface"
        data-testid={state === 'copied' && copiedTestId ? copiedTestId : testId}
        data-state={state}
        aria-live="polite"
      >
        <Icon name={state === 'copied' ? 'check' : 'copy'} size={18} />
        {state === 'copied' ? t('cmpCopied') : t('cmpCopy')}
      </button>
      {state === 'manual' && (
        <span className="text-xs text-muted" role="status" data-testid="copy-manual">
          {t('cmpCopyManual')}
        </span>
      )}
    </span>
  );
}

/** Nachricht an den Lehrer: schreibgeschütztes Feld plus Kopieren. */
export function CopyBox({ text, label, testId = 'pp-copy', copiedTestId = 'pp-copied' }: { text: string; label: string; testId?: string; copiedTestId?: string }) {
  const field = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={field}
        readOnly
        value={text}
        rows={Math.min(8, Math.max(3, Math.ceil(text.length / 60)))}
        className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-[0.95rem] leading-relaxed text-fg outline-none"
        lang="en"
        aria-label={label}
      />
      <div>
        <CopyButton text={text} target={() => field.current} testId={testId} copiedTestId={copiedTestId} />
      </div>
    </div>
  );
}
