# Struktur-Filme, Charge 2 (P63): Kapitel 5 bis 7

Stand 08.10.2026, Branch `claude/umbau-r6-c`. Datei: `src/content/c1/anim/a2.json`. Für die Lehrer-Prüfung: je Film Ausgangssatz, Zielsatz, Vorhersage (richtig / Ablenker) und Notiz (DE, letzter Schritt).

Gezielt nicht doppelt: die Pilotfilme `f.inv.negative`, `f.em.it-cleft`, `f.cp.having` aus a1.json. Mehrere Filme je Muster tragen den Zusatz `f.<Muster>-<Zusatz>`.

## Kapitel 5 · Modalität (20 neue Filme)

### modals-deduction (6)

- `f.md.must-now` (md.must-now): **I am sure that the client is still waiting for our reply.** → **The client must still be waiting for our reply.**  
  Vorhersage: Tippen: I, am, sure, that  
  Notiz: must + Grundform: Du schließt aus Indizien, dass etwas fast sicher so ist. Pflicht sagst du meist mit have to. Im Meeting kurz und natürlich; die Mail an den Kunden bleibt bei “I assume …”.
- `f.md.cant-now` (md.cant-now): **It is not possible that this is our server, because it is still running.** → **This can't be our server, because it is still running.**  
  Vorhersage: Tippen: It, is, not, possible, that  
  Notiz: can't + Grundform: Du hältst etwas für ausgeschlossen, weil die Fakten dagegen sprechen. Schärfer als might not. Im Support-Gespräch hilfreich, gegenüber dem Kunden eher “This doesn't seem to be …”.
- `f.md.might-now` (md.might-now): **Perhaps the contract is still with the legal department.** → **The contract might still be with the legal department.**  
  Vorhersage: Tippen: Perhaps  
  Notiz: might / may / could + Grundform: Etwas ist möglich, du legst dich nicht fest. Im Gespräch normal; may klingt förmlicher, vor allem in Mails und Berichten.
- `f.md.must-have` (md.must-have): **I am sure that the quote ended up in the spam folder.** → **The quote must have ended up in the spam folder.**  
  Vorhersage: Tippen: I, am, sure, that  
  Notiz: must have + 3. Form: Du schließt aus Indizien, dass etwas fast sicher passiert ist. Im Gespräch üblich; in einer Mail an den Kunden bleibt es bei “It looks like …”.
- `f.md.cant-have` (md.cant-have): **It is impossible that our team sent it, because they had no access.** → **Our team can't have sent it, because they had no access.**  
  Vorhersage: Tippen: It, is, impossible, that  
  Notiz: can't have + 3. Form: Du hältst etwas Vergangenes für ausgeschlossen. couldn't have geht genauso. Im Gespräch ein klarer Einwand; schriftlich eher “It is unlikely that …”.
- `f.md.might-have` (md.might-have): **Maybe the competitor has already seen the offer.** → **The competitor might have already seen the offer.**  
  Vorhersage: Tippen: Maybe  
  Notiz: might / may / could have + 3. Form: Etwas ist vielleicht schon passiert. Vorsichtiger und genauer als maybe, gut in Analysen und Statusmeldungen; im Gespräch ist maybe völlig in Ordnung.

### modals-prob (4)

- `f.mp.may-well` (mp.may-well): **It is quite possible that the client will accept our offer.** → **The client may well accept our offer.**  
  Vorhersage: Tippen: It, is, quite, possible, that, will  
  Notiz: may / might well + Grundform: durchaus möglich, eher mehr als nur möglich. Gut in Prognosen im Meeting; schriftlich an den Kunden eher “is quite likely to”.
- `f.mp.bound` (mp.bound): **I am certain that price will come up again.** → **Price is bound to come up again.**  
  Vorhersage: Tippen: I, am, certain, that, will  
  Notiz: be bound to + Grundform: fast sicher, weil die Lage es so mit sich bringt. Stärker als is likely to; nur für Dinge, die du wirklich erwartest, nicht für Wünsche. Im Vorbereitungsgespräch sehr natürlich.
- `f.mp.likely` (mp.likely): **It is probable that the rollout will not be finished before March.** → **The rollout is unlikely to be finished before March.**  
  Vorhersage: Wahl: richtig „The rollout is unlikely to be finished before March.“ / Ablenker „The rollout is improbable to be finished before March.“  
  Notiz: be likely / unlikely to + Grundform. Mit probable und improbable geht to nicht, dort folgt that. Sachlich und knapp in Status und Mail.
- `f.mp.chance` (mp.chance): **We will probably win the contract.** → **There is a good chance of winning the contract.**  
  Vorhersage: Wahl: richtig „There is a good chance of winning the contract.“ / Ablenker „There is a good chance for winning the contract.“  
  Notiz: a good chance of + -ing (nicht for). Nominalstil gibt der Prognose Gewicht, passend für Folien und Berichte; im Gespräch genügt “We'll probably win it.”

### modals-advice (5)

- `f.ma.should` (ma.should): **Send the agenda to the client before the call.** → **I think you should send the agenda to the client before the call.**  
  Vorhersage: Wahl: richtig „I think you should send the agenda to the client before the call.“ / Ablenker „I think you shall send the agenda to the client before the call.“  
  Notiz: should / ought to + Grundform (ohne to nach should). Als Rat klingt es freundlicher als der Befehl, “I think” mildert weiter. Unter Kollegen üblich; dem Chef gegenüber eher “You might want to …”. Nicht shall: „du sollst“ heißt should; shall klingt nach Vorschrift oder Vertrag.
- `f.ma.had-better` (ma.had-better): **We should send the quote before Friday, or we will miss the deadline.** → **We had better send the quote before Friday, or we will miss the deadline.**  
  Vorhersage: Wahl: richtig „We had better send the quote before Friday, or we will miss the deadline.“ / Ablenker „We had better to send the quote before Friday, or we will miss the deadline.“  
  Notiz: had better + Grundform (ohne to). Es meint: sonst gibt es eine Folge. Das setzt Druck, deshalb eher unter Kollegen; dem Kunden gegenüber besser “It would be best to …”.
- `f.ma.polite` (ma.polite): **You have to move the rollout to May.** → **You could move the rollout to May.**  
  Vorhersage: Tippen: have, to  
  Notiz: could + Grundform: ein Vorschlag, der dem Kunden die Wahl lässt. Im Verkaufsgespräch zeigst du so Optionen, ohne zu drängen: “You could also …”.
- `f.ma.dont-have-to` (ma.dont-have-to): **It is not necessary for you to send us the data in advance.** → **You don't have to send us the data in advance.**  
  Vorhersage: Wahl: richtig „You don't have to send us the data in advance.“ / Ablenker „You must not send us the data in advance.“  
  Notiz: don't have to / don't need to: nicht nötig. needn't (ohne to) ist förmlich und britisch. Nicht mit mustn't verwechseln, das verbietet. Beruhigt in Angebotsmails: “You don't have to …”.
- `f.ma.should-have` (ma.should-have): **We did not involve legal early enough.** → **We should have involved legal earlier.**  
  Vorhersage: Wahl: richtig „We should have involved legal earlier.“ / Ablenker „We should have involve legal earlier.“  
  Notiz: should have + 3. Form: Rückblick, was besser gewesen wäre. In der Retrospektive nimmst du mit “we” die Schärfe raus; “You should have …” klingt nach Vorwurf.

### c1-hedging (5)

- `f.hg.modal` (hg.modal): **This will cause delays.** → **This might cause delays.**  
  Vorhersage: Tippen: will  
  Notiz: might / could statt will: Du sagst, was passieren kann, ohne dich festzulegen, und bleibst trotzdem klar. Gut in Prognosen für Kunden; may ist förmlicher.
- `f.hg.worth` (hg.worth): **You should check the objections first.** → **It might be worth checking the objections first.**  
  Vorhersage: Wahl: richtig „It might be worth checking the objections first.“ / Ablenker „It might be worth to check the objections first.“  
  Notiz: worth + -ing (nie worth to). might lässt Spielraum, der Vorschlag wirkt nicht wie eine Anweisung. Typisch in Meetings und Mails; unter Kollegen reicht “You should …”.
- `f.hg.inclined` (hg.inclined): **I think we should wait until after quarter end.** → **I'd be inclined to wait until after quarter end.**  
  Vorhersage: Tippen: think, we, should  
  Notiz: I'd be inclined to + Grundform: Du sagst deine Tendenz und bleibst offen für Gegenargumente. Höflich gegenüber Chef und Kunde; sehr natürlich in Besprechungen.
- `f.hg.seems` (hg.seems): **The approval process is slow.** → **It would seem that the approval process is slow.**  
  Vorhersage: Wahl: richtig „It would seem that the approval process is slow.“ / Ablenker „Apparently is the approval process slow.“  
  Notiz: It seems / appears / would seem that + Satz, ohne Komma vor that. would schwächt zusätzlich ab. Berichte und Analysen; im Gespräch: “It looks like the approval process is slow.” Nicht: „Apparently is the process slow“ – nach einem Adverb vorn bleibt im Englischen das Subjekt vor dem Verb.
- `f.hg.downtoner` (hg.downtoner): **The solution does not fit our process.** → **The solution does not quite fit our process.**  
  Vorhersage: Wahl: richtig „The solution does not quite fit our process.“ / Ablenker „The solution does not fit quite our process.“  
  Notiz: not quite / slightly / somewhat steht vor dem Wort, das es abschwächt, nicht hinter dem Verb. Die Kritik wird kleiner, bleibt aber klar. Im Kundengespräch statt des harten “does not fit”.

## Kapitel 6 · Verbmuster (27 neue Filme)

### gerund-inf (3)

- `f.gi.ing-verbs` (gi.ing-verbs): **We don't send reminders on weekends if we can help it.** → **We avoid sending reminders on weekends.**  
  Vorhersage: Wahl: richtig „We avoid sending reminders on weekends.“ / Ablenker „We avoid to send reminders on weekends.“  
  Notiz: avoid, consider, suggest, finish + -ing (nie to). Knapp und präzise in Mails und Richtlinien; im Gespräch sagst du es lockerer.
- `f.gi.prep-ing` (gi.prep-ing): **We hope to join your kickoff call.** → **We look forward to joining your kickoff call.**  
  Vorhersage: Wahl: richtig „We look forward to joining your kickoff call.“ / Ablenker „We look forward to join your kickoff call.“  
  Notiz: look forward to + -ing, denn to ist hier eine Präposition. Der Standardschluss von Angeboten und Follow-up-Mails; im Gespräch genügt “Looking forward to it.”
- `f.gi.bare-inf` (gi.bare-inf): **Our manager required us to redo the report.** → **Our manager made us redo the report.**  
  Vorhersage: Wahl: richtig „Our manager made us redo the report.“ / Ablenker „Our manager made us to redo the report.“  
  Notiz: make / let + Objekt + Grundform ohne to (im Passiv aber mit to: “We were made to redo it”). made betont den Zwang. Im Gespräch üblich; schriftlich neutraler: “required us to”.

### verb-patterns (2)

- `f.vp.regret` (vp.regret): **We are sorry to tell you that the date has changed.** → **We regret to inform you that the date has changed.**  
  Vorhersage: Tippen: are, sorry, tell  
  Notiz: regret to + inform / say / tell: Du überbringst jetzt eine schlechte Nachricht. regret + -ing blickt dagegen zurück. Förmliche Mail oder Brief; im Gespräch genügt “Unfortunately, …”.
- `f.vp.remember-forget` (vp.remember-forget): **Please do not forget to send the approval.** → **Please remember to send the approval.**  
  Vorhersage: Tippen: do, not, forget  
  Notiz: remember to + Grundform: daran denken, etwas noch zu tun. remember + -ing meint dagegen, sich an etwas Erledigtes zu erinnern. Kurz und höflich in Follow-up-Mails.

### prepositions (4)

- `f.prp.person-to` (prp.person-to): **We gave the client an explanation of the pricing structure.** → **We explained the pricing structure to the client.**  
  Vorhersage: Wahl: richtig „We explained the pricing structure to the client.“ / Ablenker „We explained the client the pricing structure.“  
  Notiz: explain, say, suggest, describe: erst die Sache, dann to + Person. Das Verb erklärt knapper als die Nominalform und klingt direkter. Mail und Gespräch gleich gut.
- `f.prp.no-prep` (prp.no-prep): **We will talk about the rollout on Monday.** → **We will discuss the rollout on Monday.**  
  Vorhersage: Wahl: richtig „We will discuss the rollout on Monday.“ / Ablenker „We will discuss about the rollout on Monday.“  
  Notiz: discuss, mention, address, attend, reach, enter: ohne Präposition. discuss ist sachlicher als talk about. Passt in Einladungen und Agenden; im Gespräch ist talk about völlig in Ordnung.
- `f.prp.verb-prep` (prp.verb-prep): **The number of seats determines the final fee.** → **The final fee depends on the number of seats.**  
  Vorhersage: Wahl: richtig „The final fee depends on the number of seats.“ / Ablenker „The final fee depends from the number of seats.“  
  Notiz: depend on, consist of, comply with, result in: lerne Verb und Präposition als Paar. depends on stellt die Gebühr in den Vordergrund und beantwortet die Kundenfrage direkt: “It depends on the number of seats.”
- `f.prp.adj-prep` (prp.adj-prep): **We know about the risk.** → **We are fully aware of the risk.**  
  Vorhersage: Wahl: richtig „We are fully aware of the risk.“ / Ablenker „We are fully aware about the risk.“  
  Notiz: aware of, responsible for, satisfied with: das Adjektiv bringt seine Präposition mit. Stark im Einwand-Gespräch: “We are fully aware of …”.

### prep-noun (2)

- `f.pn.in` (pn.in): **Costs rose by 12 percent.** → **There was a 12 percent increase in costs.**  
  Vorhersage: Tippen: Costs, rose, by  
  Notiz: increase / decrease / rise / change in + Bereich (increase of nennt nur die Größe). Nominalstil für Berichte und Folien; im Gespräch: “Costs went up 12 percent.”
- `f.pn.about` (pn.about): **The client is worried about data security.** → **The client has concerns about data security.**  
  Vorhersage: Tippen: is, worried  
  Notiz: concerns about + Thema. Das Nomen macht die Sorge zu einer sachlichen Position, die du bearbeiten kannst. Gut in Berichten und im Einwand-Gespräch: “I understand your concerns about …”.

### phrasal-syntax (2)

- `f.ph.separable` (ph.separable): **We ruled out the on-premises option.** → **We ruled it out.**  
  Vorhersage: Wahl: richtig „We ruled it out.“ / Ablenker „We ruled out it.“  
  Notiz: Bei trennbaren Phrasal Verbs steht ein Pronomen immer in der Mitte (rule it out). So verweist du knapp auf Bekanntes. Gespräch und Mail gleich.
- `f.ph.together` (ph.together): **We will investigate the pricing issue.** → **We will look into it.**  
  Vorhersage: Wahl: richtig „We will look into it.“ / Ablenker „We will look it into.“  
  Notiz: Auch mit Pronomen bleibt look into zusammen: look into it. Im Support-Gespräch eine souveräne Antwort; die Mail an den Kunden darf “investigate” sagen.

### articles (1)

- `f.art.the-unique` (art.the-unique): **The majority of our clients use the cloud version.** → **Most of our clients use the cloud version.**  
  Vorhersage: Wahl: richtig „Most of our clients use the cloud version.“ / Ablenker „The most of our clients use the cloud version.“  
  Notiz: most = die meisten, ohne the; the most nur beim Superlativ von Adjektiven: the most reliable option. Natürlicher als the majority of.

### countable (1)

- `f.cnt.verb` (cnt.verb): **The comments from the client are very positive.** → **The client's feedback is very positive.**  
  Vorhersage: Wahl: richtig „The client's feedback is very positive.“ / Ablenker „The client's feedbacks are very positive.“  
  Notiz: feedback, information, advice, news sind unzählbar: kein -s, Verb im Singular, kein a/an. Zählen geht mit a piece of. Berichte und Mails.

### quant-neg (3)

- `f.qn.hardly` (qn.hardly): **Almost nobody uses the old portal.** → **Hardly anybody uses the old portal.**  
  Vorhersage: Wahl: richtig „Hardly anybody uses the old portal.“ / Ablenker „Hardly nobody uses the old portal.“  
  Notiz: hardly, scarcely, barely sind schon verneinend: danach kein weiteres nobody oder not, sondern anybody, any, ever. Präziser in Berichten; im Gespräch ist almost nobody völlig üblich.
- `f.qn.no-longer` (qn.no-longer): **We do not offer this license anymore.** → **We no longer offer this license.**  
  Vorhersage: Tippen: do, not, anymore  
  Notiz: no longer steht vor dem Verb und ersetzt not … anymore. Förmlicher und knapper: Angebote, Produktänderungen, Mails an Kunden. Im Gespräch sagst du “We don't offer it anymore”.
- `f.qn.number` (qn.number): **Several clients have asked about the new module.** → **A number of clients have asked about the new module.**  
  Vorhersage: Wahl: richtig „A number of clients have asked about the new module.“ / Ablenker „A number of clients has asked about the new module.“  
  Notiz: a number of + Plural: Das Verb steht im Plural (the number of dagegen im Singular: the number has grown). Formeller als several, passend für Berichte und Präsentationen.

### relative (4)

- `f.rc.prep` (rc.prep): **The client we spoke with has approved the budget.** → **The client with whom we spoke has approved the budget.**  
  Vorhersage: Wahl: richtig „The client with whom we spoke has approved the budget.“ / Ablenker „The client with who we spoke has approved the budget.“  
  Notiz: Steht die Präposition vorn, folgt whom (nie who). Förmlich: Berichte, Verträge, Mails an die Geschäftsführung. Im Gespräch bleibst du bei “the client we spoke to”.
- `f.rc.commas` (rc.commas): **Our sales team is based in Chicago and will lead the rollout.** → **Our sales team, which is based in Chicago, will lead the rollout.**  
  Vorhersage: Wahl: richtig „Our sales team, which is based in Chicago, will lead the rollout.“ / Ablenker „Our sales team, that is based in Chicago, will lead the rollout.“  
  Notiz: Zusatzinfo steht zwischen Kommas, mit which oder who, nie mit that. Verdichtet zwei Aussagen zu einer; üblich in Angeboten und Berichten, im Gespräch eher zwei kurze Sätze.
- `f.rc.whose` (rc.whose): **Clients that have their data in the EU need a separate contract.** → **Clients whose data is stored in the EU need a separate contract.**  
  Vorhersage: Wahl: richtig „Clients whose data is stored in the EU need a separate contract.“ / Ablenker „Clients which their data is stored in the EU need a separate contract.“  
  Notiz: whose ersetzt that … their: ein Wort für den Besitz, kein zusätzliches their. Kompakt in Verträgen und Preislisten; im Gespräch sagst du “Clients with data in the EU …”.
- `f.rc.that-what` (rc.that-what): **We put everything we discussed in the proposal.** → **Everything that we discussed is in the proposal.**  
  Vorhersage: Wahl: richtig „Everything that we discussed is in the proposal.“ / Ablenker „Everything what we discussed is in the proposal.“  
  Notiz: Nach everything, all, nothing und anderen Bezugswörtern steht that (oder nichts), nie what. what gibt es nur ohne Bezugswort: “What we discussed is in the proposal.” Gut als klare Zusage in Follow-ups.

### linkers (5)

- `f.lk.despite` (lk.despite): **Although there was a delay, we remain on schedule.** → **Despite the delay, we remain on schedule.**  
  Vorhersage: Wahl: richtig „Despite the delay, we remain on schedule.“ / Ablenker „Despite of the delay, we remain on schedule.“  
  Notiz: despite / in spite of + Nomen oder -ing, ohne of bei despite. Kürzer als although. Statusberichte und Folien; im Gespräch: “We had a delay, but we're on schedule.”
- `f.lk.although` (lk.although): **The budget is tight, but we can still start in May.** → **Although the budget is tight, we can still start in May.**  
  Vorhersage: Wahl: richtig „Although the budget is tight, we can still start in May.“ / Ablenker „Although the budget is tight, but we can still start in May.“  
  Notiz: Mit although steht kein but im Hauptsatz; die Konjunktion steht nur einmal. Der Nebensatz mit although stellt das Hindernis zurück und das Ergebnis voran. Gut in Angebotsmails.
- `f.lk.whereas` (lk.whereas): **The cloud solution scales easily, but the on-premises one does not.** → **The cloud solution scales easily, whereas the on-premises one does not.**  
  Vorhersage: Tippen: but  
  Notiz: whereas / while stellt zwei Dinge gegenüber, ohne eines abzuwerten. Gut für Vergleiche in Präsentationen und Angeboten; im Gespräch genügt but.
- `f.lk.however` (lk.however): **The offer is good, but the timeline is tight.** → **The offer is good. However, the timeline is tight.**  
  Vorhersage: Tippen: but  
  Notiz: However steht am Satzanfang nach einem Punkt, danach ein Komma; ein Komma davor reicht nicht. Setzt die Einschränkung ab und gibt ihr Gewicht. Mails und Berichte.
- `f.lk.therefore` (lk.therefore): **The vendor needs two weeks, so we need your approval by Friday.** → **The vendor needs two weeks. Therefore, we need your approval by Friday.**  
  Vorhersage: Tippen: so  
  Notiz: Therefore / as a result trennt Grund und Folge in zwei Sätze, mit Komma danach. Förmlicher als so, passend für Mails und Berichte; im Gespräch sagst du so.

## Kapitel 7 · Satzbau und Betonung (30 neue Filme)

### c1-participle (2)

- `f.cp.ing` (cp.ing): **We updated the schedule and added two buffers.** → **We updated the schedule, adding two buffers.**  
  Vorhersage: Tippen: and  
  Notiz: Ein -ing-Teil hängt eine zweite Handlung an dieselbe Person, mit Komma davor. Das verdichtet den Bericht. Üblich in Statusmails; im Gespräch bleibst du bei and.
- `f.cp.pp` (cp.pp): **The files that are stored on the old server need to be migrated.** → **The files stored on the old server need to be migrated.**  
  Vorhersage: Tippen: that, are  
  Notiz: Die 3. Form ersetzt that / which + Passiv und steht direkt hinter dem Nomen. Das spart Wörter in Berichten und auf Folien; im Gespräch ist der Relativsatz völlig in Ordnung.

### c1-discourse (3)

- `f.dm.concede` (dm.concede): **The product is good, but it is too expensive for us.** → **The product is good. That said, it is too expensive for us.**  
  Vorhersage: Tippen: but  
  Notiz: That said / Having said that: Du lobst und schränkst im nächsten Satz ein, mit Komma danach. Im Meeting der freundliche Einwand; schriftlich nur sparsam.
- `f.dm.build` (dm.build): **Also, we should talk about training.** → **To build on that, we should talk about training.**  
  Vorhersage: Tippen: Also  
  Notiz: To build on that knüpft an das eben Gesagte an und führt es weiter. Zeigt, dass du zugehört hast; gut in Workshops und Präsentationen.
- `f.dm.return` (dm.return): **Let me return to the price: we can offer a 5 percent discount.** → **Coming back to the price, we can offer a 5 percent discount.**  
  Vorhersage: Tippen: Let, me, return  
  Notiz: Coming back to + Thema holt den Faden zurück, mit Komma danach. So lenkst du ein Gespräch vom Nebenpfad zurück. Gut in Verhandlungen und Meetings.

### c1-emphasis (4)

- `f.em.what-cleft` (em.what-cleft): **The timeline worries us most.** → **What worries us most is the timeline.**  
  Vorhersage: Tippen: The, timeline  
  Notiz: What + Satz + is: Das Wichtige steht am Ende und bekommt Gewicht. Stark bei Einwänden und in Präsentationen: “What matters is …”. Im Alltag reicht der einfache Satz.
- `f.em.neg-inversion` (em.neg-inversion): **We rarely see such clear requirements.** → **Rarely do we see such clear requirements.**  
  Vorhersage: Tippen: rarely  
  Notiz: Rarely / Seldom vorn: Hilfsverb vor Subjekt; ohne Hilfsverb im Satz kommt do / does / did dazu. Formell und betont: Rede oder Präsentation, im Gespräch sparsam.
- `f.em.not-only` (em.not-only): **The system lowers costs, and it also improves security.** → **Not only does the system lower costs, but it also improves security.**  
  Vorhersage: Wahl: richtig „Not only does the system lower costs, but it also improves security.“ / Ablenker „Not only the system lowers costs, but it also improves security.“  
  Notiz: Not only vorn: Hilfsverb vor Subjekt, Verb in der Grundform; der zweite Teil folgt mit but … also. Betont zwei Vorteile in einem Zug, für Pitch und Folien; im Gespräch: “It lowers costs and improves security.”
- `f.em.only-inversion` (em.only-inversion): **We can start only after we receive your approval.** → **Only after we receive your approval can we start.**  
  Vorhersage: Wahl: richtig „Only after we receive your approval can we start.“ / Ablenker „Only after we receive your approval we can start.“  
  Notiz: Only after + Nebensatz vorn: Im Hauptsatz steht das Hilfsverb vor dem Subjekt. Setzt die Bedingung ans Ende der Aufmerksamkeit und klingt förmlich; gut in Verhandlungen, im Alltag reicht die einfache Form.

### inversion (2)

- `f.inv.cond` (inv.cond): **If you need further information, please call me.** → **Should you need further information, please call me.**  
  Vorhersage: Tippen: If  
  Notiz: Should + Subjekt + Grundform ersetzt if. Förmlich und höflich: der klassische Satz am Ende von Angebotsmails. Im Gespräch bleibst du bei If.
- `f.inv.cond-had` (inv.cond): **If we had known earlier, we would have moved the date.** → **Had we known earlier, we would have moved the date.**  
  Vorhersage: Tippen: If  
  Notiz: Had + Subjekt + 3. Form ersetzt If … had. Förmlich, meist schriftlich: im Bericht oder in der Rückschau. Im Gespräch sagst du If we had known …

### emph-plus (3)

- `f.ep.do-emph` (ep.do-emph): **I really think we can meet the deadline.** → **I do think we can meet the deadline.**  
  Vorhersage: Tippen: really  
  Notiz: do + Grundform betont die Aussage, besonders gegen einen Zweifel; die Betonung liegt auf do. Im Gespräch sehr natürlich, besonders bei Einwänden: “We did tell you …”. Schriftlich selten.
- `f.ep.concession` (ep.concession): **Although the offer is tempting, we cannot accept it.** → **Tempting as the offer is, we cannot accept it.**  
  Vorhersage: Tippen: Although, tempting  
  Notiz: Adjektiv + as + Subjekt + be ersetzt although und stellt das Adjektiv nach vorn. Förmlich und gewichtig: Verhandlungen, Reden. Im Gespräch bleibst du bei Although.
- `f.ep.so-such` (ep.so-such): **Demand was very high, so we had to add capacity.** → **Demand was so high that we had to add capacity.**  
  Vorhersage: Wahl: richtig „Demand was so high that we had to add capacity.“ / Ablenker „Demand was such high that we had to add capacity.“  
  Notiz: so + Adjektiv + that; such steht vor Nomen (such high demand). Das Ergebnis rückt in den Mittelpunkt. Gut in Berichten und Case Studies; im Gespräch genügt “… , so we had to …”.

### ellipsis (3)

- `f.el.so-not` (el.so-not): **I assume that legal will approve the draft.** → **I assume so.**  
  Vorhersage: Wahl: richtig „I assume so.“ / Ablenker „I assume it.“  
  Notiz: so ersetzt den ganzen that-Satz (hope, think, expect, assume + so); negativ: I hope not, I don't think so. Im Gespräch Standard, in Mails wirkt es kurz und freundlich.
- `f.el.do-so` (el.do-so): **Customers who want to upgrade can upgrade at any time.** → **Customers who want to upgrade can do so at any time.**  
  Vorhersage: Tippen: upgrade  
  Notiz: do so ersetzt ein Verb samt Objekt, um Wiederholung zu vermeiden (do the same, do so). Förmlich: Verträge, Mails, Preislisten. Im Gespräch sagst du “… can do it”.
- `f.el.one-ones` (el.one-ones): **The new version is more stable than the old version.** → **The new version is more stable than the old one.**  
  Vorhersage: Tippen: version  
  Notiz: one (Plural: ones) ersetzt ein zählbares Nomen, meist nach einem Adjektiv. So vermeidest du Wiederholung. Gespräch und Bericht gleich gut.

### noun-phrase (4)

- `f.np.contact` (np.contact): **The system that we tested last quarter is the most reliable.** → **The system we tested last quarter is the most reliable.**  
  Vorhersage: Tippen: that  
  Notiz: Ist das Bezugswort Objekt im Relativsatz, darf that wegfallen. Bei Subjekt (the system that failed) bleibt es. Kürzer und flüssiger in Mails und im Gespräch.
- `f.np.of-s` (np.of-s): **The CEO of the company approved the budget.** → **The company's CEO approved the budget.**  
  Vorhersage: Tippen: of, the  
  Notiz: 's steht bei Personen und Organisationen, of bei Sachen (the end of the contract). Kürzer und lebendiger in Mails und Folien; der förmliche Stil bleibt bei of.
- `f.np.to-inf` (np.to-inf): **The first client who signs will get a discount.** → **The first client to sign will get a discount.**  
  Vorhersage: Tippen: who  
  Notiz: Nach first, last, only, next steht to + Grundform statt eines Relativsatzes. Kompakt in Aktionen, Angeboten und Folien; im Gespräch sagst du “who signs”.
- `f.np.post` (np.post): **We do not yet know how far the rollout affects the team.** → **We do not yet know the extent to which the rollout affects the team.**  
  Vorhersage: Wahl: richtig „We do not yet know the extent to which the rollout affects the team.“ / Ablenker „We do not yet know the extent to what the rollout affects the team.“  
  Notiz: the extent to which: Nomen + Präposition + which, nie what. Das Nomen gibt dem Satz Gewicht. Berichte und Risikoanalysen; im Gespräch sagst du how far.

### compound-mod (4)

- `f.cm.measure` (cm.measure): **The workshop lasts three days.** → **It is a three-day workshop.**  
  Vorhersage: Wahl: richtig „It is a three-day workshop.“ / Ablenker „It is a three-days workshop.“  
  Notiz: Vor dem Nomen steht das Maß im Singular mit Bindestrich: a three-day workshop, a 30-minute demo. Das gilt für alle Maße. Kompakt in Einladungen und Agenden.
- `f.cm.fixed` (cm.fixed): **We want a contract that runs for a long time.** → **We want a long-term contract.**  
  Vorhersage: Tippen: that, runs, for, a, time  
  Notiz: Feste Modifikatoren vor dem Nomen werden mit Bindestrich geschrieben: long-term, high-level, state-of-the-art. Das ist kürzer und klingt professioneller in Angeboten und Verträgen.
- `f.cm.participle` (cm.participle): **We have a network that is well established.** → **We have a well-established network.**  
  Vorhersage: Tippen: that, is  
  Notiz: Adverb + 3. Form vor dem Nomen wird mit Bindestrich verbunden: well-known, newly built. Das macht die Beschreibung kompakt für Referenzen; nach dem Verb schreibst du ohne Bindestrich: “The network is well established.”
- `f.cm.order` (cm.order): **We need a system for the management of documents.** → **We need a document management system.**  
  Vorhersage: Wahl: richtig „We need a document management system.“ / Ablenker „We need a documents management system.“  
  Notiz: Ein Nomen vor einem Nomen steht im Singular: document management, contract renewal, invoice processing. So bildest du kompakte Fachbegriffe für Angebote und Folien.

### word-order (2)

- `f.wo.verb-object` (wo.verb-object): **Tomorrow we will send the quote to you.** → **We will send you the quote tomorrow.**  
  Vorhersage: Wahl: richtig „We will send you the quote tomorrow.“ / Ablenker „We will send you tomorrow the quote.“  
  Notiz: Zwischen Verb und Objekt steht nichts: send + wem + was, dann Ort und Zeit. Das ist die neutrale Reihenfolge in Mails; die Zeit vorn betont den Termin.
- `f.wo.hardly-sooner` (wo.hardly-sooner): **We had hardly started the demo when the connection dropped.** → **Hardly had we started the demo when the connection dropped.**  
  Vorhersage: Tippen: hardly  
  Notiz: Hardly + had + Subjekt + 3. Form, dann when (nicht than). Eine dramatische, erzählende Form für Rede oder Case Story; im Alltag reicht “As soon as we started …”.

### comparison (3)

- `f.cmp.the-the` (cmp.the-the): **If you sign earlier, the price will be lower.** → **The earlier you sign, the lower the price will be.**  
  Vorhersage: Tippen: If, earlier, lower  
  Notiz: the + Komparativ …, the + Komparativ …: Beides geht gemeinsam. Das gibt dem Vorteil Zug und eignet sich für Verhandlungen und Preisangebote; im Gespräch sagst du “If you sign earlier, …”.
- `f.cmp.degree` (cmp.degree): **Our price is a lot lower than last year.** → **Our price is considerably lower than last year.**  
  Vorhersage: Tippen: a, lot  
  Notiz: far, much, considerably, slightly + Komparativ: Das Maß steht davor (nicht very lower). Genauer in Angeboten und Berichten; im Gespräch ist a lot lower völlig üblich.
- `f.cmp.as-as` (cmp.as-as): **Our system is much faster than the competitor's.** → **Our system is twice as fast as the competitor's.**  
  Vorhersage: Wahl: richtig „Our system is twice as fast as the competitor's.“ / Ablenker „Our system is twice as fast like the competitor's.“  
  Notiz: as + Adjektiv + as, vorn mit twice, three times, half: nach as … as nie than. Das Vielfache macht den Vorteil messbar; gut in Pitch und Angebot.
