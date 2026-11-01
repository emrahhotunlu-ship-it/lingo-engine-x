import { lazy, Suspense } from 'react';
import { useNav } from '../../app/nav';
import { registerSlot } from '../../app/slots';
import { useLive } from '../../data/live';
import { loadOverview, vocabModuleOn } from '../../modules/vocab/api';
import { Skeleton } from '../../ui/Skeleton';

// Großpaket A S6 (Bild s2-05): Fortschritt › Wörter zeigt bei eingeschalteter Wörter-App deren Übersicht (Zahlen, 14-Tage-Vorschau,
// Behaltensrate) über dem bisherigen Teil. `enabled` am Slot ist nicht reaktiv, deshalb prüft der Wirt das Modul selbst.

const Overview = lazy(() => loadOverview().then((m) => ({ default: m.Overview })));

function OverviewHost() {
  const on = useLive((s) => vocabModuleOn(s.docs['app/profile']));
  const go = useNav((s) => s.go);
  if (!on) return null;
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Overview onOpenList={() => go({ name: 'vocabList' })} />
    </Suspense>
  );
}

registerSlot({ slot: 'progress.words', order: 0, render: () => <OverviewHost /> });
