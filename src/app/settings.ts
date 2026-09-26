import { create } from 'zustand';
import { local, KEY_PREFIX } from '../platform/storage';

// Oberflächensprache und Darstellung. Maßgeblich gespeichert in `app/profile`
// (`lang`, `theme.m` – dieselben Felder wie in der alten App). localStorage hält nur
// eine Kopie für den ersten Bildaufbau (Kap. 3.1: Bequemlichkeit).

export type Lang = 'de' | 'en';
export type ThemeMode = 'dark' | 'dim' | 'light' | 'auto';
export type ResolvedTheme = 'dark' | 'dim' | 'light';

const LANG_KEY = `${KEY_PREFIX}lang`;
const THEME_KEY = `${KEY_PREFIX}theme`;

export const isLang = (v: unknown): v is Lang => v === 'de' || v === 'en';
export const isThemeMode = (v: unknown): v is ThemeMode => v === 'dark' || v === 'dim' || v === 'light' || v === 'auto';

type SettingsState = {
  lang: Lang;
  theme: ThemeMode;
  setLangLocal(lang: Lang): void;
  setThemeLocal(theme: ThemeMode): void;
};

const initialLang = (): Lang => {
  const v = local.get(LANG_KEY);
  return isLang(v) ? v : 'de';
};
const initialTheme = (): ThemeMode => {
  const v = local.get(THEME_KEY);
  return isThemeMode(v) ? v : 'dark';
};

export const useSettings = create<SettingsState>((set) => ({
  lang: initialLang(),
  theme: initialTheme(),
  setLangLocal(lang) {
    local.set(LANG_KEY, lang);
    set({ lang });
  },
  setThemeLocal(theme) {
    local.set(THEME_KEY, theme);
    set({ theme });
  },
}));

export function resolveTheme(mode: ThemeMode, prefersLight: boolean): ResolvedTheme {
  if (mode === 'auto') return prefersLight ? 'light' : 'dark';
  return mode;
}

const THEME_COLOR: Record<ResolvedTheme, string> = { dark: '#0B0F19', dim: '#1A2030', light: '#F5F6FA' };

export function applyDocumentSettings(lang: Lang, theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.lang = lang;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}
