import { describe, expect, it } from 'vitest';
import { acceptArticle, answerShape, britishSpelling, containsWord, gluedProblem, hasInnerSentenceEnd, LIMITS, nameTokens, numberTokens } from '../../../src/modules/read/domain/accept';
import type { AcceptCtx, Gate } from '../../../src/modules/read/domain/accept';
import { goodRaw } from './fixtures';

// Regel-Test je Prüftor (docs/umbau/lesen-plan.md §3.4, Q5): je eine gute und eine kaputte Fassung mit kleinen erfundenen Fixtures.

const gatesOf = (raw: unknown, ctx: AcceptCtx = {}): Gate[] => {
  const r = acceptArticle(raw, ctx);
  return r.ok ? [] : [...new Set(r.issues.map((i) => i.gate))];
};
const messages = (raw: unknown, ctx: AcceptCtx = {}): string[] => {
  const r = acceptArticle(raw, ctx);
  return r.ok ? [] : r.issues.map((i) => `${i.gate}: ${i.message}`);
};

describe('Grundlage: der gute Fixture-Artikel', () => {
  it('besteht alle neun Tore', () => {
    const r = acceptArticle(goodRaw(), { topic: 'saas' });
    expect(r.ok ? [] : r.issues).toEqual([]);
    if (r.ok) {
      expect(r.article.keyWords).toHaveLength(5);
      expect(r.article.check).toHaveLength(2);
      expect(r.article.topic).toBe('saas');
      expect(r.dropped).toEqual([]);
      expect(r.repaired).toEqual([]);
    }
  });

  it('die Grenzen entsprechen dem Plan §3.4', () => {
    expect(LIMITS.paras).toEqual([3, 9]);
    expect(LIMITS.sentences).toEqual([14, 60]);
    expect(LIMITS.sentenceWords).toBe(60);
    expect(LIMITS.words).toEqual([380, 800]);
    expect(LIMITS.titleChars).toBe(90);
    expect(LIMITS.sentenceRatio).toEqual([0.6, 1.8]);
    expect(LIMITS.totalRatio).toEqual([0.85, 1.35]);
    expect(LIMITS.outlierShare).toBe(0.08);
    expect(LIMITS.unclearShare).toBe(0.05);
    expect(LIMITS.keyWords).toBe(5);
    expect(LIMITS.keyWordsLenientMin).toBe(3);
    expect(LIMITS.questions).toEqual([2, 3]);
  });
});

describe('Tor 1: Form', () => {
  it('gut: Antwort in der erwarteten Form', () => {
    expect(answerShape.safeParse(goodRaw()).success).toBe(true);
  });

  it('kaputt: kein Objekt, fehlende Felder', () => {
    expect(gatesOf('hello')).toEqual(['form']);
    expect(gatesOf(null)).toEqual(['form']);
    expect(gatesOf({ title: 'x' })).toEqual(['form']);
    const r = goodRaw() as Record<string, unknown>;
    delete r.paras;
    expect(gatesOf(r)).toEqual(['form']);
  });

  it('kaputt: zu wenige Absätze oder Sätze', () => {
    const a = goodRaw();
    a.paras = a.paras.slice(0, 2);
    expect(messages(a).join('\n')).toMatch(/form: needs 3 to 9 paragraphs, got 2/);
    const b = goodRaw();
    b.paras = b.paras.map((p) => p.slice(0, 1));
    expect(messages(b).join('\n')).toMatch(/form: needs 14 to 60 sentences in total, got 6/);
  });

  it('kaputt: zu viele Sätze', () => {
    const a = goodRaw();
    const all = a.paras.flat();
    a.paras = [all, [...all], [...all]].map((p, k) => p.map((s) => ({ e: `${s.e}`, d: `${s.d}${k === 99 ? 'x' : ''}` })));
    expect(messages(a).join('\n')).toMatch(/form: needs 14 to 60 sentences in total, got 63/);
  });

  it('kaputt: leerer Satz, Zeilenumbruch im Satz, Satz über 60 Wörter, leerer Titel', () => {
    const a = goodRaw();
    a.paras[0]![0]!.d = '   ';
    expect(messages(a).join('\n')).toMatch(/form: e and d must both be non-empty/);
    const b = goodRaw();
    b.paras[1]![0]!.e = 'Consider the common choice\nbetween charging per seat and charging for usage.';
    expect(messages(b).join('\n')).toMatch(/form: no line breaks inside a sentence/);
    const c = goodRaw();
    c.paras[1]![0]!.e = Array.from({ length: 61 }, () => 'word').join(' ');
    expect(messages(c).join('\n')).toMatch(/form: a sentence has more than 60 words/);
    const d = goodRaw();
    d.title = '  ';
    expect(messages(d).join('\n')).toMatch(/form: title must not be empty/);
  });
});

describe('Tor 2: Länge', () => {
  it('kaputt: zu kurz (Satzzahl stimmt, Wörter nicht)', () => {
    const a = goodRaw();
    a.paras = [0, 1, 2].map((p) => Array.from({ length: 5 }, (_, i) => ({ e: `The short sentence number ${p * 5 + i} is rather brief.`, d: `Der kurze Satz Nummer ${p * 5 + i} ist ziemlich knapp.` })));
    expect(messages(a).join('\n')).toMatch(/length: English text must have 380 to 800 words, got \d+/);
  });

  it('kaputt: zu lang', () => {
    const a = goodRaw();
    const all = a.paras.flat();
    const twice = [...all, ...all];
    a.paras = [0, 1, 2, 3, 4, 5].map((k) => twice.slice(k * 7, k * 7 + 7));
    a.paras[5] = twice.slice(35);
    expect(messages(a).join('\n')).toMatch(/length: English text must have 380 to 800 words, got 8\d\d/);
  });

  it('kaputt: Titel über 90 Zeichen', () => {
    const a = goodRaw();
    a.title = 'A '.repeat(46).trim();
    expect(messages(a).join('\n')).toMatch(/length: title must have at most 90 characters/);
  });
});

describe('Tor 3: Sprachtreue', () => {
  it('gut: kurze Sätze unter 4 Wörtern werden nicht geprüft', () => {
    const a = goodRaw();
    a.paras[0]![0] = { e: 'Prices matter.', d: 'Preise zählen.' };
    expect(gatesOf(a)).not.toContain('language');
  });

  it('kaputt: Sprachen in einem Satz vertauscht', () => {
    const a = goodRaw();
    const s = a.paras[0]![1]!;
    [s.e, s.d] = [s.d, s.e];
    const m = messages(a).join('\n');
    expect(m).toMatch(/language: must be English/);
    expect(m).toMatch(/language: must be German/);
  });

  it('kaputt: ganze Seite in der falschen Sprache', () => {
    const a = goodRaw();
    a.paras = a.paras.map((p) => p.map((s) => ({ e: s.d, d: s.e })));
    expect(gatesOf(a)).toContain('language');
    expect(messages(a).join('\n')).toMatch(/the e texts together must clearly be English/);
  });

  it('kaputt: zu viele Sätze mit unklarer Sprache', () => {
    const a = goodRaw();
    // Englische Sätze ohne ein einziges erkennbares Funktionswort: Sprache bleibt „unklar“ (mehr als 5 %).
    for (const [p, i] of [[0, 0], [0, 1], [1, 0], [1, 2], [2, 1], [3, 2], [4, 0]] as const) a.paras[p]![i]!.e = a.paras[p]![i]!.e.replace(/\b(?:the|a|an|of|to|for|and|is|are|that|it|in|on|with|by|from|as|their|they|its)\b/gi, 'pricing');
    expect(messages(a).join('\n')).toMatch(/language: too many English sentences of unclear language/);
  });
});

describe('Tor 4: 1:1-Ausrichtung', () => {
  it('gut: 1.000 und 1,000 gelten als dieselbe Zahl; Namen mit Entsprechung bestehen', () => {
    expect(numberTokens('about 1,000 users and 3.5 million')).toEqual(['1000', '35']);
    expect(numberTokens('rund 1.000 Nutzer und 3,5 Millionen')).toEqual(['1000', '35']);
    const a = goodRaw();
    a.paras[0]![0]!.e = 'Vendors such as Salesforce, Microsoft, Oracle and Shopify show the same pattern across the market, and it rarely changes quickly.';
    a.paras[0]![0]!.d = 'Anbieter wie Salesforce, Microsoft, Oracle und Shopify zeigen im gesamten Markt dasselbe Muster, und es ändert sich selten schnell.';
    expect(gatesOf(a)).toEqual([]);
  });

  it('kaputt: Zahl fehlt in der Übersetzung', () => {
    const a = goodRaw();
    a.paras[4]![1]!.d = 'Kleine Experimente, etwa ein neuer Tarif für wenige Prozent der neuen Besucher, begrenzen den Schaden, falls die Idee scheitert.';
    expect(messages(a).join('\n')).toMatch(/alignment: number 5 of the English sentence is missing in the German one/);
  });

  it('kaputt: mehrere Sätze in der Länge nicht passend (verschmolzen oder gekürzt)', () => {
    const a = goodRaw();
    for (const [p, i] of [[0, 0], [1, 1], [3, 3]] as const) a.paras[p]![i]!.d = 'Das stimmt so nicht ganz.';
    expect(messages(a).join('\n')).toMatch(/alignment: 3 of 21 sentences have a German\/English length ratio/);
  });

  it('kaputt: Gesamtverhältnis außerhalb 0,85 bis 1,35 (Deutsch viel zu kurz)', () => {
    const a = goodRaw();
    a.paras = a.paras.map((p) => p.map((s) => ({ e: s.e, d: s.d.split(' ').slice(0, 14).join(' ') })));
    expect(messages(a).join('\n')).toMatch(/alignment: German\/English word ratio 0\.\d+ is outside 0\.85–1\.35/);
  });

  it('kaputt: Eigennamen fehlen im Deutschen', () => {
    const a = goodRaw();
    a.paras[0]![0]!.e = 'Vendors such as Salesforce, Microsoft, Oracle and Shopify show the same pattern across the market, and it rarely changes quickly.';
    a.paras[0]![0]!.d = 'Anbieter zeigen im gesamten Markt dasselbe Muster, ganz unabhängig von ihrer Größe, und es ändert sich selten schnell.';
    expect(messages(a).join('\n')).toMatch(/alignment: proper names of the English text are missing/);
    expect(nameTokens('Vendors such as Salesforce, Microsoft and Europe grow.')).toEqual(['Salesforce', 'Microsoft']);
  });

  it('kaputt: zwei Satzenden in einem Eintrag (verschmolzene oder gespaltene Sätze)', () => {
    const a = goodRaw();
    a.paras[2]![0]!.e = 'Many teams respond by offering three tiers. A middle option makes the premium plan look reasonable by comparison.';
    expect(messages(a).join('\n')).toMatch(/alignment: a sentence contains a second sentence end/);
    const b = goodRaw();
    b.paras[2]![0]!.d = 'Viele Teams reagieren mit drei Stufen. Eine mittlere Option lässt den Premiumtarif vernünftig aussehen.';
    expect(messages(b).join('\n')).toMatch(/alignment: a sentence contains a second sentence end/);
  });

  it('gut: Abkürzungen und Initialen zählen nicht als Satzende', () => {
    expect(hasInnerSentenceEnd('The U.S. Government and Dr. Smith of Acme Inc. Group agreed.')).toBe(false);
    expect(hasInnerSentenceEnd('Das gilt z. B. Salesforce, d. h. Kunden bzw. Partner.')).toBe(false);
    expect(hasInnerSentenceEnd('It works. Then it stops.')).toBe(true);
    expect(hasInnerSentenceEnd('Did it work? Yes it did.')).toBe(true);
  });

  it('kaputt: zwei gleiche Sätze hintereinander', () => {
    const a = goodRaw();
    a.paras[2]![1] = { ...a.paras[2]![0]! };
    expect(messages(a).join('\n')).toMatch(/alignment: two identical sentences in a row/);
  });
});

describe('Tor 5: kein verklebter Text', () => {
  it('gut: übliche Schreibweisen mit Punkt sind kein verklebter Satz', () => {
    expect(gluedProblem('The U.S. market, Node.js, ASP.NET and a PhD in C# are fine at example.com.')).toBeNull();
    expect(gluedProblem('Version 3.5 costs 1,000 dollars.')).toBeNull();
  });

  it('kaputt: Satzende ohne Leerzeichen, doppelte Leerzeichen, Markdown, Platzhalter', () => {
    const a = goodRaw();
    a.paras[0]![0]!.e = 'Pricing is often treated as a spreadsheet exercise.But for most software companies it quietly shapes who becomes a customer and how long they stay.';
    expect(messages(a).join('\n')).toMatch(/glued: sentence end glued to the next word/);
    const b = goodRaw();
    b.paras[1]![0]!.e = 'Consider the  common choice between charging per seat and charging for usage.';
    expect(messages(b).join('\n')).toMatch(/glued: double spaces/);
    const c = goodRaw();
    c.paras[1]![0]!.d = 'Man denke an die **verbreitete** Entscheidung, ob man pro Nutzer oder nach Verbrauch abrechnet.';
    expect(messages(c).join('\n')).toMatch(/glued: markup or placeholder characters/);
    const d = goodRaw();
    d.paras[1]![0]!.e = 'Consider the common choice between charging per seat and ___ for usage.';
    expect(messages(d).join('\n')).toMatch(/glued: markup or placeholder characters/);
  });

  it('typografische Striche werden normalisiert, nicht abgelehnt', () => {
    const a = goodRaw();
    a.title = 'Pricing - a quiet lever for growth';
    const r = acceptArticle(a, { topic: 'saas' });
    expect(r.ok && r.article.title).toBe('Pricing – a quiet lever for growth');
  });
});

describe('Tor 6: Schlüsselwörter', () => {
  it('gut: Wort steht im angegebenen Satz; Endungen zählen (headcounts)', () => {
    expect(containsWord('Headcounts rose sharply in the second quarter.', 'headcount')).toBe(true);
    expect(containsWord('A breach of trust is costly.', 'breach of trust')).toBe(true);
    expect(containsWord('Nothing to see here.', 'headcount')).toBe(false);
  });

  it('kaputt: nicht genau fünf', () => {
    const a = goodRaw();
    a.keyWords = a.keyWords.slice(0, 4);
    expect(messages(a).join('\n')).toMatch(/keywords: needs exactly 5 key words, got 4/);
  });

  it('kaputt: Wort kommt im Text nicht vor', () => {
    const a = goodRaw();
    a.keyWords[0] = { w: 'headcount', de: 'Personalbestand', i: [0, 0] };
    expect(messages(a).join('\n')).toMatch(/keywords: "headcount" does not occur in any English sentence/);
  });

  it('kaputt: Funktionswort, Dublette, deutsche Bedeutung in falscher Sprache', () => {
    const a = goodRaw();
    a.keyWords[0] = { w: 'the', de: 'der', i: [0, 0] };
    expect(messages(a).join('\n')).toMatch(/keywords: "the" is a function word/);
    const b = goodRaw();
    b.keyWords[1] = { w: 'Tiers', de: 'Stufen', i: [2, 0] };
    expect(messages(b).join('\n')).toMatch(/keywords: duplicate key word/);
    const c = goodRaw();
    c.keyWords[0] = { w: 'tiers', de: 'this is the one that we use for the team and the staff', i: [2, 0] };
    expect(messages(c).join('\n')).toMatch(/keywords: de must be German/);
  });

  it('Fundstelle falsch, Wort steht aber woanders: still repariert', () => {
    const a = goodRaw();
    a.keyWords[0] = { w: 'tiers', de: 'Stufen', i: [0, 0] };
    const r = acceptArticle(a, { topic: 'saas' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.article.keyWords[0]?.i).toEqual([2, 0]);
      expect(r.repaired).toEqual(['keyWords.0.i']);
    }
  });

  it('nachsichtig (nur Neuversuch): drei gültige genügen, der Rest wird verworfen; zwei genügen nicht', () => {
    const a = goodRaw();
    a.keyWords[3] = { w: 'headcount', de: 'Personalbestand', i: [0, 0] };
    a.keyWords[4] = { w: 'the', de: 'der', i: [0, 0] };
    expect(gatesOf(a)).toEqual(['keywords']);
    const r = acceptArticle(a, { topic: 'saas', lenient: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.article.keyWords).toHaveLength(3);
      expect(r.dropped.map((d) => d.what)).toEqual(['keyWord', 'keyWord']);
    }
    a.keyWords[2] = { w: 'headcount', de: 'Personalbestand', i: [0, 0] };
    expect(gatesOf(a, { lenient: true })).toEqual(['keywords']);
  });
});

describe('Tor 7: Prüffragen (nie ein Grund, den Artikel abzulehnen)', () => {
  const dropsCheck = (mutate: (a: ReturnType<typeof goodRaw>) => void): string | undefined => {
    const a = goodRaw();
    mutate(a);
    const r = acceptArticle(a, { topic: 'saas' });
    expect(r.ok).toBe(true);
    if (!r.ok) return undefined;
    expect(r.article.check).toBeUndefined();
    return r.dropped.find((d) => d.what === 'check')?.reason;
  };

  it('gut: zwei gültige Fragen bleiben', () => {
    const r = acceptArticle(goodRaw(), { topic: 'saas' });
    expect(r.ok && r.article.check?.map((c) => c.a)).toEqual([1, 0]);
  });

  it('fehlen die Fragen ganz, ist der Artikel trotzdem gültig', () => {
    const a = goodRaw() as Record<string, unknown>;
    delete a.check;
    const r = acceptArticle(a, { topic: 'saas' });
    expect(r.ok && r.article.check).toBeUndefined();
  });

  it('kaputt: falsche Zahl der Fragen, falsche Antwort-Nummer, gleiche Optionen, englische Begründung, britische Schreibweise', () => {
    expect(dropsCheck((a) => (a.check = a.check.slice(0, 1)))).toMatch(/needs 2 to 3 questions/);
    expect(dropsCheck((a) => (a.check[0]!.a = 3))).toMatch(/a must be 0, 1 or 2/);
    expect(dropsCheck((a) => (a.check[1]!.o = ['Same answer here.', 'same answer here', 'Another one.']))).toMatch(/options must differ/);
    expect(dropsCheck((a) => (a.check[0]!.why = 'The text says that early cancellations often come from the wrong plan.'))).toMatch(/why must be German/);
    expect(dropsCheck((a) => (a.check[0]!.q = 'Which colour does the author prefer?'))).toMatch(/American English/);
    expect(dropsCheck((a) => (a.check[1]!.o = ['One', 'Two']))).toMatch(/three non-empty options/);
  });
});

describe('Tor 8: amerikanische Schreibweise', () => {
  it('gut: US-Formen und Wörter, die nur britisch aussehen, bestehen', () => {
    for (const t of ['The analysis shows emphasis on color, organization and centers.', 'We modeled the cancellation, canceled the license and advertised the program.', 'Exercise, franchise and enterprise are fine.'])
      expect(britishSpelling(t)).toBeNull();
  });

  it('kaputt: britische Formen werden gefunden', () => {
    for (const t of ['The colour of the logo', 'We organise the team', 'A new organisation', 'the centre of town', 'We analysed it', 'a licence fee', 'travelled widely', 'whilst others wait', 'the programme', 'He modelled it', 'optimising costs'])
      expect(britishSpelling(t), t).not.toBeNull();
  });

  it('kaputt: im Artikeltext wird die britische Form abgelehnt', () => {
    const a = goodRaw();
    a.paras[0]![0]!.e = 'Pricing is often treated as a spreadsheet exercise, but for most software companies it quietly shapes who becomes a customer and how long they stay, an organisation-wide habit.';
    a.paras[0]![0]!.d = 'Preisgestaltung wird oft als Tabellenübung behandelt, doch bei den meisten Softwareunternehmen bestimmt sie leise mit, wer zum Kunden wird und wie lange er bleibt, eine Gewohnheit der ganzen Organisation.';
    expect(messages(a).join('\n')).toMatch(/spelling: use American spelling, not "organisation"/);
  });
});

describe('Tor 9: Dublette', () => {
  it('gut: anderer Titel, oder ähnlicher Titel in einem anderen Thema', () => {
    expect(gatesOf(goodRaw(), { topic: 'saas', recent: [{ title: 'How remote teams decide faster', topic: 'management' }] })).toEqual([]);
    expect(gatesOf(goodRaw(), { topic: 'saas', recent: [{ title: 'Why Pricing Pages Quietly Decide Growth Faster', topic: 'ai' }] })).toEqual([]);
  });

  it('kaputt: normalisierter Titel gleich (Groß-/Kleinschreibung und Satzzeichen egal)', () => {
    expect(messages(goodRaw(), { topic: 'saas', recent: [{ title: 'why pricing pages, quietly decide growth!', topic: 'saas' }] }).join('\n')).toMatch(/duplicate: this title is too close/);
  });

  it('kaputt: fast gleicher Titel im selben Thema', () => {
    expect(gatesOf(goodRaw(), { topic: 'saas', recent: [{ title: 'Why Pricing Pages Quietly Decide Growth Faster', topic: 'saas' }] })).toEqual(['duplicate']);
  });
});

describe('Ergebnis', () => {
  it('Thema gilt wie angefragt; unbekannte Werte fallen auf Voreinstellungen', () => {
    const a = goodRaw();
    a.topic = 'unknown-topic';
    a.kind = 'weird';
    a.level = 'x9';
    a.asOf = 'a'.repeat(80);
    const r = acceptArticle(a);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.article.topic).toBe('custom');
      expect(r.article.kind).toBe('explainer');
      expect(r.article.level).toBe('c1');
      expect(r.article.asOf).toHaveLength(40);
    }
    expect(acceptArticle(goodRaw(), { topic: 'ai' }).ok && (acceptArticle(goodRaw(), { topic: 'ai' }) as { article: { topic: string } }).article.topic).toBe('ai');
  });

  it('die Mängel sind englisch, tragen Tor und Pfad (Rückmeldung an Claude im Neuversuch)', () => {
    const a = goodRaw();
    a.paras[1]![0]!.e = 'Consider the  common choice between charging per seat and charging for usage.';
    const r = acceptArticle(a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]).toEqual({ gate: 'glued', path: ['paras', 1, 0, 'e'], message: 'double spaces' });
  });
});
