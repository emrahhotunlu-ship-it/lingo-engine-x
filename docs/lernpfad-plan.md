# Lernpfad-Modell für Produktionsaufgaben (03.10.2026)

Anlass: Emrah zur Tagesaufgabe „Einwände entkräften“: „viel zu schwer … kein Pfad, wie so etwas gemacht werden muss“, Zweifel, ob die App Methoden konsistent kombiniert. Synthese aus Englischlehrer, Lernwissenschaft und Marktvergleich (Speak, Duolingo Max, Babbel, Busuu, ELSA, Praktika).

## Befund
- Einwände: Musterantwort ~75 Wörter, 30 s Tippzeit am Handy (≈ 10–15 Wörter möglich), Auto-Abgabe, „richtig“ ab 3 von 4 Schritten → Erfolgsquote nahe 0 %. Zeitdruck vor Automatisierung, Vorbild erst nach dem Scheitern, am Handy Do–Sa Pflicht.
- Keine Produktionsaufgabe passt sich an den Erfolg an. Gelenkte und freie Übungen existieren, der Weg dazwischen fehlt. Antwortbausteine gibt es in „Termin vorbereiten“, nicht bei Einwänden.

## Einheitliches Modell (alle Produktionsaufgaben)
| Stufe | Tun | Hilfen | Uhr |
|---|---|---|---|
| 1 Vorbild | Musterantwort lesen/hören, Sätze den Schritten zuordnen | alles sichtbar | nein |
| 2 Gelenkt | je Schritt den passenden Satz aus 3 wählen | Auswahl, Begründung | nein |
| 3 Satzanfänge | je Schritt Satzanfang vorgegeben, Rest selbst | Satzanfänge | nein |
| 4 Frei | eine Antwort, Schritt-Chips; Satzanfänge auf Abruf (Hilfe) | Chips | nur Anzeige |
| 5 Unter Druck | nur bekannte Inhalte (vorher Stufe 4 gelöst), Zeitziel aus eigener Zeit, kein Auto-Abbruch | keine | ja |

Regeln (`src/domain/levels`, Dokument `app/levels`, zusammengefasst):
- Wert je Versuch: ohne Hilfe richtig 1 · Hilfe 1 0,6 · Hilfe 2 0,3 · falsch 0. Inhalt getrennt vom Tempo.
- Aufstieg: ≥ 6 Versuche seit Wechsel, Mittel ≥ 0,85, letzte zwei ≥ 0,6, höchstens eine Stufe je Lerntag.
- Abstieg: Mittel der letzten 5 < 0,6 oder 3 Fehlschläge in Folge → eine Stufe tiefer.
- In der Runde: nach 2 Fehlschlägen kommt der nächste Eintrag eine Stufe leichter (nicht gespeichert).
- Knopf „leichter/schwerer“; Stufe sichtbar.
- Startstufen: Einwände 2 · Heißer Stuhl 2 · Zeit gewinnen 3 · Sag es 3 · Tonlagen 2.
- Am Handy nie Tippen gegen die Uhr.

## Reihenfolge
1. Einwände: sofort keine Auto-Abgabe, Satzanfänge vor der Antwort, Stufen 1–5 mit `app/levels`.
2. Heißer Stuhl (gleicher Aufbau), Zeit gewinnen (Satzanfänge vorn).
3. Tonlagen, Sag es, Rollenspiel-Hilfe auf Abruf, Posteingang-Bausteine.
4. Einheitliche Hilfe-Leiter und Abschluss-Moment („Heute neu sicher …“).
