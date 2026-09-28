# Prüfung der P7a-Inhalte (Englischlehrer, 28.09.2026, eine Runde)

**Status:** vom Integrator angenommen. Muss-Befunde vor der Freigabe umsetzen, Sollte-Befunde soweit bis 02:45 UTC machbar, Rest Paket B.

## Prüfung der Lerninhalte in `src/content/nb/`: Ergebnis

Ich habe eine Runde geprüft und nichts geändert. Geprüft wurden:

- /home/user/lingo-engine-x/src/content/nb/themes.ts
- /home/user/lingo-engine-x/src/content/nb/traps.ts
- /home/user/lingo-engine-x/src/content/nb/texts.json
- /home/user/lingo-engine-x/src/content/nb/collocations.json
- /home/user/lingo-engine-x/src/content/nb/transforms.json
- /home/user/lingo-engine-x/src/content/nb/objections.json
- /home/user/lingo-engine-x/src/content/nb/inbox.json
- /home/user/lingo-engine-x/src/content/nb/scenes.json
- /home/user/lingo-engine-x/src/content/nb/extras.json

**Was gut ist:** Die Inhalte sind sehr nah an Emrahs Beruf (E-Rechnung, GoBD, Einkauf, Partner). Die Einwände halten das Muster „anerkennen · nachfragen · antworten · absichern“ sauber ein. Die Mails im Posteingang haben echte versteckte Anliegen. Wortbetonung (s01–s40) und Zahlen (z01–z30) sind fehlerfrei. Die Texte liegen bei höchstens 5 % unbekannten Wörtern.

**Das größte Problem** ist die automatische Fallen-Erkennung (`detect` in traps.ts). Sie meldet viele **korrekte** Sätze als Fehler, darunter auch Formen, die die App selbst lehrt. Aus Lehrersicht ist ein Fehlalarm schlimmer als ein übersehener Fehler, denn Emrah lernt dabei eine falsche Regel.

---

### 1. traps.ts – Erkennung (`detect`)

Jede Zeile nennt einen korrekten Satz, der heute fälschlich gemeldet wird, und den Ersatz.

| ID | Wird fälschlich gemeldet | Ersatz / Änderung | Schwere |
|---|---|---|---|
| f03 #3 | „How can we become a partner?“ | `\b(?:can\|could\|may) (?:i\|we) become (?:a\|an\|the\|some) (?:glass\|cup\|coffee\|table\|receipt\|invoice\|discount\|copy)\b`; in #1 außerdem `answer` streichen („became the answer“ ist richtig) | muss |
| f05 #1 | „I sent the prospect our pricing.“, „read the prospect's mood“ | `\b(?:attach(?:ed)?\|print(?:ed)?\|read) (?:a \|the \|our \|your \|this )?(?:new )?prospects?\b(?!'\| (?:list\|data\|call\|meeting\|our\|a\|an\|the\|some)\b)` und dazu `\bsend (?:me\|us) (?:a\|the\|your) (?:new )?prospect\b(?! (?:list\|data)\b)` | muss |
| f06 | „We have a good chance to win this deal.“ (hier heißt chance Wahrscheinlichkeit, das ist richtig) | `\b(?:big\|great\|huge\|unique) chances? (?:for\|to\|in)\b` (ohne `good` und `real`) | muss |
| f10 #1 | „Can we set a date for the kickoff?“ (Standard-Englisch) | `\b(?:make\|made\|have\|had) an? date (?:with\|for)\b` (ohne `set` und `arrange`) | muss |
| f11 #1 | „We can't confirm until Monday.“ (not … until ist richtig) | nicht melden, wenn vorher im Satz not, n't, never oder only steht | muss |
| f11 #2 | „They postponed the decision until next quarter.“ Das ist der eigene Beispielsatz c03. | Lookbehind: nicht melden nach postpone, delay, put off, push back, wait oder hold | muss |
| f12 #2 | „We are flexible since the budget is fixed.“ (since heißt hier weil) | nicht melden, wenn nach since ein Satz folgt: `since(?! (?:i\|we\|you\|they\|he\|she\|it\|(?:the\|our) \w+ (?:is\|are\|was\|were\|has\|have))\b)` | muss |
| f14 #2 | „a feedback session“, „an information security policy“ | `(?! (?:loop\|form\|session\|call\|survey\|request\|security\|system\|sheet\|meeting\|round\|management\|officer\|event\|page\|desk)\b)` anhängen | muss |
| f20 #1 | „Let me know if you do the demo.“, „I wonder why they did it.“ | do/does/did muss direkt nach dem Fragewort stehen: `\b(?:tell me\|know\|ask\|wonder(?:ing)?\|explain\|remember\|sure\|idea) (?:what\|how\|when\|where\|why\|who\|which)(?: (?:many\|much\|long\|often)(?: \w+)?)? (?:do\|does\|did) (?:you\|we\|they\|he\|she\|it\|your\|the\|our)\b` | muss |
| f20 #2 | „What we need is a clear timeline.“ Das ist die C1-Betonung, die t06 lehrt. Ebenso „When we have the numbers, …“ | nur melden, wenn der Satz mit „?“ endet: `[^.!?]*\?` anhängen | muss |
| f21 | „I can't make the meeting on Friday.“ (make heißt hier teilnehmen, das ist richtig) | nur `(?:a\|an)` erlauben. Dann Übung 1 ändern zu „We need to make a kickoff with the new partner.“ mit den Lösungen hold/run/have/schedule a kickoff. In `why` ergänzen: „make the meeting = es zum Meeting schaffen“ | muss |
| f22 | „We have signed three partners since last month.“, „We've made progress over the last year.“ | vor der Zeitangabe `(?<!\b(?:since\|over the\|in the\|for the\|during the) )` einfügen | muss |
| f23 #3 | „I understand your caution.“ Genau das soll Emrah in m04 schreiben („seine Vorsicht anerkennen“). | `\b(?:pay\|paid\|return\|returned\|keep\|kept\|get\|got\|refund) (?:my \|the \|your \|our )?caution\b\|\bcaution (?:back\|money)\b` | muss |
| f25 | „You must be Anna!“, „You must have had a long flight.“ (Vermutung mit must ist das Werkzeug von t13) | `\byou must\b(?! (?:be\|have been\|have had\|feel\|know)\b)` | muss |
| f02 | „Eventually, we could roll it out to HR.“ (richtig) | nur melden, wenn im Satz eine nahe Zeit oder ein „?“ steht: `(?=[^.!?]*(?:\?\|\b(?:today\|tomorrow\|next\|this week\|monday\|tuesday\|wednesday\|thursday\|friday\|at \w+)\b))` | sollte |
| f07 | „The outage looks serious.“ | #3: `\b(?:website\|site\|company\|offer\|provider\|vendor\|firm)(?: does(?:n't\| not))? looks? (?:very \|really )?serious\b`; in #1 `business` streichen | sollte |
| f16 | „Can you explain her decision?“ (her ist hier Besitz) | `her` aus der Liste streichen | sollte |
| f19 | „That makes the picture clearer.“ | `picture` nur mit a/an erkennen | sollte |

**Zusätzlich (klein):** Alle Sätze aus der zweiten Spalte in den Test „kein Fehlalarm“ in /home/user/lingo-engine-x/tests/unit/nbWeek.test.ts aufnehmen. Alle vorgeschlagenen Muster erkennen weiterhin Beispiel und Übungssätze der jeweiligen Falle, das habe ich im Kopf durchgespielt, nicht als Test.

### 2. traps.ts – Inhalte

| ID | Falsch | Korrigiert | Schwere |
|---|---|---|---|
| f06 why | „„chance“ heißt meist „Wahrscheinlichkeit“ oder „Glück“.“ Das stimmt so nicht: „I didn't get a chance to …“ ist normales Englisch. | de: „„chance“ passt für kleine Gelegenheiten (I didn't get a chance to …) und für Wahrscheinlichkeit (a good chance of winning). Eine geschäftliche Chance ist opportunity.“ Die en-Fassung entsprechend. | muss |
| f10 Übung 1 | „Can we set a date for the demo?“ fehlt als Lösung und würde als falsch gewertet | als erlaubte Lösung ergänzen | muss |
| f03 Übung 3 | „Could I get a glass of water?“ fehlt, obwohl es in den USA sehr häufig ist | ergänzen | sollte |
| f02 Übung 1/2 | „I can possibly join …“ ist unnatürlich; „may be able to“ fehlt | „I can possibly …“ streichen; „We may be able to move …“ und „I may be able to join …“ ergänzen | sollte |

### 3. themes.ts

- **t07/t08, beide mit `conditionals` (Urteil):** t07 behält `conditionals`, denn „If you could …, we could …“ ist das Kernwerkzeug im Verhandeln. **t08 bekommt `gerund-inf`.** Grund: Beim Werben um Partner und in Nachfass-Mails passieren die typischen deutschen Fehler bei *worth to …*, *open to join …* und *look forward to hear …*. Das hängt an Emrahs echten Fehlern und lässt sich auch im Telefonat b08 üben. Schwere: sollte, Aufwand klein.
  - Fokus de: „Überzeugen und nachfassen: -ing nach worth, open to, look forward to; britisches Understatement verstehen.“
  - In x-t08 „Twenty minutes would be enough to see whether …“ ersetzen durch „It might be worth spending twenty minutes to see whether it makes sense for both sides.“ `toolIn` wird „worth spending twenty minutes“, Nachsprech-Satz 3 ebenso anpassen.
  - In b08 das Kriterium „2. Konditional“ ersetzen durch „-ing nach worth / open to / look forward to“.
  - Alternative, falls C1 wichtiger ist: `c1-participle` („Having met at …“). Bisher nutzt kein Thema `c1-participle` oder `c1-nominal`.
- **t01 Wendung 1, de (sollte):** „erklär mir … wie ihr es heute macht“ ist Du-Form, alle anderen Wendungen siezen. Ersatz: „erklären Sie mir Schritt für Schritt, wie Sie es heute machen“.
- **t04 „encrypted at rest and in transit“, de (sollte):** „gespeichert und bei der Übertragung verschlüsselt“ ist mehrdeutig. Ersatz: „verschlüsselt – im Speicher und bei der Übertragung“.
- **t04 „audit-proof archiving“ (sollte):** In `def` ergänzen, dass US-Kunden eher „tamper-proof“ oder „immutable archiving“ sagen.
- **t11 task.en (sollte):** „Lead a renewal conversation“ widerspricht c18, wo „lead a conversation“ als falsch gilt. Ersatz: „Have a renewal conversation and ask for a reference.“
- **keywords zu breit (sollte):** Diese Wörter ordnen fremde Karten dem Thema zu: t01 `need` und `process`, t09 `issue` und `fix` („issue an invoice“), t10 `team` und `target`, t13 `book`, t16 `office`, t06 `board` (trifft „boarding“). Streichen oder durch Mehrwort-Begriffe ersetzen.

### 4. texts.json

| ID | Falsch | Korrigiert | Schwere |
|---|---|---|---|
| x-t05 core.q.en | „What must every German company be able to do since January 1, 2025?“ Hier steht since ohne Present Perfect, also genau die Falle f12. | „What does every German company have to be able to do as of January 1, 2025?“ | muss |
| x-t08 | „We would not leave you alone with the product.“ Germanismus: „leave you alone“ heißt „Sie in Ruhe lassen“. | „You wouldn't be on your own with the product.“ | muss |
| x-t04 | „Access is controlled by role-based access.“ (doppelt gemoppelt) | „We use role-based access: your administrators decide …“ (`notice` bleibt wörtlich im Text) | muss |
| x-t05 | „the EU is preparing its ViDA package“. ViDA ist seit März 2025 beschlossen. | „the EU's ViDA package, adopted in 2025, is going to link invoices to digital tax reporting from 2030“ | sollte |
| x-t04 | „In the unlikely case of an outage“; „subcontractors“ | „In the unlikely event of an outage“; „subprocessors“ (der DSGVO-Begriff, auch in m04) | sollte |
| x-t14 | „Tom and I had planned … We had booked …, packed the car, and left early on Saturday morning.“ Das Past Perfect läuft bis in die Haupthandlung, und das ausgerechnet im Text zum Werkzeug past-perfect. | „Last spring, my friend Tom and I planned a weekend in the mountains. We had booked a small cabin weeks before, so on Saturday we packed the car and left early.“ | sollte |
| x-t13 | „The hotel couldn't have lost my reservation, because I had the confirmation on my phone.“ Die Folgerung ist unlogisch. | „It couldn't have been my mistake, because I had the confirmation on my phone.“ | sollte |
| x-t01 between | Die Frage „zwischen den Zeilen“ fragt ab, was wörtlich im Text steht, und `why` behauptet „nicht wörtlich“. | Neue Frage: „What usually happens in first calls today, according to the writer?“ Richtige Antwort: „Sellers talk about features, and customers lose interest.“ Beleg: „We start talking about features, and the customer politely waits for the call to end.“ | sollte |
| x-t07 between | „It gave him something to trade for the discount.“ Die Richtung ist verdreht. | „It let him ask for something in return for the discount.“ | sollte |
| x-t03 | „Dear Ms. Keller“, während m03 und b03 „Dr. Keller“ nennen; „60,000 euros“ aus 700 Stunden wären 86 €/Stunde, für eine skeptische CFO unglaubwürdig | „Dear Dr. Keller“; „around 35,000 euros“, `toolIn` entsprechend anpassen | sollte |
| x-t02 / t09 / t10 toolIn | Die Stelle trifft das Werkzeug nicht genau. In t09 ist es Present Perfect Continuous, also ein anderes Grammatikthema. | t02 „In a nutshell“; t09 „and we have missed that date“; t10 „six of them were due to close by the end of the quarter on September 30“ | sollte |
| t01, t02, t07, t10, t12, t13, t15 | Direkte Rede steht ohne Anführungszeichen, etwa „Start with So if I'm hearing you correctly, and …“. Das ist schwer lesbar und ein schlechtes Vorbild für Mails. | “…” setzen. Nachsprech-Sätze ohne „I said / I suggested / she said / I admitted“ wählen (t10 #2, t12 #2, t13 #2, t15 #2). | sollte |
| x-t09 core.why.en, x-t15 between.why.en | feste Wendungen ausgeschrieben: „We have identified …“, „That is a fair point“ | „We've identified …“, „That's a fair point“ | sollte |
| alle Texte | Niveau solides B2. Für i+1 in Richtung C1 fehlen C1-Strukturen: Partizipialsatz, Inversion und Nominalstil kommen nie vor. | je Text 1–2 davon einbauen, weiter mit höchstens 5 % unbekannten Wörtern | sollte |

### 5. collocations.json

| ID | Falsch | Korrigiert | Schwere |
|---|---|---|---|
| c10 | „close a contract“ ist als falsch markiert, im US-Vertrieb aber üblich („we closed a $2M contract“) | falsche Form: „quit a contract“ → „terminate a contract“. Hinweis: „„Einen Vertrag kündigen“ heißt terminate oder cancel; quit sagt man beim Job.“ | muss |
| c34 | „cover the need“ ist als falsch markiert, dabei ist „Does this cover your needs?“ normales US-Englisch | falsche Form: „ask the need“ (Bedarf abfragen) → „identify the need“ | muss |
| c32 | Die richtige Lösung „do a training“ ist selbst ein typischer Deutsch-Fehler, denn training ist unzählbar. | richtig: „run a training session“. Hinweis: „… oder do some training“. | muss |
| c09, c22, c26, c29, c37 ex; extras d11 und p11 (mail); scenes b10 en | „Let us negotiate / set / stay in contact / find / agree …“ klingt steif oder wie eine Bitte um Erlaubnis | „Let's …“ (c26: „Let's stay in touch …“; p11 mail: „We will review the numbers.“) | muss |
| c18 | Der Hinweis unterschlägt, dass „lead the conversation“ (das Gespräch steuern) richtig ist | einen Satz dazu ergänzen | sollte |
| c31 | „lead through a project“ ist kein typischer Fehler, und die Lösung „carry out“ steht nicht in der Verbliste | falsche Form: „make a project“ → „run a project“; „run“ in die Verben aufnehmen | sollte |
| c33 | im Hinweis „arouse interest“ | streichen, weil es auch „sexuell erregen“ heißen kann; stattdessen „generate, spark, attract“ | sollte |
| c36 | „name an example“ benutzen Muttersprachler durchaus | falsche Form: „bring an example“ (Beispiel bringen) | sollte |
| c21, c26, c36 de | „laufen“, „bleiben in“, „geben (Vorbild)“ | „(Gefahr) laufen“, „in Kontakt bleiben“, „mit gutem Beispiel vorangehen“ | sollte |

### 6. transforms.json

| ID | Falsch | Korrigiert | Schwere |
|---|---|---|---|
| u14 | why: „das Objekt steht nach down“. Das ist eine falsche Regel, auch „turned our offer down“ ist richtig. | Lücke: „The customer ___.“ Lösungen: „turned down our offer“, „turned our offer down“. why: „Nomen vor oder nach down, Pronomen nur davor: turned it down.“ | muss |
| u28 | „will likely“ fehlt, obwohl es im US-Englisch Standard ist | ergänzen und in `why` erwähnen | muss |
| u03 / u11 | Die Musterlösungen „can't have signed“ und „needn't have sent“ sind britisch geprägt | u11: „didn't need to send“ als erste Lösung. u03: im `why` „im US-Englisch meist couldn't have“ ergänzen. | sollte |
| u09 | Nur 2 Wörter, zu leicht | „If ___ too high, we would have won the deal.“ mit „our price hadn't been“ und „our price had not been“ | sollte |
| u05, u15, u26, u21, u16 | Übliche richtige Varianten fehlen | „haven't talked to him since“, „haven't spoken with him since“; „don't have to make a decision“; „due mainly to“; „whether or not we had“; „was never informed“ | sollte |
| u30 why.en | „Depending on means "according to"“ (according to heißt „laut“) | „… means "based on" (German: je nach)“ | sollte |

### 7. objections.json

| ID | Falsch | Korrigiert | Schwere |
|---|---|---|---|
| o05 answer | „Our data is hosted …“ meint die Daten des Anbieters | „Your data would be hosted in EU data centers and encrypted at rest and in transit …“ | muss |
| o09 answer | „the three-year conditions still apply“. conditions für Konditionen ist ein Germanismus. | „you still get the three-year pricing“ | muss |
| o05 acknowledge | „That's a very reasonable position“. So bestätigt der Verkäufer den Einwand gegen die Cloud. | „I understand, and I appreciate how seriously you take this, especially with personnel and financial records.“ | sollte |
| o02 | „So I send you the right material, which …“; „in the calendar“ | „Just so I send you the right material: which …“; „on the calendar“ (US) | sollte |
| o11 / o07 / o14 | „a budget to meet“; „that the decision maker can read“; „restored for 30 days“ | „you're working with a tight budget“; „could read“; „for up to 30 days“ | sollte |

### 8. inbox.json

| ID | Falsch | Korrigiert | Schwere |
|---|---|---|---|
| alle 16 Mails und 16 Antworten | Nach der Anrede geht es klein weiter („Hi,\n\nthanks for …“). Das ist die deutsche Regel und genau der typische Fehler in Emrahs Mails. 30 Stellen. | groß weiter: „Hi Laura,\n\nThanks for …“ | muss |
| m03 body | „Dear Sir or Madam“, obwohl sie den Absender kennt | „Hello,“ | sollte |
| m07 reply | „You'll have my answer by Wednesday.“ steht mitten in der Antwort; „both offers“, obwohl es drei sind | „Here is my answer ahead of your Wednesday deadline.“; „compare the offers“ | sollte |
| m09 body | „this is the second time I have to write to you“ | „This is the second time I've had to write to you.“ | sollte |
| m13 und x-t13 | Im Text bekommt er nach zehn Minuten das richtige Zimmer, in der Mail verlangt er trotzdem Geld zurück | im Text: „The next morning, she moved me to a corner room …“ | sollte |
| m15 reply | „the works council will stop the project“. Das ist absolut formuliert, obwohl t15 Hedging übt. | „could well stop the project before it even starts“ | sollte |
| m01 / m10 | Der Jahresabschluss liegt in Jan.–März, Termin „second week of January“ passt nicht; „usually takes an hour“ widerspricht x-t10 („30-minute review“) | „late February“; „usually runs way over time“ | sollte |

### 9. scenes.json

Alles hier ist „sollte“.

- **b14:** „Sarah Lehmann“ ist hier Kundin, in m14 aber Kollegin aus dem Marketing, im selben Thema. Eine der beiden umbenennen.
- **Kriterien, die sich nicht prüfen lassen:**
  - b01 „Sie spricht mehr als du“ (die KI bestimmt ihre Länge) → „Deine Beiträge sind kurz: vor allem Fragen, höchstens 2 Sätze Produkt am Stück“
  - b02 „unter 60 Sekunden“ → „… bzw. höchstens 150 Wörter“
  - b03 „Zahlen korrekt ausgesprochen“ (die Spracherkennung macht Ziffern daraus) → „Zahlen im englischen Format (1.5 million, 15 percent)“
  - b06 „unter 45 Sekunden“ → „höchstens 4 Sätze je Antwort“
  - b10 „niemand dominiert“ → „du holst jede Figur mindestens einmal zum Thema zurück“
  - b12 „Gesprächsfluss vor Grammatik“ (eine Bewertungsregel, kein Kriterium) → „am Ende ein Anlass für später (Karte, LinkedIn, Fallstudie)“
  - b04 „keine Übertreibung“ → „keine absoluten Zusagen (never, 100 percent, guarantee)“
- **Englische Kriterien ohne Kurzformen:** b01 „So if I am hearing you correctly“ → „So if I'm hearing …“; b15 „I would argue“ → „I'd argue“.

### 10. extras.json

| ID | Falsch | Korrigiert | Schwere |
|---|---|---|---|
| d10 | „___, we were lost …“ ergibt mit der Lösung „So there I was, we were lost …“, also einen falschen Satz | Text: „___, lost on a muddy forest road with no signal.“ Lösungen: „So there we were“, „So there I was“ | muss |
| d12 | Lücke 1 verlangt „In other words“ nach einem neuen Fakt, das ist keine Umformulierung | Satz 1: „Your team has cut the approval time by two thirds this year.“ | muss |
| h05 | „No, they can't.“ ist absolut und widerspricht dem Ziel von t04, nicht zu viel zu versprechen | „Not without your permission. Documents are encrypted, every access is logged, and only if you open a support case can an administrator see what you share with them.“ | sollte |
| w03 / w04 / w19 | „analytics“ bzw. „competition“ passen auch; „analytic“ fehlt | w03: „A quick ___ of your invoices shows …“; w04: „analytic“ zulassen; w19: „Most of our ___ are based in Germany.“ | sollte |
| p04 / d02 / d05 | „wrap up the contract“; „In the end“ als Fazit; fn „Umformulierung“, obwohl „For example“ erlaubt ist | „wrap up the negotiations“; „All in all“; fn „Erklärung oder Beispiel“ | sollte |

---

### Aufwand und Freigabe

- **Muss-Befunde:** 27 Zeilen (sammeln sich mehrere IDs in einer Zeile, zählt sie einmal). Aufwand mittel, etwa 2–3 Stunden. Der größte Teil sind die Regex-Korrekturen in traps.ts samt Negativsätzen im Test; der Rest sind Textänderungen.
- **Sollte-Befunde:** klein bis mittel, gern im nächsten Paket.

**Freigabe: Ja, nach Umsetzung der Muss-Befunde.** Danach genügt eine gezielte Nachprüfung nur dieser Stellen, dazu ein grüner Lauf von `nbWeek.test.ts` mit den neuen Sätzen für „kein Fehlalarm“.

---

## Nachprüfung der Muss-Stellen aus `docs/neubau/pruefung-inhalte.md`

Ich habe keinen Code geändert. Die Muster in `src/content/nb/traps.ts` habe ich von Hand durchgespielt, einen Testlauf konnte ich nicht starten (kein Befehlszugriff). Die Umwandlung in `src/domain/week/traps.ts` macht aus ’ ein ', das hilft. Alle Negativsätze aus meiner ersten Prüfung stehen in `tests/unit/nbWeek.test.ts`. Beim Nachprüfen habe ich aber weitere Fehlalarme gefunden, und zwar in Mustern, die ich selbst vorgeschlagen hatte. Das ist mein Fehler aus Runde 1.

### traps.ts – Erkennung

- **f03:** ok
- **f05:** ok. Eine Lücke bleibt in Muster 2: „Can you send me the prospect's email address?“ wird gemeldet. Korrektur (gleich mitnehmen): `'\\bsend (?:me|us) (?:a|the|your) (?:new )?prospect\\b(?!\'| (?:list|data|details|contact|name|info)\\b)'`
- **f06:** Muster ok.
- **f10: nicht ok.** „Do we have a date for the go-live yet?“ ist Standard-Englisch und wird gemeldet. Muster 1 ersetzen durch zwei Einträge:
  - `'\\b(?:make|made) an? date (?:with|for)\\b'`
  - `'\\b(?:have|had) an? date with\\b'`
- **f11: nicht ok.** „We cannot confirm until Monday.“ wird gemeldet, weil `\bnot` das Wort „cannot“ nicht trifft. In beiden Lookbehinds `\\bcannot|` ergänzen: `(?<!(?:\\bnot|\\bcannot|n't|…`
  - Sollte, Paket B: Die Lücke `[^.?!]{0,40}?` erlaubt Kommas. Deshalb wird „I'll send it tomorrow, I'm out until Monday.“ gemeldet. Besser: `[^.?!,;]{0,40}?`
- **f12:** ok für den Testsatz. Sollte, Paket B: „We are flexible since this is a pilot.“ wird noch gemeldet. Lookahead erweitern auf `(?:i|we|you|they|he|she|it|this|that|there|(?:the|our|your|their|my) \\w+ (?:is|are|was|were|has|have|will|can))`
- **f14:** ok. Sollte, Paket B: „a feedback culture“ und „a feedback tool“ werden gemeldet. `culture|process|tool|platform|technology` in die Ausnahmen aufnehmen.
- **f20: nicht ok, zwei Fehlalarme in Emrahs Kernsätzen.**
  - Muster 1: „Can you tell me who does the invoicing today?“ wird gemeldet. Bei who als Subjekt ist does das Vollverb, der Satz ist also richtig. Korrektur: `who` aus `(?:what|how|when|where|why|who|which)` streichen.
  - Muster 2: „When you have a minute, could you take a look?“ wird gemeldet, eine sehr häufige Mail-Formel. Korrektur: `when` streichen und die Lücke ohne Komma schreiben: `…(?:why|what|how|where) (?:you|we|they) (…)\\b[^.!?,]*\\?`
- **f21:** ok. Das Muster stimmt, Übung 1 und das `why` in beiden Sprachen auch.
- **f22:** ok wie gefordert. „We have signed 12 new partners since the end of last year.“ wird aber noch gemeldet, weil vor „last year“ das Wort „of“ steht. Korrektur (gleich mitnehmen): die Lücke `[^.?!]{0,40}?` ersetzen durch `(?:(?!\\bsince\\b)[^.?!]){0,40}?`
- **f23:** ok
- **f25: nicht ok.** „You must have heard about the new mandate.“ wird gemeldet. Diese Vermutung mit must übt t13 (`modals-deduction`). Korrektur: `'\\byou must\\b(?! (?:be|have|feel|know)\\b)'`. Übung 1 wird weiter erkannt.

Beispiel, Übungen und Lösungen der jeweiligen Falle bleiben mit allen Korrekturen gültig. Diese neuen Sätze gehören in den Test „kein Fehlalarm“:
- „Do we have a date for the go-live yet?“
- „We cannot confirm until Monday.“
- „Can you tell me who does the invoicing today?“
- „When you have a minute, could you take a look?“
- „You must have heard about the new mandate.“
- „Can you send me the prospect's email address?“
- „We have signed 12 new partners since the end of last year.“

### Inhalte

- **f06 Grund:** ok. Sollte: Der `hint` „Ist es Glück oder eine Gelegenheit?“ passt nicht mehr zum neuen Grund. Besser: „Kleine Gelegenheit oder Wahrscheinlichkeit – oder eine geschäftliche Chance?“
- **f10 Lösung:** ok
- **f21 Übung:** ok
- **x-t05 Frage, x-t08, x-t04:** ok
- **c10, c34, c32:** ok
- **Let's-Stellen:** ok. c09, c22, c26, c29, c37, d11, p11 und b10 sind umgesetzt. Übrig ist nur extras r08: Dort steht „Let us conclude the meeting here.“ als erste Antwort, also als Musterlösung. Die beiden Antworten tauschen, damit „Let's conclude …“ die Musterlösung ist. Aufwand klein.
- **u14, u28:** ok
- **o05, o09:** ok
- **inbox.json:** ok. Alle 30 Stellen gehen nach der Anrede groß weiter, keine Mail beginnt mehr klein.
- **d10, d12:** ok

### Stichprobe Sollte-Stellen

- **t08 gerund-inf:** ok, auch Fokus, `toolIn` in x-t08 und das Kriterium in b08.
- **x-t14:** ok
- **C1-Strukturen:** ok. „Rarely has a regulation offered …“ (Inversion, x-t05), „Managing the IT of more than 200 …, your team …“ (x-t08) und „Driving ahead of us …, the farmer …“ (x-t14) sind korrekt gebaut.

### Freigabe: Nein in diesem Stand.

**Ja, sobald die vier Muss-Korrekturen umgesetzt sind** (f10, f11 „cannot“, f20 mit beiden Mustern, f25) und `nbWeek.test.ts` mit den neuen Negativsätzen grün ist. Nach A2 ist dafür keine weitere Prüfrunde nötig, die Negativsätze sichern die Korrekturen ab.

- **Gleich mitnehmen:** f05 und f22, je eine Zeile.
- **Paket B:** f11 (Kommas), f12, f14, der f06-Hinweis und die Reihenfolge in r08.

**Integrator (00:25 UTC):** Alle genannten Korrekturen (Muss, gleich mitnehmen und Paket-B-Kleinigkeiten) an P7 übergeben; Freigabe gilt mit grünem nbWeek.test.ts inkl. der neuen Negativsätze (A2: keine weitere Runde).
