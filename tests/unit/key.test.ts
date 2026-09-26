import { describe, expect, it } from 'vitest';
import { legacyNorm, legacyTaskKey } from '../../src/domain/grammar/key';

// Referenzausgaben mit der Original-Funktion `norm`/`key` der alten App erzeugt (models.js:223,
// grammar.js:50). Weicht der Schlüssel ab, zerbrechen `seen`, der Pool-Abgleich und der Rückweg.
const REF: Array<[prompt: string, norm: string, key: string]> = [
  ['Look! It ___ outside.', 'look it ___ outside', 'lookitoutside'],
  ['I won’t ___ (be) late, I promise.', 'i will not ___ (be) late i promise', 'iwillnotbelateipromise'],
  ['She can’t have ___ the report yet.', 'she cannot have ___ the report yet', 'shecannothavethereportyet'],
  ['“We’ve been waiting,” he said.', 'we have been waiting he said', 'wehavebeenwaitinghesaid'],
  ['If I ___ (know), I’d have called.', "if i ___ (know) i'd have called", 'ifiknowidhavecalled'],
  ['They’re ___ to the new system next week.', 'they are ___ to the new system next week', 'theyaretothenewsystemnextweek'],
  ['I’m not used to ___ (get) up early.', 'i am not used to ___ (get) up early', 'iamnotusedtogetupearly'],
  ["He shan't ___ this again!", 'he shall not ___ this again', 'heshallnotthisagain'],
  ['You can not ___ (park) here; it’s forbidden.', "you cannot ___ (park) here it's forbidden", 'youcannotparkhereitsforbidden'],
  [
    'By 2027 we ___ (finish) the migration – hopefully. This sentence is deliberately very long so that the key gets cut at eighty letters.',
    'by 2027 we ___ (finish) the migration – hopefully this sentence is deliberately very long so that the key gets cut at eighty letters',
    'bywefinishthemigrationhopefullythissentenceisdeliberatelyverylongsothatthekeyget',
  ],
];

describe('legacyNorm / legacyTaskKey (1:1 alte App)', () => {
  it.each(REF)('%s', (prompt, norm, key) => {
    expect(legacyNorm(prompt)).toBe(norm);
    expect(legacyTaskKey(prompt)).toBe(key);
    expect(legacyTaskKey(prompt).length).toBeLessThanOrEqual(80);
  });

  it('liest Nicht-Texte tolerant', () => {
    expect(legacyNorm(undefined)).toBe('');
    expect(legacyNorm({ a: 1 })).toBe('');
    expect(legacyNorm(42)).toBe('42');
  });
});
