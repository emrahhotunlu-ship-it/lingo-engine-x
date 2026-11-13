import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bridgeStatPatch, readBridgeStat } from '../../../src/domain/apply/bridgeTime';
import { countsFreeUse, starterUsed } from '../../../src/modules/apply/domain/bridgeResult';
import { local, removeOlderDayKeys } from '../../../src/platform/storage';

// Prüfbefunde zu Großpaket P „Politur“, P4 (learning-scientist und data-guard, 13.11.2026): übernommener Satzanfang zählt nicht als freie
// Verwendung, gemerkte Runden älterer Lerntage verschwinden aus dem Browser-Speicher, die Zeitmessung einer Runde zählt nur einmal.
// Erfundene Daten.

class MemStorage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe('Satzanfang übernommen → kein Beleg „frei verwendet“ (Befund 9)', () => {
  const head = 'If we had called them earlier,';
  it('erkennt den übernommenen Satzanfang (Groß-/Kleinschreibung egal), nicht einen eigenen Anfang', () => {
    expect(starterUsed('If we had called them earlier, we would have won the deal.', head)).toBe(true);
    expect(starterUsed('  if WE had called them earlier, we would have kept them.', head)).toBe(true);
    expect(starterUsed('Had we called them earlier, we would have won the deal.', head)).toBe(false);
    expect(starterUsed('If we had called them earlier', head)).toBe(false);
    expect(starterUsed('If we had called them earlier, …', null)).toBe(false);
    expect(starterUsed('anything', '  ')).toBe(false);
  });
  it('das Muster zählt nur, wenn es richtig benutzt UND der Satzanfang nicht übernommen wurde', () => {
    const ok = { pat: { v: 'ok' as const, at: '', why: '' } };
    expect(countsFreeUse(ok)).toBe(true);
    expect(countsFreeUse(ok, { starterUsed: false })).toBe(true);
    expect(countsFreeUse(ok, { starterUsed: true })).toBe(false);
    expect(countsFreeUse({ pat: { v: 'wrong' as const, at: 'x', why: '' } })).toBe(false);
  });
});

describe('Browser-Speicher der Brücken-Sätze (Befund 10a)', () => {
  let store: MemStorage;
  beforeEach(() => {
    store = new MemStorage();
    vi.stubGlobal('window', { localStorage: store, sessionStorage: new MemStorage(), addEventListener: () => undefined, removeEventListener: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('entfernt Schlüssel älterer Lerntage, lässt heute, spätere und fremde Schlüssel stehen', () => {
    local.set('lx:bridge:2026-11-11:3:2', '{}');
    local.set('lx:bridge:2026-11-12:free:2', '{}');
    local.set('lx:bridge:2026-11-13:3:2', '{}');
    local.set('lx:bridge:2026-11-14:3:1', '{}');
    local.set('lx:bridge:kaputt', '{}');
    local.set('lx:combo:2026-11-01:3', '{}');
    local.set('sw2:bridge:2026-11-01', '{}');
    expect(removeOlderDayKeys('lx:bridge:', '2026-11-13')).toBe(2);
    expect(local.keys().sort()).toEqual(['lx:bridge:2026-11-13:3:2', 'lx:bridge:2026-11-14:3:1', 'lx:bridge:kaputt', 'lx:combo:2026-11-01:3', 'sw2:bridge:2026-11-01']);
    // Zweiter Lauf: nichts mehr zu tun.
    expect(removeOlderDayKeys('lx:bridge:', '2026-11-13')).toBe(0);
  });
  it('beim Start des Bereichs Anwenden: die Aufräumung läuft über die Speicher-Schicht', async () => {
    local.set('lx:bridge:2026-11-01:3:2', '{}');
    local.set('lx:bridge:2026-11-13:3:2', '{}');
    const { pruneBridgeKeys } = await import('../../../src/modules/apply/index');
    expect(pruneBridgeKeys('2026-11-13')).toBe(1);
    expect(local.keys()).toEqual(['lx:bridge:2026-11-13:3:2']);
  });
  it('ohne Browser-Speicher (privates Fenster): kein Fehler, nichts entfernt', () => {
    vi.stubGlobal('window', { localStorage: undefined });
    expect(removeOlderDayKeys('lx:bridge:', '2026-11-13')).toBe(0);
  });
});

describe('Zeitmessung einer Runde zählt nur einmal (Befund 10b)', () => {
  it('Rundenmarke: dieselbe Runde ein zweites Mal → nichts zu schreiben; eine neue Runde zählt', () => {
    const first = bridgeStatPatch({ abm: { n: 10, ms: 80_000 } }, [160_000], 'bridge:2026-11-13:3:2:abc');
    expect(first).toEqual({ abm: { n: 11, ms: 90_000, r: 'bridge:2026-11-13:3:2:abc' } });
    const after = { abm: first!.abm };
    expect(bridgeStatPatch(after, [160_000], 'bridge:2026-11-13:3:2:abc')).toBeNull();
    expect(bridgeStatPatch(after, [160_000], 'bridge:2026-11-14:3:2:def')).toMatchObject({ abm: { n: 12, r: 'bridge:2026-11-14:3:2:def' } });
    // Die Marke stört das Lesen nicht (ältere Fassungen lesen nur n und ms).
    expect(readBridgeStat(after)).toEqual({ n: 11, ms: 90_000 });
    // Ohne Marke wie bisher.
    expect(bridgeStatPatch({ abm: { n: 10, ms: 80_000 } }, [160_000])).toEqual({ abm: { n: 11, ms: 90_000 } });
  });
});
