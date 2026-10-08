// Inhalts-Test über ALLE c1x-Inhalte (Lernplattform 3.0 §3.7 Schritt 2, P12): läuft über `src/content/c1x/src/**`.
// Jede Charge, die ein Inhalts-Paket (P18 …) hinzufügt, besteht diese Regeln, sonst ist sie rot.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import transforms from '../../src/content/nb/transforms.json';
import { checkC1Content } from '../../src/domain/c1x/checkContent';
import { defaultCheckCtx } from '../../src/domain/c1x/checkContext';
import { legacyV2Items } from '../../src/domain/c1x/legacyV2';
import { c1File } from '../../src/domain/c1x/schema';
import { itemKey } from '../../src/domain/c1x/accept';
import { isFull, scoreC1 } from '../../src/domain/c1x/score';
import { solutionsOf, wrongsOf } from '../../src/domain/c1x/solutions';
import type { C1Item } from '../../src/domain/c1x/types';
import { legacyNorm } from '../../src/domain/grammar/key';
import { devMarkers, removedTemplates } from '../../scripts/check-platform.mjs';

const ROOT = join(process.cwd(), 'src/content/c1x/src');
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : []));
}
const paths = files(ROOT).sort();
const loaded = paths.map((p) => ({ path: p.slice(ROOT.length + 1), text: readFileSync(p, 'utf8') }));
const items: Array<{ path: string; item: C1Item }> = [];
for (const f of loaded) {
  const r = c1File.safeParse(JSON.parse(f.text));
  if (r.success) for (const it of r.data.items) items.push({ path: f.path, item: it });
}
const ctx = defaultCheckCtx();

describe('c1x-Inhalte', () => {
  it('es gibt Inhaltsdateien, alle sind schemagültig und stehen im Ordner ihrer Art (oder pilot/, place/, gate/)', () => {
    expect(paths.length).toBeGreaterThan(0);
    for (const f of loaded) {
      const r = c1File.safeParse(JSON.parse(f.text));
      expect(r.success, `${f.path}: ${JSON.stringify(r.error?.issues.slice(0, 2))}`).toBe(true);
      if (r.success) for (const it of r.data.items) {
        const dir = f.path.split('/')[0];
        expect(dir === 'pilot' || dir === 'place' || (dir === 'gate' && it.pool === 'gate') || dir === it.kind, `${f.path}: ${it.id} liegt im falschen Ordner`).toBe(true);
      }
    }
  });

  it('keine Entwicklungs-Marker in den Rohinhalten (wie check:platform)', () => {
    for (const f of loaded) for (const m of [...devMarkers, ...removedTemplates]) expect(f.text.includes(m), `${f.path}: ${m}`).toBe(false);
  });

  it('IDs sind je Art eindeutig', () => {
    const ids = items.map((x) => x.item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede Aufgabe besteht die Inhaltsprüfung; jede Lösungsvariante = Höchstpunktzahl, jede falsche Fassung darunter', () => {
    const problems: string[] = [];
    for (const { path, item } of items) {
      for (const p of checkC1Content(item, ctx)) problems.push(`${path} ${item.id}: ${p}`);
      for (const s of solutionsOf(item)) if (!isFull(scoreC1(item, s))) problems.push(`${path} ${item.id}: Lösung ${JSON.stringify(s)} nicht voll`);
      for (const w of wrongsOf(item)) if (isFull(scoreC1(item, w))) problems.push(`${path} ${item.id}: falsche Fassung ${JSON.stringify(w)} voll`);
    }
    expect(problems).toEqual([]);
  });

  it('Aufgaben für den Check, die Kapitelprüfung und die Einstufung haben ihre Kennzeichnung (nie im Training)', () => {
    for (const { item } of items) if (item.pool === 'gate' || item.pool === 'place') expect(item.probe).toBeUndefined();
  });

  it('keine Dubletten: Hauptsatz einzigartig gegen alle c1x-Inhalte, die LP2-Aufgaben und die Umformungen der Nachbar-Übungen', () => {
    const own = items.map((x) => itemKey(x.item));
    expect(new Set(own).size, 'doppelter Satz in den c1x-Inhalten').toBe(own.length);
    const other = new Set<string>();
    for (const l of legacyV2Items()) other.add(itemKey(l));
    const nb = (transforms as unknown as { items?: Array<{ a?: string }> }).items ?? (transforms);
    for (const t of Array.isArray(nb) ? nb : []) if (typeof t.a === 'string') other.add(legacyNorm(t.a));
    const dup = own.filter((k) => other.has(k));
    // Die Pilotaufgaben stammen aus dem Planentwurf und dürfen nicht doppelt zu bestehenden Aufgaben sein.
    expect(dup).toEqual([]);
  });

  it('Anteile (ab 20 Aufgaben je Art): fehlerfreie err-Sätze 25–35 %, Lösungsposition je 20–30 % bei mcc/para', () => {
    const err = items.filter((x) => x.item.kind === 'err' && x.path !== 'pilot/err.json').map((x) => x.item);
    if (err.length >= 20) {
      const free = err.filter((i) => i.kind === 'err' && i.bad === null).length / err.length;
      expect(free).toBeGreaterThanOrEqual(0.25);
      expect(free).toBeLessThanOrEqual(0.35);
    }
    for (const kind of ['mcc', 'para'] as const) {
      const list = items.map((x) => x.item).filter((i) => i.kind === kind);
      if (list.length < 20) continue;
      for (let pos = 0; pos < 4; pos++) {
        const share = list.filter((i) => (i.kind === 'mcc' || i.kind === 'para') && i.answer === pos).length / list.length;
        expect(share, `${kind} Position ${pos}`).toBeGreaterThanOrEqual(0.2);
        expect(share, `${kind} Position ${pos}`).toBeLessThanOrEqual(0.3);
      }
    }
  });
});

describe('LP2-Adapter besteht die Inhaltsprüfung', () => {
  it('jede umgewandelte Aufgabe ist gültig', () => {
    const problems: string[] = [];
    for (const it of legacyV2Items()) for (const p of checkC1Content(it, {})) problems.push(`${it.id}: ${p}`);
    expect(problems.slice(0, 10)).toEqual([]);
  });
});
