import { describe, expect, it } from 'vitest';
import seed from '../../seed/sample-data.json';
import legacyVocab from '../../src/content/legacy/vocab.json';
import passages from '../../src/content/legacy/passages.json';
import charge1 from '../../src/content/col/charge1.json';
import { atlasDoc, atlasEntries } from '../../src/domain/atlas/atlas';
import { PACK, packDoc } from '../../src/domain/c1pack/pack';
import { toTrainCard } from '../../src/domain/srs/cards';
import { toChunkCard } from '../../src/domain/srs/chunkCards';
import { findContext } from '../../src/domain/srs/context';
import { buildExercise, meaningsOverlap } from '../../src/domain/srs/exercise';
import { GAP_SENTENCE_MAX_WORDS, gapSentence, gapSentenceIssues, isCleanGapSentence, sentencePieces } from '../../src/domain/srs/gapSentence';
import { makeEnv, supports } from '../../src/domain/srs/modes';
import { bracketExample } from '../../src/domain/srs/newCard';
import type { ContextSpan, TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Audit 25.10.2026 (Emrahs Meldung „Auch ne blöde Aufgabe“): Wie viele Lückenaufgaben des Bestands zeigen einen Satz, der nicht eindeutig lösbar ist?
// Gezählt wird der Ursprungssatz jeder Karte (vor der Regel) und der Satz, den die Lückenaufgabe jetzt zeigt (nach der Regel, muss 0 Mängel haben).
// Mit LX_AUDIT=1 druckt der Test die Zahlen und 20 Beispiele.

type Doc = Record<string, unknown>;
const NOW = berlin('2026-10-25', 9);
const TODAY = '2026-10-25';
const KEYS = makeEnv(false, false, false);

const cards: Array<{ src: string; card: TrainCard }> = [];
const add = (src: string, c: TrainCard | null) => {
  if (c && !c.hidden) cards.push({ src, card: c });
};
for (const [path, d] of Object.entries(seed as Record<string, Doc>)) {
  if (path.startsWith('vocab/')) add('seed', toTrainCard(path.slice(6), d, true, NOW));
  if (path.startsWith('chunk/')) add('seed', toChunkCard(path.slice(6), d, NOW));
}
for (const v of (legacyVocab as { seedVocab: Array<{ w: string; p: string; de: string; def: string; ex: string; l: string }> }).seedVocab) {
  add('legacy', toTrainCard(v.w, { word: v.w, pos: v.p, de: v.de, def: v.def, ex: v.ex, level: v.l, col: [] }, false, NOW));
}
for (const e of PACK) {
  const m = packDoc(e, TODAY, NOW);
  if (m) add('pack', m.kind === 'chunk' ? toChunkCard(m.id, m.doc, NOW) : toTrainCard(m.id, m.doc, true, NOW));
}
for (const e of atlasEntries()) {
  const m = atlasDoc(e, TODAY, NOW);
  if (m) add('atlas', toTrainCard(m.id, m.doc, true, NOW));
}

/** Wortpartner-Sätze der Charge `col` (wechseln als weitere Sätze mit). */
const colSentences: Array<{ word: string; ctx: ContextSpan }> = [];
for (const it of (charge1 as { items: Array<{ word: string; col: Array<{ ex: string }> }> }).items) {
  for (const c of it.col) {
    const ctx = findContext(c.ex.replace(/\[|\]/g, ''), it.word);
    if (ctx) colSentences.push({ word: it.word, ctx });
  }
}

/** Lesetexte: so speichert „Als Karte speichern“ ein Wort aus einem Absatz (bracketExample auf den angetippten Absatz). */
const paragraphs: string[] = [];
for (const a of [...(passages as { articles: Array<{ text: string }> }).articles, ...(passages as { listen: Array<{ text: string }> }).listen]) {
  for (const p of a.text.split(/\n+/)) if (p.trim()) paragraphs.push(p.trim());
}

type Row = { src: string; word: string; issues: string[]; sentence: string };
const describeCtx = (c: ContextSpan): string => `${c.sentence.slice(0, c.start)}____${c.sentence.slice(c.end)}`;

function audit() {
  const before: Row[] = [];
  const after: Row[] = [];
  let gapCards = 0;
  let typeInstead = 0;
  for (const { src, card } of cards) {
    if (card.context) {
      const issues = gapSentenceIssues(card.context);
      const words = sentencePieces(card.context.sentence).reduce((n, p) => n + p.words, 0);
      const firstThird = card.context.start < card.context.sentence.length / 3;
      const lastThird = card.context.end > (card.context.sentence.length * 2) / 3;
      const cut = /^\s*(?:…|\.{3})/.test(card.context.sentence) || /(?:…|\.{3})\s*$/.test(card.context.sentence);
      const extra = [...(words > GAP_SENTENCE_MAX_WORDS && !issues.includes('too_long') ? ['text>22'] : []), ...(cut && (firstThird || lastThird) ? ['edge_of_cut'] : [])];
      const all = [...issues, ...extra];
      if (all.length) before.push({ src, word: card.word, issues: all, sentence: describeCtx(card.context) });
    }
    const c = { ...card, stage: 1 as TrainCard['stage'] };
    const ok = supports(c, 'cloze', 'de', 8, KEYS);
    if (!ok) {
      if (card.context) typeInstead++;
      continue;
    }
    gapCards++;
    for (const origin of [true, false]) {
      const e = buildExercise(c, 'cloze', 'de', [c], `${TODAY}|0`, { origin });
      if (!e.sentence || !isCleanGapSentence(e.sentence)) after.push({ src, word: card.word, issues: e.sentence ? gapSentenceIssues(e.sentence) : ['none'], sentence: e.sentence?.sentence ?? '' });
    }
  }
  return { before, after, gapCards, typeInstead };
}

/** Bedeutungs-Zwillinge im Bestand: gleiche Wortart, überlappende deutsche Bedeutung → „Gesucht: …“ allein trennt sie nicht. */
function twins(list: readonly TrainCard[]): Array<[string, string, string]> {
  const out: Array<[string, string, string]> = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (a.kind !== b.kind || (a.pos ?? '') !== (b.pos ?? '') || a.lemma === b.lemma) continue;
      if (meaningsOverlap(a.de, b.de)) out.push([a.word, b.word, `${a.de} | ${b.de}`]);
    }
  }
  return out;
}

describe('Audit Lückensätze über den ganzen Bestand', () => {
  const r = audit();
  it('hat Karten zum Prüfen', () => expect(cards.length).toBeGreaterThan(1000));
  it('jede Lückenaufgabe zeigt genau einen vollständigen Satz mit höchstens 22 Wörtern (Anker und Wechselsatz)', () => {
    expect(r.after.slice(0, 5)).toEqual([]);
  });
  it('Wortpartner-Sätze: Mängel werden nur gezählt (sie wechseln nur mit, wenn sauber)', () => {
    expect(colSentences.length).toBeGreaterThan(50);
  });
  it('Zahlen (LX_AUDIT=1 druckt den Bericht)', () => {
    const seedCards = cards.filter((x) => x.src === 'seed' || x.src === 'pack').map((x) => x.card);
    const tw = twins(seedCards);
    const colBad = colSentences.filter((x) => gapSentenceIssues(x.ctx).length);
    // Lesetexte: ein Wort je Absatz und Satz (das längste Wort des Satzes), gespeichert wie aus dem Leser
    let saved = 0;
    let savedNoGap = 0;
    const savedBad: string[] = [];
    for (const p of paragraphs) {
      for (const s of sentencePieces(p)) {
        const w = (s.text.match(/[A-Za-z]{7,}/g) ?? []).sort((a, b) => b.length - a.length)[0];
        if (!w) continue;
        const ex = bracketExample(p, w, w);
        if (!ex) continue;
        saved++;
        const ctx = findContext(ex, w);
        if (!ctx || !isCleanGapSentence(ctx)) savedBad.push(ex);
        if (!ctx || !gapSentence(ctx)) savedNoGap++;
      }
    }
    if (process.env.LX_AUDIT) {
      const count = (k: string) => r.before.filter((x) => x.issues.includes(k)).length;
      const bySrc = (k: string) => [...new Set(cards.map((c) => c.src))].map((s) => `${s} ${r.before.filter((x) => x.src === s && x.issues.length).length}/${cards.filter((c) => c.src === s).length}`).join(', ') + ` (${k})`;
      console.warn(
        [
          `Karten: ${cards.length} (${bySrc('Ursprungssatz mit Mangel/alle')})`,
          `Ursprungssatz mit Mangel: ${r.before.length}`,
          `  zu lang (Satz der Lücke > ${GAP_SENTENCE_MAX_WORDS} Wörter): ${count('too_long')}`,
          `  ganzer Text > ${GAP_SENTENCE_MAX_WORDS} Wörter: ${count('text>22') + count('too_long')}`,
          `  mehrere Sätze: ${count('multi')}`,
          `  beginnt mit „…“ (Lücke im abgeschnittenen Satzanfang): ${count('cut_start')}`,
          `  endet mit „…“ (Lücke im abgebrochenen Satz): ${count('cut_end')}`,
          `  Lücke im ersten/letzten Drittel eines abgeschnittenen Auszugs: ${count('edge_of_cut')}`,
          `  „…“ mitten im Satz: ${count('ellipsis_inside')}`,
          `Lückenkarten nach der Regel: ${r.gapCards}, davon mit Mangel: ${r.after.length}; ohne brauchbaren Satz → Deutsch→Englisch tippen: ${r.typeInstead}`,
          `Wortpartner-Sätze (col): ${colSentences.length}, mit Mangel: ${colBad.length}`,
          `Lesetexte, so gespeichert wie aus dem Leser: ${saved}, Ursprungssatz nicht direkt als Lücke zeigbar: ${savedBad.length}, ohne jeden brauchbaren Lückensatz: ${savedNoGap}`,
          `Bedeutungs-Zwillinge (Seed+C1-Paket, gleiche Wortart, Deutsch überlappt): ${tw.length}`,
          '',
          '20 Beispiele (vorher):',
          ...r.before.slice(0, 20).map((x) => `  [${x.src}] ${x.word} · ${x.issues.join(',')} · ${x.sentence}`),
          '',
          'Lesetexte (Beispiele):',
          ...savedBad.slice(0, 5).map((x) => `  ${x}`),
          '',
          'Zwillinge (Beispiele):',
          ...tw.slice(0, 12).map(([a, b, d]) => `  ${a} / ${b} · ${d}`),
        ].join('\n'),
      );
    }
    expect(saved).toBeGreaterThan(0);
  });
});
