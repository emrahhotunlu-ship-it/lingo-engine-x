import '../areas';
import { useBoot } from './boot';
import { Shell } from './shell/Shell';

// App-Rahmen (docs/neubau/architektur.md §2.2): startet Fähigkeiten und Daten (`boot.ts`) und
// zeichnet den Rahmen (`shell/Shell.tsx`). Die Bildschirme melden die Bereiche in `src/areas/*`
// an – `import '../areas'` trägt sie einmal ins Register ein.

export function App() {
  useBoot();
  return <Shell />;
}
