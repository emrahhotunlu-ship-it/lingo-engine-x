import type { WordOp } from '../learn/types';

// Gegenüberstellung als Blöcke (Paket Q0, Emrahs Foto 31.10.2026): der Wort-für-Wort-Abgleich (`alignWords`) zerlegt eine ersetzte Wortgruppe
// in Einzelpaare („~~each~~ → the ~~other~~ → challenges“). Aufeinanderfolgende Änderungen (sub/ins/del) werden zu EINEM Block zusammengefasst
// („~~each other~~ → the challenges“). Tippfehler (`typo`) und gleiche Wörter trennen Blöcke. Rein.

export function mergeOps(ops: readonly WordOp[]): WordOp[] {
  const out: WordOp[] = [];
  let run: WordOp[] = [];
  const flush = () => {
    if (run.length === 1) out.push(run[0] as WordOp);
    else if (run.length > 1) {
      const given = run.map((o) => (o.op === 'del' ? '' : (o.given ?? ''))).filter(Boolean).join(' ');
      const expected = run.map((o) => (o.op === 'ins' ? '' : (o.expected ?? ''))).filter(Boolean).join(' ');
      if (given && expected) out.push({ op: 'sub', given, expected });
      else if (given) out.push({ op: 'ins', given });
      else out.push({ op: 'del', expected });
    }
    run = [];
  };
  for (const o of ops) {
    if (o.op === 'sub' || o.op === 'ins' || o.op === 'del') run.push(o);
    else {
      flush();
      out.push(o);
    }
  }
  flush();
  return out;
}
