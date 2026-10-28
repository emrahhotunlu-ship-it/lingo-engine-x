import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONTEXT_COLUMN_MIN_PX,
  CONTEXT_PORTAL_ID,
  closeContext,
  contextPortalTarget,
  contextPresentation,
  currentContext,
  currentPresentation,
  openContext,
  useContextColumn,
  type ContextContent,
} from '../../src/app/shell/contextColumn';

// Kontextspalte (P2 S1-SHELL, Plan §3.2): ein Store, Spalte ab 1024 px, darunter Blatt.

const item = (kind: ContextContent['kind'], onClose?: () => void): ContextContent => ({ kind, node: null, title: kind, onClose });

afterEach(() => {
  useContextColumn.setState({ current: null });
  vi.unstubAllGlobals();
});

describe('contextColumn', () => {
  it('Portal-Ziel und Schwelle stehen fest', () => {
    expect(CONTEXT_PORTAL_ID).toBe('lx-context');
    expect(CONTEXT_COLUMN_MIN_PX).toBe(1024);
  });

  it('Darstellung: unter 1024 px Blatt, ab 1024 px Spalte', () => {
    expect(contextPresentation(390)).toBe('sheet');
    expect(contextPresentation(768)).toBe('sheet');
    expect(contextPresentation(1023)).toBe('sheet');
    expect(contextPresentation(1024)).toBe('column');
    expect(contextPresentation(1440)).toBe('column');
  });

  it('öffnen, ersetzen, schließen; onClose läuft genau einmal', () => {
    const a = vi.fn();
    const b = vi.fn();
    expect(currentContext()).toBeNull();
    openContext(item('claude', a));
    expect(currentContext()?.kind).toBe('claude');
    openContext(item('word', b));
    expect(a).toHaveBeenCalledTimes(1);
    expect(currentContext()?.kind).toBe('word');
    expect(closeContext()).toBe(true);
    expect(b).toHaveBeenCalledTimes(1);
    expect(currentContext()).toBeNull();
    expect(closeContext()).toBe(false);
  });

  it('closeContext(kind) schließt nur die passende Art', () => {
    const a = vi.fn();
    openContext(item('explain', a));
    expect(closeContext('claude')).toBe(false);
    expect(currentContext()?.kind).toBe('explain');
    expect(a).not.toHaveBeenCalled();
    expect(closeContext('explain')).toBe(true);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('denselben Inhalt erneut öffnen ruft onClose nicht', () => {
    const a = vi.fn();
    const c = item('more', a);
    openContext(c);
    openContext(c);
    expect(a).not.toHaveBeenCalled();
  });

  it('ohne Fenster: Blatt und kein Portal-Ziel', () => {
    expect(currentPresentation()).toBe('sheet');
    expect(contextPortalTarget()).toBeNull();
  });

  it('mit Fenster: folgt der Medienabfrage', () => {
    let wide = true;
    vi.stubGlobal('window', {
      innerWidth: 0,
      matchMedia: (q: string) => ({ matches: q.includes('1024') && wide, addEventListener: () => undefined, removeEventListener: () => undefined }),
    });
    expect(currentPresentation()).toBe('column');
    wide = false;
    expect(currentPresentation()).toBe('sheet');
  });
});
