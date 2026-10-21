# Wort-Werkstatt – Prüfvorlage für den Englischlehrer (Wort-Lernen 2, Teil 2)

Stand 21.10.2026, Zweig `claude/umbau-wort-werkstatt`. Diese Datei sammelt alles **Neue, das Emrah liest oder hört** und jede **neue Anweisung an Claude**, damit `english-teacher` es in einem Durchgang gegenlesen kann. Plan: `docs/umbau/wort-fest-plan.md`. Bitte je Abschnitt mit „passt“ oder einem konkreten Änderungsvorschlag antworten.

## 1. Wann ein Wort in die Werkstatt kommt (Code, `src/domain/srs/werkstatt.ts`)

- Auslöser seit der letzten Werkstatt: **3 freie Fehlversuche** (Tippen ohne Hilfe, Lücke frei, „Sag es“ zählt nur geprüft) **oder Fehler an 2 verschiedenen Lerntagen innerhalb von 14 Tagen**. Der Einführungstag zählt nie. Partnerwort-Fehler und „Welches Wort passt?“ zählen nicht.
- Höchstens **2 Werkstatt-Wörter je Lerntag**. Danach **2–3 Tage Ruhe**.
- Die Werkstatt **ersetzt** die Wiederholung (keine zusätzliche Pflichtaufgabe).
- Ab **6 Vergessen**: Angebot „Wort pausieren“ (ausblenden, nichts gelöscht).
- Nach **3 Werkstatt-Runden**: Frage „Brauchst du dieses Wort wirklich?“.
- Ablauf der Karte: Diagnose → Gegenüberstellung „Deutsch denkt … → Englisch sagt …“ → bei Wendungen die Teile, Kern zuerst → Satz → Merkhilfe (eigene zuerst, dann zwei Vorschläge von Claude) → „Jetzt abrufen“ (ein Abruf mit Anfangsbuchstaben bzw. Bausteinen, keine Aufdeckkarte).

Frage an den Lehrer: Sind 3 freie Fehlversuche / 2 Fehlertage in 14 Tagen eine sinnvolle Schwelle für B2 → C1?

## 2. Texte der Werkstatt-Karte (DE / EN)

| Schlüssel | Deutsch | Englisch |
|---|---|---|
| pxWwKind | Wort-Werkstatt | Word workshop |
| pxWwTitle | Dieses Wort verankern wir neu | Let's anchor this word again |
| pxWwPurpose | Das Wort ist zuletzt mehrmals nicht hängen geblieben. Öfter abfragen hilft hier wenig – wir schauen, woran es liegt, und geben ihm einen neuen Anker. | This word hasn't stuck the last few times. Asking it more often won't help much here – we look at what goes wrong and give it a new anchor. |
| pxWwDiagLabel | Woran es hakt | What gets in the way |
| pxWwDiag_confusion | Du verwechselst es mit „{other}“. Beide stehen hier nebeneinander. | You mix it up with "{other}". Here they are side by side. |
| pxWwDiag_false_friend | Das Deutsche lockt hier auf eine falsche Spur. | German leads you down the wrong path here. |
| pxWwDiag_partner | Das Wort selbst sitzt, aber das Partnerwort nicht. | The word itself is fine, but its partner word is not yet. |
| pxWwDiag_form | Die Bedeutung sitzt, die Schreibung noch nicht. | You know the meaning, but not yet the spelling. |
| pxWwDiag_sound | Beim Hören erkennst du es noch nicht sicher. | You don't recognize it reliably by ear yet. |
| pxWwDiag_meaning | Die Bedeutung ist noch nicht fest mit dem Wort verbunden. | The meaning isn't firmly tied to the word yet. |
| pxWwWrong | Zuletzt getippt: {wrong} | Last typed: {wrong} |
| pxWwContrastLabel | Deutsch denkt … → Englisch sagt … | German thinks … → English says … |
| pxWwThink / pxWwSay | Deutsch denkt / Englisch sagt | German thinks / English says |
| pxWwPartsLabel | In Teilen, der Kern zuerst | In parts, core first |
| pxWwSentenceLabel | Im Satz | In a sentence |
| pxWwRecall | Jetzt abrufen | Recall it now |
| pxWwRest | Danach hat das Wort 2–3 Tage Ruhe. | After this, the word gets 2–3 days of rest. |
| pxWwPause | Wort pausieren | Pause word |
| pxWwPauseHint | Du hast es {n}-mal vergessen. Pausieren blendet es aus, gelöscht wird nichts. In der Wortliste holst du es jederzeit zurück. | You've forgotten it {n} times. Pausing hides it; nothing is deleted. You can bring it back any time from the word list. |
| pxWwNeedQ | Brauchst du dieses Wort wirklich? | Do you really need this word? |
| pxWwNeedHint | Es war schon {n}-mal in der Werkstatt. Wenn du es im Alltag kaum brauchst, darf es ruhen. | It's been in the workshop {n} times already. If you rarely need it in daily life, it can rest. |
| pxWwNeedYes / pxWwNeedNo | Ja, weiter üben / Nein, ausblenden | Yes, keep practicing / No, hide it |
| pxWwPaused | „{word}“ ruht jetzt. In der Wortliste kannst du es wieder einblenden. | "{word}" is resting now. You can show it again in the word list. |

**Gegenüberstellung „Deutsch denkt … → Englisch sagt …“** (`contrastLines`): Die Zeilen kommen ausschließlich aus vorhandenen, bereits geprüften Daten, Claude schreibt hier nichts.
- Verwechslung: eigene Zeile (Bedeutung → Wort) und die Zeile des verwechselten eigenen Wortes, z. B. „nutzen → leverage“ / „beeinflussen → influence“.
- Deutsch-Falle: falscher und richtiger Satz aus der geprüften Fallen-Liste (`src/content/nb/traps`).
- Sonst nur die eigene Zeile.

Frage an den Lehrer: Ist die Zeile „Deutsch denkt: nutzen → Englisch sagt: leverage“ als Anker hilfreich, oder lieber mit Kollokation?

## 3. Merkhilfe

| Schlüssel | Deutsch | Englisch |
|---|---|---|
| pxWwMemoLabel | Merkhilfe | Memory aid |
| pxWwMemoOwnLabel | Deine eigene Merkhilfe | Your own memory aid |
| pxWwMemoOwnPh | Eigene Eselsbrücke schreiben … | Write your own memory hook … |
| pxWwMemoSave | Speichern | Save |
| pxWwMemoSaved | Gespeichert. Deine Merkhilfe steht ab jetzt an erster Stelle. | Saved. Your memory aid now comes first. |
| pxWwMemoSaveFailed | Konnte nicht gespeichert werden. Bitte versuch es noch einmal. | Couldn't save. Please try again. |
| pxWwMemoIdeas | Vorschläge von Claude | Ideas from Claude |
| pxWwMemoKeyword / pxWwMemoScene | Schlüsselwort / Bild im Kopf | Keyword / Mental picture |
| pxWwMemoPick / pxWwMemoChosen | Diese nehmen / Gewählt | Use this one / Chosen |
| pxWwMemoAsk | Vorschläge holen | Get ideas |
| pxWwMemoLoading | Claude denkt sich zwei Merkhilfen aus … | Claude is coming up with two memory aids … |
| pxWwMemoNoAi | Ohne Claude gibt es keine Vorschläge. Eine eigene Merkhilfe hilft oft am meisten. | Without Claude there are no ideas. Your own memory aid often helps most. |
| pxWwMemoBudget | Für heute sind die Tutor-Anfragen aufgebraucht. Schreib gern deine eigene Merkhilfe. | Today's tutor requests are used up. Feel free to write your own memory aid. |
| pxWwMemoFailed | Die Vorschläge kamen nicht an. | The ideas didn't come through. |
| pxWwMemoCurrent | Gespeicherte Merkhilfe | Saved memory aid |

### Neue Vorlage `mnemonic-options@1` (`src/prompts/mnemonicOptions.ts`, Stufe `quick`, 24 h zwischengespeichert)

Wird gebündelt mit höchstens 2 Wörtern je Aufruf gestellt. Automatisch nur nach einem schon beantworteten Nutzeraufruf und innerhalb der Tutor-Tagesbremse, sonst per Knopf. Eine Antwort, die das Schema verletzt, wird höchstens einmal repariert. Wortlaut der Anweisung:

```
A German-speaking business professional (CEFR B2, aiming for C1) keeps forgetting these English words. Write TWO different memory aids per word.
Learner work context: <Berufsprofil, ≤ 300 Zeichen> | (none, use general business life)
Language of the memory aids: <German|English>
Words:
- id=… | word=… | meaning=… | card sentence=… | problem=<mixes it up with another English word | falls into a German false friend | forgets its typical partner word | misspells it | does not recognize it when hearing it | does not recall the meaning> [| typed or confused with=…]
Reply with only one JSON object, no other text, exactly this shape: {"items":[{"id":"v_leverage","options":["…","…"]}]}
Rules:
- One item per word, with the same id. options: exactly 2 strings, each one or two short sentences (max. 35 words), in the language given above.
- Option 1 (keyword): link the sound or spelling of the English word to a German word or a vivid image that leads to the meaning.
- Option 2 (scene): a short scene from the learner work context in which the word is used with its meaning; it may contain one short English phrase with the word.
- Each option mentions the English word exactly once. If the problem is a confusion or a false friend, make the difference to the other word clear.
- No lists, no quotes around the whole text, American English for English words.
```

Das Schema prüft:
- jede Option ist 12–220 Zeichen lang;
- der Wortanfang kommt vor;
- die Sprache stimmt mit der Oberflächensprache überein;
- die beiden Optionen sind verschieden;
- die id ist bekannt.

Beispiel im Prompt (DE): „leverage klingt wie Hebel-Ritsch: Du setzt einen Hebel an und nutzt die Kraft, die schon da ist.“ / „Im Verkaufsgespräch: Du nutzt (leverage) die guten Zahlen des letzten Quartals wie einen Hebel für den besseren Preis.“

Fragen an den Lehrer:
1. Ist das Beispiel „Hebel-Ritsch“ zu albern für Premium-Anmutung? Gibt es einen besseren Beispiel-Anker?
2. Fehlt eine Regel, z. B. „no invented false etymology“?

## 4. Klang

| Schlüssel | Deutsch | Englisch |
|---|---|---|
| pxWwSayAloud | Sag es einmal laut | Say it out loud once |
| pxWwSayAloudHint | Freiwillig, wird nicht bewertet. Laut Gesprochenes bleibt besser hängen. | Optional and not graded. Saying it out loud helps it stick. |
| pxWwSayAloudDone | Laut gesagt | Said out loud |
| pxWwSpeakNewSetting | Neue Wörter beim Kennenlernen einmal vorlesen | Read new words aloud once when you first meet them |

- Die Einführungskarte liest Wort und Satz einmal vor. Das passiert nur nach einer Berührung und nur, wenn der Schalter an ist.
- Höraufgaben gibt es jetzt auch am Handy, sobald die Sprachausgabe bereitsteht. Ohne Sprachausgabe gibt es keine Höraufgabe.

## 5. Neue Übung „Sag es“ (`say_it`, ab 2 freien Abruftagen, Stufe 4/5)

Emrah sieht die **deutsche Absicht** und sagt den Satz auf Englisch. Am Handy nutzt er dafür die Diktiertaste der Tastatur; die App greift nie selbst aufs Mikrofon.
- Die deutsche Absicht ist die gespeicherte deutsche Übersetzung des Kartensatzes. Fehlt sie, steht nur die Bedeutung da.
- Die App prüft ohne Claude nur, ob das Zielwort (auch gebeugt) bzw. die Wendung vorkommt und ob der Satz mindestens 3 Wörter hat.
- Fehlt das Zielwort, gibt es „Schwer“ und den Vermerk ungeprüft, aber keinen Rückfall.
- Danach wird der englische Mustersatz gezeigt.

| Schlüssel | Deutsch | Englisch |
|---|---|---|
| exName_say_it | Sag es | Say it |
| pxWwSayItIntent | Das willst du sagen | What you want to say |
| pxWwSayItPlaceholder | Dein englischer Satz … | Your English sentence … |
| pxWwSayItModel | So könnte man es sagen | One way to say it |
| pxWwSayItFound | „{word}“ ist in deinem Satz. | "{word}" is in your sentence. |
| pxWwSayItMissing | „{word}“ fehlt noch in deinem Satz. | "{word}" is still missing from your sentence. |
| pxWwSayItShort | Sag einen ganzen Satz (mindestens drei Wörter). | Say a whole sentence (at least three words). |
| pxWwSayItUnverified | Ob der ganze Satz stimmt, prüft hier niemand. Vergleich ihn mit dem Mustersatz. | Nobody checks the whole sentence here. Compare it with the model sentence. |

Frage an den Lehrer: Reicht „Zielwort vorhanden + 3 Wörter“ als Wertung „Gut“, wenn der Rest des Satzes ungeprüft bleibt? (Die Alternative wäre eine Claude-Prüfung je Satz; das kostet die Tutor-Bremse.)

## 6. Freiwillige Angebote im Reiter „Wörter“ (Gruppe „Wenn du magst“)

| Schlüssel | Deutsch | Englisch |
|---|---|---|
| pxWwOffersLabel | Wenn du magst | If you like |
| pxWwEveningTitle | Abend-Check | Evening check |
| pxWwEveningLead | Die {n} Wörter von heute noch einmal frei aus dem Kopf. Etwa 2 Minuten. | Today's {n} words once more, from memory. About 2 minutes. |
| pxWwSayOwnTitle | Sag es selbst | Say it yourself |
| pxWwSayOwnLead | Zwei Wörter von gestern oder vorgestern in eigenen Sätzen. Claude schaut drüber. 2–3 Minuten. | Two words from yesterday or the day before in your own sentences. Claude takes a look. 2–3 minutes. |
| pxWwSayOwnScene | Situation | Situation |
| pxWwSayOwnTask | Sag einen Satz mit „{word}“ ({meaning}). | Say a sentence with "{word}" ({meaning}). |
| pxWwSayOwnPh | Dein Satz mit „{word}“ … | Your sentence with "{word}" … |
| pxWwSayOwnCheck | Prüfen lassen | Have it checked |
| pxWwSayOwn_correct / _minor / _wrong | Passt / Fast / Noch nicht | Good / Almost / Not yet |
| pxWwSayOwnBetter | Besser so | Better like this |
| pxWwSayOwnNext / pxWwSayOwnDone | Nächstes Wort / Fertig | Next word / Done |
| pxWwSayOwnNoAi | Ohne Claude gibt es diese Übung gerade nicht. | This exercise isn't available without Claude right now. |
| pxWwSayOwnBudget | Für heute sind die Tutor-Anfragen aufgebraucht. Morgen geht es wieder. | Today's tutor requests are used up. It works again tomorrow. |
| pxWwSayOwnExtra | Zählt als Extra, nicht zur Pflicht. | Counts as extra, not toward your daily goal. |

- **Abend-Check:** die heute eingeführten Wörter (höchstens 8), nur freies Tippen ohne Anfangsbuchstaben. Er zählt als Extra.
- **Sag es selbst:** Die Prüfung nutzt die **bestehende, schon geprüfte** Vorlage `activate-check@1` im Format `sc` (Mini-Szene) mit genau einem gezeigten Zielwort. Gespeichert wird nichts.
- Die Szene (englisch, höchstens 160 Zeichen) kommt aus dem Berufsprofil, reihum je Situation:
  - mit Profil und Situation: `At work (Sales manager in software): negotiation`
  - mit Profil ohne Situation: `At work as Controller`
  - ohne Profil: `At work: a normal day at the office`

Frage an den Lehrer: Klingt „At work (Sales manager in software): negotiation“ als Szenenzeile natürlich genug, oder lieber „You are a sales manager in software. Situation: a negotiation.“?

## 7. Berufsprofil in den Satzanfragen

- In den Einstellungen sind 5 Situationen wählbar (bisher 3 in der Anfrage). Alle 5 gehen über `tutorCtx()` in jede Satzanfrage: `word-bank@1`, `mnemonic-options@1` und „Sag es selbst“.
- **`card-examples@4`** (neu, vorher @3) hat zwei zusätzliche Zeilen, nur wenn ein Profil da ist:
  ```
  Learner work context: <≤ 300 Zeichen>
  - When it fits the meaning naturally, set at least two sentences in the learner work context above (role, industry, situations). Never bend the meaning of the word to fit it.
  ```
- **Vorprüfung der Satzbank** (vor der bestehenden 4-Wochen-Quarantäne, `preCheck`): Ein Satz fällt weg,
  - wenn das Wort nicht in der Wortart der Karte steht (`sense`, z. B. Verb „to record“ für das Hauptwort „record“), oder
  - wenn die Lücke nicht eindeutig ist (`gap`, z. B. ist das Wort ein zweites Mal sichtbar oder nur ein Wortteil).

Frage an den Lehrer: Ist die Zusatzregel in `card-examples@4` richtig formuliert, damit die Sätze nicht künstlich in den Beruf gebogen werden?

## 8. Was bewusst nicht geändert wurde
Unverändert bleiben:
- Pflicht, Serie, Tagesziel und Planversion;
- der FSRS-Kern, die Tagesbremse und die Barcroft-Grenze (Aktivierung und „Sag es“ erst ab 2 freien Tagen);
- mindestens 2 neue Wörter je Tag;
- die Quarantäne der Satzbank.
