import { describe, expect, it } from 'vitest';
import { errorSentences } from '../../src/domain/grammar/errors';
import { spanFixes } from '../../src/domain/repair/variant';

describe('errorSentences', () => {
  it('lässt den Wort-Hinweis nach der Lücke weg, damit die Fehlerstelle eindeutig ist', () => {
    const q = "'I have already sent the contract,' he told me. → He told me that he ___ (already / send) the contract.";
    const s = errorSentences(q, 'had already send', 'had already sent');
    expect(s.wrong).toBe("'I have already sent the contract,' he told me. → He told me that he had already send the contract.");
    expect(s.right).toBe("'I have already sent the contract,' he told me. → He told me that he had already sent the contract.");
    expect(spanFixes(s.wrong, s.right)).toEqual([{ span: [17, 17], fix: 'sent' }]);
    expect(errorSentences('She ___ (not / go) yet.', '', "hasn't gone")).toEqual({ wrong: 'She … yet.', right: "She hasn't gone yet." });
  });

  it('ohne Hinweis und bei Klammern an anderer Stelle bleibt der Satz unverändert', () => {
    expect(errorSentences('(Formal) She ___ the report.', 'send', 'sent')).toEqual({ wrong: '(Formal) She send the report.', right: '(Formal) She sent the report.' });
    expect(errorSentences('He ______ late.', 'come', 'came')).toEqual({ wrong: 'He come late.', right: 'He came late.' });
    expect(errorSentences('Korrigiere: He go.', 'He go.', 'He goes.')).toEqual({ wrong: 'Korrigiere: He go.', right: 'He goes.' });
  });
});

describe('spanFixes bei „Weiß ich nicht“', () => {
  it('„…“ ist keine Fehlerstelle zum Antippen (Bausteine statt Antippen)', () => {
    const s = errorSentences('"I will finish the report tomorrow," Anna said. → Anna said ___.', '', 'she would finish the report the next day');
    expect(s.wrong).toContain('…');
    expect(spanFixes(s.wrong, s.right)).toBeNull();
  });
});
