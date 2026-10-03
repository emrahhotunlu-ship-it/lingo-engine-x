import { describe, expect, it } from 'vitest';
import { bracketExample, newVocabDoc } from '../../src/domain/srs/newCard';
import { locate } from '../../src/domain/srs/context';

// Befund 28.09.2026 (Emrahs Kommentar „Speichern hat nicht geklappt" bei Lehrer-Feedback › „catch
// on"): der Beispielsatz nutzte die unregelmäßige Vergangenheitsform „caught on", `locate()` fand
// nur regelmäßige Endungen (-ed, -ing, -s) und die Karte ließ sich nicht anlegen (Kap. 15: kein
// Beispielsatz, keine Karte). Betrifft nicht nur Lehrer-Feedback, sondern jeden Weg, der eine Karte
// aus einem Beispielsatz baut (Chat, „Aus Text", Wort-Antippen).

describe('unregelmäßige Verben im Beispielsatz', () => {
  it('locate() findet „catch on" als „caught on"', () => {
    expect(locate('The idea caught on quickly with the team.', 'catch on')).not.toBeNull();
  });

  it('bracketExample setzt die Klammer um die gebeugte Form', () => {
    const ex = bracketExample('The idea caught on quickly with the team.', null, 'catch on');
    expect(ex).toBe('The idea [caught on] quickly with the team.');
  });

  it('newVocabDoc legt die Karte trotz unregelmäßiger Form an (vorher: null, „invalid")', () => {
    const made = newVocabDoc({
      word: 'catch on',
      de: 'sich durchsetzen',
      pos: 'phrase',
      def: null,
      level: null,
      ex: 'The idea caught on quickly with the team.',
      surface: null,
      src: 'teacher',
      origin: { v: 1, kind: 'teacher', t: 0 },
      today: '2026-09-28',
    });
    expect(made).not.toBeNull();
    expect(made?.doc.ex).toBe('The idea [caught on] quickly with the team.');
  });

  it('weitere gebräuchliche unregelmäßige Verben (come up with, take on, bring about)', () => {
    expect(locate('The team came up with a plan.', 'come up with')).not.toBeNull();
    expect(locate('They took on the new client last week.', 'take on')).not.toBeNull();
    expect(locate('The merger brought about big changes.', 'bring about')).not.toBeNull();
  });

  it('regelmäßige Formen funktionieren weiterhin unverändert', () => {
    expect(locate('We will phase out the old version.', 'phase out')).not.toBeNull();
    expect(locate('They rolled out the update yesterday.', 'roll out')).not.toBeNull();
  });
});
