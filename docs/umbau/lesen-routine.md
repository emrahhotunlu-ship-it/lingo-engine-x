# Routine „Lesen“: tägliche aktuelle Meldungen direkt in der App (Paket L7, Stand 14.10.2026)

Zweck: Emrah soll morgens **nichts** tippen und **nicht warten**. Eine geplante Claude-Aufgabe (eigene Sitzung mit Websuche und dem Werkzeug `ArtifactData` auf die Datenbank der App) recherchiert aktuelle Meldungen und legt sie **fertig im Leser-Format** ab. Die App zeigt sie beim Öffnen von „Lesen“ ohne Knopf. Der Knopf „Noch einen Artikel schreiben lassen“ bleibt nur als zusätzliches Angebot.

Der Abschnitt 3 ist die **vollständige, direkt verwendbare Anweisung** (zum Einfügen als Auftragstext der geplanten Aufgabe). Abschnitt 1 und 2 erklären, was die App damit macht. Abschnitt 4 ist für die Hauptsitzung (Einrichtung, Test, Rückweg). Das Beispiel in Abschnitt 3 wird von `tests/unit/read/routine.test.ts` gegen die echten Prüftore der App geprüft: Ändert sich der Prüfer, schlägt der Test an, bevor die Anweisung veraltet.

## 1. Wer schreibt was (die eine Regel)

| Dokument | Schreibt | Liest | Inhalt |
|---|---|---|---|
| `read/r-<JJJJ-MM-TT>` | **nur die Routine** | App | die Artikel des Tages im Leser-Format (`items[]`) |
| `read/m-<JJJJ-MM>` | **nur die App** | App | Lesestand je Artikel (gelesen, angefangen, Satz, Zeit) |
| `read/d-<JJJJ-MM-TT>`, `read/p` | **nur die App** | App | selbst geholte Artikel, Einstellungen |
| `feed/<JJJJ-MM-TT>` | bisheriger Tagesauftrag | App (Heute) | **bleibt wie es ist** und wird vom Leser nicht benutzt |

Die Routine schreibt **nie** in `read/m-…`, `read/d-…`, `read/p` oder irgendein anderes App-Dokument. Den Lesestand legt die App selbst an, sobald Emrah einen Routine-Artikel öffnet.

## 2. Was die App mit den Artikeln macht

- Beim Öffnen von „Lesen“ liest die App `read/r-<heute>` und die zwei Tage davor (drei einzelne Zugriffe, nie die ganze Sammlung).
- **Jeder Artikel wird einzeln geprüft**, mit denselben Prüftoren wie bei selbst geholten Artikeln (Form, Länge 280 bis 700 Wörter, Sprache Englisch/Deutsch, 1:1-Ausrichtung der Sätze, keine verklebten Sätze, US-Schreibweise, Schlüsselwörter, Prüffragen) plus: Thema aus der festen Liste, Quelle (Name) und https-Link vorhanden.
- Ein Artikel, der durchfällt, wird **ausgeblendet** (Eintrag im Diagnose-Protokoll), aber **nie gelöscht**. Er macht die anderen Artikel nicht ungültig. Ungültige Prüffragen fallen still weg, der Artikel bleibt.
- Gültige Artikel stehen in der Heute-Liste vor den selbst geholten, mit der Zeile „Aktuelle Meldung · Quelle: …“. Im Leser steht dieselbe Zeile mit dem Link zur Originalmeldung. Die App behauptet nirgends, dass der Text Claudes Wissen ist: Es ist eine Zusammenfassung und Übersetzung einer Meldung mit Quelle.
- Gelesen, angefangen, Position: stehen in `read/m-<Monat>`, geschrieben von der App.
- Die Routine räumt ihre eigenen Dokumente nach 45 Tagen auf (siehe Anweisung). Gelesene Wörter, Karten und der Lesestand bleiben davon unberührt.

## 3. ANWEISUNG (zum Einfügen)

<!-- ANWEISUNG-BEGINN -->

**Auftrag: Lesen-Artikel für die Englisch-App von Emrah schreiben**

Du arbeitest in einer geplanten Sitzung mit Websuche (WebSearch, WebFetch) und dem Werkzeug `ArtifactData`. Verwende dieselbe Artefakt-URL (`url`), mit der du bisher `feed/<Datum>` geschrieben hast. Dein Ergebnis ist **ein einziges Dokument** `read/r-<heute>` mit 4 bis 5 fertigen Artikeln für eine Lese-App. Der Leser ist Emrah, Berufstätiger, Englisch B2 auf dem Weg zu C1, Deutsch ist seine Muttersprache. Er liest jeden Satz auf Englisch und kann den deutschen Satz daneben aufdecken.

**Schritt 1: Datum.** `heute` ist das Datum in Europe/Berlin als `JJJJ-MM-TT`. Gestern, vorgestern und heute sind die Tage, die die App anzeigt.

**Schritt 2: Nichts doppelt.** Lies mit `ArtifactData` (Aktion `get`) die Dokumente `read/r-<gestern>` und `read/r-<vorgestern>`, falls vorhanden, und merke dir die Titel und Quellen. Lies außerdem `read/r-<heute>`: Steht dort schon ein Dokument mit mindestens 4 Artikeln, schreibe **nichts** und antworte mit „schon vorhanden“.

**Schritt 3: Meldungen suchen (4 bis 5).** Suche mit WebSearch aktuelle Meldungen (höchstens 48 Stunden alt) zu diesen Themen und ihren festen Schlüsseln:

| Schlüssel (`topic`) | Thema |
|---|---|
| `ai` | Künstliche Intelligenz (Modelle, Forschung, Sicherheit, Regulierung) |
| `saas` | SaaS (Produkte, Preise, Übernahmen, Kennzahlen) |
| `bizdev` | Business Development (Partnerschaften, Vertrieb, Markteintritt) |
| `economy` | Wirtschaft (Märkte, Zinsen, Inflation, Unternehmenszahlen) |
| `architecture` | Software-Architektur (Systeme, Qualität, Betrieb, Entwicklungspraxis) |
| `management` | Management (Führung, Organisation, Arbeitsweisen) |
| `claudecode` | Claude Code (neue Versionen, Arbeitsabläufe, konkrete Anwendungen) |

Regeln für die Auswahl: mindestens 4 verschiedene Themen pro Tag; `ai` und `claudecode` dürfen zusammen höchstens 2 Meldungen stellen; keine Meldung, deren Titel oder Quelle in den letzten zwei Tagen schon vorkam; nur Meldungen, deren Kern du auf einer abrufbaren Seite (WebFetch) selbst gelesen hast. Bevorzuge Primärquellen und seriöse Fach- und Wirtschaftsmedien. Keine Paywall umgehen, keine Gerüchte als Tatsachen darstellen (bei Unsicherem schreibe „reportedly“ und nenne, wer es berichtet). **Erfinde nichts**: keine Zahlen, Zitate, Personen oder Ankündigungen, die nicht auf der gelesenen Seite stehen. Findest du nur 1 bis 3 gute Meldungen, schreibe nur diese. Findest du keine, schreibe nichts.

**Schritt 4: Je Meldung ein Artikel (Feld für Feld).**

| Feld | Inhalt |
|---|---|
| `id` | `r-<heute>-<Nr.>`, Nr. ab 1, z. B. `r-2026-10-14-1` |
| `topic` | einer der Schlüssel aus der Tabelle (nie `custom`) |
| `kind` | `trend` (Meldung, Standard), `case`, `explainer`, `howto` oder `opinion` |
| `level` | immer `c1` |
| `title` | englische Überschrift, höchstens 90 Zeichen, eigene Formulierung |
| `summary` | **ein** deutscher Satz (höchstens 240 Zeichen), worum es geht |
| `asOf` | `JJJJ-MM` des Berichts |
| `pub` | Tag der Meldung `JJJJ-MM-TT` (nur wenn sicher bekannt, sonst weglassen) |
| `source` | Name der Veröffentlichung, höchstens 60 Zeichen (z. B. `InfoQ`) |
| `url` | genaue Adresse der Meldung, beginnt mit `https://` |
| `paras` | Absätze → Sätze → Paare `{ "e": englischer Satz, "d": deutscher Satz }` |
| `keyWords` | 3 bis 5 Wörter oder Wendungen mit Bedeutung und Fundstelle |
| `check` | genau 3 Prüffragen |

**Der englische Text (`e`).**
- 300 bis 450 Wörter, 3 bis 5 Absätze, 16 bis 28 Sätze, kein Satz über 35 Wörter. Kürzer als 280 oder länger als 700 Wörter wird abgelehnt.
- **Eigene Zusammenfassung.** Schreibe den Inhalt der Meldung mit eigenen Worten neu. Kopiere keine Sätze, Absätze oder Überschriften der Quelle; keine wörtlichen Zitate (höchstens eine kurze Wortgruppe). Erkläre bei Bedarf in einem Satz den Hintergrund (was ein Fachbegriff bedeutet), aber trenne klar: Das steht in der Meldung / das ist Hintergrund.
- Niveau C1, sachlicher Magazinstil, wechselnde Satzlängen, Wortverbindungen statt Einzelwörter. **US-Schreibweise** (color, organization, analyze). Verboten sind Floskeln wie „game changer“, „in today’s fast-paced world“, „delve into“, „unlock the potential“, „in conclusion,“. „however“ höchstens 3-mal, „quietly“ höchstens 1-mal.
- Reiner Text: kein Markdown, kein HTML, keine Sternchen, keine Aufzählungszeichen, keine Zeilenumbrüche mitten im Satz, keine doppelten Leerzeichen, nach jedem Satzzeichen ein Leerzeichen. Ein Eintrag = genau **ein** Satz (kein zweites Satzende darin).

**Die deutsche Übersetzung (`d`).**
- Zu **jedem** englischen Satz genau ein deutscher Satz im selben Paar: nichts zusammenfassen, auslassen, hinzufügen oder umstellen. Verschmilz keine zwei Sätze und teile keinen.
- Idiomatisches, natürliches Deutsch, nicht Wort für Wort. Fachbegriffe so, wie man sie im deutschen Berufsalltag sagt (Smart-TV, Update, Vertrieb).
- Alle **Zahlen** des englischen Satzes stehen im deutschen Satz (15 bleibt 15, 5.57 wird 5,57), Eigennamen bleiben erhalten. Der deutsche Text ist insgesamt 0,85- bis 1,35-mal so lang wie der englische.

**Schlüsselwörter (`keyWords`).** 3 bis 5, Ziel 5. Mindestens 2 davon mehrteilige Wendungen (Verb + Nomen, Adjektiv + Nomen, feste Wendungen: „hard to shut down“, „weak link“). Keine Wörter, die im Deutschen gleich aussehen und heißen (team, system, plan, manager). `w` steht **genau so** (Endungen sind erlaubt) in einem englischen Satz des Artikels, `de` ist die deutsche Bedeutung im Zusammenhang (höchstens 60 Zeichen), `i` ist `[Absatz, Satz]` des Satzes, in dem es steht, nullbasiert (`[0, 2]` = dritter Satz im ersten Absatz). Dieser Satz wird später der Ursprungssatz der Lernkarte.

**Prüffragen (`check`).** Genau 3, je 3 Antworten in `o`, `a` ist der Index der richtigen Antwort (0, 1 oder 2; wechsle die Lage, nicht immer dieselbe). Frage 1 prüft die **Kernaussage**, Frage 2 eine **Schlussfolgerung** (was folgt daraus, was ist nicht belegt), Frage 3 eine **Wendung im Kontext** (was bedeutet „…“ hier). Frage `q` und Antworten `o` sind Englisch (US), kurz, die Falschantworten plausibel und etwa gleich lang wie die richtige, nie offensichtlich absurd, keine „alle/keine der obigen“. `why` ist Deutsch, ein bis zwei Sätze, erklärt **warum** die Antwort stimmt.

**Schritt 5: Selbstprüfung vor dem Schreiben** (für jeden Artikel, sonst verbessern oder weglassen):
1. 300 bis 450 Wörter Englisch, 3 bis 5 Absätze, jeder Satz hat sein deutsches Gegenstück.
2. Jede Zahl des Englischen steht im Deutschen.
3. `source` ist ein Name, `url` beginnt mit `https://` und ist die Seite, die du gelesen hast.
4. Nichts aus der Quelle wörtlich kopiert; kein Satz mit erfundenen Angaben.
5. Jedes `keyWords.w` kommt in einem englischen Satz vor, `i` stimmt.
6. Das ganze Dokument ist gültiges JSON (Anführungszeichen in Texten mit `\"` schützen), kleiner als 150 KB.

**Schritt 6: Schreiben.** Rufe `ArtifactData` mit der Aktion `set` auf Sammlung `read`, Dokument `read/r-<heute>` auf, mit genau diesem Aufbau (ein ganzes Dokument, nicht in Teilen):

```
{ "v": 1, "day": "<heute>", "by": "routine", "items": [ <Artikel 1>, <Artikel 2>, … ] }
```

Schreibe **nur** `read/r-<heute>`. Schreibe nie in `read/m-…`, `read/d-…`, `read/p` oder ein anderes Dokument der App (den Lesestand führt die App selbst).

**Schritt 7: Aufräumen.** Lösche die Dokumente `read/r-<heute minus 46 Tage>`, `read/r-<heute minus 47 Tage>` und `read/r-<heute minus 48 Tage>`, falls sie existieren. Sonst nichts löschen.

**Schritt 8: Antwort.** Antworte mit einer kurzen Liste: Datum, je Artikel `id`, `topic`, `title`, `source`. Keine weiteren Texte.

**Das Beispiel** unten zeigt ein vollständiges Dokument mit einem Artikel in genau dem Aufbau, den die App akzeptiert. Alle Artikel eines Tages stehen im selben `items`-Feld hintereinander. Übernimm den Aufbau und die Genauigkeit, nicht den Inhalt.

<!-- BEISPIEL-JSON-BEGINN -->
```json
{
  "v": 1,
  "day": "2026-10-14",
  "by": "routine",
  "items": [
    {
      "id": "r-2026-10-14-1",
      "topic": "ai",
      "kind": "trend",
      "level": "c1",
      "title": "Anthropic Warns That Small AI Models Could Spread Across Home Devices",
      "summary": "Ein Bericht warnt, dass kleine KI-Modelle sich bald selbstständig auf gewöhnlichen vernetzten Geräten verbreiten könnten, auch wenn ein echter Angriff bisher nicht gezeigt wurde.",
      "asOf": "2026-10",
      "pub": "2026-10-13",
      "source": "Fox News",
      "url": "https://foxnews.com/live-news/ai-news-anthropic-frontier-models-safety-10-13",
      "paras": [
        [
          {
            "e": "Anthropic's Frontier Red Team has published a report with an unusual warning.",
            "d": "Das Frontier Red Team von Anthropic hat einen Bericht mit einer ungewöhnlichen Warnung veröffentlicht."
          },
          {
            "e": "A red team plays the attacker in order to find weaknesses before real attackers do.",
            "d": "Ein Red Team spielt den Angreifer, um Schwachstellen zu finden, bevor es echte Angreifer tun."
          },
          {
            "e": "According to the researchers, small AI models could within months begin to spread on their own across ordinary internet-connected devices.",
            "d": "Laut den Forschern könnten kleine KI-Modelle schon in wenigen Monaten damit beginnen, sich selbstständig auf gewöhnlichen, mit dem Internet verbundenen Geräten zu verbreiten."
          },
          {
            "e": "The list includes smart TVs, ovens and other household electronics that rarely receive security updates.",
            "d": "Dazu zählen Smart-TVs, Backöfen und andere Haushaltsgeräte, die nur selten Sicherheitsupdates erhalten."
          },
          {
            "e": "Such devices are numerous, often cheap and usually forgotten after the installation.",
            "d": "Solche Geräte sind zahlreich, oft billig und werden nach der Installation meist vergessen."
          },
          {
            "e": "The concern is that such a network of infected devices would be very hard to shut down once it exists.",
            "d": "Die Sorge ist, dass sich ein solches Netz aus befallenen Geräten kaum noch abschalten ließe, sobald es einmal besteht."
          }
        ],
        [
          {
            "e": "In one experiment, a model was run across 15 cheap Android TV boxes.",
            "d": "In einem Experiment wurde ein Modell auf 15 günstigen Android-TV-Boxen ausgeführt."
          },
          {
            "e": "Because the models were small, they could run even on cheap hardware with little computing power.",
            "d": "Weil die Modelle klein waren, liefen sie sogar auf billiger Hardware mit wenig Rechenleistung."
          },
          {
            "e": "Other tests showed that more capable models can copy themselves across a simulated network.",
            "d": "Andere Tests zeigten, dass leistungsfähigere Modelle sich in einem simulierten Netzwerk selbst kopieren können."
          },
          {
            "e": "They may also adapt to unfamiliar hardware and find new ways to spread without any human help.",
            "d": "Sie können sich außerdem an unbekannte Hardware anpassen und neue Wege der Verbreitung finden, ohne dass ein Mensch hilft."
          },
          {
            "e": "That ability is what makes the scenario so difficult to contain.",
            "d": "Genau diese Fähigkeit macht das Szenario so schwer einzudämmen."
          }
        ],
        [
          {
            "e": "It is worth reading the headline carefully before drawing conclusions.",
            "d": "Es lohnt sich, die Schlagzeile genau zu lesen, bevor man Schlüsse zieht."
          },
          {
            "e": "The researchers stress an important limit, though.",
            "d": "Die Forscher betonen allerdings eine wichtige Grenze."
          },
          {
            "e": "They have not yet demonstrated a fully autonomous AI worm operating in the real world.",
            "d": "Einen vollständig autonomen KI-Wurm, der in der realen Welt operiert, haben sie bisher nicht nachgewiesen."
          },
          {
            "e": "The report is therefore a warning about a plausible trajectory, not a description of an attack that has already happened.",
            "d": "Der Bericht ist daher eine Warnung vor einer plausiblen Entwicklung und keine Beschreibung eines Angriffs, der bereits stattgefunden hat."
          },
          {
            "e": "That distinction matters for how seriously readers should take the headline.",
            "d": "Diese Unterscheidung ist wichtig dafür, wie ernst man die Schlagzeile nehmen sollte."
          },
          {
            "e": "In other words, the risk is real enough to plan for, but nobody has yet seen it happen outside the lab.",
            "d": "Mit anderen Worten: Das Risiko ist real genug, um sich darauf vorzubereiten, aber außerhalb des Labors hat es noch niemand beobachtet."
          }
        ],
        [
          {
            "e": "For companies and device makers, the practical lesson is clear.",
            "d": "Für Unternehmen und Gerätehersteller ist die praktische Lehre eindeutig."
          },
          {
            "e": "Cheap, poorly updated hardware could become a weak link in AI safety.",
            "d": "Billige, schlecht gewartete Hardware könnte zu einem schwachen Glied der KI-Sicherheit werden."
          },
          {
            "e": "Many offices already rely on connected cameras, printers and conference-room displays.",
            "d": "Viele Büros verlassen sich bereits auf vernetzte Kameras, Drucker und Displays in den Besprechungsräumen."
          },
          {
            "e": "A single device without updates can give attackers a foothold in the whole company network.",
            "d": "Ein einziges Gerät ohne Updates kann Angreifern einen Brückenkopf im gesamten Firmennetz verschaffen."
          },
          {
            "e": "Anyone who buys or deploys connected devices should therefore ask how long the manufacturer will deliver security updates.",
            "d": "Wer vernetzte Geräte kauft oder einsetzt, sollte deshalb fragen, wie lange der Hersteller Sicherheitsupdates liefert."
          },
          {
            "e": "Procurement teams could add the update policy of a device to their standard checklist, next to price and warranty.",
            "d": "Einkaufsteams könnten die Update-Politik eines Geräts neben Preis und Garantie in ihre Standard-Checkliste aufnehmen."
          },
          {
            "e": "This costs little today and may avoid an expensive problem later.",
            "d": "Das kostet heute wenig und kann später ein teures Problem vermeiden."
          }
        ]
      ],
      "keyWords": [
        {
          "w": "spread on their own",
          "de": "sich selbstständig verbreiten",
          "i": [
            0,
            2
          ]
        },
        {
          "w": "hard to shut down",
          "de": "schwer abzuschalten",
          "i": [
            0,
            5
          ]
        },
        {
          "w": "adapt to unfamiliar hardware",
          "de": "sich an unbekannte Hardware anpassen",
          "i": [
            1,
            3
          ]
        },
        {
          "w": "plausible trajectory",
          "de": "plausible Entwicklung",
          "i": [
            2,
            3
          ]
        },
        {
          "w": "weak link",
          "de": "schwaches Glied",
          "i": [
            3,
            1
          ]
        }
      ],
      "check": [
        {
          "q": "What is the main point of the report?",
          "o": [
            "Smart TVs will be banned in offices next year.",
            "Small AI models could soon spread by themselves across everyday devices.",
            "Anthropic has stopped developing small AI models."
          ],
          "a": 1,
          "why": "Die Kernaussage steht im ersten Absatz: Kleine KI-Modelle könnten sich schon bald selbstständig auf gewöhnlichen Geräten verbreiten."
        },
        {
          "q": "What can you conclude about the risk the researchers describe?",
          "o": [
            "It is a confirmed attack on millions of devices.",
            "It only affects devices that are connected to a power plant.",
            "It is a plausible future scenario, not an attack that has already happened."
          ],
          "a": 2,
          "why": "Die Forscher haben keinen vollständig autonomen KI-Wurm in der realen Welt gezeigt. Der Bericht warnt vor einer möglichen Entwicklung."
        },
        {
          "q": "What does a weak link mean in the last paragraph?",
          "o": [
            "The part of a system that is most likely to fail or be attacked.",
            "A connection that works particularly well.",
            "A short web address that leads to a report."
          ],
          "a": 0,
          "why": "Ein weak link ist das schwächste Glied einer Kette. Hier sind es billige Geräte ohne Updates, über die ein ganzes Netz angreifbar wird."
        }
      ]
    }
  ]
}
```
<!-- BEISPIEL-JSON-ENDE -->

<!-- ANWEISUNG-ENDE -->

## 4. Für die Hauptsitzung: Einrichtung, Test, Rückweg

1. **Auftragstext der geplanten Aufgabe** (`trig_01LxTDBs97GGemopdDnxgyXP`, täglich 05:07 UTC): Den Text zwischen `ANWEISUNG-BEGINN` und `ANWEISUNG-ENDE` als zweiten Teil an den bisherigen Auftrag hängen (der bisherige Teil schreibt weiter `feed/<Datum>`). Die Recherche aus dem Feed-Teil darf wiederverwendet werden (dieselben 5 Quellen), der Text für den Leser wird aber **neu in Satzpaaren** geschrieben, weil `feed/*` keine Satz-für-Satz-Übersetzung hat. Der Trigger wurde in diesem Paket **nicht** geändert.
2. **Zeit:** 05:07 UTC liegt nach 04:00 Uhr Berlin (Tageswechsel der App), das Datum der Routine und der Lerntag der App stimmen also überein.
3. **Kosten:** Die Sitzung läuft im Konto von Emrah. Pro Tag 4 bis 5 Artikel à ≈ 3.500 Ausgabe-Token plus Recherche; die App selbst ruft nichts auf, wenn die Routine geliefert hat.
4. **Größe:** ≈ 12 KB je Artikel, 5 Artikel ≈ 60 KB je Dokument (Grenze der Datenbank: 256 KiB). Die Routine räumt nach 45 Tagen auf, es liegen also höchstens ≈ 45 Routine-Dokumente (≈ 2,7 MB). Die Sicherung (Einstellungen → Daten sichern) nimmt die Routine-Dokumente der letzten 14 Tage mit. Die Dokumentzählung der App rechnet sie nicht mit (höchstens 45 Dokumente, weit unter der Warngrenze).
5. **Ersttest:** Die Routine einmal von Hand auslösen (`fire_trigger`), danach in der App „Lesen“ öffnen. Erwartet: 4 bis 5 Zeilen mit „Aktuelle Meldung · Quelle: …“, ein Tipp öffnet den Leser mit Link zur Quelle. Zeilen, die fehlen, sind durch die Prüftore ausgeblendet: Diagnose-Protokoll (Einstellungen) zeigt `read:routine item_hidden` mit Grund.
6. **Rückweg:** Routine-Anweisung auf den alten Stand zurücksetzen. Bereits geschriebene `read/r-…`-Dokumente stören nichts (ältere App-Versionen kennen den Pfad nicht und ignorieren ihn).
