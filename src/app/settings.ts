import { create } from 'zustand';
import { local, KEY_PREFIX } from '../platform/storage';

// Oberflächensprache und Darstellung. Maßgeblich gespeichert in `app/profile`
// (`lang`, `theme.m`, `theme.p` – dieselben Felder wie in der alten App). localStorage hält nur
// eine Kopie für den ersten Bildaufbau (Kap. 3.1: Bequemlichkeit).
// Farbthema (M21): Salbei (Standard, Smaragd-Akzent), Ozean, Pflaume, Graphit – je Modus eigene
// Akzent-Tokens in src/styles/index.css ([data-palette] auf <html>).

export type Lang = 'de' | 'en';
export type ThemeMode = 'dark' | 'dim' | 'light' | 'auto';
export type ResolvedTheme = 'dark' | 'dim' | 'light';
export const PALETTES = ['sage', 'ocean', 'plum', 'graphite'] as const;
export type Palette = (typeof PALETTES)[number];

const LANG_KEY = `${KEY_PREFIX}lang`;
const THEME_KEY = `${KEY_PREFIX}theme`;
const PALETTE_KEY = `${KEY_PREFIX}palette`;
/** Handy-Modus (Emrah 01.10.2026): je Gerät, Standard an (`'0'` = aus). */
export const PHONE_MODE_KEY = `${KEY_PREFIX}phone-mode`;

export const isLang = (v: unknown): v is Lang => v === 'de' || v === 'en';
export const isThemeMode = (v: unknown): v is ThemeMode => v === 'dark' || v === 'dim' || v === 'light' || v === 'auto';
export const isPalette = (v: unknown): v is Palette => typeof v === 'string' && (PALETTES as readonly string[]).includes(v);

type SettingsState = {
  lang: Lang;
  theme: ThemeMode;
  palette: Palette;
  /** Am Handy gehört die Sprech-/Schreibaufgabe des Tages nicht zur Pflicht (nur Ansicht, `domain/plan/phone`). */
  phoneMode: boolean;
  setLangLocal(lang: Lang): void;
  setThemeLocal(theme: ThemeMode): void;
  setPaletteLocal(palette: Palette): void;
  setPhoneModeLocal(on: boolean): void;
};

const initialLang = (): Lang => {
  const v = local.get(LANG_KEY);
  return isLang(v) ? v : 'de';
};
const initialTheme = (): ThemeMode => {
  const v = local.get(THEME_KEY);
  return isThemeMode(v) ? v : 'dark';
};
const initialPalette = (): Palette => {
  const v = local.get(PALETTE_KEY);
  return isPalette(v) ? v : 'sage';
};

const initialPhoneMode = (): boolean => local.get(PHONE_MODE_KEY) !== '0';

export const useSettings = create<SettingsState>((set) => ({
  lang: initialLang(),
  theme: initialTheme(),
  palette: initialPalette(),
  phoneMode: initialPhoneMode(),
  setPhoneModeLocal(on) {
    local.set(PHONE_MODE_KEY, on ? '1' : '0');
    set({ phoneMode: on });
  },
  setLangLocal(lang) {
    local.set(LANG_KEY, lang);
    set({ lang });
  },
  setThemeLocal(theme) {
    local.set(THEME_KEY, theme);
    set({ theme });
  },
  setPaletteLocal(palette) {
    local.set(PALETTE_KEY, palette);
    set({ palette });
  },
}));

export function resolveTheme(mode: ThemeMode, prefersLight: boolean): ResolvedTheme {
  if (mode === 'auto') return prefersLight ? 'light' : 'dark';
  return mode;
}

const THEME_COLOR: Record<ResolvedTheme, string> = { dark: '#0B0F19', dim: '#1A2030', light: '#F5F6FA' };

export function applyDocumentSettings(lang: Lang, theme: ResolvedTheme, palette: Palette = 'sage'): void {
  const root = document.documentElement;
  root.lang = lang;
  root.dataset.theme = theme;
  root.dataset.palette = palette;
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}
