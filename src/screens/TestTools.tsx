import { useState } from 'react';
import { formatNumber } from '../i18n';
import { Button } from '../ui/Button';
import type { IconName } from '../ui/Icon';
import { toast } from '../ui/Toast';
import { useSettings } from '../app/settings';
import { go } from '../app/route';
import { applySampleInput, applySampleProgress, applyTestProfile, makeDueNow, resetToday } from '../coach/testActions';
import { logError } from '../platform/diagnostics';
import { testToolsDe } from '../i18n/parts/testtools.de';
import { testToolsEn } from '../i18n/parts/testtools.en';

// Testwerkzeuge für den Test-Link (nur im Test-Build, siehe src/app/testBuild.ts): alles, um die App
// ohne die lange Einstufung auszuprobieren. Im normalen Build wird diese Datei samt Texten entfernt;
// scripts/check-platform.mjs --prod prüft das an der Kennzeichnung `lx-test-tools`.

type Key = keyof typeof testToolsDe;

function useTt(): (key: Key, vars?: Record<string, number>) => string {
  const lang = useSettings((s) => s.lang);
  const dict: Record<Key, string> = lang === 'de' ? testToolsDe : testToolsEn;
  return (key, vars) => dict[key].replace(/\{(\w+)\}/g, (m, name: string) => (vars && name in vars ? formatNumber(lang, vars[name]!) : m));
}

type Tool = { id: string; icon: IconName; label: Key; desc: Key; run: () => Promise<string> };

export function TestTools() {
  const tt = useTt();
  const [busy, setBusy] = useState<string | null>(null);

  const tools: Tool[] = [
    {
      id: 'tt-profile',
      icon: 'target',
      label: 'ttProfile',
      desc: 'ttProfileDesc',
      run: async () => {
        await applyTestProfile();
        return tt('ttProfileDone');
      },
    },
    {
      id: 'tt-progress',
      icon: 'chart',
      label: 'ttProgress',
      desc: 'ttProgressDesc',
      run: async () => {
        const r = await applySampleProgress();
        return tt('ttProgressDone', r);
      },
    },
    {
      id: 'tt-input',
      icon: 'book',
      label: 'ttInput',
      desc: 'ttInputDesc',
      run: async () => {
        await applySampleInput();
        return tt('ttInputDone');
      },
    },
    {
      id: 'tt-reset',
      icon: 'refresh',
      label: 'ttReset',
      desc: 'ttResetDesc',
      run: async () => {
        await resetToday();
        return tt('ttResetDone');
      },
    },
    {
      id: 'tt-due',
      icon: 'bolt',
      label: 'ttDue',
      desc: 'ttDueDesc',
      run: async () => {
        const n = await makeDueNow(25);
        return n > 0 ? tt('ttDueDone', { n }) : tt('ttDueNone');
      },
    },
  ];

  async function run(tool: Tool) {
    setBusy(tool.id);
    try {
      toast(await tool.run());
    } catch (err) {
      logError('testtools', err, tool.id);
      toast(tt('ttFailed'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-dashed border-line p-4" data-testid="lx-test-tools">
      <h3 className="lx-eyebrow text-muted">{tt('ttTitle')}</h3>
      <p className="mt-1 text-xs text-muted">{tt('ttNote')}</p>
      <ul className="mt-3 space-y-4">
        {tools.map((tool) => (
          <li key={tool.id}>
            <Button variant="secondary" icon={tool.icon} busy={busy === tool.id} disabled={busy !== null} onClick={() => void run(tool)} data-testid={tool.id} className="w-full justify-start text-left">
              {tt(tool.label)}
            </Button>
            <p className="mt-1.5 text-xs text-muted">{tt(tool.desc)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Schnellstart: Test-Profil setzen und direkt zurück zu „Heute" (auf Heute und am Anfang der Einstufung). */
export function TestSkipButton() {
  const tt = useTt();
  const [busy, setBusy] = useState(false);
  async function skip() {
    setBusy(true);
    try {
      await applyTestProfile();
      toast(tt('ttSkipDone'));
      go({ name: 'home' });
    } catch (err) {
      logError('testtools', err, 'skip');
      toast(tt('ttFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div data-testid="lx-test-tools-skip">
      <Button variant="secondary" icon="bolt" busy={busy} onClick={() => void skip()} data-testid="tt-skip-placement">
        {tt('ttSkip')}
      </Button>
    </div>
  );
}
