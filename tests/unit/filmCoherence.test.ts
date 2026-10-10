import { describe, expect, it } from 'vitest';
import { animFilms, words, type Film } from '../../src/domain/c1/anim';
import { norm } from '../../src/engine/morphPlan';

// Bestandstest Struktur-Filme (Emrahs Rückmeldung 4, 10.10.2026): Thema ↔ Ausgangssatz ↔ Zielsatz ↔ Frage müssen zusammenpassen.
// Fall aus dem Bild: Thema „will have + 3. Form“, die Frage fragte aber nach dem Wort, das an den Satzanfang wandert (Wortstellung statt
// Zeitform). Geprüft wird für JEDEN Film:
//   1. Der Zielsatz (letzter Schritt) enthält die Struktur des Musters (Tabelle STRUCTURE, je Film ein Ausdruck).
//   2. Der Titel nennt nur, was der Film zeigt: die Schlüsselwörter vor dem Doppelpunkt stehen in einem Schritt des Films.
//   3. Die Vorhersage zielt auf die Struktur:
//      - Wahlfrage: die beiden Optionen unterscheiden sich genau dort, wo im Zielsatz die Struktur steht.
//      - „Welches Wort wandert an den Satzanfang?“ nur, wenn die Struktur selbst am Satzanfang steht (Inversion, Voranstellung).
//      - „… fällt weg“: jedes getippte Wort kommt im Zielsatz seltener vor; Zahlwörter („Zwei Wörter …“) stimmen mit der Lösung überein.
//      - DE- und EN-Frage fragen dasselbe (Satzanfang ↔ front, wegfallen ↔ drop out).

const apo = (s: string): string => s.replace(/[’‘]/g, "'");

/** Je Film: Ausdruck, den der Zielsatz erfüllen muss (Apostrophe vereinheitlicht). */
const STRUCTURE: Record<string, RegExp> = {
  'f.inv.negative': /^Never have we\b/,
  'f.em.it-cleft': /^It was .+ who\b/,
  'f.pp.personal': /\bis said to be\b/,
  'f.mc.past-cond': /^If \w+ had \w+ed\b.*\bwouldn't be\b/,
  'f.cp.having': /^Having \w+ed\b/,
  'f.nm.noun-form': /\bimplementation of\b.*\ba fall in\b/,
  'f.psc.always': /\bis always \w+ing\b/,
  'f.psc.now': /\bare \w+ing\b/,
  'f.psp.finished-time': /^We \w+ed\b.*\blast \w+/,
  'f.psp.since-for': /\bhave \w+ed\b.*\bsince\b/,
  'f.pc.duration': /\bhave been \w+ing\b.*\bfor\b/,
  'f.pc.recent': /\bhave been \w+ing\b.*\blately\b/,
  'f.pc.state-verbs': /\bhave known\b/,
  'f.pp.earlier': /\bhad (already )?\w+\b/,
  'f.pp.first-time': /\bthe first time \w+ had \w+/,
  'f.pp.inversion': /^No sooner had \w+ \w+\b.*\bthan\b/,
  'f.pp.duration': /\bhad been \w+ing\b/,
  'f.ut.would': /\bwould \w+\b/,
  'f.ut.be-used-to': /\bare used to \w+ing\b/,
  'f.pt.by-until': /\bby Friday\b/,
  'f.pt.during-within': /\bwithin\b/,
  'f.sa.trend': /\bare getting \w+er and \w+er\b/,
  'f.sa.soft': /\bwere hoping\b/,
  'f.ff.about-to': /\bare about to \w+/,
  'f.ff.was-going-to': /\bwere going to\b/,
  'f.ff.fixed-times': /\btakes place\b/,
  'f.tc.present-for-future': /^As soon as we get\b/,
  'f.tc.present-perfect': /^Once we have \w+ed\b/,
  'f.tc.by-the-time': /^By the time .* calls\b.*\bwill have \w+ed\b/,
  'f.fut.cont-plan': /^Will you be \w+ing\b/,
  'f.fut.perfect': /\bwill have \w+ed\b/,
  'f.fut.perf-cont': /\bwill have been \w+ing\b/,
  'f.fp.about-to': /\bwas about to\b/,
  'f.fp.was-to': /\bwas to \w+/,
  'f.cp.as-of': /^As of\b/,
  'f.cp.approx': /\bjust under\b/,
  'f.cp.multiples': /\btwice as \w+ as\b/,
  'f.cn.second': /^If .* weren't\b.*\bwe could\b/,
  'f.cn.third': /^If we had \w+ed\b.*\bwouldn't have\b/,
  'f.cn.if-words': /\bprovided that\b/,
  'f.ca.unless': /\bunless you sign\b/,
  'f.ca.as-long-as': /\bas long as you give\b/,
  'f.ca.otherwise': /; otherwise,/,
  'f.ca.but-for': /^But for\b/,
  'f.ca.inversion': /^Should you\b/,
  'f.ca.in-case': /\bin case the \w+ fails\b/,
  'f.mc.present-cond': /^If .* weren't\b.*\bwould have\b/,
  'f.mc.wish-past': /\bwish we had \w+/,
  'f.mc.wish-would': /\bwish .* would\b/,
  'f.mc.inversion': /^Had we\b/,
  'f.dip.wondering': /^I was wondering whether\b/,
  'f.dip.possible': /^Would it be possible to\b/,
  'f.dip.understate': /\ba bit tight\b/,
  'f.pv.progressive': /\bis being \w+ed\b/,
  'f.pv.perfect': /\bhave been \w+ed\b/,
  'f.pv.modal-future': /\bmust be \w+ed\b/,
  'f.pv.prep-agent': /\bwill be \w+ed by\b/,
  'f.pp.modal': /\bcannot be \w+ed\b/,
  'f.pp.perfect': /\bwas found\b/,
  'f.pp.being': /\bto being \w+ed\b/,
  'f.rs.time-shift': /\bhad \w+\b.*\bthe day before\b/,
  'f.rs.question': /\basked when we could\b/,
  'f.rs.request': /\basked us to \w+/,
  'f.rs.tell-say': /\btold us\b/,
  'f.rv.admit-deny': /\badmitted \w+ing\b/,
  'f.rv.suggest-rec': /\brecommend \w+ing\b/,
  'f.rv.insist': /\binsisted on \w+ing\b/,
  'f.rv.advise-warn': /\badvised us to\b/,
  'f.rv.offer': /\bpromised to\b/,
  'f.qu.indirect': /^Could you tell me how many \w+ the \w+ has\?$/,
  'f.qu.if-whether': /\bwhether you have\b/,
  'f.mnd.verbs': /\brecommend that he check\b/,
  'f.mnd.adjectives': /\bessential that\b.*\bbe \w+ed\b/,
  'f.nm.of-object': /^The review of\b/,
  'f.nm.following': /^Following \w+ of\b/,
  'f.nm.noun-prep': /\bdemand for\b/,
  'f.md.must-now': /\bmust (still )?be\b/,
  'f.md.cant-now': /\bcan't be\b/,
  'f.md.might-now': /\bmight (still )?be\b/,
  'f.md.must-have': /\bmust have \w+ed\b/,
  'f.md.cant-have': /\bcan't have \w+\b/,
  'f.md.might-have': /\bmight have\b/,
  'f.mp.may-well': /\bmay well\b/,
  'f.mp.bound': /\bis bound to\b/,
  'f.mp.likely': /\bis unlikely to\b/,
  'f.mp.chance': /\ba good chance of \w+ing\b/,
  'f.ma.should': /\byou should\b/,
  'f.ma.had-better': /\bhad better (?!to\b)\w+\b/,
  'f.ma.polite': /^You could\b/,
  'f.ma.dont-have-to': /\bdon't have to\b/,
  'f.ma.should-have': /\bshould have \w+ed\b/,
  'f.hg.modal': /\bmight\b/,
  'f.hg.worth': /\bworth \w+ing\b/,
  'f.hg.inclined': /\bI'd be inclined to\b/,
  'f.hg.seems': /^It would seem that\b/,
  'f.hg.downtoner': /\bnot quite\b/,
  'f.gi.ing-verbs': /\bavoid \w+ing\b/,
  'f.gi.prep-ing': /\blook forward to \w+ing\b/,
  'f.vp.regret': /\bregret to inform\b/,
  'f.vp.remember-forget': /\bremember to\b/,
  'f.gi.bare-inf': /\bmade us (?!to\b)\w+\b/,
  'f.prp.person-to': /\bexplained\b.*\bto the\b/,
  'f.prp.no-prep': /\bdiscuss the\b/,
  'f.prp.verb-prep': /\bdepends on\b/,
  'f.prp.adj-prep': /\baware of\b/,
  'f.pn.in': /\bincrease in\b/,
  'f.pn.about': /\bconcerns about\b/,
  'f.ph.separable': /\bruled it out\b/,
  'f.ph.together': /\blook into it\b/,
  'f.art.the-unique': /\bthe \w+est\b/,
  'f.cnt.verb': /\bfeedback is\b/,
  'f.qn.hardly': /^Hardly anybody\b/,
  'f.qn.no-longer': /\bno longer\b/,
  'f.qn.number': /^A number of \w+ have\b/,
  'f.rc.prep': /\bwith whom\b/,
  'f.rc.commas': /, which\b.*,/,
  'f.rc.whose': /\bwhose\b/,
  'f.rc.that-what': /^Everything that\b/,
  'f.lk.despite': /^Despite the\b/,
  'f.lk.although': /^Although [^,]+, we\b(?!.*\bbut\b)/,
  'f.lk.whereas': /, whereas\b/,
  'f.lk.however': /\. However,/,
  'f.lk.therefore': /\. Therefore,/,
  'f.cp.ing': /, \w+ing\b/,
  'f.cp.pp': /^The \w+ \w+ed on\b/,
  'f.dm.concede': /\. That said,/,
  'f.dm.build': /^To build on that,/,
  'f.dm.return': /^Coming back to\b/,
  'f.em.what-cleft': /^What\b.*\bis the\b/,
  'f.em.neg-inversion': /^Rarely do we\b/,
  'f.em.not-only': /^Not only does\b.*\bbut\b.*\balso\b/,
  'f.em.only-inversion': /^Only after\b.*\bcan we\b/,
  'f.inv.cond': /^Should you\b/,
  'f.inv.cond-had': /^Had we\b/,
  'f.ep.do-emph': /\bI do think\b/,
  'f.ep.concession': /^Tempting as\b.*\bis,/,
  'f.ep.so-such': /\bso \w+ that\b/,
  'f.el.so-not': /^I assume so\.$/,
  'f.el.do-so': /\bdo so\b/,
  'f.el.one-ones': /\bthe old one\b/,
  'f.np.contact': /^The system we \w+ed\b/,
  'f.np.of-s': /\bcompany's CEO\b/,
  'f.np.to-inf': /\bthe first \w+ to \w+/i,
  'f.np.post': /\bthe extent to which\b/,
  'f.cm.measure': /\ba three-day \w+/,
  'f.cm.fixed': /\blong-term\b/,
  'f.cm.participle': /\bwell-established\b/,
  'f.cm.order': /\bdocument management system\b/,
  'f.wo.verb-object': /\bsend you the quote tomorrow\b/,
  'f.wo.hardly-sooner': /^Hardly had we \w+\b.*\bwhen\b/,
  'f.cmp.the-the': /^The \w+er\b.*, the \w+er\b/,
  'f.cmp.degree': /\bconsiderably \w+er\b/,
  'f.cmp.as-as': /\btwice as \w+ as\b/,
};

/** Titel-Schlüsselwörter, die nur Formeln beschreiben (keine Satzwörter). */
const META = new Set(['past', 'participle', 'ing', 'base', 'form', 'up', 'front', 'without', 'person', 'with', 'or', 'the', 'a', 'clause', 'relative', 'noun', 'verb', 'instead', 'of', 'inversion', 'emphatic', 'cleft', 'present', 'simple', 'continuous', 'perfect', 'mixed', 'conditional', 'time', 'words', 'shift', 'too', 'reported', 'question', 'statement', 'order', 'needs', 'stays', 'together', 'pronoun', 'in', 'middle', 'object', 'and', 'clause', 'what', 'named', 'fixed', 'event', 'superlative', 'measure', 'singular']);
/** Formelwörter im Titel, die der Film bewusst in anderer Form zeigt (was → were, has → have, be → are) oder nur benennt. */
const TITLE_ALLOW: Record<string, readonly string[]> = {
  'f.pc.state-verbs': ['state', 'verbs'],
  'f.ut.be-used-to': ['be'],
  'f.sa.soft': ['was'],
  'f.ff.about-to': ['be'],
  'f.fut.cont-plan': ['polite'],
  'f.pv.perfect': ['has'],
  'f.rs.tell-say': ['tell'],
  'f.mp.bound': ['be'],
  'f.hg.modal': ['could'],
  'f.rc.commas': ['commas'],
  'f.em.what-cleft': ['what-cleft'],
};
const head = (t: string): string[] =>
  apo(t.split(':')[0] ?? t)
    .replace(/…|\.\.\.|\+|\/|\(.*?\)|-ing\b/g, ' ')
    .split(/\s+/)
    .map((w) => norm(w))
    .filter((w) => w.length > 0 && !META.has(w));

const finalOf = (f: Film): string => apo(f.steps[f.steps.length - 1]!.en);
const wordSpan = (text: string, m: RegExpMatchArray): [number, number] => {
  const start = words(text.slice(0, m.index ?? 0)).length;
  const len = words(m[0]).length;
  return [start, start + Math.max(1, len) - 1];
};
const count = (ws: string[], w: string): number => ws.filter((x) => norm(apo(x)) === w).length;
const NUM: Record<string, number> = { one: 1, a: 1, two: 2, three: 3, four: 4 };

describe('Struktur-Filme: Thema, Sätze und Frage passen zusammen (Bestand)', () => {
  const films = animFilms();

  it('jeder Film steht in der Struktur-Tabelle (neue Filme brauchen einen Eintrag)', () => {
    expect(films.map((f) => f.id).filter((id) => !STRUCTURE[id])).toEqual([]);
  });

  it('der Zielsatz enthält die Struktur des Themas', () => {
    const bad = films.filter((f) => STRUCTURE[f.id] && !STRUCTURE[f.id]!.test(finalOf(f))).map((f) => `${f.id}: ${finalOf(f)}`);
    expect(bad).toEqual([]);
  });

  it('der Titel nennt nur Wörter, die im Film vorkommen', () => {
    const bad: string[] = [];
    for (const f of films) {
      const all = new Set(f.steps.flatMap((s) => words(apo(s.en)).flatMap((w) => [norm(w), ...norm(w).split('-')])));
      const allow = TITLE_ALLOW[f.id] ?? [];
      const miss = head(f.title.en).filter((w) => !allow.includes(w) && !all.has(w) && ![...all].some((x) => x.startsWith(w.replace(/'.*$/, ''))));
      if (miss.length) bad.push(`${f.id} „${f.title.en}“: ${miss.join(', ')}`);
    }
    expect(bad).toEqual([]);
  });

  it('Wahlfrage: die Optionen unterscheiden sich genau an der Struktur', () => {
    const bad: string[] = [];
    for (const f of films) {
      if (f.predict.kind !== 'pick') continue;
      const strip = (o: string): string[] => words(apo(o).replace(/\s*…\s*$/, ''));
      const right = strip(f.predict.opts[f.predict.ans]);
      const wrong = strip(f.predict.opts[f.predict.ans === 0 ? 1 : 0]);
      const fin = finalOf(f);
      const fw = words(fin).map((w) => norm(w));
      const rw = right.map((w) => norm(w));
      const at = fw.findIndex((_, i) => rw.every((w, k) => fw[i + k] === w));
      if (at < 0) {
        bad.push(`${f.id}: richtige Option steht nicht im Zielsatz`);
        continue;
      }
      let s = 0;
      while (s < right.length && s < wrong.length && norm(right[s]!) === norm(wrong[s]!)) s++;
      let k = 0;
      while (k < right.length - s && k < wrong.length - s && norm(right[right.length - 1 - k]!) === norm(wrong[wrong.length - 1 - k]!)) k++;
      const e = Math.max(s, right.length - 1 - k);
      const lo = at + Math.max(0, s - (right.length - 1 - k < s ? 1 : 0));
      const hi = at + e;
      const m = fin.match(STRUCTURE[f.id] ?? /$^/);
      if (!m) continue;
      const [ms, me] = wordSpan(fin, m);
      if (hi < ms || lo > me) bad.push(`${f.id}: Unterschied (${right.slice(s, e + 1).join(' ')}) liegt außerhalb der Struktur „${m[0]}“`);
    }
    expect(bad).toEqual([]);
  });

  it('Tipp-Frage: Bewegung, Zahl und beide Sprachen passen zur Frage', () => {
    const bad: string[] = [];
    for (const f of films) {
      const p = f.predict;
      if (p.kind !== 'tap') continue;
      const en = p.q.en;
      const de = p.q.de;
      const w0 = words(apo(f.steps[0]!.en));
      const fin = finalOf(f);
      const w1 = words(fin);
      const front = /to the front|ahead of the subject/.test(en);
      const drop = /drops? out/.test(en);
      const move = /\bmoves?\b/.test(en);
      if (front !== /Satzanfang|vor das Subjekt/.test(de)) bad.push(`${f.id}: DE/EN fragen nicht dasselbe (Satzanfang)`);
      if (drop !== /\bweg\b/.test(de)) bad.push(`${f.id}: DE/EN fragen nicht dasselbe (wegfallen)`);
      const tapped = p.ans.map((i) => norm(w0[i] ?? ''));
      if (front) {
        const m = fin.match(STRUCTURE[f.id] ?? /$^/);
        if (!m || (m.index ?? -1) !== 0) bad.push(`${f.id}: fragt nach dem Satzanfang, die Struktur „${String(STRUCTURE[f.id])}“ steht aber nicht vorn`);
        const lead = w1.slice(0, 4).map((w) => norm(w));
        for (const t of tapped) if (!lead.includes(t)) bad.push(`${f.id}: „${t}“ steht im Zielsatz nicht vorn`);
      } else if (drop && !move) {
        for (const t of new Set(tapped)) if (count(w1, t) >= count(w0, t)) bad.push(`${f.id}: „${t}“ fällt nicht weg`);
      } else if (drop && move) {
        for (const t of new Set(tapped)) {
          const gone = count(w1, t) < count(w0, t);
          const moved = w1.map((w) => norm(w)).indexOf(t) !== w0.map((w) => norm(w)).indexOf(t);
          if (!gone && !moved) bad.push(`${f.id}: „${t}“ wandert nicht und fällt nicht weg`);
        }
      }
      const n = /^(One|A|Two|Three|Four)\b/.exec(en);
      if (n && NUM[n[1]!.toLowerCase()] !== p.ans.length) bad.push(`${f.id}: Frage nennt ${n[1]} Wort/Wörter, Lösung hat ${p.ans.length}`);
    }
    expect(bad).toEqual([]);
  });
});
