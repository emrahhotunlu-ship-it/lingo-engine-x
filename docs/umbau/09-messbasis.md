# Messbasis vor dem Umbau (W0, 04.10.2026)

Ausgangsstand: Commit `6aaf4af` auf `claude/umbau-fokus` (Marke `pre-fokus`, siehe unten). Zahlen aus der Cloud-Umgebung, nicht vom iPhone.

## 1 Größe
| Messwert | Wert |
|---|---|
| `dist/index.html` | 3,82 MB (3.820.001 Byte); Budget Warnung 4,5 MB, Fehler 6 MB, Grenze 16 MB |
| Quelltext je Ordner (Byte, Näherung für den Bundle-Anteil; Inhalte/JSON sind im Bundle meist größer als hier) | `src/features` 1,87 MB · `src/content` 1,49 MB · `src/domain` 0,91 MB · `src/prompts` 0,33 MB · `src/i18n` 0,30 MB · `src/platform` 0,24 MB |
| Größte Feature-Ordner | `vocab` 236 KB · `speak` 187 KB · `progress` 150 KB · `input` 109 KB · `companion` 88 KB · `grammar` 83 KB · `read` 72 KB · `course` 63 KB · `business` 61 KB |
| Tests | 155 Unit-Dateien, 74 Dateien in `tests/e2e` (davon 62 Specs laut `00`) |

## 2 Dauer von `npm run verify`
32 Minuten (Abschnitt 5). Ziel am Ende des Umbaus: unter 12 Minuten.

## 3 Dokumentzahl der Datenbank (offen, braucht Emrah)
Die echte Zahl steht nur auf dem Handy: Test-Link `AXHkh6…` → Einstellungen → Diagnose → „Dokumente“. **Emrah liest sie ab und schickt sie.** Grenzen: 5.000 Dokumente insgesamt (Vertrag), Warnschwelle des Umbaus 3.500. Bis die Zahl vorliegt, gilt Atlas-Plan A (kein Dokument je Wort).

## 4 Liefert das Live-Abo von `vocab`/`chunk` vollständig? (aus dem Vertrag, nicht am echten System belegt)
- `src/data/live.ts` abonniert `vocab`, `grammar`, `archive`, `chunk` mit `db.collection(name).onSnapshot(...)` **ohne** `limit(...)`.
- `contract/db.d.ts`: `limit(n)` erlaubt 1–1000 und macht eine Abfrage zu einem **Fenster**; Dokumente außerhalb kommen nur, wenn sie ins Fenster rutschen. Eine Sammlung ohne `limit` ist laut Vertrag „eine Abfrage über alles darin“. Eine feste Obergrenze für Lieferungen ohne `limit` steht im Vertrag **nicht**.
- Der Vertrag sagt aber auch: „Filters and orderBy … keep queried collections modest — hundreds to low thousands of documents“. Eine verlässliche Zusage für über 1.000 Dokumente gibt es also nicht.
- **Folge:** Ob das echte System bei mehr als 1.000 Karten kappt, lässt sich aus dem Vertrag nicht entscheiden und hier nicht prüfen. Vor W4 (Atlas legt Karten an) kommt deshalb ein **Wächter**: die App vergleicht die Zahl der gelieferten Karten mit der Zahl, die eine einmalige Abfrage (`get()`) in Seiten liefert, und meldet eine Abweichung sichtbar in der Diagnose (A6.15: Sperren statt raten). Das wird in W1/W4 gebaut, nicht jetzt.
- Heute hat Emrah (laut A7) etwa 1.500 Karten (Wortschatz „1.520“); die Frage ist also praktisch schon jetzt relevant. Die Diagnose-Zahl (Abschnitt 3) zeigt, ob Karten fehlen.

## 5 Ergebnis Basis-Lauf `npm run verify`
Gesamtlauf (04.10.2026, Cloud): **32 Minuten** (1.916 s; Ziel am Ende unter 12). Typprüfung und Lint grün, 153 Unit-Dateien / **1.751 Tests grün**, E2E **566 grün, 1 übersprungen, 2 rot**. Beide roten liefen danach einzeln grün (kein Code geändert): `sprechen.spec` axe (Last) und `a11y.spec` „Umstellung · dim · 390 px“ (Kontrast eines Elements `.bg-accent > span`, im Gesamtlauf rot, einzeln zweimal grün, vermutlich Farbübergang beim Messen; in W6 mit stabilem Warten beheben). `check:platform` lief wegen der roten Tests im Gesamtlauf nicht mehr mit (E2E-Schritt bricht ab).

## 6 Marke `pre-fokus`
Die Marke liegt lokal auf `6aaf4af`. Das Hochladen der Marke auf den Server wurde vom Git-Zugang der Sitzung abgelehnt (Verbindung bricht beim Senden ab, drei Versuche). Rückweg bleibt trotzdem gesichert: Die Basis `claude/affectionate-cerf-pe6ej2` und der Stand `6aaf4af` liegen unverändert auf dem Server.
