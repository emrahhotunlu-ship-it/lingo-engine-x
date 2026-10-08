import { useMemo, useState } from 'react';
import { z } from 'zod';
import demo from '../../../content/demo/journey.json';
import { programChapters } from '../../../domain/c1/chapters';
import type { ChapterProgress } from '../../../domain/c1/state';
import { useT } from '../../../i18n';
import { logWarn } from '../../../platform/diagnostics';
import { useWide } from '../../../platform/input';
import { JourneyMap, StatusChip } from './JourneyMap';

// Vorführung der C1-Reise (P58) mit festen, erfundenen Daten aus `src/content/demo/journey.json` (für „Momente ansehen“ und Bildvergleiche).
// Liest nichts aus der Datenbank, schreibt nichts, rollt nie: dieselbe Darstellung wie die echte Programmkarte.

const DemoSchema = z.object({
  v: z.literal(1),
  chapters: z.array(z.object({ id: z.string(), status: z.enum(['open', 'current', 'done']), patSafe: z.number().int().min(0), patTotal: z.number().int().min(0) })).length(7),
});

/** Demo-Fortschritt je Kapitel (in Programmreihenfolge); bei ungültiger Datei leer. */
export function demoJourney(): ChapterProgress[] {
  const r = DemoSchema.safeParse(demo);
  if (!r.success) {
    logWarn('journey:demo', r.error);
    return [];
  }
  return programChapters().map((c, i) => {
    const d = r.data.chapters.find((x) => x.id === c.id) ?? r.data.chapters[i]!;
    return {
      id: c.id,
      n: c.n,
      status: d.status,
      ready: d.patTotal > 0,
      topics: [],
      patSafe: Math.min(d.patSafe, d.patTotal),
      patTotal: d.patTotal,
      introduced: 0,
      liveTopics: 0,
      allIntroduced: d.status === 'done',
      allSafe: d.status === 'done',
    };
  });
}

export function JourneyDemo({ orientation }: { orientation?: 'vertical' | 'horizontal' }) {
  const { t, lang } = useT();
  const wide = useWide();
  const chs = programChapters();
  const progress = useMemo(() => demoJourney(), []);
  const cur = Math.max(0, progress.findIndex((p) => p.status === 'current'));
  const [picked, setPicked] = useState(cur);
  if (progress.length !== chs.length) return null;
  const o = orientation ?? (wide ? 'horizontal' : 'vertical');
  const show = o === 'horizontal' ? picked : cur;
  const c = chs[show]!;
  const p = progress[show]!;
  return (
    <section className="lx-glass flex flex-col gap-4 rounded-[var(--radius-card)] p-5" aria-label={t('pxMapTitle')} data-testid="journey-demo">
      <header className="flex flex-col gap-1">
        <p className="lx-eyebrow">{t('eeJrDemo')}</p>
        <h2 className="lx-t-answer tracking-tight">{t('pxMapTitle')}</h2>
      </header>
      <JourneyMap chapters={chs} progress={progress} orientation={o} picked={picked} onSelect={setPicked} testId="journey">
        <div className="flex flex-col gap-2 rounded-[0.875rem] border border-line bg-surface-solid p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold tracking-tight">{t('pxMapChapter', { n: c.n, name: c.name[lang] })}</p>
            <StatusChip status={p.status} />
          </div>
          <p className="lx-eyebrow">{t('pxMapGoalLabel')}</p>
          <p className="text-sm leading-relaxed">{c.done[lang]}</p>
        </div>
      </JourneyMap>
    </section>
  );
}
