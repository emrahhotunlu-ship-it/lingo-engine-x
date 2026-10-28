import { createRoot } from 'react-dom/client';
import '../../../src/styles/index.css';
import { applyDocumentSettings, isLang, isThemeMode, resolveTheme, useSettings } from '../../../src/app/settings';
import { LookupLayer } from '../../../src/features/lookup/LookupPopover';
import { initCapabilities } from '../../../src/platform/capabilities';
import { initSpeech } from '../../../src/platform/speech';
import { Toaster } from '../../../src/ui/Toast';
import { ReaderScreen } from '../../../src/modules/read/ui/reader';

// Prüfstand für den Leser (Paket L4, tests/e2e/lesenReader.spec.ts): hängt NUR den Leser samt Nachschlage-Fenster und Hinweisen in eine
// leere Seite, solange die Route (Paket L3) noch nicht verdrahtet ist. Die nachgebildete Laufzeit (`window.claude`) spielt Playwright von außen ein.
// Adresse: `#id=<Artikel-Kennung>&at=<Satz>&lang=de|en&theme=dark|dim|light`. Nicht Teil von dist/.

const q = new URLSearchParams(window.location.hash.slice(1));
const lang = q.get('lang');
const theme = q.get('theme');
const s = useSettings.getState();
if (isLang(lang)) s.setLangLocal(lang);
if (isThemeMode(theme)) s.setThemeLocal(theme);
const now = useSettings.getState();
applyDocumentSettings(now.lang, resolveTheme(now.theme, false), now.accent);
initCapabilities();
initSpeech({ voice: null, rate: 1 });

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt');
createRoot(root).render(
  <>
    <main id="main" className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4">
      <ReaderScreen
        id={q.get('id') ?? ''}
        startAt={Number(q.get('at')) || null}
        onList={() => {
          document.body.dataset.listed = '1';
        }}
      />
    </main>
    <Toaster />
    <LookupLayer />
  </>,
);
