# S4 – Inhalte zur Gegenlesung (english-teacher)

Stand 19.10.2026, Zweig `claude/umbau-engine-s4`. Diese Liste enthält **alle neuen englischen und deutschen Inhalte aus S4**. Laut `docs/umbau/arbeitsweise.md` wird jede Inhaltscharge vollständig gegengelesen, bevor es einen Test-Link gibt.

**Maßstab:** US-Englisch ist der Standard, britische Formen gelten als richtig. Gutes Englisch darf nie als Fehler gelten. Deutsch muss natürlich klingen und zur Bedeutung passen.

Was die automatische Prüfung schon abdeckt (`tests/tutor/colCharge1.test.ts`, `acceptCollocations`):
- Format und Länge,
- genau eine Klammerstelle mit Kartenwort und Lücke,
- Ablenker nicht in der Wendung und nicht als gleichwertiger Partner gelistet (`collocAlternatives`),
- Sprache DE/EN,
- keine britische Schreibweise.

Was nur ein Mensch prüfen kann, steht unten je Abschnitt als **Prüffrage**.

## 1. Wortpartner-Charge `col` (`src/content/col/charge1.json`)

100 Wörter mit 102 Wendungen (`discount` und `mention` haben je zwei).
- 70 Wörter sind Karten aus Emrahs Bestand, die noch keine Wortpartner haben: absent … within. Die Sätze sind erfunden, nichts ist aus seinen Karten kopiert.
- 30 Wörter sind zusätzliche B2/C1-Wörter für Business-Englisch: deadline … interest.

So läuft die Übung: Der Beispielsatz wird mit einer Lücke an der Stelle **Lücke** gezeigt. Zur Wahl stehen die richtige Lücke und die **Ablenker**.

**Prüffragen je Zeile:**
1. Ist die Wendung eine typische, natürliche Kollokation (B2→C1)?
2. Ist **jeder** Ablenker im Beispielsatz wirklich falsch, also kein ebenfalls richtiges oder übliches Wort, auch nicht im britischen Englisch? Das ist der wichtigste Punkt.
3. Ist die Lücke im Satz eindeutig?
4. Passt das Deutsche?

Die Spalte `en` (kurze englische Umschreibung) steht nur in der JSON-Datei. Sie dient als Lesehilfe und wird nicht angezeigt.

Schon vorab verschärft: Ablenker, die gutes Englisch wären, wurden ersetzt:
- overlooked → overdid
- reassure … over → at
- ambience → flavor
- cover demand → join
- coarse estimate → rude
- impact to → of
- gave an effort → held
- answer an issue → adjust
- theme → thesis
- broad spread → stretch
- lay constraints → push
- booked attendees → noted

Weggelassene Karten aus dem Bestand, weil es keine eindeutige Wortpartner-Lücke gibt oder die Wendung schon fest ist: perhaps, slightly, adaptive attempts, code rollbacks, usual cyber guardrails, broadly available, embodied, playing a game, as far as I know, it comes down to, be handled, wildly different, be reluctant to, be worth it, boil down to, bring about, brush aside, chair a meeting, fell short of expectations, go over something, hold back, in line with our target, lead to, look into something, miss out on, put something in writing, put up with, reach out to, reassure someone, renewal date, retention period, roll something out, spreadsheet, zero in on, come to terms with, commuters.

| # | Wort | Wendung (p) | Deutsch | Lücke | Ablenker | Beispielsatz |
|---|---|---|---|---|---|---|
| 1 | absent | notably absent | auffällig abwesend | notably | strongly, heavily, deeply | Two key stakeholders were ⟦notably absent⟧ from the kickoff meeting on Monday. |
| 2 | action item | open action items | offene Punkte | open | free, loose, empty | We still have three ⟦open action items⟧ from last week's call with the client. |
| 3 | argue | argue convincingly | überzeugend argumentieren | convincingly | heavily, deeply, tightly | In her memo, Dana ⟦argued convincingly⟧ that the old pricing model was holding us back. |
| 4 | attendee | registered attendees | angemeldete Teilnehmer | registered | inscribed, subscribed, noted | We expect around 200 ⟦registered attendees⟧ at the partner summit in Denver. |
| 5 | attendees | registered attendees | angemeldete Teilnehmer | registered | inscribed, subscribed, noted | Only ⟦registered attendees⟧ will receive the slides after the webinar. |
| 6 | attitude | attitude toward risk | Einstellung zum Risiko | toward | against, for, at | The new CFO has a much more relaxed ⟦attitude toward risk⟧ than her predecessor. |
| 7 | balance sheet | strong balance sheet | solide Bilanz | strong | fat, thick, hard | Thanks to a ⟦strong balance sheet⟧, the company kept investing during the downturn. |
| 8 | break even | expect to break even | erwarten, die Kosten zu decken | expect | await, wait, attend | We ⟦expect to break even⟧ in the third quarter of next year. |
| 9 | bring up | bring up the subject | das Thema ansprechen | subject | thesis, object, motive | I will ⟦bring up the subject⟧ of pricing at the end of the call. |
| 10 | broad | a broad range of | ein breites Spektrum an | range | width, stretch, row | Our new platform supports ⟦a broad range of⟧ payment methods across Europe. |
| 11 | catch up | catch up on emails | E-Mails aufarbeiten | on | at, by, for | I need an hour this morning to ⟦catch up on emails⟧ after the trip. |
| 12 | clarify | clarify this with legal | das mit der Rechtsabteilung klären | with | by, at, from | Let me ⟦clarify this with legal⟧ before we send the contract to the client. |
| 13 | compete | compete for customers | um Kunden konkurrieren | for | about, around, after | Three local agencies ⟦compete for customers⟧ in the same small market. |
| 14 | complaint | file a complaint | eine Beschwerde einreichen | filed | did, gave, set | The customer ⟦filed a complaint⟧ about the late delivery on Friday. |
| 15 | confirm | confirm receipt | den Eingang bestätigen | receipt | reception, income, entrance | Could you please ⟦confirm receipt⟧ of the signed contract by Friday? |
| 16 | consider | carefully consider | sorgfältig prüfen | carefully | exactly, neatly, tidily | We will ⟦carefully consider⟧ your proposal and get back to you next week. |
| 17 | constraint | impose constraints | Einschränkungen auferlegen | impose | push, press, stand | The new regulations ⟦impose strict constraints⟧ on how we store customer data. |
| 18 | contradictory | send contradictory signals | widersprüchliche Signale senden | sending | making, doing, saying | Management keeps ⟦sending contradictory signals⟧ about the reorganization. |
| 19 | contradicts | directly contradicts | widerspricht direkt | directly | straight, right, plain | The new report ⟦directly contradicts⟧ the figures we presented last month. |
| 20 | crowded | crowded with tourists | voller Touristen | with | of, from, at | In August the old town is ⟦crowded with tourists⟧ from early morning. |
| 21 | discount | offer a discount | einen Rabatt anbieten | offer | make, do, put | We can ⟦offer a discount⟧ if you sign up for two years. |
| 22 | discount | a discount on | Rabatt auf | on | at, to, in | Members get ⟦a 10 percent discount on⟧ all annual subscriptions. |
| 23 | entire | spend the entire day | den ganzen Tag verbringen | spent | brought, made, held | We ⟦spent the entire day⟧ going through the contract line by line. |
| 24 | expense | travel expenses | Reisekosten | travel | journey, voyage, tour | Please submit your ⟦travel expenses⟧ by the end of the month. |
| 25 | extent | to a large extent | weitgehend, in hohem Maße | large | big, wide, high | The delay was, ⟦to a large extent⟧, caused by missing data from the client. |
| 26 | fair point | make a fair point | einen berechtigten Einwand bringen | made | did, took, held | Tom ⟦made a fair point⟧ about the risks of launching in December. |
| 27 | fall behind | fall behind schedule | in Verzug geraten | schedule | calendar, agenda, clock | If the supplier is late again, we will ⟦fall behind schedule⟧ on the launch. |
| 28 | figure | sales figures | Verkaufszahlen | sales | selling, sold, buying | The latest ⟦sales figures⟧ look much better than we expected. |
| 29 | flu | come down with the flu | die Grippe bekommen | down | up, off, over | Half the team ⟦came down with the flu⟧ right before the trade show. |
| 30 | get carried away | get carried away by | sich von etwas mitreißen lassen | by | from, of, through | Let's not ⟦get carried away by⟧ one good month of sales. |
| 31 | graduate | graduate from college | den Hochschulabschluss machen | from | at, of, off | She ⟦graduated from college⟧ in 2015 and joined our sales team. |
| 32 | grant | apply for a grant | einen Zuschuss beantragen | applied | registered, subscribed, enrolled | The startup ⟦applied for a grant⟧ to fund its research project. |
| 33 | guardrail | put guardrails in place | Schutzmechanismen einführen | place | stand, spot, site | We need to ⟦put guardrails in place⟧ before the team uses the new AI tools. |
| 34 | hypocrite | a complete hypocrite | ein echter Heuchler | complete | whole, full, round | Calling it a team decision made him look like ⟦a complete hypocrite⟧ in the meeting. |
| 35 | introductory rate | offer an introductory rate | einen Einführungspreis anbieten | offers | makes, does, holds | The new gym ⟦offers an introductory rate⟧ of 20 dollars for the first month. |
| 36 | invoice | issue an invoice | eine Rechnung ausstellen | issue | exhibit, display, pose | Our accounting team will ⟦issue the invoice⟧ once the project is completed. |
| 37 | jump in | feel free to jump in | einfach einhaken | free | open, loose, easy | If you have a question, ⟦feel free to jump in⟧ at any time. |
| 38 | live up to | live up to expectations | den Erwartungen gerecht werden | expectations | expectancies, prospects, views | The new CRM did not ⟦live up to expectations⟧ in the first few months. |
| 39 | mention | briefly mention | kurz erwähnen | briefly | shortly, short, brief | In the call, she only ⟦briefly mentioned⟧ the new pricing model. |
| 40 | mention | worth mentioning | erwähnenswert | worth | value, worthy, merit | It is ⟦worth mentioning⟧ that the client renewed early last year. |
| 41 | milestone | reach a milestone | einen Meilenstein erreichen | reached | arrived, came, gained | The project ⟦reached an important milestone⟧ when the first client went live. |
| 42 | nuanced | take a nuanced view | eine differenzierte Sicht haben | takes | makes, does, sets | On pricing, the board ⟦takes a more nuanced view⟧ than the sales team. |
| 43 | obstacle | overcome an obstacle | ein Hindernis überwinden | overcame | overstepped, overtook, overdid | We ⟦overcame the last obstacle⟧ when legal approved the contract. |
| 44 | obtain | obtain approval from | eine Genehmigung einholen von | from | of, at, off | We need to ⟦obtain approval from⟧ the board before we sign the lease. |
| 45 | on track | keep the project on track | das Projekt im Plan halten | keep | hold, lay, sit | Weekly check-ins help us ⟦keep the project on track⟧ despite the tight timeline. |
| 46 | overrun | cost overrun | Kostenüberschreitung | cost | price, fee, charge | The ⟦cost overrun⟧ on the office move was almost 30 percent. |
| 47 | pass on | pass on the savings to | die Einsparungen weitergeben an | to | at, by, from | We will ⟦pass on the savings to⟧ our customers in the next price list. |
| 48 | peer | peer pressure | Gruppenzwang | pressure | press, push, stress | Many new hires work late because of ⟦peer pressure⟧ in the team. |
| 49 | phase out | phase out over two years | über zwei Jahre auslaufen lassen | over | during, since, along | The old licenses will be ⟦phased out over two years⟧ to give clients time. |
| 50 | pour | pour money into | Geld in etwas stecken | into | at, to, over | Investors ⟦poured money into⟧ AI startups over the last two years. |
| 51 | proceed | proceed with caution | vorsichtig vorgehen | caution | attention, precaution, carefulness | Given the legal risks, we should ⟦proceed with caution⟧ on this deal. |
| 52 | process | processed within five days | innerhalb von fünf Tagen bearbeitet | within | during, since, until | All refunds are ⟦processed within five business days⟧ after we receive the item. |
| 53 | quote | a quote for | ein Angebot für | for | about, over, after | Can you send me ⟦a quote for the new laptops⟧ by Thursday? |
| 54 | reassure | reassure staff about | die Belegschaft wegen etwas beruhigen | about | for, at, around | The CEO tried to ⟦reassure staff about⟧ the planned job cuts. |
| 55 | recap | a quick recap | eine kurze Zusammenfassung | quick | fast, rapid, hasty | Let me give you ⟦a quick recap⟧ of what we agreed last week. |
| 56 | recognize | widely recognized as | weithin anerkannt als | widely | wildly, vastly, deeply | She is ⟦widely recognized as⟧ one of the best negotiators in the industry. |
| 57 | resist | resist the temptation | der Versuchung widerstehen | temptation | seduction, attempt, trial | I had to ⟦resist the temptation⟧ to reply to every email right away. |
| 58 | retention | retention rate | Kundenbindungsrate | rate | quota, share, quote | Our ⟦retention rate⟧ rose to 92 percent after the new onboarding program. |
| 59 | revise | revise downward | nach unten korrigieren | downward | below, under, beneath | We had to ⟦revise our forecast downward⟧ after the second quarter. |
| 60 | satisfied | satisfied with | zufrieden mit | with | of, about, from | Most clients are ⟦satisfied with⟧ the new support hours. |
| 61 | squeeze | squeeze margins | die Margen drücken | margins | edges, borders, spans | Rising energy costs continue to ⟦squeeze our profit margins⟧ this year. |
| 62 | stall | set up a stall | einen Stand aufbauen | set | make, do, lay | Every Saturday they ⟦set up a stall⟧ at the farmers market downtown. |
| 63 | strip | strip someone of | jemandem etwas aberkennen | of | from, off, by | The committee voted to ⟦strip him of his title⟧ after the scandal. |
| 64 | subtle | a subtle difference | ein feiner Unterschied | difference | distance, diversity, division | There is ⟦a subtle difference⟧ between a discount and a rebate. |
| 65 | succeed | succeed in | es schaffen, etwas zu tun | in | to, by, on | We finally ⟦succeeded in getting⟧ the client to sign the renewal. |
| 66 | sustainable | environmentally sustainable | umweltverträglich | environmentally | environmental, environment, nature | The new packaging is cheaper and more ⟦environmentally sustainable⟧ than the old one. |
| 67 | tense | tense atmosphere | angespannte Stimmung | atmosphere | weather, flavor, aura | There was a ⟦tense atmosphere⟧ in the room before the budget vote. |
| 68 | terms and conditions | under the terms and conditions | gemäß den Vertragsbedingungen | under | below, beneath, among | ⟦Under the terms and conditions⟧, the client can cancel with 30 days' notice. |
| 69 | trade-off | make a trade-off | einen Kompromiss eingehen | make | do, take, hold | Every pricing model forces us to ⟦make a trade-off⟧ between growth and margin. |
| 70 | vulnerable | vulnerable to attacks | anfällig für Angriffe | to | for, against, of | Old servers are especially ⟦vulnerable to attacks⟧ from outside. |
| 71 | walk away | walk away from | aussteigen aus | from | of, off, out | If they cut the price again, we should ⟦walk away from the deal⟧. |
| 72 | within | within budget | im Budget | budget | money, finance, cash | We managed to finish the project on time and ⟦within budget⟧ this spring. |
| 73 | deadline | extend the deadline | die Frist verlängern | extend | lengthen, widen, enlarge | The client agreed to ⟦extend the deadline⟧ by two weeks. |
| 74 | feedback | constructive feedback | konstruktives Feedback | constructive | constructional, structural, built | Thanks for the ⟦constructive feedback⟧ on my presentation yesterday. |
| 75 | priority | top priority | höchste Priorität | top | upper, peak, head | Fixing the billing bug is our ⟦top priority⟧ this week. |
| 76 | risk | take a risk | ein Risiko eingehen | take | make, do, go | We cannot ⟦take that risk⟧ two weeks before the launch. |
| 77 | budget | tight budget | knappes Budget | tight | narrow, close, scarce | We are working with a very ⟦tight budget⟧ this quarter. |
| 78 | proposal | submit a proposal | ein Angebot einreichen | submit | subject, admit, commit | We have until Friday to ⟦submit our proposal⟧ to the city. |
| 79 | demand | meet demand | die Nachfrage decken | meet | join, reach, hit | We hired ten new drivers to ⟦meet the growing demand⟧ in December. |
| 80 | concern | raise concerns | Bedenken äußern | raised | lifted, heightened, elevated | Several engineers ⟦raised concerns⟧ about the new release schedule. |
| 81 | expectation | manage expectations | Erwartungen steuern | manage | lead, direct, rule | Good account managers ⟦manage client expectations⟧ from the very first call. |
| 82 | attention | draw attention to | die Aufmerksamkeit lenken auf | draw | pull, drag, lead | I would like to ⟦draw your attention to⟧ the second page of the contract. |
| 83 | consensus | reach a consensus | einen Konsens erzielen | reached | arrived, came, landed | After two hours, the team finally ⟦reached a consensus⟧ on pricing. |
| 84 | workload | heavy workload | hohe Arbeitsbelastung | heavy | strong, thick, fat | With two colleagues on leave, the team has a very ⟦heavy workload⟧ this month. |
| 85 | estimate | a rough estimate | eine grobe Schätzung | rough | raw, rude, harsh | Can you give me ⟦a rough estimate⟧ of the costs by Friday? |
| 86 | contract | terminate a contract | einen Vertrag kündigen | terminate | quit, dismiss, fire | The client can ⟦terminate the contract⟧ with three months' notice. |
| 87 | negotiation | enter into negotiations | in Verhandlungen eintreten | enter | step, walk, tread | We will ⟦enter into negotiations⟧ with the supplier next month. |
| 88 | assumption | make an assumption | eine Annahme treffen | made | did, took, met | We ⟦made the assumption⟧ that prices would stay flat this year. |
| 89 | responsibility | take responsibility for | die Verantwortung übernehmen für | took | made, gave, caught | The project lead ⟦took full responsibility for⟧ the delay. |
| 90 | advantage | take advantage of | etwas nutzen | take | make, use, draw | We should ⟦take advantage of⟧ the lower prices before the end of the year. |
| 91 | impact | have an impact on | Auswirkungen haben auf | on | of, at, for | The new law will ⟦have a big impact on⟧ small suppliers. |
| 92 | effort | make an effort | sich Mühe geben | made | did, held, took | She ⟦made a real effort⟧ to learn the names of all new clients. |
| 93 | progress | make progress | Fortschritte machen | made | did, took, had | We ⟦made good progress⟧ on the integration this week. |
| 94 | commitment | make a commitment | sich fest verpflichten | made | did, took, put | The board ⟦made a firm commitment⟧ to cut emissions by 2030. |
| 95 | question | raise a question | eine Frage aufwerfen | raised | rose, lifted, grew | Her comment ⟦raised an important question⟧ about our pricing. |
| 96 | issue | address an issue | ein Problem angehen | address | adjust, direct, speak | We need to ⟦address this issue⟧ before the launch. |
| 97 | pressure | under pressure | unter Druck | under | in, on, at | The team has been ⟦under a lot of pressure⟧ since January. |
| 98 | attempt | make an attempt | einen Versuch unternehmen | made | did, put, set | We ⟦made one last attempt⟧ to save the contract on Friday. |
| 99 | call | return a call | jemanden zurückrufen | return | reply, respond, repeat | I will ⟦return her call⟧ as soon as the meeting ends. |
| 100 | solution | find a solution | eine Lösung finden | find | meet, catch, win | We still need to ⟦find a workable solution⟧ for the night shift. |
| 101 | effect | take effect | in Kraft treten | takes | makes, gets, goes | The new travel policy ⟦takes effect⟧ on March 1. |
| 102 | interest | show interest in | Interesse zeigen an | showed | made, did, put | Two investors ⟦showed strong interest in⟧ the project last month. |

(⟦…⟧ = markierte Stelle im Satz, in der Datei als […].)

## 2. Prompt-Beispiele (gehen in jede Anfrage an Claude und prägen deren Antworten)

| Vorlage | Datei · Konstante | Inhalt | Prüffrage |
|---|---|---|---|
| `grammar-items@5` | `src/prompts/grammarItems.ts` · `GRAMMAR_ITEMS_EXAMPLE` | Lücke „The new contract ___ (sign) yesterday.“ → was signed; Satz verbessern „The invoices was sent to the client last Friday.“ → were sent, mit Ziel „Die Rechnungen gingen letzten Freitag an den Kunden.“; Erklärungen DE/EN | Eindeutig lösbar? Ist eine weitere Lösung möglich, die in `also` stehen müsste? |
| `grammar-items@5` | dieselbe Datei, Regeltext im Prompt | Selbstprüfung: `self.solved` blind lösen, `self.also` = jede weitere Antwort, die ein Muttersprachler gelten ließe; „Good English is never wrong.“ | Sind die Regeln für Claude klar und vollständig? |
| `solve-check@1` | `src/prompts/solveCheck.ts` · `SOLVE_CHECK_EXAMPLE` | „was signed“ (yesterday → Past Simple, Passiv); „has worked / has been working“ mit since 2020 → mehrdeutig | Begründungen DE/EN korrekt? |
| `diagnose@2` | `src/prompts/diagnoseV2.ts` · `DIAGNOSE2_EXAMPLE` | Annahme „have done“ bei „yesterday/last week“ (deutsches Perfekt); Zusammenfassung DE/EN | Fachlich richtig, verständlich für B2? |
| `word-bank@1` | `src/prompts/wordBank.ts` · `WORD_BANK_EXAMPLE` | Vier Sätze zu *reliable*: supplier … on time every month; forecasts … approved the budget; old car … to the coast; train connection … book a taxi (k = work, work, life, form) | Natürlich, 8–18 Wörter, Übersetzungen genau? |

## 3. Feste Antworten für Entwicklung und Tests (nicht in der Live-App sichtbar)

`src/platform/dev/canned/s4.ts` enthält Platzhaltersätze. Sie dienen nur dazu, die Prüflogik zu testen, deshalb ist eine sprachliche Gegenlesung nur kurz nötig:
- diagnose-Zusammenfassungen („Diese Woche lohnt sich vor allem die erste Verwechslung.“ / „This week the first mix-up is the most worthwhile one.“),
- solve-check-Begründungen,
- die vier word-bank-Satzmuster (Teil „Maria used … to describe our new project plan“).

Der Satz mit „colour“ ist **absichtlich britisch**: Mit ihm prüft der Test, dass die Satzbank britische Schreibweise in neuen Sätzen aussortiert.

## 4. Satzbank SB (`src/domain/tutor/sentenceBank.ts`)

Hier gibt es keine festen Inhalte. Neue KI-Sätze sammelt die App 4 Wochen lang nur in Quarantäne. Freigegeben werden sie erst, wenn in einer Stichprobe von 30 Sätzen (`teacherSample`) höchstens 2 harte Fehler stecken.

**Prüffrage:** Reicht diese Schwelle aus Sicht des Lehrers?

## Ergebnis der Gegenlesung

*(vom english-teacher auszufüllen: je Zeile OK / Änderung / streichen)*
