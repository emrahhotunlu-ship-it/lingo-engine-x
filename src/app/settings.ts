import { create } from 'zustand';
import { local, KEY_PREFIX } from '../platform/storage';

// Oberflächensprache und Darstellung. Maßgeblich gespeichert in `app/profile`
// (`lang`, `theme.m` wie in der alten App, dazu `theme.a` für den Akzent). localStorage hält nur
// eine Kopie für den ersten Bildaufbau (Kap. 3.1: Bequemlichkeit).
// Akzent (Relaunch P1 S1-TOK): Iris (Standard) oder Amber, feste Tokens je Modus in src/styles/index.css
// ([data-accent] auf <html>). Die alten Farbthemen (`theme.p`: Ozean, Pflaume, Graphit) werden nicht mehr
// angeboten; das gespeicherte Feld `theme.p` bleibt unangetastet stehen (Rückweg auf die alte Version).

export type Lang = 'de' | 'en';
export type ThemeMode = 'dark' | 'dim' | 'light' | 'auto';
export type ResolvedTheme = 'dark' | 'dim' | 'light';
export const ACCENTS = ['iris', 'amber'] as const;
export type Accent = (typeof ACCENTS)[number];

const LANG_KEY = `${KEY_PREFIX}lang`;
const THEME_KEY = `${KEY_PREFIX}theme`;
export const ACCENT_KEY = `${KEY_PREFIX}accent`;

export const isLang = (v: unknown): v is Lang => v === 'de' || v === 'en';
export const isThemeMode = (v: unknown): v is ThemeMode => v === 'dark' || v === 'dim' || v === 'light' || v === 'auto';
export const isAccent = (v: unknown): v is Accent => v === 'iris' || v === 'amber';

type SettingsState = {
  lang: Lang;
  theme: ThemeMode;
  accent: Accent;
  setLangLocal(lang: Lang): void;
  setThemeLocal(theme: ThemeMode): void;
  setAccentLocal(accent: Accent): void;
};

const initialLang = (): Lang => {
  const v = local.get(LANG_KEY);
  return isLang(v) ? v : 'de';
};
const initialTheme = (): ThemeMode => {
  const v = local.get(THEME_KEY);
  return isThemeMode(v) ? v : 'dark';
};
const initialAccent = (): Accent => {
  const v = local.get(ACCENT_KEY);
  return isAccent(v) ? v : 'iris';
};

export const useSettings = create<SettingsState>((set) => ({
  lang: initialLang(),
  theme: initialTheme(),
  accent: initialAccent(),
  setLangLocal(lang) {
    local.set(LANG_KEY, lang);
    set({ lang });
  },
  setThemeLocal(theme) {
    local.set(THEME_KEY, theme);
    set({ theme });
  },
  setAccentLocal(accent) {
    local.set(ACCENT_KEY, accent);
    set({ accent });
  },
}));

export function resolveTheme(mode: ThemeMode, prefersLight: boolean): ResolvedTheme {
  if (mode === 'auto') return prefersLight ? 'light' : 'dark';
  return mode;
}

// Browserleiste in der Grundfarbe des Modus (--bg aus src/styles/index.css, nach sRGB gerundet; gleiche Werte in index.html).
const THEME_COLOR: Record<ResolvedTheme, string> = { dark: '#0C0E14', dim: '#282A2F', light: '#F5F7FA' };

export function applyDocumentSettings(lang: Lang, theme: ResolvedTheme, accent: Accent = 'iris'): void {
  const root = document.documentElement;
  root.lang = lang;
  root.dataset.theme = theme;
  root.dataset.accent = accent;
  delete root.dataset.palette;
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}
