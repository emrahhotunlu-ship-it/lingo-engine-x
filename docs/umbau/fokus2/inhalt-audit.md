# Inhalts-Audit Wörter und Grammatik (english-teacher, 04.11.2026)

Noten: Wortkarten 5/10 (Lehrer-Chargen 1/2 gut 8/10; Lücke im Satz oft nicht gefunden → Karte ohne Satz; Wortpartner-Charge 5/10; Häufigkeitsliste/Atlas 3/10, nie gegengelesen) · Grammatik 7/10 (eine Antwort + gepflegte Alternativen; Schwächen: A2-Formfehler statt C1-Lücken, Lob nennt nur Musterlösung, Doppelte) · Warum-Texte `vm.de.ts` 4/10 (meist nur „Wort = Bedeutung“).

## Fünf Grundsatz-Lösungen
1. Lücke aus der `[Klammer]` nehmen (`card.ts:167 locateGap` sucht Stichwortwörter hintereinander → „meet sb halfway“ ↔ „[meet you halfway]“ ohne Lücke); Inhaltstest: jeder Eintrag ergibt eine Lücke.
2. Keine Karte ohne Satz bis Stufe 4; fehlender Satz wird nachgeliefert und geprüft; `src.upgraded`/`xEx` (Wendungen aus Rollenspiel/Mail) lesen.
3. Einheiten-Regel für Wortpartner (`content/col/charge1.json`): Kern + Partner + Platzhalter, keine Präposition am Ende, Satz enthält genau diese Wörter, Business-Rahmen.
4. Häufigkeitsliste (`content/atlas/atlas.json`) sperren, bis eine geprüfte Lehrer-Charge da ist (Tatoeba-Sätze, falsche Bedeutungen).
5. Warum-Vorlagen neu: immer Grund + Beispiel, bezogen auf die eigene Antwort.

## Einzelmängel (Auszug)
- `card.ts:104/124 headShown`: Platzhalter sb/sth fallen ohne Satz weg; `card.ts:111`: „to“ wird auch bei „to a certain extent“ abgeschnitten (nur bei Verben).
- col: 29 von ~103 Sätzen enthalten mehr als die Wendung („reach a milestone“ ↔ „[reached an important milestone]“); keine festen Einheiten („clarify this with legal“, „processed within five days“ …); Halbphrasen („a quote for“, „a discount on“); ohne Berufsbezug („set up a stall“, „come down with the flu“); `col: []`/kein `pos` bei neuen Wörtern.
- `legacy/vocab.json`: persuade/convince, significant/considerable ohne `syn`; consequence Hinweis Singular, Lücke Plural.
- Grammatik: `tasks-v2.json:29828` (US ohne Zeitverschiebung nicht angenommen), `hg-mod-f1/f2` A2-Fehler in Hedging, `patterns/c1-hedging.json:234` erfundene Falle, `c1x ocl-0033/34` falsche Begründung „would braucht eine Bedingung“, `err-0029/0030` Doppelte.
- `vm.de.ts:51-52` „Besser als raten“ widerspricht dem Wozu-Text; `:22,49,50` nur „answer = de“; `:33` Liste statt Diagnose; `:279` drei Gründe in einem Satz.

## Wörter ohne nutzbaren Satz
Charge 2 (9): meet sb halfway, be open to suggestions, dig in one's heels, put sth into perspective, put sth on the agenda, get sb up to speed, walk away from a deal, lock in a price, there is a good chance that. Wortpartner (29), alle alten Wendungen aus Rollenspiel/Mail (`chunk/*` ohne `ex`).
