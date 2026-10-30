# Vokabeln: Synthese der besten Methoden (V0a)

Stand 30.10.2026 · Paket V0a · Grundlage: 18 Steckbriefe in `anbieter/`, Emrahs Auftrag `../auftraege/vokabel-umbau-emrah.md`, Forschung `../../relaunch/recherche/lena-lernwissenschaft.md` (kurz **Lena**), Markt-Breite `../../relaunch/recherche/mara-lernmethodik.md` (kurz **Mara**), Trainer-Konzept `../../relaunch/vokabeltrainer.md` (kurz **VT**), Vorschau v2 (`../../relaunch/vorschau/src`).

**Was dieses Dokument ist:** Es sammelt jede Methode, die mindestens ein Anbieter für Wörter nutzt, und urteilt darüber. Es beschreibt dann die beste Kombination für Emrah, gleicht sie mit Emrahs Auftrag und der Vorschau ab und sagt je Methode, wo sie gebaut und wie geprüft wird. **Emrahs Auftrag bleibt der Maßstab.** Wo die Synthese davon abweicht, ist das ein Vorschlag an ihn (Abschnitt 3.3). Gebaut wird erst nach V0 und Emrahs OK.

**Kennzeichnung:**
- **[G]/[S]** stehen in den Steckbriefen an jeder Aussage. Hier verweise ich auf den Steckbrief, z. B. [anki §1.4]. Dort steht die Quelle.
- **Forschung:** Abschnitt bei Lena (z. B. Lena 2.1) oder ein Steckbrief mit Studie.
- **[Folgerung]** heißt: eigene Schlussfolgerung aus belegten Teilen. **[Vermutung]** heißt: ohne Beleg.

**Auf einen Blick: Wer wofür Vorbild ist**

| Bereich | Bestes Vorbild | Warum |
|---|---|---|
| Planung | **Anki** (FSRS, Fuzz, Lastausgleich, Geschwister-Sperre, offener Code) | genaueste und am besten belegte Planung am Markt [anki §1] |
| Abfrage | **Lingvist** (Wort in die Lücke tippen, deutsche Bedeutung als Hinweis) und **Quizlet Learn** (Frageform steigt je Wort) | Lingvist übt Abruf vom ersten Tag an [lingvist §2]; Quizlet rechnet Raten heraus [quizlet §1.2] |
| Bewertung | **Lingvist** (Tippfehler nach Lage und Schwere) und **Clozemaster/Vocabulary.com** (Hinweis halbiert) | automatisch, fair, ohne Selbsturteil [lingvist §3, clozemaster §3, vocabulary-com §3] |
| Kontext | **Vocabulary.com** (viele Fragen je Wortsinn) und **Readlang/LingQ** (Satz aus dem eigenen Lesen) | wechselnde Sätze, Zustand am Wort [vocabulary-com §1, readlang §5] |
| Aktive Nutzung | **Busuu** (freie Sätze werden korrigiert) und **Memrise** (Spur „benutzt“) | Den Schritt zum Benutzen hat kaum ein Anbieter; diese beiden kommen am nächsten [busuu §6, memrise §7] |
| Transparenz | **Anki** (Lastvorschau, echte Behaltensrate) und **Clozemaster** („nächste Wiederholung in …“, Stufenbalken) | ehrliche Zahlen statt Punkte [anki §7, clozemaster §7] |

**Lücke im Markt [Folgerung aus allen 18 Steckbriefen]:** Kein Anbieter verbindet alle drei Teile: FSRS je Wort, eine automatische Bewertung mit Zeit und Hilfe und eine Leiter bis zum eigenen, geprüften Satz. Anki plant am besten, lässt aber selbst benoten. Lingvist und Clozemaster fragen am besten ab, planen aber einfach oder je Satz. Busuu und Memrise führen zum Benutzen, prüfen aber kaum Wörter. Genau diese Verbindung ist Emrahs Auftrag.

---

## 1. Methoden-Tabelle

Spalten: **Nr.** · **Methode** · **wer** (Steckbrief) · **Forschung** · **dafür / dagegen** · **Urteil** mit Grund.
Urteile: **Ü** übernehmen · **A** anpassen · **V** verwerfen. Die Nummern (M1 …) gelten in Abschnitt 5 weiter.

### 1.1 Planung

| Nr. | Methode | wer | Forschung | dafür / dagegen | Urteil |
|---|---|---|---|---|---|
| M1 | **FSRS je Gedächtnisspur** (Stabilität, Schwierigkeit, Abrufwahrscheinlichkeit; Ziel-Behaltensquote) | Anki [anki §1.1], RemNote (Beta) [remnote §1], Mochi (wählbar) [mochi §1]; SuperMemo als Ursprung [supermemo §1] | Lena 2.2: FSRS sagt besser vorher als SM-2 (Benchmark, kein Peer-Review); Lindsey u. a. 2014: modellbasiert +10 % gegenüber Pauschalplan | + offen, gemessen, keine „Ease Hell“ · − Benchmark nicht begutachtet; ts-fsrs 6 schaltet still auf FSRS-7 um [anki §1.1] | **Ü** Emrahs Auftrag 3.1. FSRS-Version wird bewusst festgelegt: ts-fsrs 5 behalten, FSRS-7 erst nach eigener Simulation. |
| M2 | **Raten herausrechnen**: Eine richtige Auswahl verändert den Zustand weniger (Ratewahrscheinlichkeit 1/Optionen) | Quizlet RPL-Modell [quizlet §1.2] | Lena 2.3: Rechenbeispiel Raten (bei 4 Optionen ist jede 5. Richtige geraten) | + verhindert Aufstieg durch Glück · − Quizlet schwächt nur ab, Emrah will gar keine Wirkung | **A** strenger als Quizlet: Auswahl ändert FSRS **nie** (Emrah 4.3), sie dient nur als Einführung und Rettung. |
| M3 | **Feste Intervall-Leitern** (z. B. 0/1/10/30/180 Tage; 1/4/7/14/60/180 Tage) | Clozemaster [clozemaster §1], Babbel [babbel §1], LingQ [lingq §1], Memrise [memrise §1], Pimsleur (Mara 2.12) | Lena 2.2: wachsend gegen gleich ist egal (g = 0,034); ein Modell je Lerner wirkt besser (Lindsey 2014) | + leicht zu verstehen · − kein Lernermodell; ein Fehler setzt alles zurück | **V** FSRS ist genauer. Übernommen wird nur die **Verständlichkeit**: „nächste Wiederholung in 9 Tagen“ (M54). |
| M4 | **Lerner wählt den nächsten Termin selbst** | WordUp [wordup §1] | Lena 2.3: Lerner schätzen ihr Wissen schlecht ein (Kornell & Bjork 2008) | + Kontrolle · − systematisch zu optimistisch | **V** widerspricht „die App benotet“ (A7). |
| M5 | **Eigenes Wortmodell aus Zählern** (Halbwertszeit HLR; ACT-R) | Duolingo HLR [duolingo §1], Lingvist ACT-R [lingvist §1], Vocabulary.com Wissenswert und Konfidenz [vocabulary-com §1] | Settles & Meeder 2016: +12 % misst nur die Rückkehr am Folgetag, nicht den Lernerfolg [duolingo §10] | + robust · − kein Vorteil gegenüber FSRS belegt | **V** als zweiter Planer. Übernommen wird nur Lingvists Zielwert (ca. 80–90 %) als Regler (M17). |
| M6 | **Gedächtniszustand am Wort, nicht am Satz** | am Wort: Lingvist, Duolingo, Vocabulary.com, Anki (je Note); am Satz: Clozemaster, Glossika, Busuu [clozemaster §5, glossika §5] | Lena 2.1: Kodierspezifität; Kontext soll wechseln, der Zustand bleibt beim Wort | + ein Wort = ein Plan, kein Klumpen · − Clozemaster zählt 10 Sätze als 10 Karten | **Ü** Emrahs Auftrag 3.6 und 4.1 (Lexem). |
| M7 | **Getrennte Zustände je Richtung** (Englisch → Deutsch und Deutsch → Englisch) | Quizlet RPL [quizlet §1.3], Mochi [mochi §1], Anki (Rückwärtskarte) [anki §2], RemNote [remnote §1] | Lena 2.1: rezeptiv ≠ produktiv (Laufer & Goldstein 2004; Webb 2005) | + ehrliche zwei Zahlen · − doppelte Last, wenn ungeregelt | **Ü** als zwei Spuren „Verstehen“ und „Benutzen“ (Emrah 4.1), zusammen mit M8. |
| M8 | **Geschwister-Sperre**: Karten desselben Worts nicht am selben Tag; Nachbartage abgestuft (Gewicht 0,000001 / 0,2 / 0,4 …) | Anki „bury“ und Geschwister-Faktor im Lastausgleich [anki §1.3]; RemNote fehlt das, Nutzer vermissen es [remnote §1] | Lena 2.2: Abstand zwischen Abrufen wirkt; Abruf am selben Tag beantwortet die Geschwisterkarte vor | + löst Emrahs Klage 1 direkt · − Anki hat es standardmäßig **aus** | **Ü** fest eingeschaltet. Ein Lexem höchstens einmal am Tag außerhalb der Lernschritte (Emrah 4.2). Die Abstufung für die Nachbartage kommt aus Anki. |
| M9 | **Lernschritte im Minutenbereich** für neue und vergessene Wörter (Anki 1 Min. → 10 Min., Neulernen 10 Min.) | Anki [anki §1.2], Memrise (4 Std.) [memrise §1], Clozemaster (gleicher Tag) [clozemaster §1] | Lena 2.2: Der erste Abruf darf nicht sofort kommen (Karpicke & Roediger 2007); Tag 0 reichen 2 Abrufe (Nakata 2017) | + sichert Tag 0 · − Bei 10-Minuten-Sitzungen kommt der 10-Minuten-Schritt oft nach dem Ende | **A** Abstand nach **Karten und Zeit**: Schritt 1 nach mindestens 3 anderen Karten, Schritt 2 nach mindestens 8 Karten **und** 3 Minuten. Endet die Sitzung vorher, geht der Schritt in die nächste Sitzung desselben Lerntags oder in den Folgetag. |
| M10 | **Fuzz mit festem Startwert** (Korridor wächst mit dem Intervall, ab 2,5 Tagen; Startwert = Kennung + Zahl der Wiederholungen) | Anki `fuzz.rs` [anki §1.4], Clozemaster „Next review fuzz“ [clozemaster §1] | Lena 2.2: Der genaue Tag ist zweitrangig, deshalb kostet Streuung nichts | + Wörter vom selben Lerntag kommen nicht im Block · + würfelt beim Neuzeichnen nicht neu (Kap. 15) | **Ü** Ankis Formel (Emrah 4.2: „ab ca. 3 Tagen“). |
| M11 | **Lastausgleich** im Fuzz-Korridor: Gewicht (1/fällig)² · (1/Intervall), nur bis 90 Tage; „Easy Days“ je Wochentag | Anki `load_balancer.rs` [anki §1.5] | wie M10 | + gleichmäßige Last, Ruhetag planbar · − Anki zählt Karten, nicht Minuten | **A** gezählt wird die **erwartete Zeit**, nicht die Kartenzahl (eine eigene Satzaufgabe dauert länger als eine Lücke). Der Ruhetag (A7) wird als Easy Day mit Faktor „Minimum“ geplant. |
| M12 | **Tageslimit für Neues** | fest 20 neu / 200 Wiederholungen (Anki) [anki §1.6]; „Neues erst, wenn Rückstand null“ (Lingvist) [lingvist §1]; ohne Limit (Quizlet, Vocabulary.com) | Lena 3.6: Zeitbudget je Tag | + Lingvist schützt vor Überlast · − Lingvists Regel sperrt nach Pausen alles Neue (Kap. 15: „neue Wörter, die an Tagen mit Wiederholungen nie auftauchen“) | **A** **Mindestens 2 neue Lexeme an jedem Lerntag, auch bei Rückstand** (Kap. 15; Auftrag Kap. 5: Neues „früh unter die Wiederholungen gemischt“, Kontingent 0/2/5/10, Standard 5). Das **Lastbudget in Minuten** (Emrah 4.2) regelt nur die Menge über 2, die Obergrenze ist das Kontingent. Nur Kontingent 0 (von Emrah gewählt) ergibt 0 neue. Lingvists Regel: **V**. |
| M13 | **Rückstand nach Pause**: nach Abrufwahrscheinlichkeit sortieren; Wiederholungs-Deckel als Puffer; Randwörter verschieben | Anki (FSRS sortiert nach R, Deckel) [anki §1.7], SuperMemo „Postpone“ mit Priorität [supermemo §1], Glossika „schwächste zuerst“ [glossika §1] | Lena 2.2: Verspätete Abrufe stärken mehr; FSRS rechnet die Verspätung ein | + keine Wand von Karten · − SuperMemos Verschieben ohne Grenze lässt Wörter versanden | **Ü** Emrah 4.2: gefährdetste zuerst, Rest über mehrere Tage verteilt, höchstens 2 Tagesbudgets je Tag. **A** aus SuperMemo: Ein Wort darf höchstens 3-mal verschoben werden. |
| M14 | **Problemwörter (Leeches)**: Schwelle, dann andere Darstellung; bei Verwechslungspaaren eins pausieren | Anki: 8 Fehler, dann alle 4 [anki §1.8]; SuperMemo-Assistent [supermemo §1]; Vocabulary.com „Trouble Words“ [vocabulary-com §1]; Memrise „Difficult words“, höchstens 20 je Sitzung [memrise §1] | Lena 2.3: Hyperkorrektur; Anki-Handbuch: Darstellung ändern statt wiederholen | + verhindert Endlosschleifen · − Anki setzt standardmäßig nur eine Marke, die Aktion bleibt beim Nutzer | **A** Schwelle **6 Fehler** (Emrah 4.2) → automatisch neue Darstellung: neuer Satz, Merkhilfe, Kontrast zum Verwechslungswort. Die **Paar-Regel** gilt nur für echte englische Paare (*affect/effect*, *rise/raise*, *advice/advise*, *lend/borrow*, *economic/economical*): Das zweite Wort ruht, bis das erste 7 Tage hält. **Falsche Freunde** (*eventually* ≠ eventuell, *actual* ≠ aktuell, *become* ≠ bekommen, *sensible* ≠ sensibel, *control* ≠ kontrollieren im Sinn von *check*) bekommen statt der Pause eine Kontrastkarte Deutsch ↔ Englisch. |
| M15 | **Vorgezogenes Üben gleitend werten** (fast fällig = fast voller Zuwachs, sehr früh = wenig) | Anki gefilterte Stapel [anki §1.10]; Clozemaster halbiert die Punkte [clozemaster §3] | Lena 2.2: Cepeda 2008, kurze Abstände wirken später schlechter | + Freies Üben schadet dem Plan nicht | **Ü** steht schon in VT 3.1; FSRS rechnet R ein. |
| M16 | **Bekanntes herausnehmen** (Einstufung, „kenne ich schon“) | Lingvist Einstufung über ca. 50 Wörter [lingvist §1], Vocabulary.com Assessment [vocabulary-com §2], WordUp Knowledge Map [wordup §1], Drops Wischen [drops §2] | Lena 2.9: Einstufung in Bändern | + spart Zeit bei B2-Wörtern · − „kenne ich“ ohne Probe bläht auf (LingQ [lingq §7]) | **A** „Kenne ich schon“ nur mit **einer Probe**: Ein freier Abruf ohne Hilfe gelingt → Stufe 3, Kontrolle nach 7 Tagen, danach normal FSRS mit Abstands-Deckel (M77). Misslingt er → normale Einführung (Emrah 4.6; Lena 3.2). |
| M17 | **Ziel-Behaltensquote als einfacher Regler mit Lastangabe** | Anki-Simulator und Last-Kurve [anki §7]; Brainscape Zeit-Voreinstellungen [brainscape §1] | Lena 2.2: 70–97 % sinnvoll, über 90 % steigt die Last steil | + Emrah versteht „mehr Zeit für mehr Sicherheit“ · − Ankis Parameter-Menü überfordert | **A** drei Stufen 85 / 90 / 95 % mit Minutenangabe („90 %: ca. 14 Min. am Tag“), Standard 90 % (Emrah 4.2). |
| M18 | **Echte Behaltensrate** („True retention“): nur die erste Abfrage des Tages, getrennt nach jung und reif (Intervall ≥ 21 Tage) | Anki [anki §7] | Lena 3.9: Prozesswerte | + prüft, ob der Plan stimmt (Ziel 90 % → gemessen?) | **Ü** als Messwert und auf dem Dashboard. |
| M19 | **Parameter erst ab ca. 1.000 Abfragen anpassen** | RemNote, Anki [remnote §1, anki §1.1] | FSRS-Benchmark: angepasste Parameter schlagen Standardwerte in 84 % der Sammlungen (Mara 2.4) | + eigene Daten verbessern den Plan · − mit wenig Daten schlechter | **Ü** Review-Log ab Tag 1 vollständig (Emrah 7); Anpassung erst ab 1.000 Abfragen der Spur, nur nach Simulation. |
| M20 | **Neue Wörter nach Nutzen ordnen** (Häufigkeit, „Reach Words“) | Lingvist [lingvist §1], WordUp [wordup §1], Vocabulary.com [vocabulary-com §1] | Lena 2.9; Emrah 3.7 | + C1-Breite gezielt · − Häufigkeit allein passt nicht zu Business | **A** gewichtet nach Emrah 4.6: Frequenzband bis C1 + eigene Funde + Kollokationen bekannter Wörter + Berufsprofil. |
| M21 | **Priorität je Wort** (Kern- vor Randwort) | SuperMemo [supermemo §1] | – | + steuert, was bei Überlast wartet | **A** zwei Stufen „Kern“ (Business, eigene Funde) und „Rand“. Nur Randwörter werden bei Rückstand verschoben (M13). |
| M77 | **Garantierter Abruf am Folgetag und Abstands-Deckel** vor Fuzz und Lastausgleich: höchstens 1 Tag, bis ein freier Abruf an einem späteren Tag gelang; dann höchstens 3 / 7 / 21 Tage nach 1 / 2 / 3 freien Tagen | Babbel (erste Wiederholung nach 1 Tag) [babbel §1], Clozemaster (Tag 1 nach Tag 0) [clozemaster §1]; im Bestand live (`wort-fest-plan`) | Lena 2.2: Successive Relearning (Rawson & Dunlosky 2011), erster Abruf nach Schlaf | + FSRS allein kann ein neues Wort nach Good mehrere Tage wegplanen · − etwas mehr Last in den ersten Wochen | **Ü** Der Deckel wirkt vor Fuzz und Lastausgleich. Ohne ihn fiele die Synthese hinter den Live-Stand zurück. |

### 1.2 Abfrage-Leiter

| Nr. | Methode | wer | Forschung | dafür / dagegen | Urteil |
|---|---|---|---|---|---|
| M22 | **Frageform je Wort nach Stand wählen** („schwer, aber lösbar“): Auswahl → Tippen | Quizlet Learn [quizlet §2], Vocabulary.com Gerüst [vocabulary-com §2], Readlang passiv → aktiv in einer Sitzung [readlang §2], Birdbrain ca. 70 % (Mara 2.1) | Lena 2.1 (Retrieval Effort); Bjork 1994 | + jede Abfrage so schwer wie möglich · − Quizlet beendet nach 2 Treffern in einer Sitzung | **Ü** als Stufenleiter (Emrah 4.4); der Aufstieg braucht Tage (M47). Je Stufe **mindestens 2 Abfragearten** (Auftrag Kap. 5). Gewählt wird die Form mit der niedrigsten Trefferquote dieses Lexems, außer sie kam zuletzt. |
| M23 | **Auswahl (Multiple Choice) als Haupt- oder Einstiegsform** | Duolingo Wortbank [duolingo §2], Vocabulary.com fast nur Auswahl [vocabulary-com §2], Clozemaster [clozemaster §2], Drops [drops §2] | Lena 2.3: Auswahl überschätzt das Wissen | + schnell, leicht · − „way too easy“ (Duolingo), Raten | **A** nur in den Lernschritten und als Rettung nach einem Fehler, ohne FSRS-Wirkung (Emrah 4.3 und 4.4 Stufe 2; Abnahme 8.2). |
| M24 | **Wort in die Lücke eines echten Satzes tippen** | Lingvist [lingvist §2], Clozemaster [clozemaster §2], Readlang aktiv [readlang §2], Anki `{{type:cloze}}` [anki §2] | Lena 2.1: Formabruf (Nakata 2016) | + Eingabe in der Lücke (Kap. 15) · − Satz kann das Wort verraten | **Ü** Kernform ab Stufe 3; mit Leck-Prüfung der Sätze (Lena 2.1). |
| M25 | **Deutsche Bedeutung als Hinweis an der Lücke** | Lingvist [lingvist §2] | Lena 2.1: Bedeutung als Hinweis trainiert den Weg „Bedeutung → Wort“ | + klarer Abruf · − Lingvist blendet den Hinweis nie aus | **A** „Gesucht: …“ bis Stufe 4. Ab Stufe 5 ersetzt eine Situation oder ein Satz ohne Hinweis die deutsche Bedeutung. |
| M26 | **Wortart- und Formangabe an der Lücke** („noun, plural“) | Lingvist [lingvist §4] | – | + trennt Form- von Wortfehler | **A** nur, wenn der Satz die Form nicht eindeutig macht. |
| M27 | **Abruf ohne Satz** (Deutsch → Englisch, Buchstabieren) | Anki Rückwärtskarte [anki §2], Vocabulary.com Spelling [vocabulary-com §2], Mochi [mochi §2] | Lena 2.1: Etwa jeder 3. Abruf ohne Satz, gegen Satz-Erinnerung | + prüft den Weg, der beim Sprechen gebraucht wird | **Ü** Stufe 4 und jeder 3. Abruf ab Stufe 4 (Lena 3.4). Abgefragt wird immer ein **deutscher Chunk**, kein Einzelwort („eine Frist einhalten“ → *meet a deadline*). Einzelwort-Gleichungen festigen bei Deutschen das 1:1-Übersetzen (Lehrer-Befund). |
| M28 | **„Was heißt das Wort *hier*?“**, getrennt nach Bedeutungsgruppen | Vocabulary.com (z. B. *raise*: 122 Fragen zu 31 Bedeutungen) [vocabulary-com §1, §2] | Lena 2.1: Bedeutung im Kontext ablösen | + C1 heißt Mehrdeutigkeit · − Auswahlform | **A** Bedeutung **frei nennen** statt wählen (Spur Verstehen). Eine Umschreibung auf Deutsch oder Englisch zählt, nicht nur eine deutsche Wortgleichung. Jeder weitere Sinn eines Worts ist ein eigenes Lexem mit Verweis. |
| M29 | **„Apply the Meaning“**: Alltagsfrage, die nur mit Verständnis lösbar ist | Vocabulary.com [vocabulary-com §2] | Involvement Load (Emrah 3.4) | + Brücke zum Benutzen · − bei Vocabulary.com mit Auswahl | **A** als Situationsaufgabe „Du willst sagen, dass …“ (Stufe 5), Antwort getippt, Sätze vorab vom Lehrer geprüft. |
| M30 | **Hören → Tippen** (Diktat des Satzes oder Worts) | Clozemaster Listening [clozemaster §2], Glossika [glossika §2], Quizlet Spell [quizlet §2], Babbel [babbel §2] | Lena 2.6: Hören eigener Strang | + Klangbild, Abwechslung · − nur Form, keine Bedeutung | **Ü** als eine Form ab Stufe 3 (Formenmischung, Kap. 15). |
| M31 | **Sprechen als Antwortweg** | Lingvist Stimme [lingvist §2], Speak [speak §2], Babbel [babbel §2], Glossika [glossika §2] | Lena 2.5 | + Sprechen ist Emrahs Ziel · − Erkennung schwankt (Speak zu mild, Babbel blockiert) | **A** nur über das Diktat des Handys, wird wie Tippen gewertet. Eine Ablehnung der Erkennung ist nie ein Fehler; dann „Tippen statt sprechen“. |
| M32 | **Ganzen Satz aus dem Gedächtnis sagen oder tippen** („Recall“) | Glossika [glossika §2] | Lena 2.5: wiederholter Inhalt macht flüssig | + aktive Nutzung · − Satz als Einheit | **A** im Transfer-Block und in „Sag es“, nicht als Planeinheit. |
| M33 | **Eigener Satz mit dem Zielwort, korrigiert** | Busuu Community [busuu §6], Memrise MemBot [memrise §6], Speak [speak §6] | Emrah 3.4 (Involvement Load); Lena 2.1: Barcroft 2004, eigene Sätze zu früh schaden der Formlernung | + höchste Stufe · − Community schwankt, KI-Gespräche „repetitive“ | **A** Ein **gelenkter** eigener Satz zu einer Lage schon in Stufe 5 („Sag dem Kunden, dass …“). Der freie eigene Satz kommt in Stufe 6 (Emrah 4.4), wenn die Form frei sitzt. Claude prüft nach den Regeln in 2.5. |
| M34 | **Mini-Spiele mit Uhr** | Drops [drops §2], Memrise Speed Review [memrise §2] | Lena 2.5: Flüssigkeit unter Zeitdruck | + Tempo · − Zeitdruck verdrängt sorgfältiges Formulieren | **A** nur als freiwilliges „Tempo“ (H22) mit sicheren Wörtern, nie in der Pflicht. |
| M35 | **Bild-Zuordnung** | Drops [drops §2], Vocabulary.com Bildfrage [vocabulary-com §2] | – | − abstrakte Business-Wörter kaum bebilderbar | **V** für C1-Business. |
| M36 | **Erst Hinweis, kurz selbst versuchen, dann Lösung** (bei neuen Wörtern) | Memrise-Prize-Studie: d = 0,39 [memrise §10] | Lena 2.3: Hyperkorrektur; Testeffekt | + stärkere Einprägung · − Studie mit Memrise-Ko-Autoren | **A** In der Einführung (Stufe 1) wird erst der Satz mit Lücke und deutscher Bedeutung gezeigt, und Emrah darf kurz raten. „Weiß nicht“ ist straffrei. |

### 1.3 Bewertung

| Nr. | Methode | wer | Forschung | dafür / dagegen | Urteil |
|---|---|---|---|---|---|
| M37 | **Selbstbewertung** (4 Knöpfe, 1–5, „weiß ich / weiß ich nicht“) | Anki [anki §3], SuperMemo 0–5 [supermemo §3], Brainscape 1–5 [brainscape §3], Mochi 2 Knöpfe [mochi §3] | Lena 2.3: Flüssigkeits-Illusion; Selbsturteil unzuverlässig | + schnell · − Grundursache von Emrahs „willkürlich“ | **V** außer im Anki-Modus (A7, VT 3.6). |
| M38 | **Automatische Note aus Richtigkeit, Form und Hilfe** | Clozemaster (Tippen 8, Auswahl 4, Hinweis halbiert) [clozemaster §3], Vocabulary.com (Hinweis halbiert) [vocabulary-com §3], Lingvist [lingvist §3] | Lena 2.3: Form × Hilfe × Zeit | + gerecht, nicht manipulierbar | **Ü** Emrah 4.3: falsch oder Lösung angezeigt → Again; Hinweis oder sehr langsam → Hard; richtig → Good; schnell auf hoher Stufe → Easy. |
| M39 | **Antwortzeit in der Note** | kein Anbieter belegt; Anki misst sie, nutzt sie aber nicht [anki §3] | Lena 2.3: ARTS (Mettler u. a. 2016), Pavlik & Anderson 2008 | + trennt „wackelig“ von „sicher“ · − Zeit am Handy schwankt (Tastatur, Ablenkung) | **A** nach Lena 3.3: Gemessen wird die Zeit **bis zum ersten Zeichen** (sonst zählt die Wortlänge mit), gekappt bei 45 s, mit einer Zeitbasis (Median) je Form. Über 2 × Median → Hard („wackelig“). Unter 0,6 × Median → Easy, aber nur ab Stufe 5, nur bei fälligen Wörtern und nicht in den ersten 21 Tagen. Die ersten 20 Antworten je Form wirken nicht über die Zeit. Ab Stufe 5 wird die Antwortzeit sichtbar angezeigt, ohne Uhr (Lena 2.5). |
| M40 | **Tippfehler nach Lage und Schwere werten**; Toleranzstufen | Lingvist [lingvist §3], Quizlet Strict/Moderate [quizlet §3], Readlang 3 Stufen [readlang §3]; Babbel streng (Nutzerklage) [babbel §3]; Duolingo verwischt Formfehler [duolingo §3] | – (Praxis) | + „ungerecht falsch“ vermeiden · − zu viel Toleranz verdeckt Formfehler; Quizlet schaltet die Hilfe bei Sprachinhalten ab | **A** fest, nicht einstellbar (Regeln vom Lehrer geprüft):<br>(a) **Tippfehler:** 1 Fehler nach Damerau-Levenshtein (eine Vertauschung wie *recieve* zählt als 1) bei Wörtern ab 5 Buchstaben, ohne dass ein anderes echtes Wort entsteht → „fast richtig“ = Hard, mit Diff.<br>(b) **Bekannte Rechtschreibfehler deutscher Lerner** (*adress*, *responsability*, *comittee*; nicht zählbare Wörter wie *informations* laufen nur über M79) stehen auf einer Liste. Sie sind Formfehler mit eigener Erklärung, nie „fast richtig“.<br>(c) **Beugungsfehler** (gleicher Stamm, nur -s/-ed/-ing oder -er beim Steigern: *postpone* statt *postponed*) → Hard und Grammatik-Hinweis an das passende Grammatikthema.<br>(d) **Wortart- oder Ableitungsfehler** (*decide* statt *decision*, *manage* statt *manager*) → Again.<br>(e) **Anderes echtes Wort** (*affect/effect*, *contract/contact*) → nie Tippfehler.<br>(f) **Bindestrich und Leerzeichen** (*follow up* Verb ↔ *follow-up* Nomen, *set up/setup*, *log in/login*): Formfehler, wenn sich die Wortart ändert, sonst richtig.<br>(g) Artikel vor dem Wort (*the lead time*), Groß- und Kleinschreibung sowie gerade oder typografische Apostrophe werden angeglichen.<br>(h) Britische Schreibweise ist richtig (A7).<br>**Reihenfolge der Prüfung:** (g) → (h) → (c) → (f) → (b) → (e) → (a) → (d). So landet *lead times* bei (c) und nicht bei (e). |
| M41 | **„Richtig, aber nicht gesucht“** (Synonym) | Lingvist [lingvist §3], Quizlet Smart Grading [quizlet §3] | – | + keine Strafe für gutes Englisch | **A** Ausgang „Auch richtig“ (Tutor-Engine): keine Note, das Zielwort kommt nach 3–5 Karten noch einmal.<br>• Die Synonyme legt der Lehrer **je Satz** vorab fest. Ein Wort, das nur ähnlich ist, zählt nicht: *delivery time* kann auch die Uhrzeit der Lieferung meinen.<br>• **Ausweichen** auf ein einfacheres Wort (*problem* statt *bottleneck*, *say* statt *point out*; nur wo das Zielwort wirklich genauer ist, nicht bloß formeller) heißt „Richtig, aber gesucht war das genauere Wort“. Das gibt keine Note. Kommt dasselbe Ausweichwort ein zweites Mal, wird Hard daraus. Grund: Ausweichen ist ein bekannter B2-Stillstand.<br>• Britischer Wortschatz (*take a decision*, *at short notice*, *CV*) ist „Auch richtig“ mit US-Hinweis. |
| M42 | **„Ich hatte recht“ (Override)** | Quizlet „Override: I was correct“; Tippfehler-Hilfe senkte Overrides um ≥ 50 % (laut Anbieter) [quizlet §3]; Emrah 4.3 „Das wusste ich eigentlich“ | Lena 2.3: Selbsturteil unzuverlässig | + Ventil gegen falsche Automatik · − öffnet die Selbstbewertung | **A** siehe 3.3 W4: Nach „falsch“ oder „fast richtig“ wird die Abfrage **nicht benotet**, und das Wort steigt nicht ab. Es kommt nach 3–5 Karten frei in einem neuen Satz zurück, und **diese** Antwort benotet die App. So wird Emrahs Einwand geprüft statt geglaubt. |
| M43 | **„Aufgabe war unfair“** ohne Planwirkung | RemNote „Skip“ [remnote §3], Lingvist „Report a problem“ [lingvist §3], Readlang „Edit“ [readlang §4] | – | + ein kaputter Satz bestraft nicht das Wort | **Ü** Meldung an die Inhaltsprüfung, Abfrage zählt nicht. |
| M44 | **Hinweis halbiert statt nullt** | Clozemaster, Vocabulary.com [clozemaster §3, vocabulary-com §3] | Lena 3.3 | + Hilfe holen lohnt sich, Raten nicht | **Ü** als Note Hard (M38). |
| M45 | **Zweiter Versuch vor dem Zurücksetzen** | Clozemaster (Versuch mit Hinweis) [clozemaster §3], Mochi (erst in derselben Sitzung nochmal) [mochi §3] | – | + Ausrutscher kostet nicht alles | **A** Ein zweiter Versuch ist erlaubt, ergibt für FSRS aber **Again** (Lena 3.3). Er kostet keine Stufe und hat keinen Fehlerton. Ausnahme: War der erste Versuch nur ein Tippfehler (M40a), gibt es Hard. Die Spielregeln von Clozemaster und Mochi sind kein Lernbeleg. |
| M46 | **Fehler setzt alles auf null** | Clozemaster [clozemaster §1], Memrise [memrise §1] | FSRS: Stabilität sinkt abgestuft | − „bluntest part of the design“ | **V** FSRS-Vergessen plus Stufe −1 (Emrah 4.4). |
| M47 | **„Gekonnt“ nach zwei Treffern in einer Sitzung; Stand kann nie sinken** | Quizlet [quizlet §2], Vocabulary.com [vocabulary-com §3] | Lena 2.3: Kriterien „wirklich gekonnt“; Quizlet-Papier: erste Antworten sagen kaum etwas voraus [quizlet §1.2] | + schnelles Erfolgsgefühl · − aufgeblähte Zahl | **V** Aufstieg braucht Tage; „gefestigt“ erst nach Abstand ≥ 21 Tage (Lena 2.3). |

### 1.4 Rückmeldung

| Nr. | Methode | wer | Forschung | dafür / dagegen | Urteil |
|---|---|---|---|---|---|
| M48 | **Buchstaben-Diff der Eingabe** (richtig grün, falsch rot, fehlend markiert) | Anki `compare_answer` [anki §3]; Clozemaster färbt live [clozemaster §3] | – | + Emrah sieht sofort, was fehlte | **Ü** im Band nach „fast richtig“ und „falsch“; nicht live beim Tippen (verrät die Lösung). |
| M49 | **Nach Fehler die Lösung abtippen** | Lingvist Pflicht [lingvist §4], Quizlet [quizlet §4], Clozemaster „Teach Me“ freiwillig [clozemaster §2] | Lena 2.1: Abschreiben ist kein Abruf | + aktive Korrektur · − sofortiges Abtippen ist Kopieren (VT §7) | **A** kein Pflicht-Abtippen; stattdessen kommt das Wort im Lernschritt nach 3–5 Karten **frei** zurück (M53). |
| M50 | **Erklärung auch bei richtiger Antwort** | Readlang „Explain“ [readlang §4], Duolingo „Explain My Answer“ [duolingo §4] | Kap. 2 Nr. 4 | + vier Fragen erfüllt | **Ü** Band mit Warum-Zeile, „Mehr“ und Claude (besteht). |
| M51 | **Audio für Wort und Satz, normal und langsam** | Clozemaster [clozemaster §4], Anki [anki §4] | Lena 2.6 | + Klang gehört zum Wort | **Ü** US-Stimme (A7). |
| M52 | **Satzübersetzung aufklappbar** | Lingvist [lingvist §4], Clozemaster [clozemaster §4] | – | + hilft, ohne vorher zu verraten | **Ü** nach der Antwort (H2 „Mehr“). |
| M53 | **Fehlerwörter in derselben Sitzung noch einmal** | Babbel [babbel §4], SuperMemo „Final Drill“ [supermemo §4], Drops [drops §4], Duolingo „Mistakes“ [duolingo §2] | Lena 2.2: Successive Relearning | + schließt die Lücke, solange sie frisch ist | **Ü** als Neulern-Schritt (M9), mit anderem Satz. |
| M54 | **„Kommt wieder in …“ direkt nach der Antwort** | Clozemaster [clozemaster §4], Anki (Knöpfe zeigen den Termin) [anki §3] | Kap. 2 Nr. 2 | + ehrlich und nachvollziehbar (gegen Emrahs „willkürlich“) | **Ü** eine Zeile im Band: „Kommt am Mo, 9.11. wieder“. |
| M55 | **Wörtliche Bedeutung bei Wendungen** | Memrise [memrise §4] | – | + Merkhilfe | **A** nur, wenn die wörtliche Bedeutung wirklich hilft; der Lehrer entscheidet je Wendung. |
| M56 | **Kollokationen in der Rückmeldung** | kaum belegt; Vocabulary.com Bedeutungsgruppen [vocabulary-com §4] | Emrah 3.7, Lena 3.8 | + C1-Kern | **Ü** 2 Wortpartner im Band (Emrah 6) und ein eigener Ausgang „Kollokationsfehler“ (Emrah 4.4), z. B. *hold a presentation* statt *give*. Die Note hängt am Lexem: Ist das Lexem die Kollokation, gibt es Again. Ist es das Einzelwort, gibt es Hard, und das Wortpartner-Lexem wird markiert. |

### 1.5 Kontext

| Nr. | Methode | wer | Forschung | dafür / dagegen | Urteil |
|---|---|---|---|---|---|
| M57 | **Wechselnde Sätze, erst nach einem Ankersatz** | Vocabulary.com (viele Fragen je Sinn) [vocabulary-com §5]; fester Satz: Busuu, Readlang, Clozemaster [busuu §5, readlang §5, clozemaster §5] | Lena 2.1: erst verankern, dann variieren; Leck-Test | + gegen „Wort am Satz erkennen“ (Emrahs Klage) · − anfangs Vielfalt-Kosten | **Ü** Tag 0–1 Ankersatz, danach jedes Mal ein anderer Satz; für den Formabruf kommt derselbe Satz 30 Tage nicht wieder (VT 4.2). |
| M58 | **Karte aus dem eigenen Lesen mit Ursprungssatz** | Readlang [readlang §5], LingQ [lingq §5], Language Reactor (Mara 2.16) | Kap. 15 | + Emrahs eigene Wörter | **Ü** besteht (Wort-Popup); der Ursprungssatz wird Ankersatz. |
| M59 | **Lernwörter im Lesetext markiert** | LingQ [lingq §5], Language Reactor (Mara 2.16) | Nation: Input-Strang (Emrah 3.8) | + Wiederbegegnung ohne Übung | **A** Markierung im Lesen; eine Begegnung zählt als Beleg, ist aber **keine** FSRS-Wiederholung. |
| M60 | **Sätze aus Freiwilligen oder KI ohne Prüfung** | Clozemaster (Tatoeba) [clozemaster §9], Mochi KI-Felder [mochi §1], Duolingo „AI slop“ (Mara 2.1) | – | − Vertrauensverlust auf C1 | **V** Jeder Satz wird vom Lehrer (`english-teacher`) gegengelesen. |
| M61 | **Höchstens ein unbekanntes Lernwort je Satz (i+1)** | AnkiMorphs [anki §2], Language Reactor PhrasePump (Mara 2.16) | Lena 2.1 | + Satz bleibt verständlich | **Ü** Regel für die Satzbank. |
| M62 | **Bedeutungsgruppen getrennt lernen** | Vocabulary.com [vocabulary-com §1] | Lena 2.1 | + *address* (Rede / Problem angehen) sind zwei Dinge | **A** Hauptsinn zuerst; weitere Sinne als eigenes, verknüpftes Lexem. |

### 1.6 Fortschritt und Transparenz

| Nr. | Methode | wer | Forschung | dafür / dagegen | Urteil |
|---|---|---|---|---|---|
| M63 | **Lastvorschau der nächsten Tage** | Anki „Future due“ [anki §7]; Clozemaster „Review Forecast“, von Nutzern als „all but useless“ kritisiert, weil Sätze statt spielbarer Minuten gezählt werden [clozemaster §1] | Lena 3.9 | + Emrah sieht, dass es gleichmäßig ist | **A** 14 Tage als Balken in **Minuten** (Emrah 6). |
| M64 | **Stufenverteilung als Balken** | Clozemaster [clozemaster §7], Quizlet New/Seen/Familiar/Mastered [quizlet §7], Busuu 3 Stärken [busuu §7] | – | + ein Blick, wo die Wörter stehen | **Ü** besteht in der Vorschau (H34). |
| M65 | **Mehrere Spuren je Wort: gelernt / gehört / benutzt** | Memrise [memrise §7] | Lena 2.9: zwei getrennte Zahlen | + aktiv gegen passiv sichtbar | **Ü** „erkennst du / bildest du selbst / benutzt“ (H34 hat die ersten zwei). |
| M66 | **Verlauf je Wort** (alle Antworten, nächster Termin) | Anki Karteninfo [anki §7], Vocabulary.com [vocabulary-com §7], WordUp [wordup §7] | – | + Vertrauen | **Ü** Wort-Detail mit beiden Spuren und Terminen (Emrah 6). |
| M67 | **Ungeprüfte „Bekannt“-Zahl** | LingQ [lingq §7] | Lena 2.9 | − bläht auf | **V** |
| M68 | **„Heute ca. X Min., morgen ca. Y Min.“** | Brainscape geschätzte Restzeit [brainscape §7], Lingvist Minuten heute [lingvist §7] | Kap. 14: in unter 2 s klar | + klare Erwartung | **Ü** Start und Abschluss (Emrah 5). |
| M69 | **Textabdeckung „du verstehst ca. X %“** | Lingvist [lingvist §7] | – | + motivierend · − Schätzung | **A** erst mit Einstufung (V5), mit Unsicherheit. |
| M70 | **Punkte, XP, Kartenziel (50/100 am Tag)** | Clozemaster [clozemaster §3], Vocabulary.com [vocabulary-com §3], Lingvist [lingvist §1] | Lena 2.8 | − verleitet zu leichten Formen | **V** Minuten-Ziel statt Karten, keine Punkte (Konzept). |

### 1.7 Sitzungsablauf

| Nr. | Methode | wer | Forschung | dafür / dagegen | Urteil |
|---|---|---|---|---|---|
| M71 | **Sitzung mit klarem Ende** | Anki (Glückwunsch-Seite) [anki §8], Lingvist (Tagesziel) [lingvist §8], Drops (5 Min.) [drops §8]; endlos: Clozemaster [clozemaster §8] | Kap. 2 Nr. 1 | + „erledigt heißt erledigt“ | **Ü** Emrah 5; „Noch 5“ nur mit Fälligem oder Neuem. |
| M72 | **Neue Wörter zwischen Wiederholungen eingestreut** | Anki `MixWithReviews` [anki §1.6] | Auftrag Kap. 5 und Kap. 15. Achtung: Lena 2.7 belegt das Mischen bei Wortmaterial **nicht**; dort ist Blocken überlegen (g = −0,39), und verwandte neue Wörter stören sich (Tinkham) | + kein Block Neues am Ende, Lernschritt B passt in die Sitzung | **A** Emrah 5.2: Das erste neue Lexem kommt nach 3–5 Wiederholungen, das letzte spätestens bei 50 % der Sitzung. Nie zwei verwechselbare oder inhaltlich eng verwandte neue Lexeme am selben Tag. Neue Wörter sind lose nach Thema gruppiert. |
| M73 | **Zufällige Reihenfolge mit festem Startwert**; nicht nach Stapel sortieren | Anki (warnt vor Raten aus dem Kontext) [anki §1.9], Mochi [mochi §1] | – | + kein Raten aus der Reihenfolge; würfelt nicht neu (Kap. 15) | **Ü** |
| M74 | **Wichtigster Fehler am Anfang der nächsten Sitzung** | Busuu Mistake Repair [busuu §4] | Lena 3.7: Fehlerschleife | + gezielte Reparatur | **A** für Kollokationsfehler: Kontrastkarte am Anfang der nächsten Sitzung. |
| M75 | **„Schwierig“-Stapel mit Obergrenze** | Memrise (20) [memrise §1], Vocabulary.com Trouble Words [vocabulary-com §1] | – | + Fehlerwörter üben ohne Flut | **Ü** im freien Trainer (H17 „Schwierig“), höchstens 10. |
| M76 | **Wählbarer Übungsmodus beim Wiederholen** (Hören / Sprechen / Schreiben) | Babbel [babbel §2] | – | + Abwechslung · − Lerner bleibt beim leichten Modus | **A** nur im freien Trainer; in der Pflicht wählt die App. |

### 1.8 Ergänzungen aus der Prüfung (kein Anbieter hat sie belegt)

Der Lehrer (`english-teacher`) hat gezeigt, dass für C1 vier Abfrageformen fehlen. Keiner der 18 Anbieter hat sie belegt. Sie stammen also nicht aus dem Markt, sondern aus Lehrerpraxis und Forschung (Emrah 3.7: Kollokationen und feste Wendungen).

| Nr. | Methode | Quelle | dafür / dagegen | Urteil |
|---|---|---|---|---|
| M78 | **Präposition und Wortmuster ergänzen** (*discuss sth*, nicht *about*; *depend on*; *responsible for*; *by Friday*, nicht *until*) | Lehrer-Befund; Lena 3.8 | + typische Fehler deutscher Lerner · − braucht geprüfte Muster je Lexem | **Ü** als Abfrageform ab Stufe 3, gezielt nach dem Fehlerprofil des Lexems |
| M79 | **Zählbarkeit** (*information*, *feedback*, *advice*, *software*, *equipment*) | Lehrer-Befund | + Kern des Berufswortschatzes | **Ü** eigener Ausgang „Plural falsch“ mit Erklärung |
| M80 | **Stilebene und „diplomatischer sagen“** (*We can't do that* → *That might be difficult for us at this stage*) | Lehrer-Befund; Auftrag Kap. 6 (Business) | + C1-Merkmal, Verhandlungen · − Bewertung braucht Claude | **Ü** Jedes Lexem trägt eine Marke formal / neutral / informell; ab Stufe 5 gibt es die Form „diplomatischer sagen“ |
| M81 | **Phrasal Verbs: Partikel und Stellung des Pronomens** (*set it up*, nicht *set up it*) | Lehrer-Befund | + häufiger Formfehler | **Ü** Partikel-Lücke und Umstellform ab Stufe 3 |

**Zahl:** 81 Methoden (M1–M77 aus dem Markt, M77 auf Hinweis der Prüfung ergänzt; M78–M81 aus der Lehrer-Prüfung ohne Marktbeleg); Ü 38 · A 33 · V 10 (gezählt nach dem Urteil in der letzten Spalte).

---

## 2. Die beste Kombination für Emrah

**Rahmen:** B2 → C1, Business, nur Handy, 10–30 Min. am Tag, will Wörter aktiv benutzen. Der Rahmen folgt Emrahs Auftrag 4–5. Die Methoden-Nummern zeigen, woher jeder Teil kommt.

### 2.1 Sechs Grundregeln

1. **Ein Lexem, zwei Spuren, ein Plan.** Ein Wort, eine Wendung oder eine Kollokation ist ein Lexem. Es hat die FSRS-Spur „Verstehen“ und die FSRS-Spur „Benutzen“ (M1, M6, M7). Außerhalb der Lernschritte kommt es höchstens einmal am Tag (M8).
   - **Eine Benutzen-Antwort zählt auch für Verstehen, eine Verstehen-Antwort nie für Benutzen** (Lena 3.1). Emrahs Regel „die andere Spur um einen Tag verschieben“ (4.2) greift deshalb nur, wenn ausschließlich Verstehen fällig ist.
2. **Die App benotet.** Die Note entsteht aus Richtigkeit, Form, Hilfe und Zeit (M38, M39, M40, M44). Auswahl ändert den Plan nie (M2, M23). Selbstbewertung gibt es nicht. Auf „Das wusste ich eigentlich“ folgt eine neue Prüfung, kein Glaube (M42).
3. **Erst Halt, dann Abstand.** Abruf am Folgetag garantiert; Abstands-Deckel 1 / 3 / 7 / 21 Tage, bis freie Abrufe an späteren Tagen vorliegen (M77). Danach plant FSRS frei.
4. **Jede Abfrage so schwer wie gerade möglich.** Die Stufe bestimmt die Form, je Stufe gibt es mindestens 2 Formen, bevorzugt die schwächste des Lexems (M22). Ab Stufe 3 wird getippt (M24), der Satz wechselt (M57), und jeder 3. Abruf ist ohne Satz (M27).
5. **Gleichmäßig und ehrlich.** Fuzz und Lastausgleich in Minuten (M10, M11), mindestens 2 neue Lexeme an jedem Lerntag (M12), Rückstand nach Gefährdung (M13). Nach jeder Antwort steht „kommt wieder am …“ (M54). Das Dashboard zeigt die Lastvorschau und die echte Behaltensrate (M63, M18).
6. **Am Ende steht Benutzen.** Gelenkter eigener Satz ab Stufe 5, freier eigener Satz in Stufe 6 (M33), Transfer-Block (Emrah 4.5), Spur „benutzt“ (M65).

**Signale, die die App aus dem Verhalten liest** (Lena 2.3, 3.3; keine Knöpfe):
- **Satzgebunden:** Das Wort gelingt im Ankersatz, aber nicht in neuen Sätzen. Dann folgen 2 Termine ohne Satz.
- **Hyperkorrektur:** Ein Fehler ab Stufe 5 (das Wort galt als sicher) bringt sofort eine Kontrastkarte. In diesem Moment ist die Aufmerksamkeit am größten.
- **Erschwernis ankündigen:** Einmal, beim ersten Start, steht: „Freies Abrufen fühlt sich schwerer an als Auswählen. Genau das wirkt.“ (Kornell & Bjork 2008)

### 2.2 Ablauf einer Abfrage (Beispiel *lead time*, Stufe 3, Spur Benutzen)

1. **Karte erscheint.**
   - Oben stehen die Anweisung „Tippe das fehlende Wort“ und das „Wozu?“. Das „Wozu?“ gibt es für jede Form mit eigenem Satz, hier: „Du rufst es selbst ab. So wird es dein Wort.“
   - Der Satz ist groß, die Lücke ist das Eingabefeld, die Tastatur ist offen und die Autokorrektur aus. Darunter steht „Gesucht: Lieferzeit“ (M24, M25).
   - Der Satz ist neu, nicht der Ankersatz (M57).
2. **Hilfen:**
   - „Tipp“ zeigt den ersten Buchstaben und die Wortzahl. Die Note ist dann Hard (M44).
   - „Weiß ich nicht“ ist straffrei und zeigt die Lösung. Die Note ist Again, und es folgt ein Lernschritt.
3. **Eingabe und Enter.** Gemessen wird die Zeit bis zum ersten Zeichen, gekappt bei 45 s (M39).
4. **Auswertung** (M40, M41, M56):
   - richtig → Good; Easy nur, wenn es schnell war, die Stufe ≥ 5 ist, das Wort fällig war und es älter als 21 Tage ist (M39);
   - 1 Tippfehler (*lead tmie*) → „fast richtig“, Hard, mit Diff;
   - Beugungsfehler (*lead times* statt *lead time*, wo der Singular gefragt ist) → Hard und Grammatik-Hinweis;
   - festgelegtes Synonym (*turnaround time*) → „Auch richtig“, keine Note, *lead time* kommt später noch einmal;
   - Ausweichwort (*delivery time*) → „Richtig, aber gesucht war das genauere Wort“, keine Note;
   - Wortart falsch oder anderes Wort → Again;
   - Kollokationsfehler (*hold a presentation* statt *give*) → eigene Erklärung, Note nach M56.
5. **Band (eine Rückmeldekarte):**
   - Zeile 1: Urteil.
   - Zeile 2: Vergleich (Diff bei einem Fehler, M48).
   - Zeile 3: **Warum**, höchstens 120 Zeichen, nach festem Inhaltsvertrag (Auftrag Kap. 5): Wortart · typische Verbindung · bei einem Fehler „*X* heißt …, passt zu …“. Das Warum steht **auch bei richtig** da.
   - Dazu 2 Wortpartner („reduce lead times · quote a lead time“) und die Zeile „Kommt wieder: Mo, 9.11.“ (M54).
   - Knöpfe: Ton (normal/langsam), „Mehr“ (Satzübersetzung, weiterer Beispielsatz, M52), „War das auch richtig?“ und, nur nach einem Fehler, „Das wusste ich eigentlich“.
6. **Nach einem Fehler:** kein Abtippen. Das Wort kommt nach 3–5 anderen Karten frei zurück, in einem anderen Satz oder ohne Satz (M49, M53). Danach sinkt es eine Stufe, nie unter Stufe 2 (Emrah 4.4). Ausnahmen: Ein gelungener zweiter Versuch (M45) und „Das wusste ich eigentlich“ (M42) kosten keine Stufe.

### 2.3 Die Stufenleiter (Emrah 4.4, mit Marktbelegen)

**Was als Aufstiegs-Tag zählt** (Lena 3.3): nur eine fällige Antwort mit Good oder Easy, ohne Hilfe. Ein reiner Tippfehler (M40a) zählt mit. Hard, ein zweiter Versuch, Auswahl und vorgezogene Abrufe zählen nicht.

| Stufe | Abfrageformen (mindestens 2) | Spur | Vorbild | Aufstieg, wenn … (Vorschlag, konfigurierbar) |
|---|---|---|---|---|
| 1 Kennenlernen | Satz mit Lücke und „Gesucht: …“, erst kurz selbst versuchen, dann Lösung, Ton, 2–3 Wortpartner · „Kenne ich schon“ mit Probe | – | Memrise Prize (M36), Lingvist, Drops-Wischen (M16) | Einführung gesehen |
| 2 Erkennen (Lernschritte Tag 0) | **Schritt A** (nach ≥ 3 Karten): Anfangsbuchstabe; Auswahl nur nach einem Fehler · **Schritt B** (nach ≥ 8 Karten und 3 Min.): **immer frei getippt**, in neuem Satz oder ohne Satz | Benutzen (nur B) | Quizlet, Readlang (M22, M23), Lena 3.2 | B frei richtig; höchstens 4 Versuche, sonst morgen wieder ohne Stufenverlust |
| 3 Abrufen im Kontext | Lücke tippen mit „Gesucht: …“ · Hören → Tippen · Präposition/Muster (M78) · Partikel (M81) | Benutzen und Verstehen (W1 Variante B) · Verstehen zusätzlich: Bedeutung frei nennen, Ton → Bedeutung (M28) | Lingvist, Clozemaster (M24) | an 2 verschiedenen Tagen frei richtig (Deckel 3 / 7 Tage) |
| 4 Aus der Bedeutung | deutscher Chunk → Englisch ohne Satz (M27) · deutscher Satz → Lexem im englischen Satz | Benutzen | Anki Rückwärtskarte, Vocabulary.com Spelling | 3 freie Tage, Stabilität Benutzen ≥ 7 Tage |
| 5 Variieren | neuer Satz mit anderer Wortform oder Wortfamilie · Wortpartner ergänzen · Situation → Ausdruck (M29) · diplomatischer sagen (M80) · **gelenkter eigener Satz** zu einer Lage | Benutzen | Vocabulary.com „Apply“, Lena | Stabilität Benutzen ≥ 21 Tage |
| 6 Frei anwenden | eigener Satz zu Emrahs Kontext, getippt **oder** gesprochen (Diktat) · Situation → eigener Satz | Benutzen | Busuu (M33) | siehe Stufe 7 |
| 7 Gefestigt | selten; Transfer-Block; jeder 3. Termin gesprochen | Benutzen | Anki „reif“ (M18) | **Bedingung (Lena 2.3):** frei, ohne Hilfe, in einem ungesehenen Satz oder ohne Satz, zügig (≤ 1,5 × Zeitbasis), nach ≥ 21 Tagen ohne Kontakt **und** 2 geprüfte eigene Sätze in verschiedenen Zusammenhängen; bei Kernwörtern muss einer davon gesprochen sein (Sprechen bleibt sonst freiwillig, Kap. 2 Nr. 6) |

- **Bezug zu Auftrag Kap. 5** (fünfstufige Leiter): Erkennen = 1–2, Zuordnen = 2 (Auswahl als Rettung), Mit Stütze abrufen = 3, Frei abrufen = 4–5, Sicher anwenden = 6–7.
- **Abstieg:** Bei einem Fehler geht es eine Stufe zurück (nie unter 2), dazu ein Lernschritt. Den Totalreset von Clozemaster und Memrise haben wir verworfen (M46).
- **Formenmischung:** Keine Form kommt zweimal in Folge (VT 4.2, Kap. 15).

### 2.4 Ablauf einer Tagessitzung (Beispiel: Zielzeit 15 Min.)

1. **Start (Heute oder Wörter):**
   - ein Knopf „Wörter · ca. 14 Min.“ mit einer Zeile „Warum diese?“ („11 fällig, die gefährdetsten zuerst · 3 neue“) (M68, M13);
   - der Plan ist für den Lerntag eingefroren (Kap. 15).
2. **Hauptteil (ca. 11 Min.):**
   - fällige Lexeme nach Abrufwahrscheinlichkeit, gemischt, Geschwister getrennt (M13, M8, M73);
   - **neue Lexeme eingestreut**: das erste nach 3–5 Wiederholungen, das letzte spätestens bei der Hälfte der Sitzung, damit Lernschritt B noch hineinpasst (M72, M9);
   - Menge: mindestens 2, darüber nach Lastbudget bis zum Kontingent (M12);
   - jede Karte läuft nach 2.2.
3. **Anwenden** (2–3 Min., Emrah 4.5):
   - Aufgabe mit **3 Lexemen** der Stufen 4–6 in 2–3 Sätzen, z. B. „Sag dem Partner per Mail, dass sich das Meeting verschiebt“;
   - Claude prüft nach 2.5;
   - richtig benutzt → Good auf Benutzen; im falschen Sinn oder falsches Wort → Again; nur Kollokations- oder Beugungsfehler → Hard (M56, M40c); nach jedem Fehler eine Kontrastkarte in der nächsten Sitzung; nicht benutzt → keine Note;
   - ohne Claude: Musterlösung zum Selbstvergleich, plant nichts (W6).
4. **Abschluss** (Emrah 5.4), vier Zeilen:
   - heute gelernt;
   - aufgestiegen (nur echte Schritte);
   - gestolpert, mit „kommt wieder am …“;
   - „Morgen ca. 12 Min.“
   Dazu „Fertig“ und „Noch 5“. „Noch 5“ nimmt nur Fälliges oder Neues, nie heute Gesehenes (Emrah 5).
5. **Danach (freiwillig):** Trainer, „Schwierig“ (höchstens 10, M75), Tempo (M34), Anki-Modus. Alles zählt als Extra (Kap. 2 Nr. 6).

### 2.5 Regeln für Claude beim eigenen Satz und im Transfer-Block

Vom Lehrer formuliert. Sie gelten für den Prompt in V4, den der `learning-scientist` vor dem Bau prüft.

**Claude soll:**
- drei Urteile trennen: ✕ falsch · ~ möglich, aber unnatürlich · ✓ richtig;
- prüfen, ob das Zielwort im richtigen Sinn steht, nicht nur ob es vorkommt;
- Trivialsätze (*I like leverage.*) und Sätze nahe am Beispielsatz nicht als „benutzt“ zählen;
- je Fehler eine Begründung in einem Satz geben;
- danach freiwillig „Nochmal selbst schreiben“ anbieten, mit verdeckter Variante;
- Fehler in Emrahs Fehlerprofil und in M74 eintragen.

**Claude soll nicht:**
- den ganzen Satz in den eigenen Stil umschreiben;
- mehr als 2 Korrekturen auf einmal geben;
- britische Formen oder richtige Alternativen als Fehler werten;
- Geschmacksfragen als Fehler melden;
- „correct“ sagen, wenn die Kollokation unnatürlich ist;
- in der besseren Variante neue, unbekannte Wörter verwenden;
- den Inhalt oder das Fachliche bewerten;
- Sprachen mischen;
- allgemein loben.

---

## 3. Abgleich mit Emrahs Auftrag (Abschnitte 3–6)

### 3.1 Wo der Markt Emrah bestätigt

| Emrahs Punkt | Bestätigt durch |
|---|---|
| 3.1 FSRS statt SM-2 | Anki FSRS-6, Benchmark: besser als SM-2 in 99,6 % der Sammlungen (Mara 2.4) [anki §10]; RemNote und Mochi bieten FSRS an [remnote §1, mochi §1] |
| 3.2 Abrufen schlägt Wiedererkennen; Auswahl überschätzt | Quizlet rechnet Raten heraus [quizlet §1.2]; Duolingo-Kritik „way too easy“ [duolingo §9]; Clozemaster wertet Tippen doppelt [clozemaster §3] |
| 3.5 Abstand auch in der Sitzung | Anki-Lernschritte [anki §1.2]; Memrise-Prize-Studie: adaptiver Abstand d = 0,56 [memrise §10] |
| 3.6 Kontextvariation, Zustand am Wort | Lingvist und Duolingo planen je Wort [lingvist §1, duolingo §1]; Clozemasters Satz-Logik erzeugt genau Emrahs Klumpen (10 Sätze = 10 Karten) [clozemaster §5] |
| 4.2 Geschwister-Regel, Fuzz, Lastausgleich, 04:00 | Anki hat alle vier im Code, Tageswechsel standardmäßig 4 Uhr [anki §1.2–1.5] |
| 4.2 Rückstand nach Gefährdung | Anki mit FSRS sortiert nach R [anki §1.7]; SuperMemo nennt den Rückstand den Hauptgrund fürs Aufhören [supermemo §1] |
| 4.3 Automatische Bewertung, Hinweis = Hard | Clozemaster und Vocabulary.com halbieren bei Hinweis [clozemaster §3, vocabulary-com §3]; Lingvist wertet Tippfehler nach Lage [lingvist §3] |
| 4.3 Override „Das wusste ich eigentlich“ | Quizlet hat genau diesen Knopf [quizlet §3] |
| 4.4 Leiter Erkennen → Benutzen | Quizlet (Auswahl → Tippen) [quizlet §2], Readlang (passiv → aktiv in einer Sitzung) [readlang §2], Memrise (gelernt → gehört → benutzt) [memrise §7] |
| 5 Sitzung mit Ende | Anki, Lingvist, Drops [anki §8, lingvist §8, drops §8] |
| 6 UI-Muster (Lingvist-Lücke, Clozemaster-Aufklappbereich, Quizlet-Progression, Anki-Transparenz) | in den Steckbriefen je §8 Schritt für Schritt bestätigt; Bildlinks in `bildquellen.md` |

### 3.2 Wo ein Anbieter es nachweislich besser macht (Vorschläge mit Beleg)

1. **Fuzz mit festem Startwert** (Anki): Die Streuung wird aus Kennung und Wiederholungszahl berechnet, nicht frei gewürfelt [anki §1.4]. Emrahs Auftrag sagt nur „streuen“. **Vorschlag:** fester Startwert, damit der Plan beim Neuzeichnen gleich bleibt (Kap. 15).
2. **Geschwister auch auf den Nachbartagen streuen** (Anki: Gewicht 0,2 bei ±1 Tag, 0,4 bei ±2 Tagen) [anki §1.3]. Emrah verlangt „höchstens einmal am Tag“. **Vorschlag:** zusätzlich die beiden Spuren eines Lexems nicht auf aufeinanderfolgende Tage legen.
3. **Lastausgleich nur bis 90 Tage, mit Gewicht 1/Intervall** (Anki) [anki §1.5]. Das verhindert, dass alles auf späte Tage rutscht. **Vorschlag:** übernehmen; gezählt in Minuten statt Karten.
4. **Echte Behaltensrate** (Anki „True retention“) [anki §7]. **Vorschlag:** zusätzlich zu Emrahs Dashboard-Zahlen. Sie zeigt, ob 90 % wirklich erreicht werden; ohne sie bleibt der Plan unprüfbar.
5. **Raten herausrechnen statt nur „zählt nicht“** (Quizlet) [quizlet §1.2]. Emrah ist hier strenger (Auswahl zählt gar nicht). **Kein Vorschlag**, nur die Bestätigung, dass seine Linie die strengste belegte ist.
6. **Tippfehler nach Lage und Schwere** (Lingvist) [lingvist §3]. Emrah nennt Levenshtein. **Vorschlag:** Levenshtein plus Ausnahme „anderes echtes Wort“ (*contract/contact*). Das ist kein Tippfehler, sondern ein Wortfehler (M40).
7. **„Aufgabe war unfair“** (RemNote „Skip“, Lingvist „Report“) [remnote §3, lingvist §3]. **Vorschlag:** ein Weg ohne Planwirkung, damit ein schwacher Satz kein Wort bestraft.
8. **Problemwort-Paare** (Anki, SuperMemo: bei Verwechslung eins ruhen lassen) [anki §1.8, supermemo §1]. Emrah verlangt „Merkhilfe/neuer Kontext“. **Vorschlag:** zusätzlich die Paar-Regel für echte englische Paare (*affect/effect*, *advice/advise*); falsche Freunde (*eventually* ≠ eventuell) bekommen eine Kontrastkarte (M14).
9. **Bedeutungsgruppen** (Vocabulary.com) [vocabulary-com §1]. **Vorschlag:** Mehrdeutige C1-Wörter (*address*, *issue*, *raise*) bekommen je Sinn ein eigenes Lexem.
10. **Höchstens 3-mal verschieben** (SuperMemo-Grenzen) [supermemo §1]. **Vorschlag:** bei der Rückstands-Verteilung, damit kein Wort versandet.

### 3.3 Widersprüche (mit Empfehlung)

| Nr. | Widerspruch | Was der Markt und die Forschung sagen | Empfehlung |
|---|---|---|---|
| W1 | **Emrah 4.1:** „Benutzen“ startet erst bei Stabilität „Verstehen“ ≈ 3 Tage. **Emrah 4.4:** Stufe 3 (Lücke tippen) gehört zu „Verstehen“. **Lena 2.1/2.2:** Produktiver Abruf ab Tag 0 als Hauptspur. | Ein Wort in eine Lücke **tippen** ist Formabruf, also produktiv (Laufer & Goldstein 2004, Lena 2.1). Lingvist fragt vom ersten Kontakt an so ab [lingvist §2]. Quizlet und Readlang steigen noch in derselben Sitzung von Auswahl zu Tippen [quizlet §2, readlang §2]. | **Variante B (empfohlen):** Die getippte Lücke mit „Gesucht: …“ (Stufe 3) zählt auf **beide** Spuren. „Verstehen“ wird zusätzlich mit Bedeutungsabruf (Englisch → Deutsch, Ton → Bedeutung) geübt. Emrahs Schwelle (≈ 3 Tage) gilt für die schweren Benutzen-Formen ab Stufe 4. **Variante A:** genau wie im Auftrag. **Emrah entscheidet.** |
| W2 | **Emrah 4.4:** 7 Stufen. **Vorschau H12/H34 und Lena 3.2:** S0–S5. **Auftrag Kap. 5:** fünfstufige Leiter. | – | Emrahs 7 Stufen gelten intern; die Zuordnung zu Kap. 5 steht unter 2.3. Für die Anzeige drei Gruppen wie in H34: Erkennst du (1–2), Auf dem Weg (3–5), Bildest du selbst (6–7). Die Stufenbalken im Wort-Detail bekommen 7 Teile. Das Paket V3 passt H12, H34 und H37 an. |
| W3 | **Emrah 4.2:** Lernschritte „1 min → 10 min“. | Ankis Standard ist genau 1 Min. → 10 Min. [anki §1.2]. Bei 10-Minuten-Sitzungen fällt der 10-Minuten-Schritt aber oft nach das Ende. Lena 3.2: nach Karten zählen. | Abstand **nach Karten und Zeit** (M9). Die Zahlen sind konfigurierbar, die 60-Tage-Simulation prüft beides. |
| W4 | **Emrah 4.3:** Override „Das wusste ich eigentlich“. **A7:** keine Selbstbewertung. | Quizlet: Gute Tippfehler- und Synonym-Erkennung senkte den Bedarf an Overrides um mindestens 50 % (laut Anbieter) [quizlet §3]. | Der neue Auftrag hat Vorrang (Entscheidung 30.10.2026). Das Ventil wird aber so gebaut, dass es **prüft statt glaubt** (learning-scientist): Die Abfrage bleibt ohne Note und ohne Stufenabstieg. Das Wort kommt nach 3–5 Karten frei in einem neuen Satz zurück, und diese Antwort benotet die App. Gemessen wird die Trefferquote der übersteuerten Wörter bei der Wiederkehr; liegt sie unter 70 %, wird das Ventil überprüft. |
| W5 | **Emrah 4.2:** Leech bei z. B. 6 Fehlern. **Bestand (VT 3.1, wort-fest-plan):** Wort-Werkstatt schon bei 2 Fehlern in 30 Tagen. **Anki:** 8. | Anki 8, dann alle 4 [anki §1.8]; Memrise begrenzt „Difficult“ auf 20 [memrise §1]. | Beides behalten, weil sie Verschiedenes leisten: **Werkstatt** (2 in 30 Tagen) = neue Darstellung, früh. **Leech** (6 insgesamt) = Paar-Prüfung, Pause anbieten, Lehrer-Hinweis. |
| W6 | **Emrah 4.5:** Ohne Claude „Selbstbewertung mit Musterlösung“. **A7:** keine Selbstbewertung. | Kein Anbieter belegt eine planwirksame Selbstprüfung von Freitext. Busuu lässt Menschen prüfen [busuu §6]. | Ohne Claude: Musterlösung und Selbstvergleich als Übung, **ohne Wirkung auf den Plan**. Die Aufgabe bleibt nachholbar. |
| W7 | **Emrah 4.3:** Auswahl ändert die Stabilität „nicht oder nur minimal“. | Quizlet: „minimal“ über die Ratewahrscheinlichkeit [quizlet §1.2]. Lena 2.3: Auswahl beweist fast nichts. | „Nicht“ (FSRS unverändert). Das ist einfacher zu testen und zu erklären. |
| W8 | **Emrah 6:** PWA, Cloudflare Worker, `docs/verlauf.md`. | – | Schon übertragen (Entscheidung 30.10.2026): Artefakt, `claude.use("sample")`, `stand.md`. Kein Handlungsbedarf. |
| W9 | **Emrah 4.4 Stufe 1:** „danach sofort 1 leichter Abruf“. **Lena 2.2:** erster Abruf nicht sofort. | Karpicke & Roediger 2007 (Lena 2.2); Memrise Prize: erst Stichwort, dann Lösung [memrise §10]. | „Sofort“ = **nach 3 anderen Karten** (wirkt für Emrah wie sofort). Direkt bei der Einführung kommt nur der kurze eigene Versuch vor dem Aufdecken (M36). |

---

## 4. Abgleich mit der Vorschau `WBft3EEx7jYYv4QHdepuNm` v2

Grundlage ist der Quelltext der Vorschau (`docs/relaunch/vorschau/src/screens.js`, `screens-woerter.js`, `screens-soll.js`, `desk*.js`).

### 4.1 Schon drin

| Muster | Bildschirm | Methode |
|---|---|---|
| Eingabe in der Lücke, „Gesucht: …“, Tipp (erster Buchstabe und Wortzahl), „Weiß ich nicht“ | H2 `gap`/`type`, H18 | M24, M25, M44 |
| ein Band mit Urteil, Vergleich und Warum; „Mehr“ mit Satzübersetzung und Eselsbrücke; „War das auch richtig?“ | H2 `band`/`also`/`more` | M41, M50, M52 |
| Formen je Stufe: frei, Lücke, Wortpartner, Situation, Erkennen, Hören, Sprechen, Kontrast | H18 Varianten | M22, M27, M29, M30, M31 |
| Wort-Detail: Stufenbalken, Satz „Nächster Abruf morgen, ohne Satz“, Ursprungssatz mit Herkunft, Wortpartner, letzte Versuche, Anhören in Schleife, Sag es, Pausieren | H12 `detail`, L5 | M54, M58, M66 |
| zwei Zahlen „bildest du selbst / auf dem Weg / erkennst du“, Zuwachs, Vorher-Nachher | H14, H34 `words` | M64, M65 |
| Trainer-Start mit „Warum diese?“, Schwierig, Wort-Werkstatt | H17, H33 | M13, M75, M14 |
| Ergebnis mit „war nah dran (1 Buchstabe)“, „kommt morgen wieder“, „Morgen fällig: 14“ | H20, L14 | M54, M71 |
| Anki-Modus: Erkennen mit 4 Knöpfen und Abständen, Bilden ohne Planwirkung | H19, L13 | M37 (nur dort) |
| Hinzufügen „Erkennen reicht / Aktiv lernen“, Wort aus Popup mit Satz | H21, H15 `saved` | M58 |
| „Zu leicht · kenne ich längst“ (in der Vorschau: Kontrolle in 30 Tagen; nach M16 auf **7 Tage** angleichen) | H2 Menü „…“ | M16 |
| Einstufung Wörter: erst erkennen, dann selbst bilden mit Anfangsbuchstabe | H25 `placement-*` | M16, M69 |
| Melden einer Aufgabe | Menü „…“, Hinweis „Gemeldet …“ | M43 |
| Tempo als freiwilliges Format | H22 | M34 |
| ruhendes Wort mit Begründung | H12 `resting-sheet` | Lena 2.3 (21-Tage-Probe) |

### 4.2 Muss ergänzt werden (im Stil der Vorschau: ein Hauptknopf, ruhige Zeilen, keine Punkte)

| Nr. | Bildschirm / Variante | Inhalt | Methode | Paket |
|---|---|---|---|---|
| B1 | **H34 `words` + Karte „Die nächsten 14 Tage“** | Balken je Tag in Minuten (soll gleichmäßig aussehen), Ruhetag sichtbar flach; darunter „Behaltensrate: 91 % (Ziel 90 %) · reif 93 % · jung 88 %“ | M63, M18 | V4 |
| B2 | **H12 `detail`: zwei Zeilen statt einer** | „Verstehen: sicher · nächster Abruf 21.11.“ / „Benutzen: auf dem Weg · nächster Abruf morgen“; Stufenbalken mit 7 Teilen (W2) | M66, M7 | V4 |
| B3 | **H2/H18 Band `near`** | Diff der Eingabe (grün/rot/fehlend) bei „fast richtig“ und „falsch“; Zeile „Kommt wieder: Mo, 9.11.“ | M48, M54 | V3 |
| B4 | **H2/H18 Band `override`** | Nebenknopf „Das wusste ich eigentlich“ nach Fehler → eine Zeile „Gut, dann kommt es gleich noch einmal in einem neuen Satz.“ und „Rückgängig“ | M42 | V3 |
| B5 | **H18 `collocation`** | eigener Ausgang „Wort richtig, Partner falsch“ mit Kontrast „~~hold~~ → *give* a presentation“ | M56, M74 | V2/V3 |
| B6 | **H18 `own-sentence` (Stufe 6)** | Lage → eigener Satz tippen oder per Diktat → Claude-Rückmeldung (richtig, natürlich, Kollokation, bessere Variante); Zustand ohne Claude | M33 | V4 |
| B7 | **Neu H38 „Anwenden“ (Transfer-Block)** | Aufgabe mit 3–5 Zielwörtern als Chips, Textfeld, Rückmeldung je Zielwort ✓/~/✕; Variante `offline` mit Musterlösung, ohne Planwirkung | Emrah 4.5, M32 | V4 |
| B8 | **H17 `default` mit Zeitangabe; H20 mit „Morgen ca. X Min.“** | „Wörter · ca. 14 Min.“ statt nur Zahl; Abschluss mit „aufgestiegen / gestolpert / morgen ca. 12 Min.“ | M68, M71 | V3 |
| B9 | **H24 `words` (Einstellungen)** | Zielzeit 10/15/20/30 Min.; Sicherheit 85/90/95 % mit Minutenangabe | M17, Emrah 5 | V1 (Logik), V4 (Bildschirm) |
| B10 | **H2 `intro` mit kurzem Versuch** | Lücke + „Gesucht: …“ + „Erst kurz überlegen“ → Aufdecken; „Kenne ich schon“ als Probe-Knopf | M36, M16 | V2 |
| B11 | **H1 `pause` / H17 `backlog`** | nach Pause: „32 fällig · heute die 18 gefährdetsten, der Rest verteilt bis Do“ | M13 | V3 |
| B12 | **H33 `pair`** (Werkstatt) | Verwechslungspaar: „*effect* ruht, bis *affect* sitzt“ · Variante `false-friend`: Kontrastkarte *eventually* ≠ eventuell | M14 | V2 |
| B13 | **H18 `pattern` · `plural` · `diplomatic` · `particle`** | Formen M78–M81 im Stil von H18 `partner`: Präposition ergänzen, „Plural falsch“, diplomatischer sagen, Partikel-Lücke | M78–M81 | V2 |

---

## 5. Umsetzungsliste (keine Methode bleibt Papier)

Pakete nach Emrahs Vorgehen (Auftrag 9): **V1** Datenmodell, Migration, FSRS-Planer und Simulation · **V2** Stufenleiter, Übungstypen, automatische Bewertung · **V3** Lernkarte, Sitzungsablauf, Abschluss · **V4** Transfer-Block, Wort-Detail, Dashboard · **V5** Wortauswahl C1 und Einstufung.
Jede übernommene (Ü) oder angepasste (A) Methode steht in genau einem Paket. **Prüfung** heißt: Wie wird gezeigt, dass sie wirkt?
- **Sim** = 60-Tage-Simulation (gleicher Lerner wie in V0)
- **Unit** = Unit-Test
- **Bild** = Bildschirm-Abnahme per Screenshot
- **Mess** = Messwert aus echten Antworten nach 4 Wochen

| Methode | Paket | Prüfung |
|---|---|---|
| M1 FSRS je Spur, ts-fsrs 5 fest | V1 | Unit: Version ist in `package.json` festgelegt (kein `^`-Sprung auf 6); **Mess:** echte Behaltensrate 90 % ± 3 nach 4 Wochen (die Simulation allein wäre zirkulär, weil der simulierte Lerner selbst FSRS folgt) |
| M2/M23 Auswahl ohne FSRS-Wirkung | V2 | Unit: Auswahl-Antwort ändert `S`, `D` und `due` nicht; Sim: ≥ 50 % aktive Abfragen ab Stufe 3 (Abnahme 8.2) |
| M6 Zustand am Lexem | V1 | Unit: 3 Sätze eines Lexems ergeben genau 1 Plan-Eintrag je Spur; Migration: Zahl der Lexeme ≤ Zahl der alten Karten |
| M7 zwei Spuren | V1 | Unit: getrennter FSRS-Zustand; Freischaltung nach W1 |
| M8 Geschwister-Sperre und Nachbartage | V1 | Sim: 0 Lexeme mehr als einmal am Tag außerhalb der Lernschritte (Abnahme 8.1); Unit: Spuren eines Lexems nicht an Folgetagen, wenn ein anderer Tag im Korridor frei ist |
| M9 Lernschritte nach Karten und Zeit | V1 (Regel), V3 (Sitzung) | Unit: Schritt 1 nie vor 3 anderen Karten; Sim: Tag-0-Lernschritte enden an ≥ 95 % der Tage in derselben Sitzung |
| M10 Fuzz mit festem Startwert | V1 | Unit: gleiche Eingabe → gleicher Tag (100 Wiederholungen); Korridor nach Ankis Testwerten (7 → 5–9, 17 → 14–20, 37 → 33–41) |
| M11 Lastausgleich in Minuten, Ruhetag | V1 | Sim: Variationskoeffizient der Tageslast vorher/nachher (Abnahme 8.1); Ruhetag ≤ 25 % des Mittels |
| M12 mindestens 2 neue, Lastbudget darüber | V1 | Sim: an **100 %** der Lerntage mit Kontingent > 0 kommen ≥ 2 neue Lexeme, auch im Pausen-Szenario (Kap. 15); Tageslast ≤ Zielzeit + 20 % an ≥ 90 % der Tage |
| M13 Rückstand nach Gefährdung, höchstens 3-mal verschieben | V1 | Sim: Pause 10 Tage → Abbau in ≤ 7 Tagen, kein Lexem länger als 3-mal verschoben, keine fälligen Lexeme unbegrenzt liegen (Abnahme 8.1) |
| M14 Leech 6, Paar-Regel, falsche Freunde | V2 | Unit: 6. Fehler → Werkstatt-Ablauf mit neuem Satz; englisches Paar → zweites Wort ruht; falscher Freund → Kontrastkarte statt Pause; Mess: Fehlerquote der Leeches 4 Wochen danach |
| M15 vorgezogen gleitend | V1 | Unit: früher Abruf → kleinerer Stabilitätszuwachs als fälliger (FSRS-R) |
| M16 „Kenne ich schon“ mit Probe | V5 | Unit: ohne Probe keine Stufenänderung; Mess: Fehlerquote der so übersprungenen Wörter bei der Kontrolle nach 7 Tagen |
| M17 Sicherheit 85/90/95 % mit Minuten | V1 (Logik) | Sim: Minutenangabe je Stufe aus der Simulation, Abweichung ≤ 15 % |
| M18 echte Behaltensrate | V4 | Unit: nur die erste Abfrage des Tages zählt; Mess: Wert nach 4 Wochen sichtbar, Ziel 90 % ± 3 |
| M19 Review-Log vollständig, Anpassung ab 1.000 | V1 | Unit: jedes Log hat Zeit, Form, Spur, Ergebnis, Dauer, Hinweis, Note (Emrah 7); Anpassung gesperrt unter 1.000 |
| M20 Nutzenrang neuer Wörter | V5 | Unit: Gewichtung Band / eigene Funde / Kollokationen; Lehrer prüft die ersten 40 |
| M21 Priorität Kern/Rand | V1 | Sim: bei Rückstand werden nur Randwörter verschoben |
| M22 Form nach Stufe, ≥ 2 je Stufe, schwächste zuerst | V2 | Unit: jede Stufe hat ≥ 2 Formen; Wahl = Form mit der niedrigsten Trefferquote, außer zuletzt; Sim: keine Form zweimal in Folge; **Mess:** Trefferquote beim ersten Versuch 75–90 % (Lena 3.3: „schwer, aber lösbar“) |
| M24 Lücke tippen | V2 (Logik), V3 (Karte) | Bild: H18 `gap` auf 390 px, Tastatur offen, Autokorrektur aus |
| M25 „Gesucht: …“ bis Stufe 4 | V2 | Unit: ab Stufe 5 ohne deutsche Bedeutung |
| M26 Wortart- und Formangabe | V2 | Unit: nur bei mehrdeutiger Form; Lehrer-Stichprobe |
| M27 jeder 3. Abruf ohne Satz, als deutscher Chunk | V2 | Sim: Anteil ohne Satz ab Stufe 4 bei 30–40 %; Lehrer prüft die Chunks; **Mess:** Trefferquote ohne Satz gegen Ankersatz, die Lücke wird über 4 Wochen kleiner |
| M28 Bedeutung frei nennen, Sinne getrennt | V2 | Unit: Verstehen-Abfrage wertet die Bedeutung (Claude oder Liste); Lehrer-Charge |
| M29 Situation → Ausdruck | V2 | Lehrer prüft 100 % der Situationen; Unit: Schlüssel vorhanden |
| M30 Hören → Tippen | V2 | Unit: Form im Katalog; Bild H18 `listen` |
| M31 Sprechen per Diktat | V2 | Unit: abgelehnte Erkennung wird nie als Fehler gewertet |
| M32 Satz-Recall im Transfer | V4 | Bild H38 |
| M33 gelenkter (Stufe 5) und freier (Stufe 6) eigener Satz | V4 | Prompt-Prüfung nach 2.5 (learning-scientist, english-teacher); Unit: ohne Claude keine Planwirkung, Trivialsatz zählt nicht als „benutzt“; Mess: Anteil richtiger eigener Sätze |
| M34 Tempo freiwillig | V3 | Unit: Tempo-Antworten zählen nicht zur Pflicht |
| M36 erst versuchen, dann Lösung | V2 | Bild H2 `intro`; **Mess:** Tag-1-Abruf mit und ohne Versuch, zufällig aufgeteilt nach Lexem-Kennung (gerade/ungerade), nicht nach Woche |
| M38 Note aus Richtigkeit, Form, Hilfe | V2 | Unit: Notentabelle vollständig (alle Ausgänge × Stufen) |
| M39 Zeit in der Note | V2 | Unit: Zeit bis zum ersten Zeichen, Kappung 45 s; erste 20 Antworten je Form ohne Zeitwirkung; Schwellen 2× / 0,6×; Easy nur ab Stufe 5, fällig, nach 21 Tagen; **Mess:** Behaltensrate bei der nächsten Abfrage getrennt nach Hard/Good/Easy, jede im Band 85–95 % |
| M40 Tippfehler-Regeln | V2 | Unit je Regel (a)–(h): *lead tmie*, *recieve* (Vertauschung = 1) → fast richtig; *adress* → Formfehler aus der Liste; *lead times* → (c), nicht (e); *manage* statt *manager* → Again; *postpone* statt *postponed* → Hard + Grammatik; *decide* statt *decision* → Again; *contract/contact* → Wort; *follow up/follow-up* → Form; *the lead time*, typografischer Apostroph → richtig; *organise* → richtig. Lehrer prüft die Liste der Fehler deutscher Lerner |
| M41 Auch richtig, Ausweichwort | V2 | Unit: keine Note, Wiederkehr nach 3–5 Karten; zweites gleiches Ausweichwort → Hard; Lehrer legt Synonyme je Satz fest (Charge) |
| M42 Override prüft statt glaubt | V3 | Unit: Override → keine Note, kein Abstieg, Wiederkehr in neuem Satz, die benotet wird; **Mess:** Trefferquote der übersteuerten Wörter bei der Wiederkehr (unter 70 % → Ventil prüfen) |
| M43 Aufgabe unfair | V3 | Unit: keine Planwirkung, Eintrag in der Inhaltsprüfung |
| M44 Hinweis = Hard | V2 | Unit (Teil der Notentabelle) |
| M45 zweiter Versuch | V2 | Unit: Fehler, dann richtig → Again ohne Stufenverlust; erster Versuch nur Tippfehler → Hard |
| M48 Diff | V3 | Unit: Diff-Funktion (NFC, Groß/Klein); Bild H18 `near` |
| M49 kein Pflicht-Abtippen, freie Wiederkehr | V3 | Unit: Wiederkehr in anderem Satz oder ohne Satz |
| M50 Erklärung auch bei richtig, Inhaltsvertrag | V3 | Bild je Form im Zustand richtig und falsch; Lehrer-Stichprobe von 30 Warum-Zeilen (Wortart · Verbindung · „X heißt …, passt zu …“); Unit: jede Form hat einen Wozu-Satz |
| M51 Ton normal/langsam | V3 | Bild; Unit: US-Stimme |
| M52 Satzübersetzung im „Mehr“ | V3 | Bild H2 `more` |
| M53 Fehlerwort in derselben Sitzung | V3 | Sim: jedes Again kommt in derselben Sitzung frei zurück, solange die Sitzung noch ≥ 3 Karten hat |
| M54 „Kommt wieder am …“ | V3 | Unit: angezeigtes Datum = gespeichertes `due` (Emrahs Rückmeldung 6 vom 10.10.) |
| M55 wörtliche Bedeutung | V5 | Lehrer-Charge (nur wo sinnvoll) |
| M56 Wortpartner und Kollokationsfehler | V2 | Unit: Ausgang „Partner falsch“; Lexem = Kollokation → Again, Einzelwort → Hard + Partner-Lexem markiert; *take a decision* → Auch richtig (UK); Lehrer prüft Partnerlisten |
| M57 Ankersatz, dann wechselnd | V2 | Sim: derselbe Satz für den Formabruf nicht innerhalb von 30 Tagen; Unit: Leck-Prüfung vorhanden; Signal „satzgebunden“ → 2 Termine ohne Satz; **Mess:** Trefferquote im neuen Satz gegen Ankersatz, die Lücke wird über 4 Wochen kleiner |
| M58 Ursprungssatz aus dem Lesen | V1 (Migration), V5 | Unit: kein Lexem ohne Ursprungssatz (Kap. 15) |
| M59 Markierung im Lesen, ohne FSRS | V5 | Unit: Begegnung ändert FSRS nicht |
| M61 i+1-Regel | V5 | Unit: Satzbank-Validator (höchstens 1 Lernwort unter Stufe 3 je Satz) |
| M62 Sinne als eigenes Lexem | V5 | Lehrer-Charge zu 20 mehrdeutigen C1-Wörtern |
| M63 Lastvorschau 14 Tage in Minuten | V4 | Bild B1; Unit: Vorschau = Summe der geplanten Minuten |
| M64 Stufenverteilung | V4 | Bild H34 (besteht, an 7 Stufen anpassen) |
| M65 drei Spuren erkennt / bildet / benutzt | V4 | Unit: „benutzt“ nur aus geprüften eigenen Sätzen und Transfer |
| M66 Wort-Detail mit beiden Spuren | V4 | Bild B2 |
| M68 Minuten heute und morgen | V3 | Unit: Schätzung aus Median-Zeiten; Mess: Abweichung ≤ 20 % |
| M69 Textabdeckung | V5 | Unit: nur mit Einstufung, mit Bandbreite |
| M71 klares Ende, „Noch 5“ | V3 | Unit: „Noch 5“ ohne heute Gesehenes |
| M72 Neues eingestreut | V3 | Sim: erstes neues Lexem nach 3–5 Wiederholungen, letztes ≤ 50 % der Sitzung, Lernschritt B passt in ≥ 95 % der Sitzungen; Unit: keine zwei verwechselbaren neuen Lexeme am selben Tag |
| M73 Reihenfolge mit festem Startwert | V3 | Unit: Neuzeichnen ändert die Reihenfolge nicht |
| M74 Kollokationsfehler am Anfang der nächsten Sitzung | V3 | Unit: Kontrastkarte erscheint als erste Karte der nächsten Sitzung |
| M75 „Schwierig“ höchstens 10 | V3 | Unit |
| M76 Modus-Wahl nur im Trainer | V3 | Unit: Pflicht ignoriert die Modus-Wahl |
| M77 Folgetag und Abstands-Deckel | V1 | Sim: 100 % der neuen Lexeme am Lerntag 1 abgefragt; kein Intervall über dem Deckel der Belegstufe; **Mess:** Abruf am Lerntag 1, sanfte Bremse für Neues unter 70 % (Lena 3.2) |
| M78 Präposition/Muster | V2 | Lehrer-Charge der Muster je Lexem; Unit: Ausgang „Präposition falsch“; Mess: Fehlerquote je Muster sinkt über 4 Wochen |
| M79 Zählbarkeit | V2 | Unit: *informations*, *advices* → „Plural falsch“ mit Erklärung |
| M80 Stilebene, diplomatischer sagen | V2 (Marke), V4 (Form mit Claude) | Lehrer markiert die Stilebene je Lexem; Prompt-Prüfung (learning-scientist); Bild H18 `diplomatic` |
| M81 Phrasal Verbs | V2 | Unit: *set up it* → Formfehler mit Erklärung; Lehrer-Charge |

**Abdeckung:** Alle 71 übernommenen oder angepassten Methoden stehen in der Liste (M3–M5, M35, M37, M46, M47, M60, M67 und M70 sind verworfen). Zwei Zeilen fassen je zwei Methoden zusammen (M2/M23, M44 bei M38).

**Gesamtabnahme (aus Emrahs Auftrag 8, ergänzt):**
- 60-Tage-Simulation vorher/nachher: Wiederholungen je Lexem und Tag, Variationskoeffizient der Last, längste Lücke, Anteil aktiver Abfragen und neu die simulierte Behaltensquote;
- die Unit-Tests oben;
- Bildschirm-Abnahme B1–B13 durch Emrah am Handy;
- Messwerte nach 4 Wochen: echte Behaltensrate, Behaltensrate je Note (Hard/Good/Easy), Trefferquote beim ersten Versuch, Trefferquote übersteuerter Wörter, Abruf am Lerntag 1, Lücke Ankersatz gegen neuen Satz.

---

## 6. Grenzen dieser Synthese

- **Belege sind ungleich tief.** Anki ist bis in den Quellcode belegt. Quizlet konnte nur über Sekundärquellen belegt werden: Hilfe und Blog antworteten mit 403 [quizlet §Quellen]. Lingvists Modell ist nicht offen [lingvist §1].
- **Unabhängige Studien zur Lernwirkung fehlen** für fast alle Apps. Ausnahmen sind HLR (eigene Daten von Duolingo) und der Memrise Prize (Memrise-Ko-Autoren). Wirkungsaussagen stützen sich deshalb auf die Forschung bei Lena, nicht auf Anbieterzahlen.
- **Antwortzeit als Notenbestandteil** nutzt kein Anbieter nachweislich. Die Regel M39 stützt sich auf Forschung (ARTS) und wird deshalb erst nach 20 Antworten je Form wirksam und nach 4 Wochen gemessen.
- **Die Zahlenwerte** (Schwellen, Stufen-Aufstieg, 3 Karten, 2× / 0,6×) sind Startwerte. V1 macht sie konfigurierbar, die Simulation in V0/V1 prüft sie.
