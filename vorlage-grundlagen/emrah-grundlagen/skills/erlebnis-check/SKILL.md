---
name: erlebnis-check
description: Prüft eine App wie ein anspruchsvoller Nutzer und ein Spitzen-Produktteam in allen Facetten (Klarheit, Bedienlogik, Inhalt, Design, Tempo, Verlässlichkeit, Besonderheit) anhand echter Screenshots auf den Geräten, auf denen sie genutzt wird, und liefert die drei Änderungen mit der größten Wirkung. Einsetzen bei "wie gut ist die App", "was fehlt zu outstanding", "ehrliche Meinung zur App", vor einer Veröffentlichung oder nach einem großen Umbau.
---

# Erlebnis-Check

Eine Runde, ein klares Ergebnis. Kein Katalog mit 30 Punkten.

## Ablauf

1. **Maßstab lesen:** `docs/produkt.md` und `docs/design.md`, falls vorhanden.
2. **Durchspielen:** Die App bauen und starten, wie es im Projekt vorgesehen ist (CLAUDE.md, Skill `run`). Mit Playwright auf den Hauptgeräten der App (laut `docs/produkt.md`; sonst Handy 390 × 844 mit Touch und Desktop 1440 × 900) die drei wichtigsten Wege durchgehen: die tägliche Hauptaufgabe und die besonderen Momente aus `docs/produkt.md`. Dazu jeweils einen Screenshot vom Dunkelmodus, einem leeren Zustand und einem Fehler. Die Screenshots wirklich ansehen.
3. **Bewerten:** Jede Facette mit 1–5 Punkten und einem Satz mit Beleg (Screenshot oder Stelle):
   - **Klarheit:** Ist in drei Sekunden klar, was zu tun ist?
   - **Bedienlogik:** Wenige Schritte, Rückwege, keine Sackgassen, Zähler und Zustände widersprechen sich nicht.
   - **Inhalt:** Fachlich richtig, tief, persönlich – nicht generisch.
   - **Gefühl und Design:** Im Vergleich mit `docs/design.md` und den Vorbildern.
   - **Tempo:** Start, Reaktion auf Tippen, Ladezustände.
   - **Verlässlichkeit:** Fehlerfälle, Datensicherheit, schlechte Verbindung.
   - **Besonderheit:** Sind die besonderen Momente da und spürbar?
4. **Ergebnis an Emrah (kurz, in einfachen Worten):**
   - die Punktzahl je Facette als kleine Tabelle,
   - zwei Dinge, die schon stark sind,
   - **die drei Änderungen mit der größten Wirkung**, je: was, warum, Aufwand (klein / mittel / groß).
5. Emrah entscheidet, was gebaut wird. Keine zweite Prüfrunde ohne Änderung dazwischen.
