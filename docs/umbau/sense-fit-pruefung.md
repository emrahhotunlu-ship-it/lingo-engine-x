# Sinn-Auswahl beim Wort-Antippen und Einführungskarte – Prüfliste (25.10.2026)

Anlass: zwei Meldungen von Emrah zur Live-Version v83.

1. **decline:** Er tippte im Satz „The candidate **declined** to commit to the start date until she reviewed the contract.“ auf das Wort. Die Karte dazu ist „to decline to commit to“ = „sich nicht festlegen wollen auf“. Angezeigt wurde „decline · Nomen · Rückgang“.
2. **to adjust:** Auf der Einführungskarte für „to adjust“ stand der Satz „**Adjusted** earnings came to $1.08 …“. Dort ist das Wort ein Eigenschaftswort. Außerdem war die deutsche Bedeutung zu klein und nicht hervorgehoben.

Zweig: `claude/umbau-sense-fit`. Diese Datei sammelt alles, was `english-teacher` gegenlesen soll: neue Wörterbuch-Bedeutungen, Ergebnisse der Karten-Prüfung, offene Punkte.

## 1. Ursachen

- **decline:** Das angetippte Wort wurde nur über seine Grundform aufgelöst. Dabei gewann eine eigene Karte oder die erste Wörterbuch-Bedeutung, egal wie das Wort im Satz verwendet wird. Der bisherige Wortart-Hinweis sah nur das Wort davor an. Nach „candidate“ gab er keinen Hinweis, deshalb stand das Nomen „Rückgang“ vorn.
- **to adjust:** Der Satz-Wächter `senseFits` prüft, ob ein Satz zur Wortart einer Verb-Karte passt. Er verwarf bisher nur Formen nach einem Artikel („the adjusted …“). Ein Partizip am Satzanfang vor einem Nomen („Adjusted earnings“) ließ er durch.

## 2. Was gebaut wurde

- **`src/domain/lookup/sense.ts`** (reine Logik, mit Unit-Tests):
  - `guessPos`: bestimmt die Wortart aus der Endung (-ed, -ing, -s, -ly) und der Stellung im Satz. Dazu gehören:
    - das Wort davor: Artikel, Besitzwort, Subjekt, Hilfsverb, „to“, Präposition, be/have/get;
    - Verben wie remain, seem, stay, nach denen ein Eigenschaftswort folgt;
    - das Wort danach: Objekt, „of“, is/will/has;
    - Partizip vor einem Nomen, Hilfsverben, Teilchen.
  - `rankSenses`: stellt die passende Bedeutung nach vorn und gibt eine andere Wortart als „Auch“ zurück. Bleibt die Lage unklar, lautet das Ergebnis `unsure`. Passt keine Bedeutung, lautet es `mismatch`.
  - `targetPart`: Ist das Wort Teil der Ziel-Wendung oder Karte des Satzes, liefert es deren Bedeutung. In offenen Aufgaben (Lücke im Satz) liefert es nie etwas.
- **`resolveWord`** nutzt den Satzbezug:
  - Es berücksichtigt mehrere Grundformen („used“ → use, „lives“ → live).
  - Ein Gerundium meint die Tätigkeit („Drinking …“ → trinken, nicht „Getränk“).
  - Eine eigene Nomen-Karte verdrängt die Verb-Bedeutung im Verb-Satz nicht mehr.
- **Nachschlage-Fenster:**
  - oben der Kasten „Teil von ‚…‘“ mit der Bedeutung der Wendung, darunter „Das Wort allein: …“;
  - eine Zeile „Auch: Nomen – Rückgang“;
  - wenn die Bedeutung unsicher ist: der Hinweis „Bedeutung hier nicht sicher – Claude fragen“ mit dem Knopf „Bedeutung im Satz“. Er fragt Claude nur mit Zustimmung und Tutor-Bremse, über `quick`. Lücken gehen als „___“ mit, und eine Prompt-Regel verbietet, das Verdeckte zu verraten.
- **`senseFits`:** Eine Verb-Karte bekommt kein Partizip mehr, das als Eigenschaftswort vor einem Nomen steht, am Satzanfang oder nach einer Präposition („Adjusted earnings“, „with limited resources“). Die Karte nimmt dann einen anderen eigenen Satz (Beispiel oder Wortpartner) oder keinen.
- **Einführungskarte** in dieser Reihenfolge:
  1. das Wort;
  2. die deutsche Bedeutung groß und fett, die Wortart klein daneben;
  3. die Lautschrift;
  4. der Beispielsatz kleiner, mit markiertem Wort.

  „Kenne ich“ ist jetzt ein umrandeter Knopf mit mindestens 44 px. Die Zeile „Bedeutung im Satz“ fällt weg, und es bleibt kein leerer Block, wenn es keine Zusatzzeilen gibt.
- **Ergebnis-Karte:** Im Kopf steht die Bedeutung groß und fett direkt unter dem Wort, außer bei Kontrast und Wortpartner. „Merke“ wiederholt sie dann nicht.

## 3. Zahlen der Satz-Prüfung (Wort-Antippen)

Geprüft wurden alle Sätze in `src/content/**` und `seed/`: 32.672 Sätze mit 46.859 Stellen mehrdeutiger Wörter. Als Vergleich diente ein maschineller Wortart-Tagger (NLTK). Er irrt selbst gelegentlich, die Zahlen sind deshalb Näherungen.

| | Stellen | verschiedene Wörter |
|---|---:|---:|
| vorher: falsche Wortart zuerst | 14.485 | 695 |
| jetzt: falsch und nicht als unsicher markiert | 4.425 | – |
| jetzt: ehrlich als „nicht sicher“ markiert, mit Claude-Knopf | 9.042 | – |
| behoben (vorher falsch, jetzt richtig oder markiert) | 11.515 | 374 mit klarer neuer Bedeutung |
| neu falsch (zum großen Teil Irrtümer des Taggers) | 1.455 | – |

20 Beispiele (vorher → jetzt):

1. **declined** „The candidate declined to commit …“: Rückgang (Nomen) → ablehnen (Verb); mit Karte: „Teil von ‚to decline to commit to‘: sich nicht festlegen wollen auf“
2. **talk** „I can't talk because I'm driving …“: Gespräch → reden, sprechen
3. **levels** „update stock levels automatically“: eben (Adj.) → Niveau, Ebene
4. **current** „in the current year“: Strömung → aktuell
5. **convinced** „He convinced me …“: überzeugt (Adj.) → überzeugen (Verb)
6. **copy** „students often copy each other's homework“: Kopie → kopieren
7. **helps** „Television helps us …“: Hilfe → helfen
8. **use** „Computers use the binary number system“: Gebrauch → benutzen
9. **plan** „… and plan their costumes“: Plan → planen
10. **sleep** „I can't sleep“: Schlaf → schlafen
11. **leave** „Don't leave the bedroom window open“: Urlaub → verlassen, lassen
12. **gain** „helped us gain an advantage“: Gewinn → gewinnen
13. **Call** „Call me if you need assistance“: Anruf → anrufen
14. **visit** „Do you often visit flea markets?“: Besuch → besuchen
15. **test** „We did not test the update earlier“: Test → testen
16. **notice** „Tom didn't notice the camera“: Aushang → bemerken
17. **secure** „secure a fixed next step“: sicher (Adj.) → sichern
18. **paid** „citizens paid for the pedestal“: Lohn → zahlen
19. **official** „the official spokesperson“: Beamter → offiziell
20. **Driven** „Driven by demand, prices rose …“: Fahrt, Antrieb → antreiben

Weitere behobene Wörter, unter anderem: dealt (Geschäft → sich befassen), schedule, trusts, replies, demands, supports, checks, doubt, increases, offer, patients, officials, joint, tore, slept, standard.

## 4. Zahlen der Karten-Prüfung (Wortart/Bedeutung der Karte gegen ihren Ursprungssatz)

Geprüft wurden alle Karten im Repository: 621 Karten, davon 138 aus `seed`, 40 aus dem Startwortschatz (`legacy/vocab.json`) und 443 aus dem C1-Paket. Neue Karten (Stufe 0) und die Stufen 0–2 hatten Vorrang.

- **Echte Widersprüche zwischen Karte und Satz: 0.** In allen auffälligen Fällen war die Karte richtig, und die Wortart-Vermutung oder der Tagger hatte sich geirrt.
  - Stark auffällig waren 5 Fälle: e-invoicing, sluggish, compliant, predominantly, volatile.
  - Schwach auffällig waren 9 Fälle: affects (2×), forecast, go-live, landmark, streamlines, hesitate, concise, coherent.
  - Daraufhin wurde die Wortart-Vermutung verbessert: nach remain/seem/stay folgt ein Eigenschaftswort, und ein -ly-Wort nach „are“ bleibt ein Adverb.
- **32 Seed-Karten ohne Satz mit dem Wort:** Die Testdaten geben Lektionswörtern absichtlich den Beispielsatz der Lektion (wie die alte App). Die App zeigt dann ersatzweise einen anderen Satz oder keinen (`fallbackContext`). Es gibt keine falsche Markierung, eine Änderung ist nicht nötig.
- **Emrahs eigene Karten** (zum Beispiel „to adjust“ mit „Adjusted earnings …“ und „to decline to commit to“) liegen nur in seiner Datenbank, nicht im Repository. Für sie greifen ab jetzt zur Laufzeit:
  - der erweiterte `senseFits`, der den unpassenden Satz durch einen passenden ersetzt oder keinen zeigt;
  - die neue Sinn-Auswahl beim Antippen.

  Nichts wird gelöscht oder umgeschrieben (Kap. 9).

## 5. Neue Wörterbuch-Bedeutungen zum Gegenlesen (65 von höchstens 150)

Datei: `src/content/lexicon/sense-extra.json`. Sie ergänzt `src/content/legacy/dict.json` um fehlende Wortarten, die in den Sätzen der App häufig vorkommen. Englisch in US-Schreibweise.

| Nr. | Wort | Wortart | Deutsch | English |
|---:|---|---|---|---|
| 1 | can | verb | können, dürfen | be able to; be allowed to |
| 2 | could | verb | könnte, konnte | past or conditional form of can |
| 3 | past | adj | vergangen, letzte | gone by; just before now |
| 4 | present | adj | anwesend; aktuell, gegenwärtig | being here; existing now |
| 5 | tense | noun | Zeitform | verb form that shows time |
| 6 | passive | noun | Passiv | verb form in which the subject receives the action |
| 7 | perfect | noun | Perfekt | tense formed with have and a past participle |
| 8 | stay | noun | Aufenthalt | time spent in a place |
| 9 | alone | adv | allein | without other people |
| 10 | better | adv | besser | in a better way; more |
| 11 | before | adv | vorher, schon einmal | at an earlier time |
| 12 | subject | adj | abhängig von, vorbehaltlich (subject to) | depending on; affected by |
| 13 | stand | noun | Stand, Standpunkt | booth at a fair; firm opinion |
| 14 | lower | adj | niedriger, untere | less high; below |
| 15 | hire | noun | Neueinstellung | person who was recently hired |
| 16 | count | noun | Zählung, Anzahl | act of counting; total number |
| 17 | front | adj | vordere, Vorder- | at the front |
| 18 | only | adj | einzige | single; with no others |
| 19 | double | verb | (sich) verdoppeln | become or make twice as much |
| 20 | opposite | noun | Gegenteil | something completely different |
| 21 | left | noun | linke Seite, links | the left side |
| 22 | deal | verb | sich befassen (mit), handeln (mit) | handle a problem; do business |
| 23 | pause | noun | Pause, Unterbrechung | short stop |
| 24 | close | adv | nahe, dicht | near |
| 25 | register | noun | Register, Verzeichnis | official list |
| 26 | refund | verb | erstatten, zurückzahlen | pay money back |
| 27 | speed | verb | beschleunigen (speed up) | make faster |
| 28 | sum | verb | zusammenfassen (sum up) | summarize |
| 29 | later | adj | später | coming after |
| 30 | outside | adv | draußen | not inside a building |
| 31 | email | verb | mailen, per E-Mail schicken | send an email to |
| 32 | back | verb | unterstützen | support |
| 33 | right | adv | direkt, gleich, genau | directly; immediately; exactly |
| 34 | slip | noun | Ausrutscher, Flüchtigkeitsfehler | small mistake |
| 35 | set | adj | fest, festgelegt | fixed; decided before |
| 36 | budget | verb | einplanen, budgetieren | plan how much money to spend |
| 37 | forecast | verb | vorhersagen, prognostizieren | say what will probably happen |
| 38 | staff | verb | besetzen (mit Personal) | provide workers for |
| 39 | chair | verb | leiten (Sitzung) | lead a meeting |
| 40 | price | verb | bepreisen, mit einem Preis versehen | set the price of |
| 41 | source | verb | beschaffen, beziehen | get from a supplier |
| 42 | invoice | verb | in Rechnung stellen | send a bill to |
| 43 | deposit | verb | einzahlen, hinterlegen | put money into an account |
| 44 | draft | verb | entwerfen | write a first version of |
| 45 | project | verb | prognostizieren, hochrechnen | estimate a future amount |
| 46 | result | verb | sich ergeben (result in: führen zu) | happen because of something |
| 47 | stock | verb | führen, vorrätig haben | keep goods for sale |
| 48 | total | verb | sich belaufen auf | add up to |
| 49 | credit | verb | gutschreiben | add money to an account |
| 50 | pitch | verb | vorstellen, anpreisen | present an idea to win support |
| 51 | rank | verb | einstufen, rangieren | put in order of importance |
| 52 | reference | verb | verweisen auf, nennen | mention as a source |
| 53 | table | verb | zurückstellen, vertagen | postpone discussion of (US) |
| 54 | task | verb | beauftragen | give someone a job to do |
| 55 | split | noun | Aufteilung, Spaltung | division into parts |
| 56 | spend | noun | Ausgaben | amount of money spent |
| 57 | scale | verb | skalieren, ausbauen | change in size or amount |
| 58 | shortfall | noun | Fehlbetrag, Lücke | amount by which something is too small |
| 59 | upcoming | adj | bevorstehend | happening soon |
| 60 | commercial | noun | Werbespot | advertisement on TV or radio |
| 61 | alert | noun | Warnung, Alarm, Benachrichtigung | warning message |
| 62 | briefing | noun | Besprechung, Briefing | meeting where people get information or instructions |
| 63 | correctly | adv | richtig, korrekt | in a correct way |
| 64 | formally | adv | formell, offiziell | in a formal or official way |
| 65 | politely | adv | höflich | in a polite way |

Hinweis für die Gegenlesung: „table“ (Verb) ist bewusst die US-Bedeutung „vertagen“. Im britischen Englisch heißt es das Gegenteil, nämlich „zur Beratung vorlegen“.

## 6. Folgeaufgaben

- **Gegenlesung** der 65 Einträge durch `english-teacher`, bevor ein Test-Link entsteht.
- **Emrahs Datenbank-Karten:** Eine einmalige Prüfung im Artefakt (Diagnose-Ansicht) könnte zählen, wie viele Karten wegen `senseFits` keinen eigenen Satz mehr zeigen. Daraus ließe sich ein Vorschlag für neue Sätze machen, ohne etwas zu überschreiben. Noch nicht gebaut.
- **Restfehler der Wortart-Vermutung**, rund 4.400 Stellen, meist an Satzanfängen und bei Aufzählungen:
  - weitere Regeln nur nach Stichproben;
  - der Claude-Knopf deckt unsichere Fälle ab.
- **-ing-Partizip vor einem Nomen** („Growing demand“ gegenüber „Managing teams“): `senseFits` prüft bewusst nur -ed. Für -ing bräuchte es Bedeutungswissen.
- **Hinweis im Fenster:** „Aus dem Wörterbuch – ohne Satzbezug“ steht auch dann, wenn die Wortart aus dem Satz gewählt wurde. Der Text könnte genauer werden, zum Beispiel „Wörterbuch, passend zur Wortart im Satz“.
- **Prompt-Version:** Die Version von `wordLookup` blieb bei 2. Die neue Regel zum „___“ schreibt keine Antworten anders fest, deshalb wurde der Zwischenspeicher nicht geleert.
