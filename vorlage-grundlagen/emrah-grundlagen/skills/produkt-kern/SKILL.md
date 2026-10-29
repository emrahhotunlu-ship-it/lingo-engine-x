---
name: produkt-kern
description: Findet und schärft den Kern einer App, bevor gebaut wird – Zielperson, das eine Versprechen, Emrahs unfairer Vorteil, drei besondere Momente, Nicht-Ziele – und schreibt ihn nach docs/produkt.md. Einsetzen bei einer neuen App, einem neuen großen Bereich oder wenn Emrah sagt "soll outstanding werden", "was macht die App besonders", "neue Idee", "warum sollte das jemand nutzen".
---

# Produkt-Kern

Ziel: Ein kurzes Dokument `docs/produkt.md`, das jede spätere Entscheidung lenkt. Code ist heute leicht nachzubauen. Schwer nachzubauen sind Fachwissen, eigene Inhalte und Daten, gut durchdachte Abläufe und Geschmack. Dieser Skill holt genau das aus Emrah heraus.

## Ablauf

1. **Lesen:** Vorhandenes `docs/produkt.md`, README und CLAUDE.md überfliegen. Nichts fragen, was dort schon steht.
2. **Fragen:** Höchstens fünf Fragen, gebündelt in einem AskUserQuestion-Aufruf. Wähle die, die noch offen sind:
   - Für wen genau ist die App, und in welchem Moment des Tages greift die Person zu ihr?
   - Was nervt heute an den bestehenden Lösungen oder Abläufen? Bitte ein konkretes Beispiel.
   - Was weißt oder hast du, was andere nicht haben (Fachwissen, Abläufe, Daten, Kontakte, eigene Erfahrung)?
   - Woran merkst du nach vier Wochen, dass die App ein Erfolg ist?
   - Welche zwei bis drei Apps begeistern dich (egal aus welcher Branche), und was genau daran?
3. **Umschauen:** Höchstens drei Websuchen (Modus `standard`) nach den wichtigsten Alternativen. Ergebnis: Was ist dort Standard, wo ist die Lücke?
4. **Schreiben:** `docs/produkt.md` nach der Vorlage unten, höchstens zwei Seiten.
5. **Gegenprobe:** Den Entwurf selbst gegen die drei Tests unten prüfen und schwache Stellen nachschärfen.
6. **Abstimmen:** Emrah in fünf kurzen Zeilen den Kern zeigen und um sein OK bitten. Höchstens eine Überarbeitungsrunde.

## Vorlage `docs/produkt.md`

```markdown
# Produkt-Kern: <App-Name>

**In einem Satz:** Für <Person>, die <Situation>, ist <App> das Einzige, das <Ergebnis> – anders als <übliche Alternative>.

## Zielperson und Moment
Wer, in welcher Lage, mit welchem Gerät, wie viel Zeit.

## Die Aufgabe
Was soll für die Person danach erledigt oder besser sein? (nicht: welche Funktionen)

## Unfairer Vorteil (warum schwer nachzubauen)
Mindestens zwei: Fachwissen · eigene Inhalte/Daten · durchdachter Ablauf aus echter Praxis · Personalisierung über Zeit · Geschmack und Detailtiefe.

## Drei besondere Momente
Konkrete Situationen, in denen der Nutzer „wow“ denkt. Jeweils: Auslöser → was die App tut → warum das überrascht.

## Qualitätslatte
Je Facette eine Referenz-App und was genau wir davon übernehmen:
Aussehen · Bedienlogik · Inhalt · Tempo · Verlässlichkeit.

## Nicht-Ziele
Was wir bewusst nicht bauen (mindestens drei Punkte).

## Erfolgszeichen
Drei beobachtbare Zeichen nach vier Wochen.
```

## Die drei Tests

- **Wochenend-Test:** Könnte ein guter Entwickler mit KI das an einem Wochenende nachbauen? Wenn ja: Woher kommt die Tiefe, die das verhindert (Inhalt, Daten, Ablaufwissen)?
- **Vermissen-Test:** Würde die Zielperson die App nach zwei Wochen vermissen? Welcher Moment genau fehlt ihr dann?
- **10x-Test:** Wo ist die App zehnmal besser statt zehn Prozent besser? Gibt es keinen solchen Punkt, ist der Kern noch nicht gefunden.
