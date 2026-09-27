# Wortschatztest (Phase 6, Plan §8)

Freiwillig, nie Pflicht. Das Ergebnis steht im Format der alten App in `app/profile.vtests[]` (Anhang B) und speist das Wortschatzziel 8.000 sowie die Can-Do-Punkte `vocab_passive`/`vocab_active`.

## Ablauf

| Teil | Inhalt | Umfang |
|---|---|---|
| 1 · Kennst du das Wort? | alle 100 Wörter aus `src/content/legacy/vtest.json` (10 Häufigkeitsbänder zu je 1.000 Wörtern) und 12 der 30 Pseudowörter, gemischt mit `mulberry32(hash32(Lerntag))` | 112 |
| 2 · Was bedeutet es? | 2 „Kenne ich"-Wörter je Band, höhere Bänder zuerst; 4 Optionen gleicher Wortart in der Oberflächensprache (`de` aus `vtest.json`, `en` aus `src/content/vtest-en.json`) | ≤ 20 |
| 3 · Schreib das Wort | 1 „Kenne ich"-Wort je Band (möglichst nicht aus Teil 2); Bedeutung vorgegeben, Lücke mit Buchstaben-Platzhaltern und erstem Buchstaben, Prüfung mit `checkTyped` | ≤ 10 |

Teil 1 ist die Wissensabfrage des Tests, keine Bewertung einer Wiederholung – Emrahs Regel „keine Selbstbewertung" (A7) betrifft die Wiederholungen und gilt hier nicht. Abbrechen fragt nach und speichert nichts.

## Rechnung (`src/domain/vtest/score.ts`)

- Fehlalarmquote `f = fa / faN` (faN = gezeigte Pseudowörter, 12).
- Je Band `k_b = max(0, (h_b − f) / (1 − f))`, `h_b` = Anteil „Kenne ich" im Band; bei `f = 1` gilt `k_b = 0`.
- Bedeutungsquote `m' = (richtig + 1) / (geprüft + 2)`; ohne Probe `m' = 1`.
- `bands[b] = round2(k_b · m')`, `passive = round50(Σ 1000 · bands[b])`.
- Streuung `SE = √Σ (1000² · x(1 − x) / 10)`, Band `pLo/pHi = passive ∓ 1,64 · SE`, begrenzt auf 0–10.000.
- Aktiv: `aAcc = (richtig + 1) / (n + 2)`, `active = round50(passive · aAcc)`, `aLo/aHi` = `pLo/pHi · aAcc`.
- Gespeichert zusätzlich: `fa`, `faN`, `pseudoN`, `mAcc`, `aAcc`, `dur` (ms), `d` (Lerntag), `t`, Kennung `v: 'lx1'`.

## Speichern (`src/domain/vtest/persist.ts`)

Über die eine Sammel-Warteschlange (`recordProfileFields`): `vtests` (≤ 20), `act[tag].vtest + 1`, `minutes[tag] + round(dur / 60.000)`. Ein schon gespeichertes Ergebnis (gleiches `t`) wird nie doppelt angehängt.

## Englische Bedeutungen

`src/content/vtest-en.json` enthält 100 kurze Umschreibungen in einfachem amerikanischem Englisch, nie das Wort selbst (Test). Eine Prüfung durch den learning-scientist steht aus (siehe Bericht).
