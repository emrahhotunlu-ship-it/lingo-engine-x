# Bundle-Budget (Lernplattform 3.0 §9)

**Eine Zahl:** `check:platform` warnt ab **6 MiB** (6.291.456 Byte), blockiert ab **9 MiB** (9.437.184 Byte). Plattformgrenze 16 MB. Einheit festgelegt: **MiB** (1 MiB = 1.048.576 Byte); wo der Plan „MB“ sagt, sind 10⁶ Byte gemeint.
Arbeitsvorgabe der Koordination für Release 1: Gesamt-`dist` ≤ 5,2 MB (= 4,96 MiB), Warnung bei 6 MB.

Messung nach **jedem** Paket (Byte der `dist/index.html`, Differenz zum Vorgänger, Grund).

| Datum | Paket | Byte | Differenz | MiB | Grund |
|---|---|---|---|---|---|
| 07.10.2026 | Ausgangsstand (cf8134c) | 4.354.238 | – | 4,15 | LIVE 3 mit gepackten `?raw`-JSON (`scripts/vite-raw-json-zip.mjs`) |
| 07.10.2026 | P9 | 4.354.238 | 0 | 4,15 | nur Skripte, ESLint, Tests (kein Einfluss auf dist) |
| 07.10.2026 | P10 | 4.354.238 | 0 | 4,15 | Inhaltsspeicher ohne Verbraucher (kein Einfluss auf dist) |
| 07.10.2026 | P12 | 4.354.238 | 0 | 4,15 | c1x-Domäne noch nicht von der App importiert (Tree-Shaking) |
| 07.10.2026 | P11 | 4.355.991 | +1.753 | 4,15 | Slot, Registry, 13 Stellen |
| 07.10.2026 | P13 | 4.356.579 | +588 | 4,15 | Buchung (write.ts, answerRight); c1x-Domäne noch ohne Verbraucher in der App |
| 07.10.2026 | P14 | 4.452.161 | +95.582 | 4,25 | c1x-Rahmen, Texte DE/EN, Stile, Kwt/Err-Gerüst, Verbraucher in der App |
| 07.10.2026 | P16 | 4.459.761 | +3.761 | 4,25 | kwt: Handy-Bausteine, Teil B getippt, `kindRound`; Schalter `kwt` an |
| 07.10.2026 | P17 | 4.463.280 | +3.519 | 4,26 | err: TapSentence, Chips, Teil-Tippen, Messwerte; Schalter `err` an |
| 07.10.2026 | P20/P21 | 4.545.191 | +81.911 | 4,33 | ocl/mcc: Oberfläche, Lexik-Buchung, Inhalt K2 (120 + 120 Aufgaben, gepackt); Schalter `mcc` und `ocl` an |
| 07.10.2026 | Stand Test-Link 5 (7173d43) | 4.578.365 | – | 4,37 | Ausgangswert für Release 2 (zuletzt eingechecktes `dist`) |
| 07.10.2026 | P24 | 4.591.348 | +12.983 | 4,38 | Tempo-Runde: Auswahl, Messwerte, Runde, Eingabeformen kwt Teil B, Kachel, Texte DE/EN, Stile |
| 07.10.2026 | P30 | 4.597.416 | +6.068 | 4,38 | Effekte-Fundament: `engine/fx` (Ereignisse, Dirigent, Stufe), Feder-Tokens, Stufe 1 als CSS, Einstellungen › Effekte |

## Planrechnung (LP3 §9, Modell)

| Posten | MB |
|---|---|
| Stand heute | 4,35 (gemessen) |
| c1x-Inhalt Endstand (1.920 Aufgaben, gepackt) | +0,62 |
| Code c1x, Programm, Check | +0,12 |
| Code Tutor / Erlebnis / Motivation | +0,18 |
| `anim.json`, `program.json`, `demo/moments.json` | +0,07 |

Überschreitet ein Paket 6 MiB, ist das nächste Paket die Packung bestehender Inhalte (`dict.json`, `toolkit.json`, `grammar-bank.json`).
