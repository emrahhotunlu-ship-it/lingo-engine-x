import { describe, expect, it } from 'vitest';
import { bridgeFrames, comboFrames } from '../../../src/content/apply/frames';
import { bridgeHistory, bridgeHistoryDays, isLearning, isSettled, knownPatterns, pickBridge, safePatterns, type BridgeFrame, type BridgePat, type BridgeWord } from '../../../src/domain/apply/bridge';
import { BRIDGE_MIN, bridgeMinutes, bridgeMinutesOf, bridgeStatPatch, readBridgeStat } from '../../../src/domain/apply/bridgeTime';
import { patternById, topicsWithPatterns } from '../../../src/domain/grammar/patterns';
import { freeUseOf, freeUsePatch, freeUsesOf, readFreeUse } from '../../../src/domain/grammar/freeUse';
import { patPush, topicStateFromPatterns } from '../../../src/domain/metrics/pattern';
import { applyStepMinutes, unitPlanFor } from '../../../src/domain/unit/planFor';
import { todayPatternOf } from '../../../src/features/apply/todayPattern';
import { bridgeOutItem, bridgeRepair, bridgeVerdict, fixSpans, flowbackOn, hasFix, patMark, reportsWord, wordMark, type BridgeRun } from '../../../src/modules/apply/domain/bridgeResult';
import { applyOfDay } from '../../../src/modules/apply/domain/count';
import { resolveStep } from '../../../src/modules/apply/domain/step';
import type { BridgeOut } from '../../../src/prompts/applyBridge';

// Großpaket P „Politur“, P4 „Anwenden als Brücke“: Zielwahl aus dem Lernstand, 14-Tage-Sperre, Rahmen je Muster, ehrliche Minuten,
// Beleg-Zähler „frei verwendet“, Speicherformen und Schritt 3.

const TODAY = '2026-11-13';
const YESTERDAY = '2026-11-12';
type Doc = Record<string, unknown>;

const word = (key: string, lv: number, o: Partial<BridgeWord> = {}): BridgeWord => ({
  key: `vocab/${key}`,
  path: `vocab/${key}`,
  head: key,
  word: key,
  de: `${key}-de`,
  kind: 'w',
  lv,
  example: null,
  own: 0,
  intro: '2026-11-01',
  practiced: null,
  ...o,
});
const FRAMES = new Map<string, readonly BridgeFrame[]>([
  ['cn.third', [{ de: 'Nach einem verlorenen Auftrag …', en: 'After losing an order …', starter: 'If we had called them earlier, …' }]],
  ['pc.duration', [{ de: 'Der Kunde fragt, warum …', en: 'The client asks why …', starter: 'Since the site visit in March, our team has been …' }]],
]);
const SAFE: BridgePat[] = [
  { id: 'pc.duration', topic: 'pres-perf-cont', state: 'safe', uses: 0, lastUse: null },
  { id: 'rs.backshift', topic: 'reported', state: 'firm', uses: 2, lastUse: '2026-11-01' },
];
const base = { todayPat: { id: 'cn.third', topic: 'conditionals' }, safe: SAFE, frames: FRAMES, last: new Map<string, string>(), today: TODAY, n: 2 };

describe('Brücken-Sätze: Ziele aus dem Lernstand', () => {
  it('„gerade gelernt“ = Stufe 3–4, heute oder gestern geübt, nicht heute eingeführt; „sitzt“ = Stufe 5–6 mit weniger als 2 eigenen Sätzen', () => {
    expect(isLearning(word('a', 3, { practiced: TODAY }), TODAY)).toBe(true);
    expect(isLearning(word('a', 4, { practiced: YESTERDAY }), TODAY)).toBe(true);
    expect(isLearning(word('a', 3, { practiced: '2026-11-10' }), TODAY)).toBe(false);
    expect(isLearning(word('a', 3, { practiced: TODAY, intro: TODAY }), TODAY)).toBe(false);
    expect(isLearning(word('a', 2, { practiced: TODAY }), TODAY)).toBe(false);
    expect(isLearning(word('a', 5, { practiced: TODAY }), TODAY)).toBe(false);
    expect(isSettled(word('a', 5))).toBe(true);
    expect(isSettled(word('a', 6, { own: 1 }))).toBe(true);
    expect(isSettled(word('a', 6, { own: 2 }))).toBe(false);
    expect(isSettled(word('a', 7))).toBe(false);
    expect(isSettled(word('a', 5, { path: null }))).toBe(false);
  });

  it('Satz 1: gerade gelerntes Wort + Muster von heute; Satz 2: sitzendes Wort + sicheres früheres Muster; fest je Lerntag', () => {
    const words = [word('postpone', 3, { practiced: TODAY }), word('streamline', 4, { practiced: YESTERDAY }), word('leverage', 6, { own: 1 }), word('deadline', 5), word('new', 3, { practiced: TODAY, intro: TODAY })];
    const a = pickBridge({ ...base, words });
    expect(a).toHaveLength(2);
    // Heute geübt geht vor gestern; heute eingeführte Wörter kommen nie.
    expect(a[0]).toMatchObject({ slot: 1, pat: 'cn.third', topic: 'conditionals', whyWord: 'today', whyPat: 'today', word: { key: 'vocab/postpone' } });
    expect(a[0]!.frame?.starter).toBe('If we had called them earlier, …');
    // Näher an der höchsten Stufe zuerst (Stufe 6 mit einem eigenen Satz); das Muster ist ein anderes Thema und hat einen Rahmen.
    expect(a[1]).toMatchObject({ slot: 2, pat: 'pc.duration', topic: 'pres-perf-cont', whyWord: 'sits', whyPat: 'safe', word: { key: 'vocab/leverage' } });
    expect(pickBridge({ ...base, words })).toEqual(a);
    expect(pickBridge({ ...base, words: [...words].reverse() })).toEqual(a);
  });

  it('14 Tage Sperre für dasselbe Wort; sind alle gesperrt, kommt das am längsten nicht benutzte', () => {
    const words = [word('postpone', 3, { practiced: TODAY }), word('streamline', 3, { practiced: TODAY }), word('leverage', 6), word('deadline', 6)];
    const order = pickBridge({ ...base, words }).map((x) => x.word.key);
    const last = new Map([[order[0]!, '2026-11-05'], [order[1]!, '2026-10-20']]);
    const b = pickBridge({ ...base, words, last });
    // Satz 1: das andere gelernte Wort (das erste ist seit 8 Tagen gesperrt); Satz 2: 24 Tage her = wieder frei.
    expect(b[0]!.word.key).not.toBe(order[0]);
    expect(b[1]!.word.key).toBe(order[1]);
    const all = new Map(words.map((w, k) => [w.key, k === 0 ? '2026-11-02' : '2026-11-10']));
    const c = pickBridge({ ...base, words, last: all });
    expect(c).toHaveLength(2);
    expect(c[0]!.word.key).toBe('vocab/postpone');
  });

  it('Rückfall: ohne passendes Wort rückt der andere Vorrat nach, dann die Wörter des alten Wegs; ohne Wort oder Muster entfällt der Satz', () => {
    const legacy: BridgeWord[] = [{ ...word('invoice', 0), key: 'w:invoice', path: null }, { ...word('budget', 0), key: 'w:budget', path: null }];
    // Nur sitzende Wörter: Satz 1 nimmt eines davon, Satz 2 das andere.
    const onlySettled = pickBridge({ ...base, words: [word('leverage', 6), word('deadline', 5)] });
    expect(onlySettled.map((x) => x.whyWord)).toEqual(['sits', 'sits']);
    expect(new Set(onlySettled.map((x) => x.word.key)).size).toBe(2);
    // Wörter-App ohne passende Wörter: der alte Weg liefert beide Sätze.
    const old = pickBridge({ ...base, words: [word('fresh', 1)], legacy });
    expect(old.map((x) => [x.word.key, x.whyWord])).toEqual([['w:invoice', 'legacy'], ['w:budget', 'legacy']]);
    expect(pickBridge({ ...base, words: [], legacy: [] })).toEqual([]);
    expect(pickBridge({ ...base, words: [word('leverage', 6)], todayPat: null, safe: [], known: [] })).toEqual([]);
    // Ohne Muster von heute: Satz 1 nimmt das beste sichere, Satz 2 ein anderes.
    const noToday = pickBridge({ ...base, todayPat: null, words: [word('postpone', 3, { practiced: TODAY }), word('leverage', 6)] });
    expect(noToday.map((x) => [x.pat, x.whyPat])).toEqual([['pc.duration', 'safe'], ['rs.backshift', 'firm']]);
    // Ohne sicheres Muster bleibt es bei zwei Sätzen: das Muster von heute mit einem anderen Wort.
    const noSafe = pickBridge({ ...base, safe: [], words: [word('postpone', 3, { practiced: TODAY }), word('leverage', 6)] });
    expect(noSafe.map((x) => x.pat)).toEqual(['cn.third', 'cn.third']);
    // Begonnene Muster als Rückfall für Satz 2.
    const withKnown = pickBridge({ ...base, safe: [], known: [{ id: 'pv.simple', topic: 'passive' }], words: [word('postpone', 3, { practiced: TODAY }), word('leverage', 6)] });
    expect(withKnown[1]).toMatchObject({ pat: 'pv.simple', whyPat: 'known' });
  });

  it('kurzer Tag: ein Satz; freie Zusatzrunde: heute benutzte Wörter und Muster bleiben draußen; lange Einträge und Zustandsverben passen nicht', () => {
    const words = [word('postpone', 3, { practiced: TODAY }), word('streamline', 3, { practiced: TODAY }), word('leverage', 6), word('deadline', 6)];
    expect(pickBridge({ ...base, words, n: 1 })).toHaveLength(1);
    const duty = pickBridge({ ...base, words });
    const free = pickBridge({ ...base, words, skip: new Set(duty.map((x) => x.word.key)), skipPats: new Set(duty.map((x) => x.pat)) });
    expect(free).toHaveLength(2);
    for (const x of free) {
      expect(duty.map((d) => d.word.key)).not.toContain(x.word.key);
      expect(duty.map((d) => d.pat)).not.toContain(x.pat);
    }
    // Zu lange Wendung: nie ein Ziel.
    expect(pickBridge({ ...base, words: [word('x', 3, { practiced: TODAY, word: 'to be on the same page with sb' })] })).toEqual([]);
    // Zustandsverb nie mit Present Perfect Continuous: das Wort bekommt Satz 1 nicht, wenn das Muster von heute dort liegt.
    const ppc = pickBridge({ ...base, todayPat: { id: 'pc.duration', topic: 'pres-perf-cont' }, safe: [], words: [word('know', 3, { practiced: TODAY }), word('postpone', 4, { practiced: YESTERDAY })], n: 1 });
    expect(ppc[0]!.word.key).toBe('vocab/postpone');
  });

  it('sichere und begonnene Muster aus den Thema-Dokumenten; „frei verwendet“ sortiert seltener Benutztes nach vorn', () => {
    const push = (e: ReturnType<typeof patPush> | undefined, day: string, ok = true) => patPush(e, { ok, help: false, day, t: Date.parse(`${day}T10:00:00Z`) });
    const safeEntry = push(push(push(undefined, '2026-10-01'), '2026-10-02'), '2026-10-03');
    const learning = push(push(push(undefined, '2026-11-10', false), '2026-11-11', true), '2026-11-12', false);
    const docs: [string, Doc][] = [
      ['conditionals', { pats: { 'cn.first': safeEntry, 'cn.third': learning, 'xx.unknown': safeEntry }, fu: { 'cn.first': { n: 3, d: '2026-11-01' } } }],
      ['reported', { pats: { 'rs.backshift': safeEntry } }],
    ];
    const known = (id: string) => patternById(id)?.topic ?? null;
    const safe = safePatterns(docs, TODAY, known);
    // Unbekannte Kennungen fallen weg; das noch nie frei verwendete Muster steht vorn.
    expect(safe.map((p) => [p.id, p.uses])).toEqual([['rs.backshift', 0], ['cn.first', 3]]);
    expect(safe.every((p) => p.state === 'safe' || p.state === 'firm')).toBe(true);
    expect(knownPatterns(docs, TODAY, known)).toEqual([{ id: 'cn.third', topic: 'conditionals' }]);
  });

  it('Verlauf: Sperre aus `out/<Monat>` (Art bridge); Einträge von heute zählen nicht zur Sperre, nur zur Zusatzrunde', () => {
    expect(bridgeHistoryDays('2026-11-13')).toEqual(['2026-11-13', '2026-10-30']);
    const docs = [
      { items: [{ id: 'a', k: 'bridge', d: '2026-11-05', theme: 'vocab/postpone', fb: { pat: 'cn.third' } }, { id: 'b', k: 'bridge', d: TODAY, theme: 'vocab/leverage', fb: { pat: 'pc.duration' } }, { id: 'c', k: 'reply', d: '2026-11-06', theme: 'm01' }] },
      { items: [{ id: 'd', k: 'bridge', d: '2026-10-31', theme: 'vocab/postpone' }, 'kaputt', { k: 'bridge', d: 'x', theme: 'vocab/zzz' }] },
      null,
    ];
    const h = bridgeHistory(docs, TODAY);
    expect([...h.last]).toEqual([['vocab/postpone', '2026-11-05']]);
    expect([...h.today]).toEqual(['vocab/leverage']);
    expect([...h.todayPats]).toEqual(['pc.duration']);
  });
});

describe('Rahmen (frames.json)', () => {
  it('jedes genannte Muster gibt es; Rahmen je Thema bleiben bei 2–3; jeder Satzanfang endet auf „…“ und ist Englisch', () => {
    const byPat = bridgeFrames();
    expect(byPat.size).toBeGreaterThan(120);
    for (const [id, list] of byPat) {
      expect(patternById(id), id).not.toBeNull();
      for (const f of list) {
        expect(f.starter, id).toMatch(/…$/);
        expect(/[äöüß]/i.test(f.en) || /[äöüß]/i.test(f.starter), `${id}: ${f.en}`).toBe(false);
      }
    }
    const topics = comboFrames();
    for (const t of topicsWithPatterns()) {
      expect(topics[t]?.length ?? 0, t).toBeGreaterThanOrEqual(2);
      expect(topics[t]?.length ?? 0, t).toBeLessThanOrEqual(3);
    }
    // Berufswelt (Lehrer-Befund 13.11.2026): Business Development bei einem DMS/ECM-Hersteller mit Cloud-Produkt, nicht Küchen- und Möbelbranche.
    const all = [...byPat.values()].flat().map((f) => `${f.de} ${f.en} ${f.starter}`).join(' ');
    expect(all).not.toMatch(/\b(kitchen|countertops?|cabinets?|showroom|furniture|installers?)\b|Küche|Möbel/i);
    expect(all).toMatch(/\bcloud\b/i);
    expect(all).toMatch(/\b(CFO|head of IT)\b/);
    // Etwa ein Drittel Alltag und Nachrichten (Wirtschaft, Politik, Technik).
    const unique = [...new Set([...byPat.values()].flat())];
    const daily = unique.filter((f) => /\b(friend|neighbor|acquaintance|economy|news|headlines|minister|central bank|interest rates|energy|vacation|phone|electric cars|smartphones|small talk|dinner|lunch|tech fair|trade deal|study|carmaker|takeover|chip|airport|mechanic|strike|laptop|Silicon Valley|batteries|app|government|nephew|election|exhibition)\b/i.test(f.en));
    expect(daily.length / unique.length).toBeGreaterThan(0.25);
    // Der Satzanfang enthält die Zielform nicht schon fertig (Emrah bildet sie selbst; „despite …“ nach Vorgabe des Lehrers erlaubt).
    const GIVEN_AWAY: Readonly<Record<string, RegExp>> = {
      'cn.were': /\bif I were\b/i, 'cn.third': /\bwould have\b/i, 'pc.duration': /\b(has|have|'ve) been\b/i, 'pc.recent': /\b(has|have|'ve) been\b/i,
      'pp.earlier': /\bhad\b/i, 'fut.perfect': /\bwill have\b/i, 'fut.perf-cont': /\bwill have been\b/i, 'fut.continuous': /\bwill be\b|\bI'll be\b/i,
      'ut.used-to': /\bused to\b/i, 'ut.be-used-to': /\bused to\b/i, 'ut.get-used-to': /\bused to\b/i, 'mc.wish-past': /\bwish\b/i, 'mc.wish-now': /\bwish\b/i,
      'em.not-only': /\bnot only\b/i, 'pp.inversion': /\bno sooner\b/i, 'inv.negative': /\b(never before|rarely)\b/i, 'inv.cond': /^should\b/i,
      'ep.concession': /\bas it is\b/i, 'hg.worth': /\bworth\b/i, 'hg.seems': /\bseems?\b/i, 'dip.wondering': /\bwondering\b/i, 'dip.possible': /\bwould it be possible\b/i,
      'em.what-cleft': /^what\b/i, 'em.it-cleft': /\bit (is|was)\b.*\bwho\b/i, 'cmp.the-the': /^the more\b/i, 'dm.concede': /\b(that said|having said)\b/i,
      'dm.return': /\bcoming back\b/i, 'dm.sum': /\b(all in all|in short|to sum up)\b/i, 'nm.following': /\b(following|upon|prior to)\b/i, 'cp.having': /\bhaving\b/i,
      'cp.within': /\bwithin\b/i, 'cp.as-of': /\bas of\b/i, 'ca.unless': /\bunless\b/i, 'ca.as-long-as': /\bas long as\b/i, 'cn.if-words': /\b(provided|providing|unless)\b/i,
      'pp.personal': /\bis (said|believed|thought|reported)\b/i, 'mp.may-well': /\bmay well\b/i, 'mp.chance': /\bchance\b/i, 'mp.likely': /\blikely\b/i,
      'sa.soft': /\b(hoping|wondering)\b/i, 'fp.was-going': /\bgoing to\b/i, 'fp.about-to': /\babout to\b/i, 'qn.none': /\bnone\b/i,
      'qn.no-longer': /\b(no longer|anymore)\b/i, 'qn.hardly': /\b(hardly|barely|scarcely)\b/i, 'tc.by-the-time': /\bby the time\b/i, 'lk.although': /\balthough\b/i,
      'np.to-inf': /\bthe first\b/i, 'pp.first-time': /\bfirst time\b/i, 'tc.present-for-future': /\b(as soon as|once|when)\b/i,
    };
    for (const [id, list] of byPat) for (const f of list) if (GIVEN_AWAY[id]) expect(GIVEN_AWAY[id].test(f.starter), `${id}: ${f.starter}`).toBe(false);
  });
});

describe('ehrliche Minuten von Schritt 3', () => {
  it('Standard 3 Minuten; mit Messwert 2 bis 6; Messung als gleitendes Mittel, Ausreißer zählen nicht', () => {
    expect(bridgeMinutes(null)).toBe(BRIDGE_MIN);
    expect(bridgeMinutes(90_000)).toBe(3);
    expect(bridgeMinutes(40_000)).toBe(2);
    expect(bridgeMinutes(400_000)).toBe(6);
    expect(readBridgeStat({})).toEqual({ n: 0, ms: 0 });
    expect(readBridgeStat({ abm: 'x' })).toBeNull();
    expect(bridgeMinutesOf({})).toBeUndefined();
    expect(bridgeMinutesOf({ abm: { n: 3, ms: 150_000 } })).toBeUndefined();
    expect(bridgeMinutesOf({ abm: { n: 4, ms: 150_000 } })).toBe(5);
    const first = bridgeStatPatch({}, [80_000, 100_000, 5_000, 700_000]);
    expect(first).toEqual({ abm: { n: 2, ms: 90_000 } });
    expect(bridgeStatPatch({ abm: { n: 10, ms: 80_000 } }, [160_000])).toEqual({ abm: { n: 11, ms: 90_000 } });
    expect(bridgeStatPatch({}, [1_000])).toBeNull();
    // Unerwarteter Aufbau wird nie überschrieben.
    expect(bridgeStatPatch({ abm: { n: 'viele' } }, [90_000])).toBeNull();
  });

  it('Tagesplan: Schritt 3 nennt die Minuten der zwei Sätze (nicht das 10-%-Budget); Sonntag bleibt der Wochen-Check', () => {
    expect(applyStepMinutes(undefined)).toBe(3);
    expect(applyStepMinutes(4.4)).toBe(4);
    expect(applyStepMinutes(40)).toBe(6);
    const p25 = unitPlanFor('2026-11-03', null, { goalMin: 25, tw: 1, reviewCount: 20 });
    expect(p25.blocks.map((b) => [b.kind, b.min])).toEqual([['review', 18], ['grammar', 5], ['task.apply', 3]]);
    const p60 = unitPlanFor('2026-11-03', null, { goalMin: 60, tw: 1, reviewCount: 20 });
    expect(p60.blocks[2]).toMatchObject({ kind: 'task.apply', min: 3 });
    const measured = unitPlanFor('2026-11-03', null, { goalMin: 25, tw: 1, reviewCount: 20, applyMin: 5 });
    expect(measured.blocks[2]!.min).toBe(5);
    expect(measured.minutes).toBe(28);
    const sun = unitPlanFor('2026-11-08', null, { goalMin: 25, tw: 1, reviewCount: 20, applyMin: 5 });
    expect(sun.blocks[2]).toMatchObject({ kind: 'task.check', min: 5 });
  });

  it('Schritt 3 = Brücken-Sätze: zwei am vollen Tag, einer am kurzen Tag, ohne Claude Satzbau; die alte Disziplin steuert nichts mehr', () => {
    expect(resolveStep({ ap: 'reply', short: false, ai: true })).toEqual({ to: 'bridge', n: 2 });
    expect(resolveStep({ ap: undefined, short: false, ai: true })).toEqual({ to: 'bridge', n: 2 });
    expect(resolveStep({ ap: 'summary', short: true, ai: true })).toEqual({ to: 'bridge', n: 1 });
    expect(resolveStep({ ap: 'combo', short: false, ai: false })).toEqual({ to: 'order' });
    // Neue Pläne frieren immer den eigenen Satz ein (Rückweg: eine ältere Version startet dann den eigenen Satz, nie eine Mail).
    expect(applyOfDay({ apc: { n: 2, d: '2026-09-20' } })).toBe('combo');
    expect(applyOfDay({})).toBe('combo');
  });
});

describe('Beleg-Zähler „frei verwendet“ (grammar/<thema>.fu)', () => {
  const doc = { p: 0.8, n: 12, pats: { 'cn.third': { n: 4, c: 3 } } };
  it('ein Beleg je Muster und Lerntag, nur vorwärts, nie ohne Thema-Dokument; `pats` und der Musterzustand bleiben unberührt', () => {
    expect(freeUsePatch(undefined, 'cn.third', TODAY)).toBeNull();
    const a = freeUsePatch(doc, 'cn.third', TODAY);
    expect(a).toEqual({ fu: { 'cn.third': { n: 1, d: TODAY } } });
    expect(Object.keys(a!)).toEqual(['fu']);
    const after = { ...doc, fu: a!.fu };
    expect(freeUsePatch(after, 'cn.third', TODAY)).toBeNull();
    expect(freeUsePatch(after, 'cn.third', YESTERDAY)).toBeNull();
    expect(freeUsePatch(after, 'cn.third', '2026-11-14')).toEqual({ fu: { 'cn.third': { n: 2, d: '2026-11-14' } } });
    // Ein Muster ohne `pats`-Eintrag bekommt nur den Zähler; der Themenzustand rechnet weiter allein aus `pats`.
    const other = freeUsePatch(after, 'cn.first', TODAY)!;
    expect(other).toEqual({ fu: { 'cn.first': { n: 1, d: TODAY } } });
    expect(topicStateFromPatterns('conditionals', { ...after, fu: { ...after.fu, ...other.fu } }, TODAY)).toBe(topicStateFromPatterns('conditionals', doc, TODAY));
    expect(freeUseOf(after, 'cn.third')).toEqual({ n: 1, d: TODAY });
    expect(freeUseOf(after, 'cn.zero')).toEqual({ n: 0, d: null });
    expect(freeUsesOf(null)).toEqual({});
  });
  it('unerwarteter Aufbau wird nie überschrieben; ungültige Kennung oder ungültiger Tag schreiben nichts', () => {
    expect(freeUsePatch({ ...doc, fu: 'kaputt' }, 'cn.third', TODAY)).toBeNull();
    expect(freeUsePatch({ ...doc, fu: { 'cn.third': { n: 'zwei' } } }, 'cn.third', TODAY)).toBeNull();
    expect(freeUsePatch(doc, 'kein muster', TODAY)).toBeNull();
    expect(freeUsePatch(doc, 'cn.third', 'heute')).toBeNull();
    expect(readFreeUse({ n: 500, d: TODAY })).toEqual({ n: 99, d: TODAY });
    expect(freeUsePatch({ ...doc, fu: { 'cn.third': { n: 99, d: YESTERDAY } } }, 'cn.third', TODAY)).toEqual({ fu: { 'cn.third': { n: 99, d: TODAY } } });
  });
});

describe('Ergebnis eines Brücken-Satzes', () => {
  const out = (o: Partial<BridgeOut> = {}): BridgeOut => ({
    word: { v: 'ok', err: null, at: 'postponed', why: 'Passt.' },
    pat: { v: 'ok', at: 'If we had', why: 'Passt.' },
    extra: null,
    fixed: '',
    better: '',
    keep: 'Weiter so.',
    ...o,
  });
  const target = { slot: 1 as const, word: word('postpone', 5), pat: 'cn.third', topic: 'conditionals', frame: null, whyWord: 'sits' as const, whyPat: 'today' as const };
  const run = (o: BridgeOut, sentence: string): BridgeRun => ({ day: TODAY, now: Date.parse('2026-11-13T18:00:00Z'), target, sentence, out: o, ms: 61_234 });

  it('Zeichen je Element und Gesamturteil', () => {
    expect([wordMark('ok'), wordMark('odd'), wordMark('wrong'), wordMark('thin'), wordMark('unused')]).toEqual(['ok', 'bad', 'bad', 'open', 'open']);
    expect([patMark('ok'), patMark('wrong'), patMark('avoided'), patMark('unsure')]).toEqual(['ok', 'bad', 'open', 'open']);
    expect(bridgeVerdict(out())).toBe('ok');
    expect(bridgeVerdict(out({ pat: { v: 'avoided', at: '', why: '' } }))).toBe('near');
    expect(bridgeVerdict(out({ extra: { from: 'a', to: 'b', why: 'x' } }))).toBe('near');
    expect(bridgeVerdict(out({ word: { v: 'odd', err: 'prep', at: 'x', why: '' } }))).toBe('wrong');
    expect(bridgeVerdict(out({ pat: { v: 'wrong', at: 'x', why: '' } }))).toBe('wrong');
    expect(reportsWord({ v: 'unused', err: null, at: '', why: '' })).toBe(false);
    expect(reportsWord({ v: 'unused', err: null, at: 'delayed', why: '' })).toBe(true);
    expect(reportsWord({ v: 'wrong', err: 'sense', at: 'x', why: '' })).toBe(true);
  });

  it('Speicherform `out/<Monat>`: Art bridge, Wort-Kennung als `theme`, Schreibzeit, Urteile und Muster', () => {
    const o = out({ pat: { v: 'wrong', at: 'would called', why: 'Form.' }, fixed: 'If we had called them earlier, we would have postponed the delivery.' });
    const item = bridgeOutItem(run(o, 'If we had called them earlier, we would postponed the delivery.'));
    expect(item).toMatchObject({ k: 'bridge', d: TODAY, theme: 'vocab/postpone', ok: false, ms: 61_234, fb: { w: 'ok', p: 'wrong', pat: 'cn.third', wd: 'postpone', lv: 5, s: 1 } });
    expect(item.id).toMatch(/^bridge-[a-z0-9]+$/);
    expect(bridgeHistory([{ items: [{ ...item, d: '2026-11-10' }] }], TODAY).last.get('vocab/postpone')).toBe('2026-11-10');
  });

  it('Fehlersatz nur bei belegtem Fehler mit anderer Fassung: mit Muster (wenn das Muster falsch war), Situation und korrigierten Stellen', () => {
    const given = 'If we had called them earlier, we would postponed the delivery.';
    const fixed = 'If we had called them earlier, we would have postponed the delivery.';
    const patWrong = out({ pat: { v: 'wrong', at: 'would postponed', why: 'Nach „would“ fehlt „have“.' }, fixed });
    expect(hasFix(patWrong, given)).toBe(true);
    expect(fixSpans(given, fixed)).toEqual(['have']);
    expect(bridgeRepair(run(patWrong, given), 'Nach einem verlorenen Auftrag …')).toEqual({ wrong: given, right: fixed, why: 'Nach „would“ fehlt „have“.', src: 'write', ctx: 'Nach einem verlorenen Auftrag …', fix: ['have'], pat: 'cn.third' });
    // Wort falsch: der Grund kommt vom Wort, kein Muster am Fehlersatz.
    const wordWrong = out({ word: { v: 'wrong', err: 'sense', at: 'postponed', why: 'Falsche Bedeutung.' }, fixed: 'We delayed the delivery.' });
    expect(bridgeRepair(run(wordWrong, 'We postponed the delivery zzz.'), null)).toMatchObject({ why: 'Falsche Bedeutung.', pat: null, ctx: null });
    // Kein Fehler, vermiedenes Muster, gleiche oder fehlende Fassung: kein Fehlersatz.
    expect(bridgeRepair(run(out(), given), null)).toBeNull();
    expect(bridgeRepair(run(out({ pat: { v: 'avoided', at: '', why: '' }, fixed }), given), null)).toBeNull();
    expect(bridgeRepair(run(out({ pat: { v: 'wrong', at: 'x', why: '' }, fixed: given }), given), null)).toBeNull();
    expect(bridgeRepair(run(out({ pat: { v: 'wrong', at: 'x', why: '' }, fixed: '' }), given), null)).toBeNull();
  });

  it('Rückfluss ist abschaltbar: `app/profile.acfg.rf = 0`', () => {
    expect(flowbackOn(null)).toBe(true);
    expect(flowbackOn({})).toBe(true);
    expect(flowbackOn({ acfg: { rf: 1 } })).toBe(true);
    expect(flowbackOn({ acfg: { rf: 0 } })).toBe(false);
    expect(flowbackOn({ acfg: 'x' })).toBe(true);
  });
});

describe('Adapter: Muster des heutigen Grammatik-Schritts', () => {
  const at = (day: string) => Date.parse(`${day}T12:00:00+01:00`);
  const entry = (last: number, n = 3) => ({ n, c: 2, last, r: 3, k: 2, dd: [] });
  it('heute geübtes Muster der Themen von heute → Buch-Seite → eingefrorener Plan → schwächstes begonnenes Thema', () => {
    const grammar = new Map<string, Doc>([
      ['conditionals', { p: 0.55, n: 20, pats: { 'cn.third': entry(at(TODAY)), 'cn.first': entry(at(YESTERDAY)) } }],
      ['passive', { p: 0.4, n: 8, pats: { 'pv.simple': entry(at(YESTERDAY)) } }],
      ['reported', { p: 0.9, n: 30, pats: { 'rs.backshift': entry(at(TODAY)) } }],
    ]);
    const gt = { intro: null, pats: ['cn.first'], topics: ['conditionals'] };
    // 1. Heute in der Runde geübt (nur Themen von heute zählen: „reported“ steht nicht im Plan).
    expect(todayPatternOf({ book: null, gt, grammar, today: TODAY })).toEqual({ id: 'cn.third', topic: 'conditionals', src: 'done' });
    // 2. Buch-Seite, noch nichts geübt: das Muster des Themas, an dem gearbeitet wird.
    expect(todayPatternOf({ book: { kind: 'page', ch: 2, topic: 'passive', part: 'A' }, gt: null, grammar, today: '2026-11-14' })).toMatchObject({ topic: 'passive', src: 'book' });
    // 3. Plan: Muster des Tages.
    expect(todayPatternOf({ book: null, gt, grammar, today: '2026-11-14' })).toEqual({ id: 'cn.first', topic: 'conditionals', src: 'plan' });
    expect(todayPatternOf({ book: null, gt: { intro: null, pats: ['gibt.es-nicht'], topics: ['passive'] }, grammar, today: '2026-11-14' })).toMatchObject({ topic: 'passive', src: 'plan' });
    // 4. Ohne Plan: das schwächste begonnene Thema.
    expect(todayPatternOf({ book: null, gt: null, grammar, today: '2026-11-14' })).toMatchObject({ topic: 'passive', src: 'weak' });
    expect(todayPatternOf({ book: null, gt: null, grammar: new Map(), today: TODAY })).toBeNull();
  });
});
