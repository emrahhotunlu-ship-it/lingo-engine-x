import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardStatus, isFestCard } from '../../src/domain/metrics/cardStatus';
import { wordFest, wordStatus, wordTier } from '../../src/domain/tutor/learnerWords';
import { buildLearnerModel } from '../../src/domain/tutor/learner';
import { toTrainCard } from '../../src/domain/srs/cards';

// Tutor-Engine v3 S2 „Eine Wahrheit“: Den Status einer Karte rechnen nur `metrics/cardStatus.ts` (die Regeln), `tutor/learnerWords.ts`
// (der eine Zugang) und `tutor/learner.ts` (das Lernermodell). Alle Bildschirme und Zähler fragen `wordStatus`/`wordTier`/`wordFest`.
// Alle Daten sind erfunden.

const ROOT = join(__dirname, '../../src');
const ALLOWED = new Set(['domain/metrics/cardStatus.ts', 'domain/tutor/learnerWords.ts', 'domain/tutor/learner.ts']);
const CALL = /\b(cardStatus|cardStatusFrom|isFestCard|isFestState|isFestFrom|unitState|isFest)\s*\(/;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 19, 12).getTime();
const docs = Array.from({ length: 40 }, (_, i) => ({
  id: `w${i}`,
  word: `word${i}`,
  de: `Wort${i}`,
  stage: i % 6,
  S: 2 + (i % 9) * 4,
  D: 1 + (i % 8),
  state: i % 4 ? 'review' : 'learning',
  reps: 1 + (i % 5),
  due: NOW + ((i % 9) - 4) * DAY,
  last: NOW - (1 + (i % 13)) * DAY,
  ex: `The word${i} was here.`,
  ...(i % 7 === 0 ? { hidden: true } : {}),
  ...(i % 5 === 0 ? { na: 1 } : {}),
  hist: Array.from({ length: i % 6 }, (_, k) => ({ t: NOW - (40 - k * 6) * DAY, x: ['type', 'mc_en', 'produce'][k % 3], g: [3, 1, 4, 3][(i + k) % 4], s: `We met word${i} in sentence ${k % 2}.` })),
}));

describe('Eine Wahrheit für den Kartenstatus', () => {
  it('keine Status-Regel wird außerhalb des Lernermodells direkt aufgerufen', () => {
    const hits: string[] = [];
    for (const f of files(ROOT)) {
      const rel = relative(ROOT, f).replaceAll('\\', '/');
      if (ALLOWED.has(rel)) continue;
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const t = line.trim();
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
          if (CALL.test(line)) hits.push(`${rel}:${i + 1}: ${t}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it('wordStatus/wordTier/wordFest = Regeln ohne Zwischenspeicher (auch beim zweiten Aufruf)', () => {
    let n = 0;
    for (const d of docs) {
      const c = toTrainCard(d.id, d, true, NOW);
      if (!c) continue;
      n++;
      for (const t of [NOW, NOW + 30 * DAY]) {
        expect(wordStatus(c, t)).toEqual(cardStatus(c, t));
        expect(wordStatus(c, t)).toEqual(cardStatus(c, t));
        expect(wordTier(c, t)).toBe(cardStatus(c, t).tier);
        expect(wordFest(c, t)).toBe(isFestCard(c, t));
      }
      expect(wordFest(c)).toBe(isFestCard(c));
    }
    expect(n).toBeGreaterThan(20);
  });

  it('Stufenwechsel am selben Dokument-Objekt rechnet neu', () => {
    const d = { ...docs[5]!, hist: [] };
    const c = toTrainCard(d.id, d, true, NOW);
    if (!c) throw new Error('Karte fehlt');
    expect(wordStatus({ ...c, stage: 0 }, NOW)).toEqual(cardStatus({ ...c, stage: 0 }, NOW));
    expect(wordStatus({ ...c, stage: 5 }, NOW)).toEqual(cardStatus({ ...c, stage: 5 }, NOW));
  });

  it('Lernermodell und Liste sagen dasselbe (Kopf-Zustand)', () => {
    const vocab = new Map(docs.map((d) => [d.id, d as Record<string, unknown>]));
    const m = buildLearnerModel({ grammarDocs: new Map(), logs: new Map(), vocab, act: new Map(), profile: null, diag: [] }, NOW);
    let n = 0;
    for (const d of docs) {
      const c = toTrainCard(d.id, d, true, NOW);
      const w = m.words.get(d.id);
      if (!c || !w) continue;
      n++;
      const st = wordStatus(c, NOW);
      expect(w.head).toBe(st.mind === 'none' ? 'noGap' : st.mind);
      expect(w.freeDays).toBe(st.freeDays);
    }
    expect(n).toBeGreaterThan(20);
  });
});
