# Lehrer-Urteil: Bringt Lingo-Engine X Emrah von B2 zu C1?

## 1. In drei Sätzen

Die App ist ein sehr guter Wiederholungs- und Übungsapparat: Wörter, Grammatik und Kurs sind sauber geplant, die Korrekturen im Rollenspiel und beim Schreiben sind fachlich gut. Zu C1 bringt sie Emrah heute trotzdem nur langsam, weil die tägliche Pflicht fast nur aus Wiedererkennen und gelenkten Lücken besteht (Wiederholen ≈ 10 Min., Lektion ≈ 12 Min., dazu Grammatik, Lückenjagd oder Satzbau ≈ 5 Min.). Sprechen und Schreiben sind nur freiwillige Extras, Korrekturen werden gelesen, aber nie noch einmal selbst verbessert gesagt, und die Grammatik endet bei B2-Zeitformen. Genau das fehlt ihm aber zwischen B2 und C1: frei, schnell und präzise formulieren, im richtigen Ton, ohne seine typischen deutschen Fehler.

## 2. Die wichtigsten Vorschläge (nach Wirkung sortiert)

### V1. „Nochmal, aber besser“: Jede Korrektur wird selbst wiederholt
- **Was:** Nach jeder Analyse im Rollenspiel, beim Schreiben und im Präsentations-Coach kommt ein kurzer Pflichtschritt. Die bessere Fassung wird kurz gezeigt und dann ausgeblendet. Emrah sagt oder tippt seinen Satz noch einmal neu, aus dem Kopf. Die App vergleicht mit der verbesserten Fassung, und es reicht, wenn der Kern stimmt. Jede so geübte Verbesserung wird **automatisch** zu einer Karte, nicht erst über „mitnehmen“: vorne sein eigener alter Satz, hinten die bessere Form. In 1, 3 und 9 Tagen kommt sie zurück als „Damals hast du gesagt: … Sag es jetzt besser.“ Die Abfrageart `situation` und die Fehlerboxen gibt es schon und lassen sich dafür nutzen.
- **Warum:** Lesen allein ändert nichts an der Korrektur. Erst wenn der Lerner die bessere Form selbst hervorbringt, bleibt sie hängen (erzwungener Output). So würde ich es in jeder Stunde machen. Heute verpufft der größte Schatz der App, nämlich die Analyse seiner echten Sätze.
- **Aufwand:** mittel
- **Neu oder Verbesserung:** neu

### V2. Sprechen oder Schreiben wird tägliche Pflicht
- **Was:** Der Pflichtkanal (heute nur Grammatik, Lückenjagd oder Satzbau) bekommt einen **Output-Kanal**. An mindestens 4 von 7 Tagen ist die Pflicht ein kurzes Gespräch, mindestens 6 eigene Züge in einer Szene, oder ein kurzer Text von 80–120 Wörtern, etwa eine Mail oder eine Slack-Antwort. Damit das in 25–30 Minuten passt, wird die Lektion an diesen Tagen kürzer, und die Wiederholung wird bei 8 Minuten gedeckelt.
- **Warum:** Wer B2 hat, versteht schon viel. Was fehlt, ist das freie Produzieren. Bleibt Sprechen ein freiwilliges Extra, macht es im Alltag kaum jemand. Heute kann Emrah wochenlang seine Serie halten, ohne einen einzigen freien Satz auf Englisch zu formulieren.
- **Aufwand:** mittel (Tagesplan in `src/domain/plan`, Bedingung für „Gespräch erledigt“ gibt es schon)
- **Neu oder Verbesserung:** Verbesserung, aber mit großer Wirkung

### V3. Persönliche „Deutsch-Fallen“: das eigene Fehlerprofil
- **Was:** Die App sammelt aus allen Quellen seine **wiederkehrenden** Fehlermuster, also aus Rollenspiel-Analysen, Schreibkorrekturen, Preply-Importen und Grammatikfehlern. Ein Aufruf alle paar Tage fasst sie zu höchstens 8 persönlichen Mustern zusammen. Beispiele: „since + Gegenwart“, „make/do“, „actual = aktuell“, „become = bekommen“, „I have a question to you“, fehlendes Hilfsverb in Fragen. Zu jedem Muster gibt es ein kurzes Drill aus **seinen eigenen** Sätzen (umformulieren, korrigieren, frei neu bilden) und eine Anzeige „kam diese Woche noch 3× vor → 1×“. Die Rollenspiel-Analyse bekommt die Top-3-Muster mit und achtet gezielt darauf.
- **Warum:** C1-Prüfer hören sofort die immer gleichen 5–10 Übertragungsfehler aus dem Deutschen. Die 16 festen Themen fangen sie nur teilweise, weil viele dieser Fehler Wort- und Ausdrucksfehler sind. Übung mit eigenen Fehlern wirkt am stärksten, weil sie genau an seiner Lücke ansetzt.
- **Aufwand:** mittel bis groß
- **Neu oder Verbesserung:** neu

### V4. „Mein nächster Termin“: Englisch für die echte Arbeitswoche
- **Was:** Emrah gibt in zwei Minuten einen echten Termin ein: mit wem, worum es geht, was heikel ist. Beispiel: „Call mit Partner in UK, er will Rabatt, ich will Laufzeit“. Daraus baut die App eine 10-Minuten-Vorbereitung: 6–8 Schlüsselwendungen für genau diesen Termin, die drei wahrscheinlichsten Einwände mit Antwortbausteinen und eine Generalprobe als Rollenspiel mit genau diesem Gegenüber. Nach dem Termin gibt es eine Nachbesprechung in einer Minute: „Was wolltest du sagen und konntest es nicht?“ Daraus werden sofort Karten mit der besten Formulierung.
- **Warum:** Zwei Drittel seines Bedarfs sind beruflich. Nichts motiviert und wirkt so sehr wie Sprache, die er morgen tatsächlich braucht. Heute sind die Inhalte zwar Business-Themen, aber allgemein. Fest eingebaut sind nur 2 eigene Szenen und 4 aus der alten App.
- **Aufwand:** mittel (Szenen-Erzeugung, Rollenspiel und Karten gibt es schon)
- **Neu oder Verbesserung:** neu

### V5. C1-Werkzeugkasten statt nur Zeitformen
- **Was:** Die 16 Grammatikthemen sind alle B1/B2-Stoff (Zeiten, Bedingungssätze, Passiv, Artikel …). Dazu kommen 6–8 **C1-Themen mit Wirkung im Beruf**:
  - Abschwächen und Absichern (hedging): „It might be worth considering…“, „I'd be inclined to…“
  - Diplomatische Distanz: „I was wondering whether…“, „That could be tricky for us.“
  - Betonung durch Satzbau: „What we really need is…“, „Not only did we…, but…“
  - Diskursmarker für Struktur und Überleitung: „That said“, „To build on that“, „Coming back to…“
  - Nominalstil in Mails: „the implementation of…“ statt vieler Nebensätze
  - Partizipialsätze: „Having reviewed the contract, we…“
  - Präzise Mengen- und Zeitangaben: „roughly“, „a fraction of“, „by end of Q3“

  Jedes Thema wird mit dem vorhandenen Themenblatt, Aufgaben und Fehlerwiederholung aufgebaut und fließt in Lektionen und Rollenspiel-Analyse ein. Die Analyse prüft dann ausdrücklich: „Hat er abgeschwächt, strukturiert, betont?“
- **Warum:** Nicht fehlerfreie Zeiten unterscheiden C1 von B2, sondern die Fähigkeit, Ton und Wirkung zu steuern. Genau das braucht ein Head of Business Development in Verhandlungen und mit C-Level.
- **Aufwand:** mittel (vor allem Inhalte, die Technik ist da)
- **Neu oder Verbesserung:** Verbesserung (neuer Inhalt in vorhandener Struktur)

### V6. Flüssigkeit unter Zeitdruck: 90 – 60 – 45 Sekunden
- **Was:** Eine neue Kurzübung von etwa 5 Minuten nach der 4-3-2-Methode. Eine Berufsfrage, etwa „Why should a mid-sized company move its archive to the cloud?“ oder „Explain ViDA to a CFO in plain English“. Emrah antwortet 90 Sekunden lang, gesprochen, wenn das Mikrofon geht, sonst getippt. Dann dieselbe Antwort in 60 Sekunden, dann in 45 Sekunden. Ein sichtbarer Balken zeigt die Zeit. Danach eine kurze KI-Rückmeldung: Was wurde flüssiger? Welche 2 Wendungen fehlten? Mit V1 („nochmal besser“) koppeln.
- **Warum:** Flüssigkeit trainiert man nur, wenn man denselben Inhalt mehrmals schneller formuliert. Dann wird die Sprache automatisch und die Aufmerksamkeit frei für Präzision. Im Rollenspiel gibt es heute keinen Zeitdruck, Emrah kann jeden Satz beliebig lange feilen. Das ist im echten Call nicht so.
- **Aufwand:** klein bis mittel
- **Neu oder Verbesserung:** neu

### V7. Eine Botschaft, drei Tonlagen
- **Was:** Eine kurze Schreibübung: Ein Sachverhalt, z. B. „Die Migration verschiebt sich um zwei Wochen“, wird dreimal formuliert. Als Slack-Nachricht an einen Kollegen, als Mail an den Kunden-CFO und als gesprochener Satz im Meeting. Die KI-Rückmeldung bewertet nur den Ton: zu direkt, zu steif, passend? Dazu eine Musterfassung je Tonlage.
- **Warum:** Deutsche Muttersprachler wirken auf Englisch oft zu direkt oder zu förmlich. Den Ton bewusst zu wechseln ist eine Kernfähigkeit auf C1 und im Vertrieb entscheidend. Die App bewertet den Ton heute zwar mit („register“), trainiert ihn aber nirgends gezielt.
- **Aufwand:** klein (Schreibmaske und Korrektur-Vorlage gibt es schon)
- **Neu oder Verbesserung:** neu

### V8. Preply und App arbeiten an denselben 5 Zielen
- **Was:** Aus jedem Preply-Import und aus dem Fehlerprofil (V3) entsteht ein Wochenfokus mit höchstens 5 Punkten, z. B. „Diese Woche: since/for, hedging, ‚I'd suggest that we…‘“. Tagesplan, Rollenspiel-Analyse und Stundenvorbereitung beziehen sich alle darauf. Die Stundenvorbereitung schickt dem Lehrer: „Bitte achten Sie auf diese 3 Punkte.“ Der Wochenbericht sagt, ob die Punkte seltener geworden sind.
- **Warum:** Heute arbeiten Lehrer und App nebeneinander her. Das Wiederholen wirkt am besten, wenn beide dasselbe Ziel haben und der Lehrer die Fortschritte der App im Gespräch prüft.
- **Aufwand:** klein bis mittel
- **Neu oder Verbesserung:** Verbesserung

## 3. Weglassen oder vereinfachen

1. **Satzbau aus Bausteinen und Sprint nicht mehr als Pflicht:** Beides ist auf B2 vor allem Beschäftigung. Satzbau übt Wortstellung, die er meist schon kann, und der Sprint übt schnelles Wiedererkennen. Beides darf als freiwilliges Extra bleiben, der Pflichtplatz geht an Output (V2).
2. **Weniger Zeit in den unteren Karten-Stufen:** Auswahlfragen (Stufe 1–2) sind für neue Business-Wendungen fast verschenkte Zeit. Neue Wendungen und Kollokationen sollten direkt bei „Mit Stütze abrufen“ (Stufe 3) starten und zügig bis zum eigenen Satz aufsteigen.
3. **Wortschatzziel „8.000 Wörter“ und Wortzahl-Schätzungen nicht betonen:** Auf dem Weg zu C1 zählen nicht mehr Einzelwörter, sondern sichere Wendungen und Ton. Die Zahl kann eingeklappt unter „Messwerte“ bleiben. Sichtbar sollte stattdessen etwas wie „Wendungen, die du frei benutzt hast“ stehen.
