import { describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import { BRIEF_MAX, learnerBrief, openGrammarErrors, weakestTopics } from '../../src/domain/companion/brief';
import { activeMsgs, appendChat, ASSISTANT_MAX, CHAT_GAP_MS, CHAT_MAX, CHAT_MAX_BYTES, currentMsgs, msgLang, readChat, replyLang, USER_MAX, type ChatMsg } from '../../src/domain/companion/chatDoc';
import { maskText, redact, type Seeing } from '../../src/domain/companion/seeing';
import { suggestions } from '../../src/domain/companion/suggest';
import { buildChatInput, HISTORY_MAX, TURNS_MAX_BYTES } from '../../src/domain/companion/turns';
import { englishRuns, inlineText, parseMarkdown } from '../../src/domain/text/markdown';
import { afterScroll, isAtBottom, nextScroll } from '../../src/ui/chat/scroll';
import { companionChat, NO_SOLUTION_RULE, type CompanionVars } from '../../src/prompts/companionChat';
import { loadSeed, type Doc } from './helpers';

const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
const seed = loadSeed();

describe('app/chat (chatDoc)', () => {
  it('liest Altnachrichten ohne t/lang aus dem Seed; ungültige Form → ok:false', () => {
    const r = readChat(seed['app/chat']);
    expect(r.ok).toBe(true);
    expect(r.msgs.length).toBe(4);
    expect(r.msgs[0]!.t).toBeUndefined();
    expect(readChat({ msgs: 'kaputt' }).ok).toBe(false);
    expect(readChat(undefined)).toEqual({ msgs: [], since: 0, ok: true });
    expect(validateDoc('app/chat', { msgs: [{ role: 'user', content: 'x', t: 1, lang: 'de', ctx: 'Heute', stopped: true }], since: 5 }).ok).toBe(true);
    expect(validateDoc('app/chat', seed['app/chat']).ok).toBe(true);
  });

  it('appendChat: ≤ 40 Nachrichten, ≤ 180 KB auch mit Umlauten, älteste zuerst weg, Kürzen je Nachricht', () => {
    let msgs: ChatMsg[] = [];
    for (let i = 0; i < 60; i++) {
      msgs = appendChat(msgs, [
        { role: 'user', content: 'ä'.repeat(3000), t: i * 2 },
        { role: 'assistant', content: 'ö'.repeat(9000), t: i * 2 + 1 },
      ]);
    }
    expect(msgs.length).toBeLessThanOrEqual(CHAT_MAX);
    expect(bytes({ msgs, since: 0 })).toBeLessThanOrEqual(CHAT_MAX_BYTES);
    expect(msgs[msgs.length - 1]!.t).toBe(119);
    expect(Array.from(msgs.find((m) => m.role === 'user')!.content).length).toBeLessThanOrEqual(USER_MAX);
    expect(Array.from(msgs.find((m) => m.role === 'assistant')!.content).length).toBeLessThanOrEqual(ASSISTANT_MAX);
  });

  it('appendChat ist wiederholbar: dieselben Nachrichten (t, Rolle) kommen nicht doppelt', () => {
    const add: ChatMsg[] = [
      { role: 'user', content: 'Hallo', t: 10 },
      { role: 'assistant', content: 'Hi', t: 11 },
    ];
    const once = appendChat([], add);
    expect(appendChat(once, add)).toHaveLength(2);
  });

  it('since: nur das laufende Gespräch geht an Claude', () => {
    const msgs: ChatMsg[] = [{ role: 'user', content: 'alt' }, { role: 'user', content: 'neu', t: 100 }];
    expect(currentMsgs(msgs, 50).map((m) => m.content)).toEqual(['neu']);
    expect(currentMsgs(msgs, 0)).toHaveLength(2);
  });

  it('msgLang/replyLang: Zitate und Fettes zählen nicht', () => {
    expect(msgLang({ role: 'assistant', content: '„sign off on something“ heißt etwas offiziell freigeben: The CFO signed off on the budget.' })).not.toBe('en');
    expect(replyLang('**leverage** heißt hier *nutzen*, um einen Vorteil zu erzielen. Das ist sehr häufig.', 'de')).toBe('de');
    expect(replyLang('Sure! It means using what you have to get an advantage, and it is very common.', 'de')).toBe('en');
    expect(replyLang('ok', 'de')).toBe('de');
  });
});

describe('Eingabe des Gesprächs (turns)', () => {
  it('beginnt und endet mit user, Einleitung bleibt, keine leeren Inhalte', () => {
    const t = buildChatInput('LEAD', [{ role: 'assistant', content: 'a' }, { role: 'user', content: '  ' }, { role: 'user', content: 'q' }], 'neu');
    expect(t[0]).toEqual({ role: 'user', content: 'LEAD' });
    expect(t[t.length - 1]).toEqual({ role: 'user', content: 'neu' });
    expect(t.every((x) => x.content.trim().length > 0)).toBe(true);
  });

  it('älteste Verlaufsnachrichten fallen zuerst weg: ≤ 56.000 B und ≤ 20', () => {
    const hist = Array.from({ length: 60 }, (_, i): ChatMsg => ({ role: i % 2 ? 'assistant' : 'user', content: `${i} ${'ü'.repeat(2900)}` }));
    const t = buildChatInput('L'.repeat(5000), hist, 'Frage');
    const total = t.reduce((n, x) => n + new TextEncoder().encode(x.content).length, 0);
    expect(total).toBeLessThanOrEqual(TURNS_MAX_BYTES);
    expect(t.length - 2).toBeLessThanOrEqual(HISTORY_MAX);
    expect(t[1]!.content.startsWith('5')).toBe(true);
    expect(t[t.length - 2]!.content.startsWith('59')).toBe(true);
  });
});

describe('Schwärzen (seeing) und Schutzregel', () => {
  const q: Seeing = { area: 'trainer', label: 'Übung · Lücke', phase: 'question', detail: 'Fülle die Lücke\nWe need to ___ the budget.', reveal: 'Solution: approve. Learner: accept' };
  const vars = (s: Seeing | null): CompanionVars => ({ uiLang: 'de', learner: 'Level: B2', work: 'Sales', seeing: s, attach: null, history: [], message: 'Hilfe?' });

  it('question: reveal fällt weg, Schutzregel steht in der Einleitung, Lösung nirgends', () => {
    expect(redact(q)?.reveal).toBeUndefined();
    const turns = companionChat.buildTurns(vars(q));
    const all = turns.map((t) => t.content).join('\n');
    expect(all).toContain(NO_SOLUTION_RULE);
    expect(all).not.toContain('approve');
    expect(all).toContain('___');
  });

  it('question: Lösung auch im Satz eines angetippten Worts geschwärzt (mask), nach dem Prüfen nicht', () => {
    const s: Seeing = { ...q, mask: ['avoid', 'to avoid'] };
    expect(maskText('Try to avoid driving. Avoidance is fine.', s)).toBe('Try to ___ driving. Avoidance is fine.');
    const v = { ...vars(s), attach: { kind: 'word' as const, word: 'driving', sentence: 'Try to avoid driving in rush hour.', source: null } };
    const all = companionChat.buildTurns(v).map((t) => t.content).join('\n');
    expect(all).toContain('"Try to ___ driving in rush hour."');
    expect(all).not.toMatch(/\bavoid\b/);
    expect(maskText('Try to avoid it.', { ...s, phase: 'feedback' })).toBe('Try to avoid it.');
  });

  it('feedback: reveal wird gesendet, keine Schutzregel', () => {
    const turns = companionChat.buildTurns(vars({ ...q, phase: 'feedback' }));
    const all = turns.map((t) => t.content).join('\n');
    expect(all).toContain('Solution: approve');
    expect(all).not.toContain(NO_SOLUTION_RULE);
  });

  it('Kopfzeile, Stufe default, cache false; Sprache der Erklärungen', () => {
    const turns = companionChat.buildTurns(vars(null));
    expect(turns[0]!.content.split('\n')[0]).toBe('[companion-chat@2]');
    expect(companionChat.tier).toBe('default');
    expect(companionChat.cache).toBe(false);
    expect(turns[0]!.content).toContain('Write your explanations in German');
    expect(companionChat.buildTurns({ ...vars(null), uiLang: 'en' })[0]!.content).toContain('Write your explanations in English');
  });
});

describe('Lernstand-Kurzfassung (brief)', () => {
  const grammar = new Map<string, Doc>(Object.entries(seed).filter(([k]) => k.startsWith('grammar/')).map(([k, v]) => [k.slice(8), v]));
  const vocab = new Map<string, Doc>(Object.entries(seed).filter(([k]) => k.startsWith('vocab/')).map(([k, v]) => [k.slice(6), v]));

  it('aus dem Seed ≤ 2.500 Zeichen, Themen in UI-Sprache, offene Fehler', () => {
    const de = learnerBrief({ assess: seed['app/assess'], grammar, vocab, uiLang: 'de', pflichtDone: false });
    expect(de.length).toBeLessThanOrEqual(BRIEF_MAX);
    expect(de).toContain('Level: B2');
    expect(de).toContain('Daily review done today: no');
    expect(openGrammarErrors(grammar, 5).length).toBeGreaterThan(0);
    const en = weakestTopics(grammar, 'en', 16).map((x) => x.name);
    expect(en).toContain('Passive voice');
    expect(weakestTopics(grammar, 'de', 16).map((x) => x.name)).toContain('Passiv');
  });

  it('ohne assess und ohne Daten kein Absturz', () => {
    expect(learnerBrief({ assess: null, grammar: undefined, vocab: undefined, uiLang: 'de', pflichtDone: null })).toContain('Weakest grammar topics');
  });
});

describe('Vorschläge', () => {
  it('je Lage feste Schlüssel, nach einer Antwort genau drei Folgechips', () => {
    expect(suggestions({ seeing: { area: 'trainer', label: 'x', phase: 'question' }, hasWord: false, afterReply: false })).toEqual(['sgHint', 'sgRule']);
    expect(suggestions({ seeing: null, hasWord: true, afterReply: false })).toContain('sgWordColloc');
    expect(suggestions({ seeing: null, hasWord: false, afterReply: true })).toEqual(['nbProfilSgExample', 'nbProfilSgOther', 'nbProfilSgGerman']);
  });
});

describe('Markdown', () => {
  it('Absätze, Listen, fett, kursiv, code, Zitat, Überschrift', () => {
    const b = parseMarkdown('### Titel\n\n**fett** und *kursiv* und `code`\n\n- eins\n- zwei\n\n1. a\n2. b\n\n> zitat');
    expect(b.map((x) => x.type)).toEqual(['h', 'p', 'ul', 'ol', 'quote']);
    const p = b[1]!;
    expect(p.type === 'p' && p.inline.map((n) => n.type)).toEqual(['strong', 'text', 'em', 'text', 'code']);
  });

  it('unfertige Marker bleiben Text; HTML und Links bleiben Text', () => {
    const b = parseMarkdown('Das ist **bol');
    expect(b[0]!.type === 'p' && inlineText(b[0]!.inline)).toBe('Das ist **bol');
    const h = parseMarkdown('<script>alert(1)</script> [link](https://x.y)');
    expect(h[0]!.type === 'p' && inlineText(h[0]!.inline)).toBe('<script>alert(1)</script> [link](https://x.y)');
  });

  it('jedes Präfix einer Antwort lässt sich parsen (Streaming)', () => {
    const src = '### Hi\n\n**leverage** heißt *nutzen*.\n\n- „We can **leverage** it.“\n- `x`\n\n```\ncode\n``';
    for (let i = 0; i <= src.length; i++) expect(() => parseMarkdown(src.slice(0, i))).not.toThrow();
  });
});

describe('Scroll-Logik (nextScroll)', () => {
  const m = { scrollTop: 0, scrollHeight: 2000, clientHeight: 500 };
  it('unten → folgen; hochgescrollt → Position bleibt, Pille an; Senden → unten', () => {
    expect(nextScroll({ atBottom: true }, m, 'grow')).toEqual({ scrollTop: 1500, atBottom: true, jump: false });
    expect(nextScroll({ atBottom: false }, { ...m, scrollTop: 800 }, 'grow')).toEqual({ scrollTop: null, atBottom: false, jump: true });
    expect(nextScroll({ atBottom: false }, { ...m, scrollTop: 800 }, 'send').scrollTop).toBe(1500);
    expect(isAtBottom({ scrollTop: 1460, scrollHeight: 2000, clientHeight: 500 })).toBe(true);
    expect(isAtBottom({ scrollTop: 1400, scrollHeight: 2000, clientHeight: 500 })).toBe(false);
  });

  it('verspätetes Scroll-Ereignis nach eigenem Senden hebt „unten" nicht auf; echtes Hochscrollen schon', () => {
    // Die App hat auf 1500 gesetzt, danach ist der Inhalt um 300 px gewachsen.
    expect(afterScroll(true, { scrollTop: 1500, scrollHeight: 2300, clientHeight: 500 }, 1500)).toBe(true);
    expect(afterScroll(true, { scrollTop: 1100, scrollHeight: 2300, clientHeight: 500 }, 1500)).toBe(false);
    expect(afterScroll(false, { scrollTop: 1790, scrollHeight: 2300, clientHeight: 500 }, null)).toBe(true);
    expect(afterScroll(false, { scrollTop: 1600, scrollHeight: 2300, clientHeight: 500 }, 1500)).toBe(false);
  });
});

describe('englishRuns (W5: englische Sätze ohne Anführungszeichen antippbar)', () => {
  it('markiert nur den eindeutig englischen Satz in einer deutschen Erklärung', () => {
    const runs = englishRuns('Du kannst es so sagen: I would like to schedule a meeting with you. Das ist höflich.');
    expect(runs.filter((r) => r.en).map((r) => r.text)).toEqual(['I would like to schedule a meeting with you.']);
    expect(runs.map((r) => r.text).join('')).toBe('Du kannst es so sagen: I would like to schedule a meeting with you. Das ist höflich.');
  });
  it('lässt rein deutschen Text unverändert', () => {
    expect(englishRuns('Das ist ein ganz normaler deutscher Satz.').some((r) => r.en)).toBe(false);
  });
});

// Emrahs Befund 27.09.: „Er antwortet auf den Kontext der letzten Aufgabe".
describe('Gesprächsverlauf: nur der aktuelle Abschnitt', () => {
  const now = 10 * CHAT_GAP_MS;
  const m = (t: number, content: string) => ({ role: 'user' as const, content, t });
  it('nach über einer Stunde Pause geht der alte Verlauf nicht mehr an Claude', () => {
    expect(activeMsgs([m(now - 2 * CHAT_GAP_MS, 'alte Aufgabe')], 0, now)).toEqual([]);
  });
  it('zusammenhängendes Gespräch bleibt, ältere Abschnitte fallen weg', () => {
    const msgs = [m(now - 3 * CHAT_GAP_MS, 'alt'), m(now - 20 * 60_000, 'a'), m(now - 5 * 60_000, 'b')];
    expect(activeMsgs(msgs, 0, now).map((x) => x.content)).toEqual(['a', 'b']);
  });
  it('„Neues Gespräch" gilt weiter', () => {
    const msgs = [m(now - 20 * 60_000, 'a'), m(now - 5 * 60_000, 'b')];
    expect(activeMsgs(msgs, now - 10 * 60_000, now).map((x) => x.content)).toEqual(['b']);
  });
});
