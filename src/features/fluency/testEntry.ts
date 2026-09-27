import { useNav } from '../../app/nav';

// Test-Einstieg für Flüssigkeit und „Mein nächster Termin“: Die Knöpfe unter „Sprechen“ setzt der
// Umbau der Navigation. Bis dahin (und für die eigenen E2E-Tests) springt `window.__LINGO_GO__`
// direkt zu diesen beiden Bildschirmen – aber NUR, wenn der Entwicklungs-Adapter von außen
// eingespielt ist (`window.__LINGO_FAKE__`, nur in Tests). In claude.ai gibt es ihn nie.

type Target = 'fluency' | 'meeting';
type TestWindow = Window & { __LINGO_FAKE__?: unknown; __LINGO_GO__?: (name: Target) => void };

export function installTestEntry(): void {
  if (typeof window === 'undefined') return;
  const w = window as TestWindow;
  if (!w.__LINGO_FAKE__ || w.__LINGO_GO__) return;
  w.__LINGO_GO__ = (name) => {
    if (name === 'fluency' || name === 'meeting') useNav.getState().go({ name });
  };
}
