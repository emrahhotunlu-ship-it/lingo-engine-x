# Bundle-Budget (Lernplattform 3.0 §9)

**Eine Zahl:** `check:platform` warnt ab **6 MiB** (6.291.456 Byte), blockiert ab **9 MiB** (9.437.184 Byte). Plattformgrenze 16 MB. Einheit festgelegt: **MiB** (1 MiB = 1.048.576 Byte); wo der Plan „MB“ sagt, sind 10⁶ Byte gemeint.
Arbeitsvorgabe der Koordination für Release 1: Gesamt-`dist` ≤ 5,2 MB (= 4,96 MiB), Warnung bei 6 MB.

Messung nach **jedem** Paket (Byte der `dist/index.html`, Differenz zum Vorgänger, Grund).

| Datum | Paket | Byte | Differenz | MiB | Grund |
|---|---|---|---|---|---|
| 07.10.2026 | Ausgangsstand (cf8134c) | 4.354.238 | – | 4,15 | LIVE 3 mit gepackten `?raw`-JSON (`scripts/vite-raw-json-zip.mjs`) |
| 07.10.2026 | P9 | 4.354.238 | 0 | 4,15 | nur Skripte, ESLint, Tests (kein Einfluss auf dist) |

## Planrechnung (LP3 §9, Modell)

| Posten | MB |
|---|---|
| Stand heute | 4,35 (gemessen) |
| c1x-Inhalt Endstand (1.920 Aufgaben, gepackt) | +0,62 |
| Code c1x, Programm, Check | +0,12 |
| Code Tutor / Erlebnis / Motivation | +0,18 |
| `anim.json`, `program.json`, `demo/moments.json` | +0,07 |

Überschreitet ein Paket 6 MiB, ist das nächste Paket die Packung bestehender Inhalte (`dict.json`, `toolkit.json`, `grammar-bank.json`).
