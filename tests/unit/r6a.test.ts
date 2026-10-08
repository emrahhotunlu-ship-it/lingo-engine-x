import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { dayMoment, levelUpFor, markSeen, nextLevelUp, numberRolls, parseSeen, roundSparks, SEEN_MAX, stateUps } from '../../src/domain/moments/detect';
import { AXIS_LOCK_PX, followPose, lockAxis, MAX_ROTATE, RELEASE_PX, releaseDecision, TINT_PX } from '../../src/engine/cardSwipe';
import { ACTIVE_MS, blobsAt, FPS, phaseOf, SCALE } from '../../src/engine/fx/AmbientLight';
import { LINES_MAX, MOMENT_MAX_MS, momentLine, momentLines, momentStats, pushLine, resetMeasure } from '../../src/engine/fx/measure';
import { SPARK_MAX } from '../../src/engine/fx/moments';
import { ARC_GAP_DEG, dutyFills, ringArcs } from '../../src/ui/DayRing';
import { EMBLEM_IDS, EMBLEM_MARK } from '../../src/ui/moments/Emblem';
import { movingCols, odometerCols, ROLL_MS } from '../../src/ui/Odometer';
import { STACK } from '../../src/ui/motion';

// Lernplattform 3.0 R6 Spur A (P54–P60, P64): reine Teile der Premium-Bewegung.

const ROOT = join(__dirname, '../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe('P56 Momente erkennen', () => {
  it('meldet nur echte Aufstiege, fehlender Vorher-Wert zählt als neu', () => {
    const before = new Map([
      ['a', 'learning' as const],
      ['b', 'safe' as const],
      ['c', 'firm' as const],
    ]);
    const after = new Map([
      ['a', 'safe' as const],
      ['b', 'safe' as const],
      ['c', 'safe' as const],
      ['d', 'learning' as const],
    ]);
    expect(stateUps(before, after)).toEqual([
      { id: 'a', from: 'learning', to: 'safe' },
      { id: 'd', from: 'new', to: 'learning' },
    ]);
  });

  it('Funken am Rundenende: höchstens drei Ursprünge, Feste zuerst, ohne Aufstieg keine', () => {
    const ups = [
      { id: '1', to: 'learning' as const },
      { id: '2', to: 'safe' as const },
      { id: '3', to: 'firm' as const },
      { id: '4', to: 'safe' as const },
      { id: '5', to: 'firm' as const },
    ];
    expect(roundSparks(ups).map((u) => u.id)).toEqual(['3', '5', '2']);
    expect(roundSparks([])).toEqual([]);
    expect(SPARK_MAX).toBeLessThanOrEqual(16);
  });

  it('Tagesmoment nur beim Übergang offen → fertig und einmal', () => {
    expect(dayMoment('open', 'done', false)).toBe(true);
    expect(dayMoment(null, 'done', false)).toBe(false);
    expect(dayMoment('done', 'done', false)).toBe(false);
    expect(dayMoment('open', 'done', true)).toBe(false);
  });

  it('Zahl rollt nur bei geändertem Wert', () => {
    expect(numberRolls(null, '12')).toBe(true);
    expect(numberRolls('12', '12')).toBe(false);
    expect(numberRolls('9', '12')).toBe(true);
  });

  it('Aufstieg: Kapitel, C1 und Wort-Marken ab 250; je Gerät einmal', () => {
    expect(levelUpFor('ch3')).toEqual({ kind: 'chapter', n: 3 });
    expect(levelUpFor('c1ready')).toEqual({ kind: 'c1' });
    expect(levelUpFor('fest500')).toEqual({ kind: 'words', n: 500 });
    expect(levelUpFor('fest100')).toBeNull();
    expect(levelUpFor('topic1')).toBeNull();
    expect(nextLevelUp(['fest100', 'ch2'], [])?.id).toBe('ch2');
    expect(nextLevelUp(['ch2'], ['ch2'])).toBeNull();
    const many = Array.from({ length: SEEN_MAX + 5 }, (_, i) => `x${i}`).reduce<string[]>((s, id) => markSeen(s, id), []);
    expect(many).toHaveLength(SEEN_MAX);
    expect(markSeen(['a'], 'a')).toEqual(['a']);
    expect(parseSeen('kaputt')).toEqual([]);
    expect(parseSeen('["a",1,"b"]')).toEqual(['a', 'b']);
  });
});

describe('P55 Zähler und Tagesring', () => {
  it('Spalten rechtsbündig gepaart, neue Spalten blenden ein, Zeichen stehen fest', () => {
    expect(odometerCols('9', '12')).toEqual([
      { kind: 'digit', from: 0, to: 1, lead: true },
      { kind: 'digit', from: 9, to: 2, lead: false },
    ]);
    const cols = odometerCols('1.250', '1.300');
    expect(cols[1]).toEqual({ kind: 'char', ch: '.' });
    expect(movingCols(cols)).toBe(2);
    expect(movingCols(odometerCols('42', '42'))).toBe(0);
  });

  it('ohne Vorwert rollt jede Ziffer aus der Einblendung (kein „0“-Zwischenbild als Wert)', () => {
    expect(odometerCols(null, '7')).toEqual([{ kind: 'digit', from: 0, to: 7, lead: true }]);
    expect(ROLL_MS).toBeLessThanOrEqual(MOMENT_MAX_MS);
  });

  it('Bogenanteile = Pflichtzustand (erledigt 1, offen höchstens 0,95)', () => {
    const fills = dutyFills([
      { state: 'done', progress: null },
      { state: 'open', progress: { done: 9, total: 10 } },
      { state: 'open', progress: { done: 10, total: 10 } },
      { state: 'open', progress: null },
    ]);
    expect(fills).toEqual([1, 0.9, 0.95, 0]);
    expect(fills.filter((f) => f >= 1)).toHaveLength(1);
  });

  it('vier Bogen mit sichtbarer Lücke von 8° (Kappen eingerechnet); geschlossen ein Ring', () => {
    const size = 168;
    const stroke = 14;
    const arcs = ringArcs(4, size, stroke);
    const r = (size - stroke) / 2;
    const cap = (stroke / r) * (180 / Math.PI);
    expect(arcs).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      const a = arcs[i]!;
      const next = arcs[(i + 1) % 4]!;
      const visibleGap = (next.start + (i === 3 ? 360 : 0)) - (a.start + a.len) - cap;
      expect(visibleGap).toBeCloseTo(ARC_GAP_DEG, 5);
    }
    const closed = ringArcs(4, size, stroke, true);
    expect(closed.reduce((s, a) => s + a.len, 0)).toBeCloseTo(360, 5);
  });
});

describe('P54 Wischen und Stapel', () => {
  it('Achse rastet erst nach 10 px ein; 30 px senkrecht bewegt die Karte nicht', () => {
    expect(lockAxis(5, 6)).toBeNull();
    expect(lockAxis(AXIS_LOCK_PX + 1, 2)).toBe('x');
    expect(lockAxis(4, 30)).toBe('y');
    expect(lockAxis(12, 30)).toBe('y');
  });

  it('Karte folgt mit begrenzter Drehung und färbt ab 48 px', () => {
    expect(followPose(20)).toEqual({ x: 20, rot: 1, side: null });
    expect(followPose(-TINT_PX).side).toBe('left');
    expect(followPose(400).rot).toBe(MAX_ROTATE);
  });

  it('Entscheidung: bekannte Geste zuerst, beim Folgen ab 96 px; senkrecht nie', () => {
    const a = { x: 200, y: 300, t: 0 };
    expect(releaseDecision(a, { x: 120, y: 302, t: 200 }, null)).toBe('left');
    expect(releaseDecision(a, { x: 200 + RELEASE_PX, y: 310, t: 2000 }, 'x')).toBe('right');
    expect(releaseDecision(a, { x: 210, y: 330, t: 200 }, 'y')).toBeNull();
    expect(releaseDecision(a, { x: 230, y: 300, t: 2000 }, 'x')).toBeNull();
  });

  it('Kartenwechsel bleibt Bedienbewegung (≤ 300 ms), nie ein Leerbild', () => {
    expect(STACK.exitMs).toBeLessThanOrEqual(300);
    expect(STACK.enterMs).toBeLessThanOrEqual(300);
    expect(STACK.flyMs).toBeLessThanOrEqual(300);
    expect(STACK.fadeMs).toBeLessThanOrEqual(150);
    expect(STACK.enterOpacity).toBeGreaterThan(0);
  });
});

describe('P57 Lichtfeld', () => {
  it('Startphase ist je Lerntag fest, das Standbild deterministisch', () => {
    expect(phaseOf('2026-10-07')).toBe(phaseOf('2026-10-07'));
    expect(phaseOf('2026-10-07')).not.toBe(phaseOf('2026-10-08'));
    expect(blobsAt(3, phaseOf('2026-10-07'), 0.16)).toEqual(blobsAt(3, phaseOf('2026-10-07'), 0.16));
  });

  it('Wege bleiben klein, in Übungen gedimmt, 24 fps in 1/6 Auflösung, 12 s Bewegung', () => {
    const p = phaseOf('x');
    for (let t = 0; t < 70; t += 1.7) {
      const [a] = blobsAt(t, p, 0.16);
      expect(Math.abs(a.x - 0.5)).toBeLessThanOrEqual(0.06 + 1e-9);
    }
    expect(blobsAt(0, p, 0.16, 0.5)[0].a).toBeCloseTo(0.08, 6);
    expect(FPS).toBe(24);
    expect(SCALE).toBe(6);
    expect(ACTIVE_MS).toBe(12_000);
  });
});

describe('P60 Messung und Embleme', () => {
  afterEach(() => resetMeasure());

  it('Diagnosezeile aus Bildabständen', () => {
    const s = momentStats([16, 17, 16, 33]);
    expect(s).toEqual({ fps: Math.round(1000 / ((16 + 17 + 16 + 33) / 4)), maxMs: 33, frames: 4 });
    expect(momentLine('Tag geschafft', s, 'full')).toBe(`Tag geschafft · ${s!.fps} fps · längstes Bild 33 ms · Stufe full`);
    expect(momentStats([])).toBeNull();
  });

  it('höchstens 20 Zeilen, jede Änderung ist eine neue Liste', () => {
    const first = momentLines();
    for (let i = 0; i < LINES_MAX + 3; i++) pushLine(`z${i}`);
    expect(momentLines()).not.toBe(first);
    expect(momentLines()).toHaveLength(LINES_MAX);
    expect(momentLines()[0]).toBe('z3');
  });

  it('acht Embleme, je klein (≈ 400 B)', () => {
    expect(EMBLEM_IDS).toHaveLength(8);
    for (const id of EMBLEM_IDS) expect(EMBLEM_MARK[id].length).toBeLessThan(120);
    const src = readFileSync(join(ROOT, 'src/ui/moments/Emblem.tsx'), 'utf8');
    expect(src.length).toBeLessThan(8 * 600);
  });

  it('„Momente ansehen“ liest nur moments.json: kein Seed, kein Entwicklungs-Adapter, keine Datenbank', () => {
    const src = readFileSync(join(ROOT, 'src/features/settings/MomentsDemo.tsx'), 'utf8');
    const imports = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1] ?? '');
    expect(imports.some((i) => i.includes('seed'))).toBe(false);
    expect(imports.some((i) => i.includes('platform/dev'))).toBe(false);
    expect(imports.some((i) => /\/data\/|writer|actions/.test(i))).toBe(false);
    expect(imports).toContain('../../content/demo/moments.json');
  });
});

describe('P64 Dauerwächter', () => {
  /** Dateien, in denen Momente (≤ 1,4 s) leben dürfen. */
  const MOMENT_FILES = ['src/ui/motion.ts', 'src/ui/Odometer.tsx', 'src/ui/DayRing.tsx', 'src/engine/fx/', 'src/ui/moments/', 'src/features/settings/MomentsDemo.tsx', 'src/engine/SentenceMorph.tsx', 'src/features/c1/film/'];
  const isMoment = (rel: string): boolean => MOMENT_FILES.some((m) => rel.startsWith(m));

  it('keine Dauer über 0,3 s und kein Federn über 0,4 außerhalb von motion.ts und den Momenten', () => {
    const bad: string[] = [];
    for (const file of walk(join(ROOT, 'src'))) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (isMoment(rel) || rel.startsWith('src/platform/dev/')) continue;
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\b(visualDuration|duration|bounce)\s*:\s*([0-9.]+)/g)) {
        const key = m[1];
        const v = Number(m[2]);
        // `duration` unter 20 = Sekunden (framer-motion), sonst Millisekunden (Web Animations).
        const tooLong = key === 'bounce' ? v > 0.4 : v < 20 ? v > 0.3 : v > 300;
        if (tooLong) bad.push(`${rel}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('r6a.css: lange Übergänge nur in Momenten (Zähler, Ring, Aufstieg), keine über 1,4 s', () => {
    const css = readFileSync(join(ROOT, 'src/styles/parts/r6a.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const bad: string[] = [];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = (m[1] ?? '').trim();
      if (sel.startsWith('@keyframes') || /^(from|to|\d+%)$/.test(sel)) continue;
      const body = m[2] ?? '';
      const moment = /lx-odo|lx-dayring|lx-levelup|lx-emblem/.test(sel);
      for (const d of body.matchAll(/(\d+)ms/g)) {
        const v = Number(d[1]);
        if (v > MOMENT_MAX_MS || (!moment && v > 300)) bad.push(`${sel}: ${d[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
