import { describe, expect, it } from 'vitest';
import { acceptListen, acceptListenAll } from '../../src/domain/apply/listenQ';
import { listenQ, LISTEN_Q_EXAMPLE } from '../../src/prompts/listenQ';
import { listenQReply } from '../../src/platform/dev/canned/listenQ';
import { header } from '../../src/prompts/common';

const GOOD = {
  word: 'deadline',
  text: 'Thanks for the update. We will not meet the deadline on Friday, because the supplier is late. Could we move it to Tuesday? I can send the new plan this afternoon, and then we can decide together.',
  question: 'Why can the team not meet the deadline?',
  options: ['The supplier is late.', 'The budget is too small.', 'The client changed the plan.'],
  answer: 0,
  quote: 'because the supplier is late',
  why: 'Der Grund steht direkt nach because.',
};

describe('Hörübung mit Frage: Prüfung vor der Anzeige', () => {
  it('nimmt einen guten Eintrag an, mischt fest und behält die richtige Antwort', () => {
    const it1 = acceptListen(GOOD, 'de')!;
    expect(it1).toBeTruthy();
    expect(it1.options[it1.answer]).toBe('The supplier is late.');
    expect(acceptListen(GOOD, 'de')!.options).toEqual(it1.options);
  });
  it('lehnt ab: Zielwort fehlt, Beleg nicht im Text, doppelte Optionen, falscher Index, Frage verrät Antwort', () => {
    expect(acceptListen({ ...GOOD, word: 'invoice' }, 'de')).toBeNull();
    expect(acceptListen({ ...GOOD, quote: 'this is not in the text' }, 'de')).toBeNull();
    expect(acceptListen({ ...GOOD, options: ['A.', 'A.', 'B.'] }, 'de')).toBeNull();
    expect(acceptListen({ ...GOOD, answer: 3 }, 'de')).toBeNull();
    expect(acceptListen({ ...GOOD, question: 'Is it true that the supplier is late?' }, 'de')).toBeNull();
    expect(acceptListen({ ...GOOD, text: 'Too short for this.' }, 'de')).toBeNull();
    expect(acceptListen({ ...GOOD, why: 'The reason is right after the word because in the text.' }, 'de')).toBeNull();
  });
  it('Dubletten und schon gehörte Texte fallen weg', () => {
    expect(acceptListenAll([GOOD, GOOD], 'de')).toHaveLength(1);
    expect(acceptListenAll([GOOD], 'de', new Set(['thanks for the update we will not meet the deadline on friday because the supplier is late could we move it to tuesday i can send the new plan this afternoon and then we can decide together']))).toHaveLength(0);
  });
  it('Vorlage: Kopfzeile, Beispiel besteht Schema und Prüfung, Test-Antwort ist gültig', () => {
    const v = { words: ['deadline', 'invoice', 'budget'], avoid: [], n: 3, uiLang: 'de' as const };
    expect(listenQ.build(v).split('\n')[0]).toBe(header(listenQ));
    const parsed = listenQ.schema(v).parse(JSON.parse(LISTEN_Q_EXAMPLE));
    expect(acceptListenAll(parsed.items, 'de')).toHaveLength(1);
    const out = listenQ.schema(v).parse(JSON.parse(listenQReply(listenQ.build(v))));
    expect(acceptListenAll(out.items, 'de')).toHaveLength(3);
  });
});
