# KI-Tutor · Claude als Lehrer in Lingo-Engine X

*Stand 06.10.2026 · Arbeitsstand `claude/umbau-fokus` · nur geplant, nichts gebaut. Baut auf `docs/umbau/lernplattform-2.md` (im Folgenden **LP2**: Muster, `ExerciseShell`, Erklär-Karte, Eingabeprofil) und `docs/umbau/c1-programm.md` (im Folgenden **C1P**: Kapitel, C1-Check, `assess@4`, Wochen-Mail) auf und widerspricht ihnen nicht. LP2 und C1P regeln, **was** geübt wird und **wie** eine Übung aussieht. Dieses Dokument regelt, **wo Claude als Lehrer eingreift**, mit welcher Vorlage, zu welchen Kosten und mit welchen Sicherungen. Daten werden nie gelöscht, Neues wird nur ergänzt (CLAUDE.md A6, Kap. 9).*

**Prüfstatus jeder Aussage:** [G] Quelle selbst abgerufen · [S] Suchtreffer oder Sekundärquelle, Seite selbst nicht vollständig gelesen · [E] eigene Rechnung oder Einschätzung · [U] Fachwissen, ungeprüft. Pfade sind relativ zu `/home/user/lingo-engine-x`.

---

# Teil A · In einfachen Worten (für Emrah)

## Was der KI-Tutor ist

Bisher ist Claude in der App vor allem ein Chatfenster am Rand. Der Tutor ist etwas anderes: Claude sitzt **an acht festen Stellen direkt in deinem Training** und tut dort jeweils genau eine Lehrer-Aufgabe. Die App bleibt der Schiedsrichter (sie entscheidet richtig oder falsch), Claude ist der Lehrer, der dir *deinen* Fehler erklärt und dir *deine* nächsten Aufgaben baut.

## Was du erlebst

1. **„Warum ist *meine* Antwort falsch?“** Du schreibst in eine Lücke etwas, womit die App nicht gerechnet hat, zum Beispiel „I wish the client *would send* us the data last week“. Unter dem Ergebnis steht eine Zeile „Claude erklärt deine Antwort“. Ein Tipp, und nach ein bis zwei Sekunden steht da: „*would send* wäre ein Wunsch an jemanden, der sich jetzt anders verhalten soll. *last week* ist vorbei, also Bedauern über früher: **had sent**.“ Das Signalwort „last week“ leuchtet im Satz auf. Danach schreibst du die Lösung einmal selbst.
2. **Aufgaben, die genau deine Schwäche treffen.** Verwechselst du zweimal *wish + Past* und *wish + Past Perfect*, baut Claude im Hintergrund neue Sätze genau zu diesem Unterschied, in deinen Situationen (Kunden-Mail, Meeting, Verhandlung). Die App prüft jeden Satz, bevor du ihn siehst, und lässt ihn zusätzlich von einem zweiten Claude-Durchgang lösen. Nur was beide Prüfungen besteht, kommt in deine Übung. Du erkennst es an „Claude“ in der Statuszeile.
3. **Sätze aus deinem Alltag.** Du sagst der App einmal in zwei Minuten, mit wem du sprichst (CFO, IT-Leitung, Partner) und in welchen Situationen (Einwände, Status-Updates, Angebote). Ab dann spielen neue Aufgaben, Beispielsätze und Rollenspiele dort.
4. **Satz-Klinik.** Du hast morgen eine Mail zu schreiben und bist bei einem Satz unsicher. Du tippst ihn in die Satz-Klinik (geht auch am Handy). Claude korrigiert nur, was falsch ist, nennt das Muster, zeigt eine C1-Fassung, und der Fehler wird ein Fehlersatz in deinem Training.
5. **Wochen-Diagnose „Was du verwechselst“.** Einmal pro Woche schaut Claude auf deine Fehler der letzten 28 Tage und schreibt in drei Punkten, was du *systematisch* verwechselst, woran man es erkennt und mit welchem Merksatz du es auseinanderhältst. Jeder Punkt hat einen Knopf „Kontrast-Runde“: acht Aufgaben, die beide Muster abwechselnd üben.
6. **Schreibwerkstatt am Laptop.** Einmal pro Woche eine echte Mail (120–180 Wörter) zu einer Situation aus deinem Job. Claude markiert jede falsche Stelle im Text und erklärt sie. Echte Fehler werden Fehlersätze, reine Stil-Verbesserungen nicht.
7. **Sprechen am Laptop.** Das Rollenspiel bleibt. Neu: Nach einem Fehler sagst du den Satz noch einmal selbst („Sag's nochmal“), statt nur die Korrektur zu lesen.
8. **Nachfragen.** Unter jeder Erklärung kannst du Claude weiterfragen oder dir fünf neue Aufgaben genau zu diesem Muster geben lassen.

## Was der Tutor bewusst nicht tut (ehrlich)

- **Er ist kein Video-Lehrer.** Ein Video von einer Minute wäre größer als die ganze App (Grenze 16 MB) und darf nicht von außen geladen werden. Der Tutor ist Text, Bewegung und Sprachausgabe.
- **Er hört deine Aussprache nicht.** Claude bekommt in einem Artefakt nur Text und Bilder, kein Audio.
- **Er kann sich irren.** Alles von Claude ist mit „von Claude, kann Fehler enthalten“ gekennzeichnet und hat einen Knopf „Melden“. Gemeldetes verschwindet sofort.
- **Deine Pflicht geht immer auch ohne Claude.** Fällt Claude aus, läuft dein Tag mit den festen Aufgaben weiter, und die Serie reißt nicht.
- **Er misst dich nicht.** Einstufung, C1-Check und Wochen-Check benutzen nur feste, geprüfte Aufgaben, nie Aufgaben von Claude.
- **Er kostet etwas von deinem Claude-Kontingent.** Deshalb fragt er im Hintergrund höchstens 5-mal am Tag je Gerät. Alles andere passiert nur, wenn du tippst.

## Was du entscheidest (der Standard gilt, bis du „anders“ sagst)

| Nr. | Frage | Standard |
|---|---|---|
| KT-E1 | Darf Claude im Hintergrund neue Aufgaben zu deinen Schwächen bauen? | ja, höchstens 5 Anfragen am Tag je Gerät |
| KT-E2 | Dürfen Aufgaben von Claude in der Pflicht vorkommen? | ja, höchstens 2 von 6 Grammatikplätzen, nie bei der Einführung eines neuen Musters |
| KT-E3 | Wochen-Diagnose | automatisch einmal pro Woche beim Öffnen von „Fortschritt“, sonst per Knopf |
| KT-E4 | Berufsprofil | einmal ausfüllen (2 Min.), vorausgefüllt mit deinem bisherigen Text (DMS/ECM, Business Development) |
| KT-E5 | Schreibwerkstatt | einmal pro Woche am Laptop vorgeschlagen, freiwillig (gleich wie C1P C-E5) |

---

# Teil B · Für die Umsetzung

## 0 Ausgangslage (Belege aus dem Code)

**Vorhanden und gut (bleibt):**
- Ein KI-Tor für alles: Verfügbarkeit → Budget → Drosselung → Warteschlange → genau ein Aufruf → zod → höchstens ein Neuversuch bei Schemafehler (`src/ai/gate.ts:10-13`, `:277-327`). Kein Timer-Abbruch, nur der Hinweis „dauert länger“ (`gate.ts:26`, A6.2). Neuversuch mit angehängten Mängeln und frischem Zwischenspeicher (`gate.ts:55-65`, `:317-318`, A6.3).
- Höchstens 2 Aufrufe gleichzeitig, davon höchstens 1 Hintergrund (`src/ai/queue.ts:22`, `:99`); nach `rate_limited` 60 s Pause, lokal höchstens 20 Aufrufe je 60 s (`src/ai/status.ts:8-10`).
- 24 JSON-Vorlagen und 2 Gesprächsvorlagen (`src/prompts/registry.ts:28-61`, `:69`). Davon tutor-nah: `grammar-items@2` (neue Aufgaben zu einem Thema, nur auf Knopfdruck, `src/features/grammar/generate.ts:18-21`), `order-gen@1` mit Vorrat im Hintergrund und formaler Prüfung (`src/features/drills/orderGen.ts:114-150`, `src/domain/drills/orderPool.ts:141-166`), `patterns@1` „Deutsch-Fallen“ einmal je Woche (`src/features/patterns/store.ts:209-214`), `assess@3` (Urteil aus Belegen), `combo-check@1`, `produce-check@1`, `repair-check@1`, Rollenspiel (`roleplay-turn@1`, `turn-analysis@2`, `goal-check@1`, `roleplay-report@3`).
- Schutzregel im Begleiter: Vor dem Prüfen nennt Claude die Lösung nicht (`src/prompts/companionChat.ts:37-38`).
- Lokaler Wort-für-Wort-Vergleich mit Operationen `eq/typo/sub/ins/del` (`src/domain/answer/align.ts:25`).

**Lücken, die der Tutor schließt:**
1. **Keine Erklärung für *unerwartete* Antworten.** LP2 schreibt Begründungen je falscher Option (`WhyRule`, LP2 §3.1). Für frei getippte Antworten (Lücke, Umformen, Schlüsselwort, Wörter) gibt es unendlich viele falsche Fassungen; vorgeschrieben werden kann nur ein Teil. LP2 plant dafür `explain-answer@1`, aber nur als Zeile (`lernplattform-2.md:970`).
2. **Zu wenige Aufgaben je Muster.** Ca. 640 Aufgaben auf ca. 130 Muster (`lernplattform-2.md:385`), also im Mittel ≈ 5 je Muster [E]. Die Fehlerwiederholung braucht ab der 2. Wiederholung eine *ungesehene Variante gleichen Typs* (`src/domain/grammar/tasks.ts:251`). Nach zwei, drei Fehlern im selben Muster ist der Vorrat leer.
3. **`grammar-items@2` kennt kein Muster** und hat den Berufskontext fest im Prompt (`src/prompts/grammarItems.ts:91-93`) statt aus `app/profile.ctx`.
4. **`patterns@1` arbeitet auf freiem Text** (falsch/richtig-Paare, `src/prompts/patterns.ts:214-220`), nicht auf Muster-Kennungen. Eine Aussage wie „verwechselt A mit B, 7 von 9“ ist so nicht belegbar.
5. **Keine Meldefunktion** für Claude-Inhalte (in A7 vom 02.10. ausdrücklich „verschoben“) und **kein Tagesbudget** für Hintergrund-Aufrufe.
6. **Befund nebenbei:** `prefetchOrder` startet einen Hintergrund-Aufruf beim Rundenstart, ohne zu wissen, ob in dieser Ansicht schon eine Zustimmung erteilt wurde (`orderGen.ts:114-123`). Laut Vertrag fragt der *erste* Aufruf einer Ansicht nach Zustimmung (`contract/sample.d.ts:44-47`). Der Dialog kann also mitten im Satzbau aufgehen. Regel T-R6 unten verhindert das künftig für alle Hintergrund-Aufrufe.

## 1 Forschung und Marktstand → Regeln für den Tutor

| Befund | Quelle | Folge im Tutor |
|---|---|---|
| Duolingo Max „Explain My Answer“: Knopf nach bestimmten Übungen, kurzer Chat über *diese* Antwort; die App gibt dem Modell mit, was falsch war, was richtig gewesen wäre und was der Lernende wollte. Begründung: für Übersetzungen gibt es unendlich viele falsche Antworten, die man nicht alle vorschreiben kann. | [G] [Duolingo-Blog][duo-max]; [S] [Interview Tech & Learning][duo-tl] | T1 nur auf Tipp, Eingabe = Aufgabe + Antwort + Lösung + Muster + lokal berechnete Abweichung |
| Duolingo lässt KI-Inhalte von Fachleuten prüfen; Nutzer melden fehlerhafte Antworten per langem Drücken. | [G] [Duolingo-Blog][duo-max] | T0: „Melden“ an jedem Claude-Inhalt, Gemeldetes sofort ausgeblendet, KI-Stichprobe für den Englischlehrer |
| Ein-Schritt-GPT-4 erklärte nur 60,2 % der Grammatikfehler in Lernertexten; mit vorgeschaltetem Schritt „atomare Änderungen herausziehen“ waren 93,9 % (Deutsch) der Erklärungen korrekt. | [G] [Song u. a., GEE!, NAACL Findings 2024][gee] | T-R3: Die App berechnet die Abweichung (`alignWords`), Claude erklärt nur diese. In T6 liefert Claude zuerst Stellen mit wörtlichem Ausschnitt, die App prüft sie, erst dann zählt die Erklärung |
| ChatGPT korrigiert flüssig, aber über das Nötige hinaus (höchste Trefferquote, niedrigste Präzision im M2-Maß). | [S] [Fang u. a. 2023][fang] | T-R12: „minimale Änderung“ im Prompt; Fehler und Stil-Verbesserung getrennt; nur Fehler werden Fehlersätze |
| Automatisch erzeugte Lückenaufgaben (GPT-3.5): 75 % wohlgeformte Sätze, 66,85 % passende Antwortoptionen. | [G] [arXiv 2403.02078][vocatt] | T2: harte formale Prüfung plus Löser-Probe; Anfrage 6, gespeichert nur bei ≥ 3 bestandenen |
| GPT-4-Zugang ohne Leitplanken verbesserte Übungsleistung, verschlechterte aber die Leistung ohne KI danach um 17 %; ein Tutor mit Leitplanken (Hinweise statt Lösungen) hob den Schaden weitgehend auf. ≈ 1.000 Schüler. | [S] [Bastani u. a., PNAS 2025][bastani]; [S] [Wharton][bastani-w] | T-R1: Claude erst nach dem eigenen Versuch; Tipps vor der Antwort bleiben fest (Tipp-Leiter, LP2); Nachfragen vor dem Prüfen ohne Lösung (`companionChat.ts:37-38`) |
| Khanmigo: sokratisch, gibt keine Lösungen, eigene Leitplanken je Funktion. | [S] [Khan Academy][khan] | je Funktion eine Vorlage mit eigenen Regeln; kein freier „Mach mir das“-Weg in der Pflicht |
| Mündliche Korrektur im Unterricht wirkt dauerhaft; Aufforderungen zur Selbstkorrektur (prompts) wirken stärker als bloßes Vorsagen (recasts), am stärksten bei frei gebildeten Antworten. 15 Studien, N = 827. | [S] [Lyster & Saito 2010][lyster] | T1/T7: nach der Erklärung „Einmal richtig schreiben“ bzw. „Sag's nochmal“ (selbst bilden, nicht nur lesen) |
| Korrektur insgesamt mittlerer Effekt. | [S] [Li 2010][li] | Korrektur ist sinnvoll, aber kein Wundermittel; kein Versprechen von Tempo |
| Schriftliche Korrektur verbessert die Genauigkeit mit mittlerem Effekt; direkte Korrektur etwas stärker als indirekte (nicht signifikant). 21 Studien. | [S] [Kang & Han 2015][kanghan] | T6 zeigt die Korrektur direkt an der Stelle, mit Grund |
| Abwechselndes Üben ähnlicher Kategorien (interleaving) hilft im Mittel (g = 0,42), stärker bei Stoff, der sich zwischen Kategorien ähnelt. **Bei Wörtern war Blocken besser (g = −0,39).** 59 Studien. | [G] [Brunmair & Richter 2019][brunmair] | T5 „Kontrast-Runde“ für verwechselte **Grammatikmuster**; Wort-Kontraste (T3) erst, wenn beide Wörter schon sitzen (Stufe ≥ 2), höchstens 1 je Runde |
| Lernen ähnlicher Wörter im selben Durchgang erschwert das Behalten (semantische Interferenz). | [U] Tinkham 1993, Waring 1997 | T3: kein Kontrast während der Einführung eines Worts |

## 2 Leitregeln des Tutors (verbindlich)

- **T-R1 Erst versuchen, dann Claude.** Claude erklärt nur nach einer abgegebenen Antwort. Vor dem Prüfen gibt es nur die feste Tipp-Leiter (LP2) und das Nachfragen ohne Lösung.
- **T-R2 Die App urteilt, Claude erklärt.** Claude ändert nie selbst ein Urteil, eine Note, BKT oder FSRS. Hält Claude eine Antwort für ebenfalls möglich (`alsoRight`), erscheint der vorhandene Einspruch „Ich lag richtig“ (`log.entries[].override`, `src/data/schemas.ts:409`); erst Emrahs Tipp zählt.
- **T-R3 Die App findet die Stelle, Claude erklärt sie.** Wo die App die Abweichung selbst berechnen kann (`alignWords`, `src/domain/answer/align.ts:25`), bekommt Claude sie fertig mit. Wo Claude Stellen liefert (T4, T6), muss jeder Ausschnitt wörtlich im Text stehen, sonst fällt er weg.
- **T-R4 Nichts Ungeprüftes.** Jede erzeugte Aufgabe und jeder erzeugte Satz läuft vor der Anzeige durch eine formale Prüfung (Vorbild `acceptGenerated`, `orderPool.ts:141-166`). Was nicht besteht, fällt still weg; das löst **keinen** Neuversuch aus (Vorbild `src/prompts/orderGen.ts:6-8`). Der eine Neuversuch nach A6.3 gilt nur, wenn die Antwort als Ganzes die falsche Form hat.
- **T-R5 Kennzeichnen und melden.** Alles von Claude trägt `AiMark` („von Claude · kann Fehler enthalten · Melden“). Gemeldetes wird ausgeblendet, nie gelöscht.
- **T-R6 Sparsam und ohne Überraschung.** Aufrufe nur nach einer Handlung (Tipp, Rundenende), nie aus Timer oder Schleife (`contract/sample.d.ts:53-56`). **Hintergrund-Aufrufe erst, wenn in dieser Ansicht schon ein Aufruf erfolgreich war** (sonst könnte der Zustimmungsdialog ungefragt erscheinen, `sample.d.ts:44-47`). Tagesbudget je Gerät (§3.3). Ergebnisse, die wiederkommen, liegen in `db` (Kap. 10), nicht nur im 24-h-Zwischenspeicher von `sample` (`sample.d.ts:363-365`).
- **T-R7 Pflicht ohne KI.** Jede Pflicht bleibt ohne Claude erfüllbar; ein KI-Fehler blockiert nie eine Pflicht (`docs/umbau/03-lernmodell.md:109`).
- **T-R8 Messen nie mit Claude-Inhalten.** Einstufung, C1-Check, Meilensteinprüfung und Wochen-Check ziehen nur feste, geprüfte Aufgaben (C1P §4). Aufgaben von Claude buchen nie BKT und nie den Musterzähler `pats` (LP2 §8); sie erzeugen bei falscher Antwort nur einen Fehlersatz.
- **T-R9 Daten nur ergänzend.** Kein neues Dokument, keine neue Sammlung; nur optionale Felder in vorhandenen Pfaden (§7). Schreiben nur über `writer.transform`.
- **T-R10 Das Gerät bestimmt die Form, nicht den Plan** (LP2 Leitsatz 3). Handy: antippen, auswählen, 1–5 Wörter, ein Satz. Laptop: ganze Sätze, Texte, Sprechen.
- **T-R11 Sprachtreue.** Erklärungen werden als `{de, en}` erzeugt und gespeichert; angezeigt wird die Oberflächensprache; Englisch immer US (Kap. 10, A7.3). Britische Formen in Emrahs Antworten gelten als richtig und werden nur als Hinweis erwähnt.
- **T-R12 Minimal korrigieren.** Fehler und Verbesserung sind getrennt (`sev: 'error' | 'upgrade'`); nur Fehler werden Fehlersätze.

## 3 Fundament „Tutor-Schicht“ (T0)

### 3.1 Bausteine

| Baustein | Datei (neu, wenn nicht anders gesagt) | Aufgabe |
|---|---|---|
| `AiMark` | `src/ui/AiMark.tsx` | eine Zeile in `--lx-text-2`, 13 px: „von Claude · kann Fehler enthalten“ + Textknopf „Melden“ (Tippfläche ≥ 44 px). Varianten: `task` („Aufgabe von Claude · formal geprüft“), `explain`, `diag`, `edit`. EN: „From Claude · may contain mistakes · Report“ |
| Melde-Blatt | `src/ui/ReportSheet.tsx` | Gründe: „Lösung falsch“ · „Zwei Antworten passen“ · „Erklärung falsch“ · „Satz klingt unnatürlich“ · „Anderes“. Schreibt eine Markierung an den Ort des Inhalts (§7) und einen Log-Eintrag `{k: 'aiflag', m: '<vorlage>@<v>', q: <grund>, id}` in `log/<tag>` |
| Budget | `src/ai/budget.ts` | Tageszähler je Gerät in `localStorage` `lx:ai-day` = `{d, bg, n: {<vorlage>: zahl}}`; `PromptTemplate.budget?: {bgPerDay: number}` (optionales Feld in `src/prompts/types.ts:12-29`). Das Tor prüft nur bei `priority: 'background'`; überschritten → `failure('busy', 'budget')`, still |
| Zustimmung bekannt | `src/platform/capabilities.ts` | neues Feld `sampleConfirmed` im Store, gesetzt im Tor nach dem ersten erfolgreichen Aufruf der Ansicht; Hintergrund-Aufrufe ohne `sampleConfirmed` werden nicht gesendet (`failure('busy', 'no_consent_yet')`, still) |
| Berufsprofil-Zeile | `src/domain/tutor/ctx.ts` | `tutorCtx(profile): string` ≤ 300 Zeichen aus `app/profile.ctx2` (T4), sonst `workContext()` (`src/prompts/work.ts:12-15`) |
| Qualitätszähler | `src/domain/tutor/quality.ts` + Diagnose-Zeile | `lx:ai-q` = `{<vorlage>: {gen, acc, shown, flag}}`: erzeugt, formal bestanden, gezeigt, gemeldet |
| KI-Stichprobe | Einstellungen › Diagnose | „KI-Stichprobe sichern“: die letzten 30 gezeigten Claude-Inhalte (Aufgabe, Antwort, Erklärung, Meldung) als JSON über `downloads`. Emrah schickt die Datei in claude.ai, der Englischlehrer prüft sie in der nächsten Sitzung. Echte Claude-Antworten lassen sich nur so prüfen, denn in der Cloud-Umgebung gibt es kein `sample` |
| Testantworten | `src/platform/dev/cannedReplies.ts` | je neue Vorlage eine feste Antwort über `registerCannedReply` (Muster: `cannedReplies.ts:214-254`), dazu je eine absichtlich fehlerhafte für die Prüfungstests |

### 3.2 Gemeinsamer Ablauf eines Tutor-Aufrufs
1. Auslöser ist ein Tipp oder ein Rundenende (nie Laden, Timer, Schleife).
2. `useAiAvailable()` (`src/ai/scope.ts`) falsch → Knopf ist gar nicht da.
3. Prompt aus Vorlage, Eingabe ≤ 60.000 Byte (`gate.ts:19`); jede Vorlage dieses Dokuments bleibt unter 8 KB (Unit-Test mit Höchstwerten).
4. Anzeige: „Denkt nach …“ als Skelett aus drei Zeilen (Kap. 3.4: Skelette statt Spinner), ab `SLOW_AFTER_MS` „dauert länger als üblich“ mit Stopp (`gate.ts:26`).
5. zod-Schema der Vorlage; danach die formale Einzelprüfung (falls vorhanden).
6. Ergebnis mit `AiMark`, Speichern nach §7, Qualitätszähler.

### 3.3 Budget je Gerät und Tag

| Vorlage | Priorität | Deckel/Tag | Abstand |
|---|---|---|---|
| `grammar-items@3` (Hintergrund) | background | 2 | ≥ 20 Min. (wie `orderGen.ts:26`) |
| `solve-check@1` | background | 2 (folgt nur auf `grammar-items@3`) | – |
| `word-ctx@1` | background | 1 | – |
| `diagnose@1` (automatisch) | background | 1 je ISO-Woche | – |
| alle übrigen | user | keiner außer dem Tor (20 je 60 s, `status.ts:10`) | – |

**Summe Hintergrund ≤ 5 Anfragen am Tag je Gerät** (KT-E1). Bei ≥ 40 überfälligen Karten (Aufholmodus) gibt es keine Hintergrund-Erzeugung: Dann fehlt Zeit, nicht Stoff.

**Aufwand T0:** M (≈ 1,5 AP). **Abnahme:** Unit `budget.test.ts` (3. Aufruf am Tag wird nicht gesendet, Tageswechsel um 04:00 setzt zurück, `user` nie gedeckelt); Unit: Hintergrund ohne `sampleConfirmed` sendet nichts; E2E ohne `sample`: kein Tutor-Knopf, keine Tutor-Zeile, alle Pflichten erfüllbar; jedes Element mit `ai: true` zeigt `AiMark` (Selektor-Test über alle Übungsarten).

## 4 Die Funktionen

### T1 „Erklär mir meine Antwort“

**Was Emrah sieht (Handy, im Ergebnis-Teil der `ExerciseShell`, LP2 §5.2):**
1. Urteil „Noch nicht“ / „Fast richtig“ · Muster · Lösung in der Lücke (fest, wie LP2).
2. Gibt es für seine Antwort **keine** passende feste Begründung (`WhyRule` greift nicht, LP2 §3.1) oder war es „Fast richtig“: Zeile im Platz `explanation` „Warum ist **deine** Antwort falsch? · Claude erklärt ›“. Sonst nur im Menü ⋯ („Erklär mir meine Antwort“, `lernplattform-2.md:702`). So kostet der Normalfall nichts.
3. Nach dem Tipp: Skelett (Stufe `quick`, meist 1–2 s, `sample.d.ts:58-60`), dann
   - **Deine Antwort:** was *seine* Form ausdrückt oder wo sie richtig wäre (1 Satz),
   - **Richtig, weil:** Signalwort und Regel (nur, wenn die feste Begründung fehlt),
   - **Beispiel:** ein neuer Satz desselben Musters aus seinem Berufsalltag, mit ▶ (Sprachausgabe),
   - Signalwörter leuchten im Übungssatz auf (`--lx-mark`, ≤ 300 ms),
   - `AiMark`.
4. Darunter: **„Einmal richtig schreiben“** (Hauptknopf, Selbstkorrektur, LP2), „Nachfragen ›“ (T8), „Mehr davon ›“ (T8).
5. Meint Claude, seine Antwort sei auch möglich: goldene Zeile „Claude hält deine Antwort auch für möglich.“ + Knopf „Ich lag richtig“. Die App ändert nichts von selbst (T-R2).

**Laptop:** dieselben Zeilen in der rechten Spalte (Regel-Panel, LP2 §6) statt unter der Aufgabe; Nachfragen öffnet den Chat in derselben Spalte.

**Wörter:** gleich, wenn `explainWord` (LP2 `lernplattform-2.md:1063`) nur die Rückfall-Erklärung hat. Die App gibt mit: ob seine Antwort eine andere eigene Karte ist (Verwechslung), ob ein bekannter falscher Freund vorliegt (Fallen-Index LP2 §3.7).

**Vorlage `explain-answer@1`** (Kennung wie in `lernplattform-2.md:970`; dieses Dokument legt Eingabe und Schema fest)
- `tier: 'quick'`, `cache: { gcTime: 86_400_000 }`, `priority: 'user'`.
- Eingabe:
```ts
type ExplainVars = {
  kind: 'grammar' | 'word';
  task: string;          // Übungssatz mit ___ bzw. Ganzsatz, ≤ 300 Zeichen (clip)
  given: string;         // ≤ 160; '' bei „Weiß ich nicht“
  answer: string;        // ≤ 160
  accepted: string[];    // ≤ 4
  ops: Array<{ op: 'sub' | 'ins' | 'del' | 'typo'; g: string; e: string }>; // aus alignWords, ≤ 6, eq weggelassen
  pattern: { id: string; name: string; form: string; signals: string[]; trap: string } | null; // EN, aus LP2-Musterdatei
  neighbors: Array<{ id: string; name: string }>; // ≤ 4 Muster derselben Kontrastfamilie (LP2 §3.5)
  word: { en: string; de: string; pos: string; other: { en: string; de: string } | null; falseFriend: string | null } | null;
  ctx: string;           // tutorCtx, ≤ 200 (nur für das Beispiel)
};
```
- Prompt (Kern): `[explain-answer@1]` · „The app has already graded this answer as NOT correct. Do not grade again; only set alsoRight=true if the learner answer is fully correct English for this exact task.“ · „Explain ONLY the listed word changes (ops). Never mention other problems.“ · „yours: what the learner's form expresses or when it would be right. why: the signal word in the sentence and the rule. Each at most 25 words; German in simple German, English terms in “…”.“ · „example: one NEW sentence with the same pattern, 8–16 words, American English, from the learner's work context.“ · Musterangaben, `ctx`, `QUOTE_RULE` (`gate.ts:218-219`).
- Ausgabe:
```ts
const Bi = (max: number) => z.object({ de: clipped(8, max), en: clipped(8, max) })
  .superRefine((b, ctx) => { if (isWrongLang(b.de, 'de')) ctx.addIssue({ code: 'custom', path: ['de'], message: 'must be German' });
                             if (isWrongLang(b.en, 'en')) ctx.addIssue({ code: 'custom', path: ['en'], message: 'must be English' }); });
export const explainSchema = (v: ExplainVars) => z.object({
  yours: Bi(160).nullable(),                         // null nur, wenn given === ''
  why: Bi(160),
  signal: z.preprocess(asList, z.array(z.string()))  // nur wörtlich im Übungssatz vorhandene, ≤ 3; sonst stillschweigend weg
    .transform((xs) => xs.filter((s) => v.task.toLowerCase().includes(s.toLowerCase())).slice(0, 3)),
  confused: z.preprocess((x) => (typeof x === 'string' && v.neighbors.some((n) => n.id === x) ? x : null), z.string().nullable()),
  alsoRight: z.preprocess(looseBool, z.boolean()).default(false),
  example: z.unknown().transform((x) => acceptExample(x, v)).nullable(), // fällt weg statt Neuversuch: britisch, " im Text, 6–20 Wörter
}).superRefine((o, ctx) => { if (v.given && !o.yours) ctx.addIssue({ code: 'custom', path: ['yours'], message: 'yours is required' }); });
```
  Hilfen: `clipped` (`src/prompts/tolerant.ts:17`), `looseBool` (`src/prompts/produceCheck.ts:52`), `isWrongLang` (`src/domain/lang/detect.ts:80`). Neuversuch nach A6.3 nur, wenn `yours`/`why` fehlen oder in falscher Sprache sind.
- **Kosten:** nur auf Tipp; je Antwort höchstens ein erfolgreicher Aufruf (Knopf danach weg); erneutes Öffnen desselben Fehlersatzes liest `ax` aus der Datenbank (0 Aufrufe). Prompt ≈ 1,5–3 KB, Antwort ≈ 0,5–0,8 KB [E]. Erwartet 0–5 Aufrufe am Tag [E].
- **Fehlerzustände:** §6. Bei `refused`: „Dazu kann Claude nichts sagen.“, die feste Erklärung bleibt stehen.
- **Kennzeichnung:** `AiMark variant="explain"` unter den Claude-Zeilen; feste Zeilen bleiben ohne Marke.
- **Daten:** `grammar/<topic>.errors[i].ax` (die falsche Antwort hat den Eintrag schon erzeugt, `03-lernmodell.md:101`) und `.errors[i].cf` = `confused`; Wörter: `vocab/<id>.axs[]` (≤ 3, ältester fällt heraus). Form siehe §7.
- **Aufwand:** M (≈ 2 AP; setzt LP2 P1 `ExerciseShell`/Menü und P2 Muster voraus; ohne Muster läuft es mit `pattern: null` auf Themenebene).
- **Abnahme:**
  - Unit: Schema mit 12 Musterantworten (u. a. `signal` nicht im Satz → entfernt, `confused` außerhalb der Familie → `null`, Beispiel britisch → `null` ohne Neuversuch, `why.de` englisch → ein Neuversuch).
  - Unit: Prompt mit Höchstwerten < 4 KB.
  - E2E (Testlaufzeit): Lücke falsch, keine `WhyRule` → Zeile sichtbar; mit passender `WhyRule` → nur im Menü ⋯. Nach Tipp `AiMark` sichtbar; zweites Öffnen des Fehlersatzes am nächsten Tag zeigt die Erklärung **ohne** Aufruf (Zähler = 1). `alsoRight` → Urteil bleibt „Noch nicht“, bis „Ich lag richtig“ getippt wird. `invalid_json` → genau 1 Aufruf + „Erneut versuchen“; Schemafehler → genau 2 Aufrufe (A6.3). Ohne `sample` weder Zeile noch Menüeintrag.
  - learning-scientist prüft den Prompt einmal (A5).

### T2 Adaptive Grammatik-Aufgaben („genau deine Schwäche“)

**Was Emrah sieht:** nichts Neues an Bedienung. In Grammatik-Runden stehen höchstens 2 von 6 Pflichtplätzen (KT-E2) als Aufgaben mit „Claude“ in der Statuszeile; bevorzugt als **ungesehene Variante eines fälligen Fehlersatzes im selben Muster**. Im Ergebnis `AiMark variant="task"`. Wenn eine Aufgabe nicht stimmt: „Melden“ → sie kommt nie wieder.

**Bedarf (rein, `src/domain/tutor/needs.ts`):**
- *schwaches Muster* = offenes Fehlersatz-Muster (`errors[].pat`, LP2 §8) **oder** `pats[id].n ≥ 3` und Anteil richtig < 0,6 in 28 Tagen;
- *Bedarf* = schwach **und** weniger als 2 ungesehene Aufgaben dieses Musters in fest + Vorrat;
- gewählt wird das Muster mit den meisten offenen Fehlern; hat es ein Verwechslungs-Paar (`cf`, T1/T5), läuft die Anfrage im Kontrast-Modus mit dem Nachbarmuster.

**Auslöser:** Ende einer Grammatik-Runde und Erfolg von T1 (beides Handlungen), im Hintergrund, nur wenn Bedarf, Budget (§3.3), 20 Min. Abstand, `sampleConfirmed`, < 30 Claude-Aufgaben im Vorrat und < 40 überfällige Karten. Dazu „Mehr davon“ (T8) als Nutzer-Aufruf.

**Vorlage `grammar-items@3`** (Nachfolger von `@2`, Kennung bleibt; LP2 `lernplattform-2.md:867` nennt sie schon)
- `tier: 'default'`, `cache: false`, Hintergrund `budget: { bgPerDay: 2 }`.
- Eingabe:
```ts
type PatternBrief = { id: string; name: string; form: string; use: string; signals: string[]; trap: { bad: string; good: string } };
type GrammarItemsV3Vars = {
  topic: string;
  pattern: PatternBrief;
  contrast: PatternBrief | null;                       // Nachbarmuster im Kontrast-Modus
  mistakes: Array<{ q: string; given: string; ans: string }>; // ≤ 5, nur dieses Muster
  types: Array<'mc' | 'gap' | 'find' | 'kwt' | 'transform' | 'correct'>; // aus BKT-p und Eingabeprofil der letzten Runde
  count: number;                                       // 6 Hintergrund, 5 „Mehr davon“
  avoid: string[];                                     // ≤ 20 zuletzt gesehene Sätze
  ctx: string;                                         // tutorCtx ≤ 300 (ersetzt grammarItems.ts:91-93)
};
```
  Handy-Profil (`touch`): `mc`, `gap` (≤ 3 Wörter), `find`, `kwt` (2–5 Wörter). Laptop (`keys`): zusätzlich `transform`, `correct` (LP2 §6).
- Ausgabe: wie `order-gen@1` als Liste ohne Einzelprüfung im Schema (`src/prompts/orderGen.ts:58`), damit eine schlechte Aufgabe nicht die anderen mitreißt:
```ts
const schema = z.preprocess(looseItems, z.array(z.unknown()).min(1).max(8)).transform((items) => ({ items }));
// Einzelform, geprüft in acceptGrammarItem:
const ItemRaw = z.object({
  pat: z.string(), type: z.enum(['mc', 'gap', 'find', 'kwt', 'transform', 'correct']),
  prompt: z.string(), answer: z.string(),
  accepted: z.array(z.string()).max(6).default([]),
  options: z.array(z.string()).min(3).max(4).nullable().default(null),
  why: TaskWhySchema,                    // LP2 §3.2: { ok: Bi, wrong: WhyRule[] ≤ 4 }
  hint_de: z.string().max(60).default(''),
  sit: z.enum(['meeting', 'mail', 'talk', 'call']).optional(),
  // find/kwt: Zusatzfelder wie V2TaskSchema (LP2 §3.4)
});
```
- **Formale Prüfung `acceptGrammarItem(raw, ctx)`** (`src/domain/tutor/acceptItem.ts`, rein):
  1. `ItemRaw` gültig; `pat` = angefragtes Muster (oder im Kontrast-Modus das Nachbarmuster); `normalizeTask(raw, 'ai')` ≠ `null` (genau eine Lücke usw., `tasks.ts:46-80`).
  2. Übungssatz 8–22 Wörter ohne Lücke, endet auf `.`, `?` oder `!`.
  3. `mc`: 3–4 Optionen, nach Normalisierung verschieden, Lösung enthalten; **jede falsche Option hat eine `WhyRule` mit `opt`** (sonst keine Begründung möglich). Die App mischt die Optionen selbst.
  4. `checkGrammar(task, answer).ok` und für jede `accepted`-Fassung ebenso (`src/domain/grammar/check.ts:94`); keine falsche Option besteht `checkGrammar`.
  5. Hat das Muster ≥ 2 Signalwörter (LP2 §3.2 `signals`), steht mindestens eines im Satz (Ausnahme pro Muster per Inhaltsfeld `sigReq: false`).
  6. US-Schreibung (`BRITISH`, `orderPool.ts:126`, um `-ise`-Verben der Musterdateien ergänzt); kein `"`; `why.*.de` deutsch, `why.*.en` englisch (`isWrongLang`).
  7. `kwt`: Schlüsselwort unverändert in der Lösung, Lösung 2–5 Wörter. `find`: Fehlerbereich innerhalb der Wortzahl; höchstens jede vierte `find`-Aufgabe fehlerfrei (LP2 §3.4).
  8. Schlüssel (`legacyTaskKey`) weder in festen Aufgaben, Vorrat, `seen` noch `app/pool.bad`.
- **Löser-Probe `solve-check@1`** (neu, `tier: 'quick'`, `cache: false`, Hintergrund): direkt nach bestandener formaler Prüfung, eine Anfrage für alle Kandidaten (≤ 8). Eingabe: Aufgaben **ohne** Lösung (Satz, Optionen bzw. Grundform). Ausgabe:
```ts
z.object({ answers: z.array(z.object({ i: intIn(1, 8), a: clipped(1, 120), also: z.preprocess(asList, z.array(z.string())).default([]) })).max(8) })
```
  Behalten wird eine Aufgabe nur, wenn `checkGrammar(task, a).ok` und `also` keine andere Option bzw. nur Fassungen aus `accepted` enthält. Das ist Stufe (2) der Prüfkette aus `docs/umbau/02-lehrplan.md:25`, hier zur Laufzeit.
- **Speichern nur bei ≥ 3 bestandenen Aufgaben** (Vorbild `orderGen.ts:137`); sonst Warnung im Protokoll, kein Neuversuch. Erwartete Ausbeute 50–70 % [E, aus 66,85 % passenden Optionen bei GPT-3.5, [vocatt]].
- **Einsatz in Runden** (`selectRound`, `tasks.ts:214`): Vorrat steht dort schon vor festen Aufgaben (`tasks.ts:218`); neu: höchstens 2 Claude-Aufgaben je Pflichtrunde und 3 je Extra-Runde; nie auf Einführungsplätzen (LP2 §5.3); Fehlersatz-Varianten bevorzugen dasselbe `pat`.
- **Buchung (T-R8):** Claude-Aufgaben buchen weder BKT noch `pats`; falsche Antwort → Fehlersatz mit `src: 'ai'` und `pat`; der Pflichtplatz zählt als erledigt wie jeder andere. Gemeldet → Fehlersatz `done: true` + `bad: 1` (nicht gelöscht).
- **Kosten:** ≤ 2 Erzeugungen + ≤ 2 Löser-Proben am Tag je Gerät; Prompt ≈ 3–5 KB, Antwort ≈ 3–5 KB (Erzeugung), ≈ 1–2 KB / 0,3 KB (Löser) [E].
- **Fehlerzustände:** Hintergrund immer still (Vorbild `orderGen.ts:144`); feste Aufgaben springen ein.
- **Daten:** `app/pool.items[]` mit Zusatzfeldern `pat`, `why`, `gen`, `ai`, `sit`, `t`; neue Liste `app/pool.bad` (§7). `toPoolItem` (`tasks.ts:83-98`) übernimmt die Zusatzfelder.
- **Aufwand:** L (≈ 4 AP; nach LP2 P2 `pat` und P5 Runde).
- **Abnahme:**
  - Unit `acceptItem.test.ts`: 25 schlechte Muster-Aufgaben werden abgelehnt (zwei richtige Optionen, Lösung nicht unter den Optionen, zwei Lücken, britisch, Signalwort fehlt, Lösung besteht `checkGrammar` nicht, Dublette einer festen Aufgabe, `"` im Text, deutsche Begründung auf Englisch, Schlüsselwort verändert, `find`-Bereich außerhalb), 10 gute angenommen.
  - Unit `needs.test.ts`; Unit: Runde mit 6 Plätzen enthält ≤ 2 Claude-Aufgaben, keine auf Einführungsplätzen; Einstufung, C1-Check und Wochen-Check enthalten nie `src: 'ai'`.
  - E2E: zwei Fehler im selben Muster, < 2 Varianten → nach Rundenende genau 1 Erzeugung + 1 Löser-Probe; Vorrat hat ≥ 3 Einträge mit `ai: 1`; in der nächsten Runde `AiMark`; „Melden“ → Aufgabe kommt nicht wieder; 3. Erzeugung am selben Tag wird nicht gesendet; ohne `sample` keine Aufrufe, Runde unverändert.
  - Plattform: im Feature kein `setTimeout`/`setInterval` als Auslöser (Grep-Test).

### T3 Wörter: neue Sätze und Kontrast für schwache Wörter

**Was Emrah sieht:** Ein Wort, das er mehrmals vergessen hat, kommt in einem **neuen Satz aus seinen Situationen** statt immer im selben Ursprungssatz („Der Kunde will den Rollout verschieben …“). Hat er zwei eigene Wörter verwechselt (z. B. *actual* statt *current*), kommt – erst wenn beide schon sitzen – einmal eine Aufgabe „Welches Wort passt?“ mit Begründung. Beides mit `AiMark`.

**Bedarf (rein):** schwach = `lapses ≥ 2` (Glossar, `gesamtkonzept.md:138`) oder 2 Fehler in 14 Tagen; Verwechslung = getippte Antwort ist (normalisiert) das Wort einer anderen eigenen Karte oder ein falscher Freund aus dem Fallen-Index (LP2 §3.7). Bedarf, wenn weniger als 2 frische Claude-Sätze (≤ 30 Tage) vorliegen.

**Vorlage `word-ctx@1`** (neu)
- `tier: 'quick'` (Vorbild `card-examples@2`, `src/prompts/cardExamples.ts:6-8`), `cache: false`, Hintergrund `budget: { bgPerDay: 1 }`, Auslöser Ende einer Wörter-Runde.
- Eingabe: `{ words: Array<{ id; en; pos; de; ex; other: { en; de } | null }> (≤ 6), ctx: string (≤ 300), avoid: string[] (≤ 12) }`.
- Ausgabe: `{ items: unknown[] }` (Liste ohne Einzelprüfung), Einzelform `{ id, sents: [{ en, de, sit }] (2), contrast: { en, why: { de, en } } | null }`.
- **Formale Prüfung `acceptWordCtx`:** `phraseIn(en, word)` (beugungstolerant, `tolerant.ts:143`); 8–18 Wörter; Satzzeichen am Ende; `BRITISH`; kein `"`; `de` deutsch; verschieden von `ex`, `xEx`, `wx` (Normalform `poolNorm`, `orderPool.ts:39`). Kontrast: `phraseIn(en, other.en)` **und nicht** `phraseIn(en, word.en)`; `why` zweisprachig.
- **Einsatz:** Kontext-Wechsel (`src/domain/srs/rotate.ts`) nimmt `wx` ab Stufe 2 auf. Kontrast als Auswahl „Welches Wort passt?“ nur, wenn beide Karten Stufe ≥ 2 haben, höchstens 1 je Runde, Note mit Gewicht `choice` 0,55 (`src/domain/srs/weight.ts:8`).
- **Kosten:** ≤ 1 Aufruf am Tag, Prompt ≈ 1,5 KB, Antwort ≈ 2 KB [E].
- **Daten:** neue Kartenfelder `vocab/<id>.wx[]` (≤ 4) und `vocab/<id>.cfx[]` (≤ 2). `xEx` bleibt unverändert, denn es wird nur einmal geschrieben (`src/domain/srs/examples.ts:94-98`).
- **Aufwand:** M (≈ 2 AP; nach LP2 P6).
- **Abnahme:** Unit `acceptWordCtx` (Wort fehlt, Kontrast enthält Zielwort, britisch, Dublette → abgelehnt); E2E: schwaches Wort zeigt in der nächsten Runde einen `wx`-Satz mit `AiMark`; Kontrast erscheint nicht, solange eine der Karten Stufe < 2 hat.

### T4 „Mein Arbeitsalltag“ und Satz-Klinik

**Berufsprofil (Daten statt Freitext):**
- **Bildschirm** Einstellungen › „Mein Arbeitsalltag“ (dazu einmal nach der Pflicht eine Karte „Damit Claude Sätze aus deinem Alltag baut · 2 Min.“): Rolle (Feld), Branche/Produkt (Feld), **Gesprächspartner** (Chips: CFO · IT-Leitung · Einkauf · Partner · eigenes Team · Investor · eigener Eintrag), **Situationen** (Chips: Verhandlung · Einwand · Status-Update · Kunden-Mail · Präsentation · Small Talk · Eskalation), **eigene Fachwörter** (≤ 12, Englisch). Vorbelegt aus `app/profile.ctx` bzw. dem Standardtext (`src/content/legacy/context.json`). Der bisherige Abschnitt `WorkContextSection` (`src/features/settings/WorkContextSection.tsx`) bleibt als „Freitext“.
- **Daten:** `app/profile.ctx2` (§7). `ctx` bleibt unverändert.
- **Nutzung:** `tutorCtx()` → `grammar-items@3`, `word-ctx@1`, `explain-answer@1` (nur Beispiel), `c1-mail@1`, `sentence-clinic@1`, dazu `order-gen@2` (Nachfolger mit Kontextzeile) und das Rollenspiel (nutzt `ctx` schon, `src/features/speak/useRoleplay.ts`). Regel aus `grammarItems.ts:92-93` bleibt: nur erfundene Namen, nie Fakten über echte Firmen.

**Satz-Klinik (Sätze aus seinem Alltag):**
- **Wo:** Reiter Anwenden › „Satz-Klinik“; im Übersetzer unter dem Ergebnis „Meinen eigenen Satz prüfen“; im Extra-Blatt.
- **Handy:** ein Feld „Dein Satz“ (≤ 300 Zeichen), optional „Wofür?“ (Chip aus den Situationen), Knopf „Prüfen“. **Laptop:** gleich, rechts das Muster-Panel.
- **Ergebnis:** Urteil (Richtig · Fast richtig · Noch nicht) · Satz mit markierten Stellen (Tipp → Grund und Muster) · „C1-Fassung“ (aufklappbar) · Ton-Hinweis · `AiMark`. Bei Fehlern automatisch höchstens 2 Fehlersätze (`src: 'clinic'`), sichtbar ab morgen in Schritt 4. Knopf „3 Aufgaben dazu“ → `grammar-items@3` mit seinem Satz als Fehlerbeleg (Nutzer-Aufruf).

**Vorlage `sentence-clinic@1`** (neu)
- `tier: 'quick'` (ein Satz, Vorbild `produce-check@1`), `cache: { gcTime: 86_400_000 }`, `priority: 'user'`.
- Eingabe: `{ sentence: string (≤ 300, fenced, common.ts:74), purpose: string (≤ 120), uiLang, ctx: string (≤ 200), pats: string (Kurzliste „topic: id, id, …“ aller Muster, ≈ 2 KB) }`.
- Ausgabe:
```ts
z.object({
  verdict: z.preprocess(produceVerdict, z.enum(['correct', 'minor', 'wrong'])),
  fixed: z.preprocess((v) => v ?? '', clipped(0, 400)),
  edits: z.preprocess(asList, z.array(z.unknown())).transform((xs) => keepEdits(xs, sentence, patIds)).pipe(z.array(Edit).max(3)),
  // Edit = { from: string (wörtlich im Satz), to: string, why: clipped(5, 140) in uiLang, pat: string | null (aus der Liste, sonst null), kind: 'grammar'|'word'|'collocation'|'register'|'spelling' }
  better: z.preprocess((v) => v ?? '', clipped(0, 400)),
  register: z.enum(['formal', 'neutral', 'informal']).catch('neutral'),
  note: z.preprocess((v) => v ?? '', clipped(0, 140)),
}).superRefine((o, ctx) => { if (o.verdict !== 'correct' && !o.fixed.trim()) ctx.addIssue({ code: 'custom', path: ['fixed'], message: 'fixed required' });
                             if (o.verdict === 'correct' && o.edits.length) ctx.addIssue({ code: 'custom', path: ['edits'], message: 'no edits when correct' }); })
```
  `keepEdits` verwirft Stellen, deren `from` nicht wörtlich (Leerraum normalisiert) im Satz steht oder bei denen `from` = `to` (T-R3).
- **Kosten:** nur auf Tipp, derselbe Satz innerhalb 24 h aus dem Zwischenspeicher, Ergebnis zusätzlich in `out/<Monat>`; ≈ 3 KB Prompt, ≈ 0,6 KB Antwort [E].
- **Daten:** `out/<JJJJ-MM>.items[]` mit `k: 'clinic'`; Fehlersätze in `app/repair` mit `src: 'clinic'` (neuer Wert der Union `RepairSrc`, `src/domain/repair/repair.ts:19`; Schema liest `src` als Text) und `pat`.
- **Aufwand:** M (Profil ≈ 1 AP, Klinik ≈ 1,5 AP).
- **Abnahme:** Unit `keepEdits` (erfundene Stelle → weg; `correct` mit Änderungen → ein Neuversuch); E2E Handy 390 px: ein Satz, Ergebnis ohne Querscrollen, Fehlersatz erscheint am nächsten Lerntag in Schritt 4, nicht am selben (`docs/umbau/anwenden-plan.md:13`); Profil-Chips gespeichert in `app/profile.ctx2`, `ctx` unverändert (data-guard).

### T5 Wochen-Diagnose „Was du verwechselst“

**Ohne Claude (immer, deterministisch):** Fortschritt › Grammatik zeigt die Karte **„Häufigste Verwechslungen · 28 Tage“**: bis zu 3 Paare als zwei Muster-Chips mit Pfeil, Zahl („4 ×“) und vier kleinen Wochenbalken; je Paar Knopf „Kontrast-Runde“.

**Mit Claude (einmal pro Woche):** darüber ein Block „Diagnose von Claude“: Überschrift (1 Satz), bis zu 3 Befunde (Titel · was er verwechselt und woran man es erkennt · Merksatz · Knopf), optional „Besser geworden“, „Nächster Schritt“. `AiMark variant="diag"`: „Einschätzung von Claude aus deinen Fehlern der letzten 28 Tage · kann Fehler enthalten“.

**Belege (rein, `src/domain/tutor/confusion.ts`):**
- Quellen: `grammar/<topic>.errors[]` mit `pat`/`cf`, `log/<tag>.entries[]` mit `pat`/`ok` (28 Tage), `app/repair.items[]` mit `pat`, Wort-Verwechslungen aus Log und Karten.
- `cf` entsteht beim Anlegen des Fehlers: (1) die getroffene `WhyRule` hat `pat` (LP2 §3.1), (2) T1 meldet `confused`, (3) bei Auswahl die Muster-Zuordnung der gewählten Option.
- Ergebnis: je Muster `n`, `w`, Trend gegen die 28 Tage davor; je Paar `a → b`, Anzahl, ≤ 2 eigene Sätze; Wort-Paare; Dauerfehler.
- Belegzeilen mit Kennungen, ≤ 6 KB: `[p:mc.wish-past] 9 Versuche, 5 falsch (davor 6 von 8)` · `[cf:mc.wish-past>mc.wish-would] 4×, z. B. „I wish the client sent …“ → „had sent“` · `[w:actual>current] 3×` · `[src:write] 2 Fehler im Muster …`.

**Vorlage `diagnose@1`** (neu)
- `tier: 'complex'` (Urteil über viele Belege, wie `assess@3`), `cache: false`, `verb: 'text-json'` (antwortende Stufe sichtbar, `src/prompts/assess.ts:189-194`).
- Eingabe: `{ lang, evidence: string, ids: string[], allowed: string[], prev: { headline, titles: string[] } | null, today }`. `allowed` lokal gebaut: `contrast:<a>|<b>`, `pattern:<id>`, `words:<id>,<id>`.
- Prompt (Kern): „You are an experienced English teacher for German-speaking business professionals. Judge ONLY from the numbered evidence. Report what the learner SYSTEMATICALLY confuses (at least 3 occurrences, or 2 in different weeks). Each finding cites 1–3 evidence ids in brackets. Give a decision question or rule of thumb in the explanation language. Never invent counts.“
- Ausgabe:
```ts
z.object({
  headline: clipped(10, 120),
  findings: sliced(z.object({
    title: clipped(3, 60),
    why: clipped(10, 240),          // was er verwechselt und woran man es erkennt
    rule: clipped(5, 160),          // Merksatz oder Entscheidungsfrage
    ev: z.preprocess((x) => cleanEv(x, ids), z.array(z.string()).min(1).max(3)),   // assess.ts:78
    action: z.preprocess((a) => cleanAction(a, allowed), z.string().refine((a) => allowed.includes(a))),
  }).superRefine(langOf(['title', 'why', 'rule'], lang)), 1, 3),
  better: z.object({ text: clipped(5, 160), ev: z.preprocess((x) => cleanEv(x, ids), z.array(z.string()).min(1)) }).nullable().catch(null),
  next: clipped(5, 160),
}).superRefine(langOf(['headline', 'next'], lang))
```
- **Auslöser:** Öffnen von Fortschritt › Grammatik oder Rückblick, höchstens einmal je ISO-Woche und nur bei ≥ 12 neuen zugeordneten Fehlern seit der letzten Diagnose (Vorbild `maybeAutoPatterns`, `src/features/patterns/store.ts:209-214`); Knopf „Neu einschätzen“ höchstens einmal am Tag. Die automatische Woche von `patterns@1` entfällt dafür (nur noch Knopf), damit es bei **einem** `complex`-Aufruf je Woche bleibt.
- **Kontrast-Runde:** 8 Aufgaben, A und B abwechselnd, nie 3 gleiche hintereinander, zuerst feste Aufgaben mit `pat`, dann Vorrat; < 3 je Seite → `grammar-items@3` im Kontrast-Modus (Nutzer-Aufruf, Ladeskelett). Jede Erklärung zeigt die Zeile `contrast` (LP2 §3.1). Kontext `xtra`, keine Pflicht. Begründung: Abwechselndes Üben hilft bei ähnlichen Kategorien ([brunmair]).
- **Weiterverwendung:** Befunde werden Belegzeilen `[dx:<a>|<b>]` für `assess@4` (C1P `c1-programm.md:433`).
- **Kosten:** ≤ 1 `complex`-Aufruf je Woche automatisch, Prompt ≈ 4–6 KB, Antwort ≈ 1,5 KB [E].
- **Daten:** `app/patterns.diag[]` (≤ 12 Einträge, §7). `app/patterns.items/history` bleiben unberührt.
- **Aufwand:** L (≈ 3,5 AP; braucht `pat` in Aufgaben und Fehlern aus LP2 P2/P5 und `cf` aus T1).
- **Abnahme:** Unit `confusion.test.ts` mit Seed-Fixtures (Zählung, Fenster 28 Tage an der 04:00-Grenze, Trend, Zeitumstellung 25.10.2026); Unit: erfundene Beleg-Kennung fällt weg, bleibt keine → genau ein Neuversuch; E2E ohne `sample`: Verwechslungs-Karte vollständig, kein Diagnose-Block; mit Testlaufzeit: höchstens ein Aufruf je ISO-Woche (Testuhr); „Kontrast-Runde“ startet 8 Aufgaben im Wechsel.

### T6 Schreibwerkstatt (Laptop)

**Bezug:** C1P plant die Wochen-Mail und die Vorlage `c1-mail@1` (`c1-programm.md:471`, Paket C-P9 `:585`). Hier stehen Bildschirm, Schema und Regeln.

**Bildschirm (Laptop ≥ 1.024 px, Eingabeprofil `keys`):**
- Links: Situationskarte (Gegenüber, Anlass, Ziel; aus Kapitel und `ctx2.sit`), Editor, Wortzähler „146 / 120–180“, **Checkliste** (3 Kapitelmuster, 4 Wendungen; lokal abgehakt beim Tippen über `usesChunk`/Musterregeln), Knopf „Prüfen“ in der Aktionsleiste.
- Rechts: Muster-Panel (LP2 `PatternSheet`).
- Während der Prüfung: „Denkt nach …“, ab dem ersten Text ein Zähler „4 Stellen gefunden …“ (nur Anzeige: Vorkommen von `"from"` im Teiltext über `onPartial`, `src/ai/types.ts:46-47`), ab 45 s „dauert länger als üblich“ + Stopp.
- Ergebnis: Text mit Unterstreichungen (rot = Fehler, gold = Verbesserung); Tipp auf eine Stelle → Glas-Popover mit Grund, Muster, „Als Fehlersatz übernommen“; Ton-Zeile; „C1-Fassung“ aufklappbar mit ▶; „4 Fehlersätze übernommen“; `AiMark variant="edit"` mit „Stelle melden“.
- **Handy:** Anwenden zeigt die Aufgabe als Karte „Am Laptop schreiben“ (T-R10, LP2 L4); kein Editor.

**Vorlage `c1-mail@1`**
- `tier: 'default'` (Kap. 10: Korrekturen), `cache: { gcTime: 86_400_000 }` (gleicher Text, gleiche Korrektur), `priority: 'user'`.
- Eingabe: `{ situation: string (≤ 300), patterns: Array<{ id; name; form }> (≤ 3), phrases: string[] (≤ 4), text: string (≤ 1.800 Zeichen, block() + fenced(), common.ts:60-74), uiLang, ctx: string (≤ 200) }`.
- Prompt (Kern): „First list every error as an atomic edit: copy the exact wrong span from the text into from, write the minimal replacement into to. Only then explain each edit. Keep the learner's words wherever they are correct. Style improvements are sev=upgrade, never error. British spelling is correct; mention US only as upgrade.“ (zweistufig nach [gee], minimal nach [fang]).
- Ausgabe:
```ts
const Edit = z.object({
  from: clipped(1, 120), to: clipped(0, 120),
  kind: z.preprocess(editKind, z.enum(['grammar', 'word', 'collocation', 'register', 'spelling', 'punctuation'])),
  sev: z.preprocess(sevLoose2, z.enum(['error', 'upgrade'])),
  pat: z.string().nullable().catch(null),            // nur Kennungen aus patterns, sonst null
  why: clipped(5, 160),                              // Oberflächensprache
});
z.object({
  edits: z.preprocess(asList, z.array(z.unknown())).transform((xs) => keepEdits(xs, text, patIds, 12)),
  used: z.preprocess(asList, z.array(z.object({ pat: z.string(), ok: z.boolean(), quote: z.string() }))).transform(keepQuoted(text)),
  tone: z.object({ fit: z.enum(['fits', 'too-direct', 'too-informal', 'too-stiff']).catch('fits'), why: clipped(5, 160) }),
  upgraded: clipped(20, 2200),                       // ganze C1-Fassung, US
  summary: clipped(5, 200),
}).superRefine(langOf(['summary'], uiLang))
```
- **Nachbearbeitung (rein, `src/domain/tutor/edits.ts`):** Stellen ohne wörtlichen Treffer fallen weg; `sev: 'error'` und `kind ≠ 'register'` → Fehlersatz: der Satz um die Stelle (Satzgrenzen wie `countSentences`, `tolerant.ts:93`) als `wrong`, mit Ersetzung als `right`, `why`, `pat`, `src: 'write'`; höchstens 5 je Text (Reihenfolge grammar > word > collocation > spelling); mehr als 8 Fehler je 100 Wörter → nur die ersten 5 werden Fehlersätze, der Rest wird nur gezeigt.
- **Kosten:** auf Tipp; Vorschlag einmal je Woche (KT-E5); bis zu 3 Prüfungen je Text (nach Überarbeitung); ≈ 3–4 KB Prompt, ≈ 3–5 KB Antwort, Antwortbeginn 5–60 s (`sample.d.ts:60-62`) [E].
- **Daten:** `out/<JJJJ-MM>.items[]` mit `k: 'c1mail'` (Text ≤ 2 KB, `fb` ≤ 2 KB, wie `src/data/schemas.ts:885-900`); Fehlersätze in `app/repair` (`src: 'write'`, `pat`).
- **Aufwand:** L (≈ 3 AP; Situationen aus C1P `program.json` oder vorab 12 eigene).
- **Abnahme:** Unit `edits.test.ts` (erfundene Stelle → weg, Stil nie Fehlersatz, Deckel 5, Satzgrenzen mit „e.g.“ und Zahlen); E2E 1440 px: Prüfen → Markierungen und Fehlersätze in `app/repair`; 390 px: nur Karte „Am Laptop schreiben“; Text > 1.800 Zeichen nicht absendbar; ohne `sample` keine Schreibwerkstatt-Kachel.

### T7 Sprechen am Laptop (Rollenspiel+)

**Vorhanden:** Figur `roleplay-turn@1` (`quick`), Analyse `turn-analysis@2` (`complex`, Hintergrund), Ziele `goal-check@1`, Bericht `roleplay-report@3`, Fehler → Fehlersätze (`src/features/speak/useRoleplay.ts:193-194`), Spracheingabe mit Schutz gegen gesperrtes Mikrofon (`src/platform/stt.ts:5-11`).

**Neu:**
1. **`turn-analysis@3`:** Fehler bekommen optional `pat` aus der Musterliste des Kapitels (≤ 30 Kennungen im Prompt); sonst unverändert (`src/prompts/threeLayers.ts`). Sprechfehler fließen damit in T5.
2. **„Sag's nochmal“:** Unter einer Analyse mit Fehler ein Knopf; Emrah sagt bzw. tippt seine Aussage neu, **ohne** die Korrektur zu sehen (Selbstkorrektur, [lyster]); `repair-check@1` (vorhanden, `quick`, `src/prompts/repairCheck.ts`) prüft; ✓ schließt die Stelle, keine weitere Buchung.
3. **Kapitelziel** im Szenenstart („2 × abschwächen, 1 × Inversion“), gezählt aus den Werkzeug-Treffern der Analyse (C1P §5).
4. **Laptop-Aufbau:** Gespräch links, Analysespur rechts; Mikrofon-Knopf nur, wenn `stt.ts` ihn freigibt.

- **Ehrlich:** keine Aussprache-Bewertung (Claude bekommt kein Audio, `sample.d.ts:306-321` kennt nur Bilder); Spracheingabe im claude.ai-Rahmen am iPhone ungewiss, deshalb Laptop zuerst.
- **Kosten:** wie heute + 1 `quick`-Aufruf je „Sag's nochmal“.
- **Aufwand:** M (≈ 2 AP). Priorität kann (Sprechen ist freiwillig, A7 04.10.).
- **Abnahme:** Unit `turn-analysis@3` nimmt `pat` nur aus der Liste; E2E: „Sag's nochmal“ → genau 1 Aufruf `repair-check`, Ergebnis ohne Pflichtbuchung.

### T8 Nachfragen und „Mehr davon“

- **„Nachfragen ›“** in jeder Erklär-Karte öffnet das Claude-Blatt (`companion-chat@3`) mit `seeing` = Aufgabe, Urteil, Erklärung (Mechanik vorhanden, `src/prompts/companionChat.ts:58-62`). Vorschläge als Chips: „Noch ein Beispiel“ · „Wann nehme ich das andere?“ · „Prüf mich mit einer Frage“ (eine Frage zur Zeit, `companionChat.ts:51`). Am Laptop in der rechten Spalte, am Handy als Blatt.
- **„Mehr davon ›“** startet `grammar-items@3` mit `count: 5` für dieses Muster als Nutzer-Aufruf; danach eine Mini-Runde mit 5 Aufgaben (Kontext `xtra`) im selben Gerüst; die Aufgaben landen im Vorrat. Fallen < 3 durch die Prüfung: „Claude hat diesmal keine brauchbaren Aufgaben geliefert. Hier sind 3 aus dem festen Bestand.“
- `claude-drill@1` (Übung aus einem Chat, `src/prompts/nb/p6/claudeDrill.ts`) bleibt.
- **Aufwand:** S (≈ 1 AP). **Abnahme:** E2E: „Nachfragen“ öffnet das Blatt mit „sieht gerade: …“; „Mehr davon“ → 1 Erzeugung + 1 Löser-Probe, Mini-Runde mit `AiMark`.

## 5 Verbrauch an einem typischen Tag [E]

| Funktion | Auslöser | Stufe | Anfragen (typisch / Deckel) | Prompt | Antwort |
|---|---|---|---|---|---|
| T1 `explain-answer@1` | Tipp | quick | 2 / – | 1,5–3 KB | 0,5–0,8 KB |
| T2 `grammar-items@3` | Rundenende | default | 1 / 2 | 3–5 KB | 3–5 KB |
| T2 `solve-check@1` | nach T2 | quick | 1 / 2 | 1–2 KB | 0,3 KB |
| T3 `word-ctx@1` | Wörter-Rundenende | quick | 0,5 / 1 | 1,5 KB | 2 KB |
| T4 `sentence-clinic@1` | Tipp | quick | 1 / – | ≈ 3 KB | 0,6 KB |
| T5 `diagnose@1` | Fortschritt, 1 × Woche | complex | 0,15 / 1 je Woche | 4–6 KB | 1,5 KB |
| T6 `c1-mail@1` | Tipp | default | 0,3 / – | 3–4 KB | 3–5 KB |
| T8 „Mehr davon“ | Tipp | default + quick | 0,3 / – | wie T2 | wie T2 |

Hintergrund zusammen ≤ 5 Anfragen am Tag je Gerät. Bisherige Aufrufe (Wortpartner beim ersten Aufdecken, Satzbau-Vorrat, Einschätzung höchstens alle 3 Tage, Wochenbericht) bleiben. Alles liegt weit unter 64 KiB je Eingabe (`sample.d.ts:133`).

## 6 Fehlerzustände (für alle Tutor-Funktionen gleich)

| Art (`src/ai/errors.ts:9-29`) | Codes | Nutzer-Aufruf (Tipp) | Hintergrund |
|---|---|---|---|
| `unavailable` | `not_granted`, `sampling_disabled`, `not_declared`, `capability_*` | Knopf verschwindet für diese Ansicht (`markSampleRevoked`) | kein Aufruf mehr |
| `busy` | `rate_limited`, lokale Grenze, `budget`, `no_consent_yet` | „Claude ist gerade ausgelastet. In einer Minute wieder.“ Knopf aus bis `pausedUntil` (`status.ts:8`) | still; nächster Auslöser frühestens nach Abstand |
| `signin` | `session_expired` | „Bitte in claude.ai neu anmelden.“ | still |
| `refused` | `refused` | „Dazu kann Claude nichts sagen.“ ohne „Erneut“; Teiltext weg (`sample.d.ts:595-598`) | still |
| `empty` | `empty_completion` | „Keine Antwort erhalten.“ + „Erneut versuchen“ | still |
| `invalid` | `invalid_json`, Schemafehler nach dem einen Neuversuch | „Die Antwort war unvollständig.“ + „Erneut versuchen“ (frisch, `gate.ts:71-83`) | still, Zähler `gen` ohne `acc` |
| `too_large`, `bug` | `prompt_too_large`, `invalid_request` … | „Das ging schief. Steht im Protokoll.“ + `logError` | `logError` |
| `failed` | `upstream_error`, unbekannt | Teiltext bleibt, „unterbrochen“ + „Erneut versuchen“ | still |
| `cancelled` | Stopp, Bildschirmwechsel | nichts | nichts |
| Phase `slow` | – | „dauert länger als üblich“ + Stopp, kein Abbruch (A6.2) | – |
| formale Prüfung lehnt alles ab | – | fester Ersatz mit einer Zeile Hinweis (T8) | nichts gespeichert, kein Neuversuch |

Immer: Die feste Erklärung und die festen Aufgaben bleiben sichtbar; ein Fehler von Claude macht nie eine Übung unbedienbar (T-R7).

## 7 Daten (nur ergänzend, keine neue Sammlung, kein neues Dokument)

| Feld (neu, optional) | Ort | Form | Grenze | Schreibt |
|---|---|---|---|---|
| `ax` | `grammar/<topic>.errors[i]` | `{g, y?: Bi, w?: Bi, ex?: {en, de}, sig?: string[], cf?: string, alt?: 1, pv: 'explain-answer@1', t, bad?: 1}` | ≤ 1 KB; ≤ 10 Einträge je Thema (`src/domain/grammar/errors.ts:20`) → ≤ 10 KB je Dokument | T1 |
| `cf` | `grammar/<topic>.errors[i]` | Muster-Kennung (≤ 40) | – | T1, LP2-Fehlerweg |
| `src: 'ai'`, `pat` | `grammar/<topic>.errors[i]` | Text | – | T2 (LP2 `pat`) |
| `pat`, `cf`, `ai` | `log/<tag>.entries[i]` | Text / `1` | – | T1, T2 |
| `k: 'aiflag'` | `log/<tag>.entries[i]` | `{k, m, q, id}` | – | T0 |
| `axs[]` | `vocab/<id>` | wie `ax`, ≤ 3 | ≤ 3 KB | T1 |
| `wx[]` | `vocab/<id>` | `{en, de, sit, t, pv, bad?}` ≤ 4 | ≤ 1,5 KB | T3 |
| `cfx[]` | `vocab/<id>` | `{w, en, why: Bi, t, pv, bad?}` ≤ 2 | ≤ 1 KB | T3 |
| `pat`, `why`, `gen`, `ai`, `sit`, `t` | `app/pool.items[i]` | wie LP2 `TaskWhy` | ≤ 30 Claude-Aufgaben × ≈ 0,7 KB ≈ 21 KB; Vorrat gesamt ≤ 90 (`src/domain/grammar/pool.ts:16`) | T2 |
| `bad` | `app/pool` | `string[]` (Aufgabenschlüssel), Ring ≤ 300 | ≈ 15 KB | T0 |
| `ctx2` | `app/profile` | `{v: 1, role, field, who: string[≤6], sit: string[≤6], terms: string[≤12], t}` | ≤ 1 KB | T4 |
| `diag[]` | `app/patterns` | `{w, t, pv, lang, rep, out, bad?: number[]}` ≤ 12 | ≈ 24 KB | T5 |
| `k: 'clinic'`, `k: 'c1mail'` | `out/<JJJJ-MM>.items[]` | `text` ≤ 2 KB, `fb` ≤ 2 KB | ≤ 400 Einträge je Monat (Schema-Kommentar `schemas.ts:884`) | T4, T6 |
| `src: 'clinic'`, `pat` | `app/repair.items[i]` | Text | Deckel 150 Einträge / 200 KiB bleibt (`repair.ts:14`, `:97`); **kein** `ax` hier | T4, T6, T7 |

**Regeln:** Lesen mit `looseObject` und optionalen Feldern (A6.16), Schreiben nur über `writer.transform` und nur bei Änderung (Kap. 3.4). Melden setzt `bad`, löscht nie. Ältere App-Versionen ignorieren die neuen Felder. **Dokumentzahl:** +0. data-guard prüft T0, T1, T2, T4, T5 vor dem Zusammenführen.

## 8 Was in einem Artefakt nicht geht (ehrlich) und was stattdessen

| Wunsch | Warum nicht | Stattdessen |
|---|---|---|
| Video-Lehrer oder Avatar | 1 Minute 720p ≈ 11–19 MB (`c1-programm.md` §6) > 16-MB-Grenze; Laden von außen blockiert (Kap. 3.1, A6.8) | Tutor-Karte mit Bewegung (Erklär-Karte gleitet auf, Signalwort-Leuchten ≤ 300 ms), Struktur-Filme aus C1P §6, Sprachausgabe für Beispiele |
| Aussprache bewerten | `sample` nimmt nur Text und Bilder (`sample.d.ts:306-321`); keine externen Sprachdienste (A7 29.09.) | Sprechen als Text-Analyse; Aussprache mit dem Preply-Lehrer |
| Sprach-Dialog in Echtzeit am iPhone | Spracheingabe im claude.ai-Rahmen ungewiss (`stt.ts:5-11`); WebKit hier nicht testbar | Laptop zuerst; am iPhone tippen; Figur auf `quick` (1–2 s) |
| Tutor erinnert dich von selbst | keine Push-Nachrichten, keine Hintergrund-Jobs ohne geöffnete App (Kap. 3.1) | Tutor arbeitet nach deinen Handlungen; Erinnerung bleibt beim externen Tagesauftrag (pausiert) |
| Tutor merkt sich alles | `sample` hat kein Gedächtnis (`sample.d.ts:21-27`) | die App gibt jedes Mal mit: Berufsprofil, Muster, deine Fehler, gemerkte Fakten (`app/memory`, `src/prompts/work.ts:22-37`) |
| immer das stärkste Modell | der Plan kann eine kleinere Stufe liefern (`sample.d.ts:330-335`) | Protokoll `tier_substituted` (`gate.ts:263`), Anzeige nur in der Diagnose |
| Qualität automatisch messen | keine Telemetrie, kein `sample` in der Cloud-Umgebung | Qualitätszähler, „Melden“, KI-Stichprobe als Datei über `downloads` |

## 9 Arbeitspakete und Reihenfolge

| Paket | Inhalt | hängt ab von | Aufwand | Test-Link |
|---|---|---|---|---|
| KT-0 | Tutor-Schicht (§3) | – | M | A |
| KT-1 | T1 Erklär mir meine Antwort | LP2 P1 (Gerüst, Menü), P2 (Muster); ohne P2 auf Themenebene | M | A |
| KT-4 | T4 Berufsprofil + Satz-Klinik | KT-0 | M | A |
| KT-2 | T2 Adaptive Grammatik + Löser-Probe | LP2 P2 (`pat`), P5 (Runde); KT-0 | L | B |
| KT-5 | T5 Verwechslungen + Diagnose + Kontrast-Runde | KT-1 (`cf`), LP2 P2/P5 | L | B |
| KT-8 | T8 Nachfragen, Mehr davon | KT-1, KT-2 | S | B |
| KT-3 | T3 Wörter | LP2 P6 | M | C |
| KT-6 | T6 Schreibwerkstatt | KT-0, C1P C-P9 (Situationen) | L | C |
| KT-7 | T7 Sprechen+ | KT-0 | M | C |

Aufwand: S ≤ 1 AP, M ≈ 1,5–2 AP, L ≈ 3–4 AP (AP ≈ 2–4 h, wie `gesamtkonzept.md:187`). Summe ≈ 19 AP [E]. Prüfer je Test-Link (A2/A5): learning-scientist über alle neuen Prompts, data-guard (§7), platform-guard, ux-reviewer (Erklär-Karte, Satz-Klinik 390 px, Schreibwerkstatt 1440 px), english-teacher über die erste KI-Stichprobe nach einer Woche auf dem Test-Link. Je Prüfer eine Prüfung und eine gezielte Nachprüfung, danach entscheidet Emrah. Live nur mit „Ja live nehmen“.

## 10 Abnahme gesamt (Definition of Done für den KI-Tutor)

1. **Ohne KI vollständig:** Mit `?fake=nosample` sind alle Pflichten erfüllbar, kein Tutor-Knopf ist sichtbar, die Verwechslungs-Karte (T5) erscheint trotzdem (E2E).
2. **Kein Selbstlauf:** Jeder `sample`-Aufruf geht auf einen Tipp oder ein Rundenende zurück (Grep-Test: kein Aufruf aus Timer, Render oder Snapshot-Rückruf); Hintergrund-Aufrufe erst nach `sampleConfirmed`; Tagesdeckel greift (Unit).
3. **A6.2/A6.3:** kein eigener Abbruch-Timer; `invalid_json` → 1 Aufruf; Schemafehler → genau 2; Einzelprüfung abgelehnt → kein weiterer Aufruf (E2E-Zähler der Testlaufzeit).
4. **Kennzeichnung:** Jeder Inhalt mit `ai: true` zeigt `AiMark`; „Melden“ blendet aus und setzt `bad`, löscht nichts (E2E + data-guard).
5. **Urteil bleibt bei der App:** `alsoRight` ändert ohne Tipp auf „Ich lag richtig“ weder Note noch Log (Unit + E2E).
6. **Messung sauber:** Einstufung, C1-Check, Meilenstein und Wochen-Check enthalten nie `src: 'ai'`; Claude-Aufgaben buchen weder BKT noch `pats` (Unit).
7. **Daten:** nur Felder aus §7, Dokumentzahl unverändert, Grenzen eingehalten (Unit mit Höchstwerten).
8. **Plattform:** jede Vorlage < 8 KB bei Höchstwerten; `check:platform` grün; Bundle wächst um höchstens 100 KB [E: nur Code, keine Inhalte].
9. **Qualität nach einer Woche Test-Link:** Anteil gemeldeter Claude-Inhalte an gezeigten ≤ 5 %; in der KI-Stichprobe (30 Inhalte) höchstens 2 harte Fehler (falsche Lösung, zwei richtige Antworten, falsche Erklärung), sonst wird die betroffene Vorlage nachgeschärft (Maßstab wie `02-lehrplan.md:25`, aber für Laufzeit-Inhalte).
10. **Sprachtreue:** Erklärungen in DE und EN wechseln mit der Oberflächensprache ohne neuen Aufruf (E2E).

## 11 Risiken

- **Claude lehrt Falsches.** Ein-Schritt-Erklärungen sind nur zu ≈ 60 % vollständig richtig [gee]; erzeugte Optionen sind oft mehrdeutig [vocatt]. Gegenmittel: lokale Abweichung statt Fehlersuche (T-R3), formale Prüfung + Löser-Probe, Kennzeichnung, Melden, höchstens 2 Claude-Aufgaben je Pflichtrunde, nie in Messungen, KI-Stichprobe.
- **Kontingent.** Jeder Aufruf kostet Emrahs Claude-Nutzung (`sample.d.ts:44-47`). Gegenmittel: Tagesdeckel, `quick` wo möglich, Speichern in `db`, Zwischenspeicher 24 h bei gleichen Eingaben.
- **Zustimmungsdialog zur falschen Zeit.** Gegenmittel: `sampleConfirmed` (T0); derselbe Schutz für `prefetchOrder` (Befund §0 Nr. 6).
- **Zu viel Hilfe macht bequem** [bastani]. Gegenmittel: T-R1, Selbstkorrektur nach jeder Erklärung, Erklärung kürzer, je sicherer das Muster (LP2 Erklär-Tiefe).
- **Abhängigkeit von LP2.** T2 und T5 brauchen `pat` in Aufgaben und Fehlern. Ohne LP2 P2 laufen T1 und T2 auf Themenebene; T5 zeigt dann Themen statt Muster.
- **Eingeschleuste Anweisungen** in eigenen Texten (Satz-Klinik, Schreibwerkstatt): Text im Block (`fenced`, `common.ts:74`), keine `tools`, Ausgabe per zod, Stellen nur als wörtliche Ausschnitte.
- **Fehlerlast wächst.** Mehr Fehlersätze durch Klinik, Schreibwerkstatt und Claude-Aufgaben. Gegenmittel: Deckel je Quelle (2 / 5 / 1 je Aufgabe), Schritt 4 bleibt bei höchstens 5 am Tag (LP2 L2).
- **Nur ein Lerner, kein Vergleich.** Ob adaptive Aufgaben Fehler schneller „fest“ machen, lässt sich nicht kausal zeigen. Gemessen wird nur plausibel: Anteil fester Fehlersätze in Mustern mit und ohne Claude-Varianten über 8 Wochen (Fortschritt › Messwerte dahinter).

## 12 Quellen

| Kürzel | Inhalt | Status |
|---|---|---|
| duo-max | Duolingo-Blog: Duolingo Max (Explain My Answer, Roleplay, Prüfung durch Fachleute, Melden per langem Drücken) | G |
| duo-tl | Tech & Learning: Interview mit dem Produktmanager von Duolingo Max | S |
| gee | Song u. a.: GEE! Grammar Error Explanation with Large Language Models, Findings of NAACL 2024 | G (Abstract) |
| fang | Fang u. a.: Is ChatGPT a Highly Fluent Grammatical Error Correction System?, 2023 | S |
| vocatt | Automated Generation of Multiple-Choice Cloze Questions for Assessing English Vocabulary Using GPT-turbo 3.5, 2023 | G (Abstract) |
| bastani | Bastani u. a.: Generative AI without guardrails can harm learning, PNAS 2025 | S |
| bastani-w | Wharton: Without guardrails, generative AI can harm education | S |
| khan | Khan Academy: 7-Step Approach to Prompt Engineering for Khanmigo | S |
| lyster | Lyster & Saito 2010: Oral feedback in classroom SLA: A meta-analysis, SSLA 32 | S |
| li | Li 2010: The effectiveness of corrective feedback in SLA: A meta-analysis, Language Learning 60 | S |
| kanghan | Kang & Han 2015: The efficacy of written corrective feedback in improving L2 written accuracy, MLJ 99 | S |
| brunmair | Brunmair & Richter 2019: Similarity matters: A meta-analysis of interleaved learning and its moderators, Psychological Bulletin | G (Abstract) |

[duo-max]: https://blog.duolingo.com/duolingo-max/
[duo-tl]: https://techlearning.com/how-to/what-is-duolingo-max-the-gpt-4-powered-learning-tool-explained-by-the-apps-product-manager
[gee]: https://arxiv.org/abs/2311.09517
[fang]: https://arxiv.org/abs/2304.01746
[vocatt]: https://arxiv.org/abs/2403.02078
[bastani]: https://ideas.repec.org/a/nas/journl/v122y2025pe2422633122.html
[bastani-w]: https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education
[khan]: https://blog.khanacademy.org/khan-academys-7-step-approach-to-prompt-engineering-for-khanmigo
[lyster]: https://www.cambridge.org/core/product/4999EE1C8379B2BF026B148EAF373CA1
[li]: https://escholarship.mcgill.ca/downloads/6w924g64b
[kanghan]: https://scinapse.io/papers/2005247852
[brunmair]: https://www.psychologie.uni-wuerzburg.de/fileadmin/06020400/2019/Brunmair_Richter_in_press__2019_META-ANALYSIS_OF_INTERLEAVED_LEARNING.pdf
