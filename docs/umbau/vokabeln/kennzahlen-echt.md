# Emrahs echter Lernverlauf – Kennzahlen (30.10.2026)

Quelle ist die Live-Datenbank `JLL8…`, Sammlung `vocab`, nur gelesen. Emrah hat das am 30.10.2026 erlaubt. Hier stehen **nur Kennzahlen**, keine Wörter, Sätze oder Inhalte. Das Auswerteskript liegt im Notizordner der Überchat-Sitzung und nicht im Repository, weil es auf echten Daten läuft.

Tageswechsel: 04:00 Europe/Berlin. Zeitraum: 15.09.–30.10.2026, 45 Lerntage.

**Vorbehalt:** Je Wort speichert die App nur die **letzten 12 Antworten** (`HIST_MAX = 12`, `src/domain/srs/applyReview.ts:27`). Insgesamt gab es 1.900 Abfragen, 1.616 davon sind noch im Verlauf. Ältere Antworten sind verloren. Das ist selbst ein Befund: Emrahs Auftrag verlangt einen vollständigen Verlauf.

## 1. Dasselbe Wort mehrmals am Tag
| Kennzahl | Wert |
|---|---|
| Wort-Tage, also Wort und Tag mit mindestens einer Abfrage | 1.093 |
| davon mehr als einmal am Tag | **363 (33 %)** |
| Häufigkeit: 1× / 2× / 3× / 4–6× | 730 / 213 / 143 / 7 |
| Mehrfach-Tage außerhalb des Einführungstags | 258 |
| davon nach einem Fehler am selben Tag | 195 |
| ohne vorherigen Fehler | 63 |
| häufigste Kombinationen am selben Tag | nur Erkennen 71 · Lücke + Erkennen 52 · Erkennen + Tippen 32 · Lücke + Tippen 21 |

## 2. Wochenlang weg
| Kennzahl | Wert |
|---|---|
| Lücke zwischen zwei Abfragetagen je Wort | Median 3 Tage, 90 % ≤ 13 Tage, längste 28 Tage |
| Verteilung der Lücken: 1 / 2–3 / 4–7 / 8–14 / 15–30 Tage | 224 / 228 / 231 / 134 / 61 |
| **überfällig am 30.10.2026, 12:00** | **112 von 253 Wörtern (44 %)** |
| Vorschau, was in den nächsten 14 Tagen fällig wird | 44 · 16 · 6 · 6 · 6 · 2 · 7 · 2 · 0 · 1 · 4 · 1 · 1 · 0 |
| verschiedene Wörter in den letzten 14 Tagen | 188 von 253 |

## 3. Tageslast
| Kennzahl | Wert |
|---|---|
| Abfragen je Tag in den letzten 30 Tagen | 0 bis 98, Mittel 41 |
| Variationskoeffizient | **0,52** (Ausgangswert für Abnahmekriterium 1) |

## 4. Erkennen gegenüber aktivem Abrufen
| Kennzahl | Wert |
|---|---|
| Modus über alles | Erkennen 771 (48 %) · Tippen 331 (20 %) · Lücke 306 (19 %) · Wortpartner 141 (9 %) · Hören 48 (3 %) · **Bilden aus dem Deutschen 19 (1 %)** |
| Aufdecken mit Selbsteinschätzung (`flip`) | 331 |
| Auswahl (`mc_de`, `mc_en`, `ctx_mc`, `listen_mc`, `match`) | 252 |
| Kalenderwochen 38–44: Erkennen | 70 % → 67 % → 46 % → 39 % → 58 % → 37 % → 32 % |
| Kalenderwochen 38–44: Tippen | 2 % → 6 % → 11 % → 29 % → 13 % → 32 % → 35 % |
| Kalenderwochen 38–44: Bilden | 0 % → 0 % → 0 % → 3 % → 4 % → 0 % → 0 % |

## 5. Gedächtniszustand
| Kennzahl | Wert |
|---|---|
| Noten 1 / 2 / 3 / 4 | 269 / 501 / 724 / 122 |
| FSRS-Stabilität | Median 6,8 Tage, 90 % ≤ 32 Tage |
| Stufen 1 / 2 / 3 / 4 / 5 / ohne | 34 / 46 / 80 / 33 / 22 / 38 |
| Wörter mit ≥ 6 Fehlversuchen (Leeches) | 5; das schwerste hat 11 Fehlversuche bei 28 Abfragen und Stabilität 2 Tage |

## Erste Lesart für V0 (Hypothesen, V0 muss sie im Code belegen)
1. **Mehrmals am Tag:** Meist folgt nach einem Fehler dieselbe Abfrage am selben Tag noch einmal, oft in einer anderen Übungsart. 63 Mehrfach-Tage haben keinen Fehler davor. Hier holen vermutlich verschiedene Wege das Wort unabhängig vom Plan, z. B. Erkennen + Lücke.
2. **Wochenlang weg:** 44 % der Wörter sind überfällig, für die nächsten zwei Wochen ist dagegen kaum etwas geplant. Es gibt einen Rückstau statt einer gleichmäßigen Verteilung. Die Tageslast schwankt stark (VK 0,52).
3. **Passiv:** Bilden aus dem Deutschen kommt praktisch nicht vor (1 %). Tippen hat zugenommen, Erkennen liegt aber noch bei etwa einem Drittel.
4. **Kein vollständiger Verlauf:** Es bleiben nur 12 Antworten je Wort. FSRS kann später nicht auf Emrahs Daten angepasst werden.
