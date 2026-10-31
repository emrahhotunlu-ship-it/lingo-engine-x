# Vokabeln: Referenzen und Abgleich mit der Vorschau (V0)

Stand 31.10.2026 · Paket V0.

## 1. Marktvergleich
Der Marktvergleich aus Emrahs Auftrag (§6) ist in **V0a** erledigt, und zwar breiter als verlangt: 18 Steckbriefe statt 4.
- **Steckbriefe** mit Quellen an jeder Aussage: `anbieter/*.md`. Dort stehen auch die vier geforderten Apps: `lingvist.md`, `clozemaster.md`, `quizlet.md`, `anki.md`.
- **Muster je App mit Urteil:** `synthese.md` §1 (M1–M81), Vorbild je Bereich in „Auf einen Blick“.
- **Bildquellen** (Links zu den Bildschirmfotos der Anbieter; die Bilder liegen nicht im öffentlichen Repository): `bildquellen.md`. Der Überchat zeigt Emrah den Bildvergleich als private Seite.

Kurz, was wir je App übernehmen (Bedienlogik, nicht Optik; Details und Belege in `synthese.md`):
| App | übernommen | Methode |
|---|---|---|
| **Lingvist** | Eingabe direkt in der Lücke, deutsche Bedeutung als Hinweis, Tippfehler nach Lage und Schwere, Tagesziel in Minuten | M24, M25, M40, M68 |
| **Clozemaster** | Satz als Hauptformat, Wechsel Auswahl → Tippen nach Stufe, Ton normal/langsam, Aufklappbereich mit Übersetzung, „kommt wieder in …“ | M22, M51, M52, M54 |
| **Quizlet Learn** | sichtbarer Weg Erkennen → Abrufen, Raten zählt nicht, „War das auch richtig?“ | M2, M22, M41, M42 |
| **Anki** | FSRS, Fuzz mit festem Startwert, Lastausgleich, Geschwister-Sperre, Lastvorschau, echte Behaltensrate | M1, M8, M10, M11, M18, M63 |

Neue Recherche in V0: nur die **Lizenzen der Wortlisten** (`plan.md` §8).

## 2. Abgleich mit der Vorschau `WBft3EEx7jYYv4QHdepuNm` v2
Grundlage ist der Quelltext der Vorschau (`docs/relaunch/vorschau/src/screens-woerter.js`, `screens.js`, `screens-soll.js`), ausgewertet in `synthese.md` §4.

### 2.1 Schon abgebildet
Siehe `synthese.md` §4.1. Kurz:
- Wörter H12/L5: Wort-Detail mit Stufenbalken, „nächster Abruf“, Ursprungssatz, Wortpartner, letzten Versuchen, „Sag es“ und Pausieren.
- H14/H34: zwei Zahlen „bildest du selbst / erkennst du“.
- Übung H2/H4/H5 und H18: Lücke als Eingabefeld, „Gesucht: …“, Tipp, „Weiß ich nicht“, ein Rückmeldeband mit Warum, „Mehr“ und „War das auch richtig?“.
- H20/L14: Ergebnis mit „morgen fällig“.

### 2.2 Muss ergänzt werden (im Stil der Vorschau: ein Hauptknopf, ruhige Zeilen, keine Punkte)
Die vier Stellen, die Emrahs Auftrag ausdrücklich nennt, und wo sie im Plan stehen:
| Ergänzung | Bild-Vorschlag (für Emrah vor dem Bau) | Synthese | Paket |
|---|---|---|---|
| **Wort-Detail mit beiden Spuren** | H12 `detail`: Unter dem Wort ein Balken mit 7 Teilen in drei Farbtönen („erkennst du · auf dem Weg · bildest du selbst“). Darunter zwei ruhige Zeilen: „Verstehen · sicher · nächster Abruf Sa 21.11.“ und „Benutzen · auf dem Weg · nächster Abruf morgen“. Dann „Deine Sätze“ (eigene Sätze aus Stufe 6) und „Verlauf“ als aufklappbare Liste. | B2 | V4 |
| **14-Tage-Lastvorschau** | H34 `words`: neue Karte „Die nächsten 14 Tage“ mit 14 schmalen Balken in Minuten. Heute ist hervorgehoben, der Ruhetag flach und grau. Darunter eine Zeile „Behaltensrate 91 % (Ziel 90 %) · reif 93 % · jung 88 %“. | B1 | V4 |
| **Abschluss „morgen ca. X Min.“** | H20: vier Zeilen „Heute gelernt 4 · Aufgestiegen 6 · Gestolpert 2 (kommen wieder: morgen) · Morgen ca. 12 Min.“, darunter „Fertig“ (Hauptknopf) und „Noch 5“ (Nebenknopf). | B8 | V3 |
| **Transfer-Aufgabe „Anwenden“** | neu H38: Lage in einem Satz, 3 Zielwörter als Chips über dem Textfeld, Hauptknopf „Prüfen“. Die Rückmeldung zeigt je Zielwort ✓ / ~ / ✕ mit einem Satz Begründung und darunter „So ginge es natürlicher“. Variante ohne Claude: „Vergleich mit dem Muster“, ohne Wirkung auf den Plan. | B7 | V4 |

Dazu die übrigen Ergänzungen B3–B6 und B9–B13 aus `synthese.md` §4.2. Neue Vorschläge aus V0 (Diagnose, Bestandsliste) stehen in `plan.md` §7.2 (N1–N8).
