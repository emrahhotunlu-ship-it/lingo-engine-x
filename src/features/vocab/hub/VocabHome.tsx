import { lazy, Suspense } from 'react';
import { useNav } from '../../../app/nav';
import { openSheet } from '../../../app/sheets';
import { loadHome } from '../../../modules/vocab/api';
import { VSkeleton } from '../../../ui/v';
import { useToday } from '../../today/state';

// Reiter Wörter bei eingeschalteter Wörter-App (Emrah 02.11.2026), seit Großpaket B3 im neuen Aussehen (Vorschau H12): die Seite selbst
// kommt aus dem Wörter-Modul (`loadHome`), hier stehen nur die Wege nach außen (Runden, Wort-Seite, Übersicht, Einstufung, Hinzufügen,
// Atlas). Den Kopf „Wörter“ mit Übersetzer · Claude · Zahnrad zeichnet der Rahmen (B1). Rückweg: `vcfg.mod = 0` zeigt den alten Reiter.

const WordsHome = lazy(() => loadHome().then((m) => ({ default: m.WordsHome })));

export function VocabHome() {
  const go = useNav((s) => s.go);
  // Dieselbe Quelle wie Heute: Pflicht „Wörter“ offen, erledigt oder (ohne Tagesplan) nicht da.
  const duty = useToday((s) => s.duties.items.find((d) => d.id === 'review')?.state ?? null);
  const state = duty === null ? null : duty === 'open' ? 'open' : 'done';
  return (
    <Suspense fallback={<VSkeleton height={320} />}>
      <WordsHome
        duty={state}
        onRound={(kind) => go({ name: 'vlearn', kind })}
        onWord={(path) => go({ name: 'vword', path })}
        onStats={() => go({ name: 'vstats' })}
        onPlace={() => go({ name: 'vplace' })}
        onAdd={() => openSheet('add')}
        onAtlas={() => go({ name: 'atlas' })}
      />
    </Suspense>
  );
}
