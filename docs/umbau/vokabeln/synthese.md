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
| M12 | **Tageslimit für Neues** | fest 20 neu / 200 Wiederholungen (Anki) [anki §1.6]; „Neues erst, wenn Rückstand null“ (Lingvist) [lingvist §1]; ohne Limit (Quizlet, Vocabulary.com) | Lena 3.6: Zeitbudget je Tag | + Lingvist schützt vor Überlast · − Lingvists Regel sperrt nach Pausen alles Neue (Kap. 15: „neue Wörter, die an Tagen mit Wiederholungen nie auftauchen“) | **A** **Lastbudget in Minuten** (Emrah 4.2): Neues nur, solange die erwartete Last unter der Zielzeit liegt; dazu eine Mindestmenge von 1–2 neuen am Tag außer bei Rückstand über 2 Tagesbudgets. Lingvists Regel: **V**. |
| M13 | **Rückstand nach Pause**: nach Abrufwahrscheinlichkeit sortieren; Wiederholungs-Deckel als Puffer; Randwörter verschieben | Anki (FSRS sortiert nach R, Deckel) [anki §1.7], SuperMemo „Postpone“ mit Priorität [supermemo §1], Glossika „schwächste zuerst“ [glossika §1] | Lena 2.2: Verspätete Abrufe stärken mehr; FSRS rechnet die Verspätung ein | + keine Wand von Karten · − SuperMemos Verschieben ohne Grenze lässt Wörter versanden | **Ü** Emrah 4.2: gefährdetste zuerst, Rest über mehrere Tage verteilt, höchstens 2 Tagesbudgets je Tag. **A** aus SuperMemo: Ein Wort darf höchstens 3-mal verschoben werden. |
| M14 | **Problemwörter (Leeches)**: Schwelle, dann andere Darstellung; bei Verwechslungspaaren eins pausieren | Anki: 8 Fehler, dann alle 4 [anki §1.8]; SuperMemo-Assistent [supermemo §1]; Vocabulary.com „Trouble Words“ [vocabulary-com §1]; Memrise „Difficult words“, höchstens 20 je Sitzung [memrise §1] | Lena 2.3: Hyperkorrektur; Anki-Handbuch: Darstellung ändern statt wiederholen | + verhindert Endlosschleifen · − Anki setzt standardmäßig nur eine Marke, die Aktion bleibt beim Nutzer | **A** Schwelle **6 Fehler** (Emrah 4.2) → automatisch neue Darstellung: neuer Satz, Merkhilfe, Kontrast zum Verwechslungswort. Bei einem Verwechslungspaar ruht das zweite Wort, bis das erste 7 Tage hält. |
| M15 | **Vorgezogenes Üben gleitend werten** (fast fällig = fast voller Zuwachs, sehr früh = wenig) | Anki gefilterte Stapel [anki §1.10]; Clozemaster halbiert die Punkte [clozemaster §3] | Lena 2.2: Cepeda 2008, kurze Abstände wirken später schlechter | + Freies Üben schadet dem Plan nicht | **Ü** steht schon in VT 3.1; FSRS rechnet R ein. |
| M16 | **Bekanntes herausnehmen** (Einstufung, „kenne ich schon“) | Lingvist Einstufung über ca. 50 Wörter [lingvist §1], Vocabulary.com Assessment [vocabulary-com §2], WordUp Knowledge Map [wordup §1], Drops Wischen [drops §2] | Lena 2.9: Einstufung in Bändern | + spart Zeit bei B2-Wörtern · − „kenne ich“ ohne Probe bläht auf (LingQ [lingq §7]) | **A** „Kenne ich schon“ nur mit **einer Probe**: Ein freier Abruf ohne Hilfe gelingt → Stufe hoch und Kontrolle in 30 Tagen; misslingt er → normale Einführung (Emrah 4.6). |
| M17 | **Ziel-Behaltensquote als einfacher Regler mit Lastangabe** | Anki-Simulator und Last-Kurve [anki §7]; Brainscape Zeit-Voreinstellungen [brainscape §1] | Lena 2.2: 70–97 % sinnvoll, über 90 % steigt die Last steil | + Emrah versteht „mehr Zeit für mehr Sicherheit“ · − Ankis Parameter-Menü überfordert | **A** drei Stufen 85 / 90 / 95 % mit Minutenangabe („90 %: ca. 14 Min. am Tag“), Standard 90 % (Emrah 4.2). |
| M18 | **Echte Behaltensrate** („True retention“): nur die erste Abfrage des Tages, getrennt nach jung und reif (Intervall ≥ 21 Tage) | Anki [anki §7] | Lena 3.9: Prozesswerte | + prüft, ob der Plan stimmt (Ziel 90 % → gemessen?) | **Ü** als Messwert und auf dem Dashboard. |
| M19 | **Parameter erst ab ca. 1.000 Abfragen anpassen** | RemNote, Anki [remnote §1, anki §1.1] | FSRS-Benchmark: angepasste Parameter schlagen Standardwerte in 84 % der Sammlungen (Mara 2.4) | + eigene Daten verbessern den Plan · − mit wenig Daten schlechter | **Ü** Review-Log ab Tag 1 vollständig (Emrah 7); Anpassung erst ab 1.000 Abfragen der Spur, nur nach Simulation. |
| M20 | **Neue Wörter nach Nutzen ordnen** (Häufigkeit, „Reach Words“) | Lingvist [lingvist §1], WordUp [wordup §1], Vocabulary.com [vocabulary-com §1] | Lena 2.9; Emrah 3.7 | + C1-Breite gezielt · − Häufigkeit allein passt nicht zu Business | **A** gewichtet nach Emrah 4.6: Frequenzband bis C1 + eigene Funde + Kollokationen bekannter Wörter + Berufsprofil. |
| M21 | **Priorität je Wort** (Kern- vor Randwort) | SuperMemo [supermemo §1] | – | + steuert, was bei Überlast wartet | **A** zwei Stufen „Kern“ (Business, eigene Funde) und „Rand“. Nur Randwörter werden bei Rückstand verschoben (M13). |

### 1.2 Abfrage-Leiter

| Nr. | Methode | wer | Forschung | dafür / dagegen | Urteil |
|---|---|---|---|---|---|
| M22 | **Frageform je Wort nach Stand wählen** („schwer, aber lösbar“): Auswahl → Tippen | Quizlet Learn [quizlet §2], Vocabulary.com Gerüst [vocabulary-com §2], Readlang passiv → aktiv in einer Sitzung [readlang §2], Birdbrain ca. 70 % (Mara 2.1) | Lena 2.1 (Retrieval Effort); Bjork 1994 | + jede Abfrage so schwer wie möglich · − Quizlet beendet nach 2 Treffern in einer Sitzung | **Ü** als Stufenleiter (Emrah 4.4); der Aufstieg braucht Tage (M47). |
| M23 | **Auswahl (Multiple Choice) als Haupt- oder Einstiegsform** | Duolingo Wortbank [duolingo §2], Vocabulary.com fast nur Auswahl [vocabulary-com §2], Clozemaster [clozemaster §2], Drops [drops §2] | Lena 2.3: Auswahl überschätzt das Wissen | + schnell, leicht · − „way too easy“ (Duolingo), Raten | **A** nur in den Lernschritten und als Rettung nach einem Fehler, ohne FSRS-Wirkung (Emrah 4.3 und 4.4 Stufe 2; Abnahme 8.2). |
| M24 | **Wort in die Lücke eines echten Satzes tippen** | Lingvist [lingvist §2], Clozemaster [clozemaster §2], Readlang aktiv [readlang §2], Anki `{{type:cloze}}` [anki §2] | Lena 2.1: Formabruf (Nakata 2016) | + Eingabe in der Lücke (Kap. 15) · − Satz kann das Wort verraten | **Ü** Kernform ab Stufe 3; mit Leck-Prüfung der Sätze (Lena 2.1). |
| M25 | **Deutsche Bedeutung als Hinweis an der Lücke** | Lingvist [lingvist §2] | Lena 2.1: Bedeutung als Hinweis trainiert den Weg „Bedeutung → Wort“ | + klarer Abruf · − Lingvist blendet den Hinweis nie aus | **A** „Gesucht: …“ bis Stufe 4. Ab Stufe 5 ersetzt eine Situation oder ein Satz ohne Hinweis die deutsche Bedeutung. |
| M26 | **Wortart- und Formangabe an der Lücke** („noun, plural“) | Lingvist [lingvist §4] | – | + trennt Form- von Wortfehler | **A** nur, wenn der Satz die Form nicht eindeutig macht. |
| M27 | **Abruf ohne Satz** (Deutsch → Englisch, Buchstabieren) | Anki Rückwärtskarte [anki §2], Vocabulary.com Spelling [vocabulary-com §2], Mochi [mochi §2] | Lena 2.1: Etwa jeder 3. Abruf ohne Satz, gegen Satz-Erinnerung | + prüft den Weg, der beim Sprechen gebraucht wird | **Ü** Stufe 4 und jeder 3. Abruf ab Stufe 4 (Lena 3.4). |
| M28 | **„Was heißt das Wort *hier*?“**, getrennt nach Bedeutungsgruppen | Vocabulary.com (z. B. *raise*: 122 Fragen zu 31 Bedeutungen) [vocabulary-com §1, §2] | Lena 2.1: Bedeutung im Kontext ablösen | + C1 heißt Mehrdeutigkeit · − Auswahlform | **A** Bedeutung **frei nennen** statt wählen (Spur Verstehen). Jeder weitere Sinn eines Worts ist ein eigenes Lexem mit Verweis. |
| M29 | **„Apply the Meaning“**: Alltagsfrage, die nur mit Verständnis lösbar ist | Vocabulary.com [vocabulary-com §2] | Involvement Load (Emrah 3.4) | + Brücke zum Benutzen · − bei Vocabulary.com mit Auswahl | **A** als Situationsaufgabe „Du willst sagen, dass …“ (Stufe 5), Antwort getippt, Sätze vorab vom Lehrer geprüft. |
| M30 | **Hören → Tippen** (Diktat des Satzes oder Worts) | Clozemaster Listening [clozemaster §2], Glossika [glossika §2], Quizlet Spell [quizlet §2], Babbel [babbel §2] | Lena 2.6: Hören eigener Strang | + Klangbild, Abwechslung · − nur Form, keine Bedeutung | **Ü** als eine Form ab Stufe 3 (Formenmischung, Kap. 15). |
| M31 | **Sprechen als Antwortweg** | Lingvist Stimme [lingvist §2], Speak [speak §2], Babbel [babbel §2], Glossika [glossika §2] | Lena 2.5 | + Sprechen ist Emrahs Ziel · − Erkennung schwankt (Speak zu mild, Babbel blockiert) | **A** nur über das Diktat des Handys, wird wie Tippen gewertet. Eine Ablehnung der Erkennung ist nie ein Fehler; dann „Tippen statt sprechen“. |
| M32 | **Ganzen Satz aus dem Gedächtnis sagen oder tippen** („Recall“) | Glossika [glossika §2] | Lena 2.5: wiederholter Inhalt macht flüssig | + aktive Nutzung · − Satz als Einheit | **A** im Transfer-Block und in „Sag es“, nicht als Planeinheit. |
| M33 | **Eigener Satz mit dem Zielwort, korrigiert** | Busuu Community [busuu §6], Memrise MemBot [memrise §6], Speak [speak §6] | Emrah 3.4 (Involvement Load); Lena 2.1: Barcroft 2004, eigene Sätze zu früh schaden der Formlernung | + höchste Stufe · − Community schwankt, KI-Gespräche „repetitive“ | **A** Stufe 6 (Emrah 4.4) erst, wenn die Form frei sitzt; Claude prüft Korrektheit, Natürlichkeit und Kollokation und zeigt eine bessere Variante. |
| M34 | **Mini-Spiele mit Uhr** | Drops [drops §2], Memrise Speed Review [memrise §2] | Lena 2.5: Flüssigkeit unter Zeitdruck | + Tempo · − Zeitdruck verdrängt sorgfältiges Formulieren | **A** nur als freiwilliges „Tempo“ (H22) mit sicheren Wörtern, nie in der Pflicht. |
| M35 | **Bild-Zuordnung** | Drops [drops §2], Vocabulary.com Bildfrage [vocabulary-com §2] | – | − abstrakte Business-Wörter kaum bebilderbar | **V** für C1-Business. |
| M36 | **Erst Hinweis, kurz selbst versuchen, dann Lösung** (bei neuen Wörtern) | Memrise-Prize-Studie: d = 0,39 [memrise §10] | Lena 2.3: Hyperkorrektur; Testeffekt | + stärkere Einprägung · − Studie mit Memrise-Ko-Autoren | **A** In der Einführung (Stufe 1) wird erst der Satz mit Lücke und deutscher Bedeutung gezeigt, und Emrah darf kurz raten. „Weiß nicht“ ist straffrei. |

### 1.3 Bewertung

| Nr. | Methode | wer | Forschung | dafür / dagegen | Urteil |
|---|---|---|---|---|---|
| M37 | **Selbstbewertung** (4 Knöpfe, 1–5, „weiß ich / weiß ich nicht“) | Anki [anki §3], SuperMemo 0–5 [supermemo §3], Brainscape 1–5 [brainscape §3], Mochi 2 Knöpfe [mochi §3] | Lena 2.3: Flüssigkeits-Illusion; Selbsturteil unzuverlässig | + schnell · − Grundursache von Emrahs „willkürlich“ | **V** außer im Anki-Modus (A7, VT 3.6). |
| M38 | **Automatische Note aus Richtigkeit, Form und Hilfe** | Clozemaster (Tippen 8, Auswahl 4, Hinweis halbiert) [clozemaster §3], Vocabulary.com (Hinweis halbiert) [vocabulary-com §3], Lingvist [lingvist §3] | Lena 2.3: Form × Hilfe × Zeit | + gerecht, nicht manipulierbar | **Ü** Emrah 4.3: falsch oder Lösung angezeigt → Again; Hinweis oder sehr langsam → Hard; richtig → Good; schnell auf hoher Stufe → Easy. |
| M39 | **Antwortzeit in der Note** | kein Anbieter belegt; Anki misst sie, nutzt sie aber nicht [anki §3] | Lena 2.3: ARTS (Mettler u. a. 2016), Pavlik & Anderson 2008 | + trennt „wackelig“ von „sicher“ · − Zeit am Handy schwankt (Tastatur, Ablenkung) | **A** persönliche Zeitbasis je Form (Median); „sehr langsam“ = über 2,5 × Median → Hard; „schnell“ = unter 0,7 × Median und Stufe ≥ 5 → Easy. Erste 20 Antworten je Form ohne Zeitwirkung. |
| M40 | **Tippfehler nach Lage und Schwere werten**; Toleranzstufen | Lingvist [lingvist §3], Quizlet Strict/Moderate [quizlet §3], Readlang 3 Stufen [readlang §3]; Babbel streng (Nutzerklage) [babbel §3]; Duolingo verwischt Formfehler [duolingo §3] | – (Praxis) | + „ungerecht falsch“ vermeiden · − zu viel Toleranz verdeckt Formfehler; Quizlet schaltet die Hilfe bei Sprachinhalten ab | **A** fest, nicht einstellbar: (a) 1 Buchstabe Abstand bei Wörtern ab 5 Buchstaben, ohne dass ein anderes echtes Wort entsteht → „fast richtig“ = Hard, mit Diff; (b) falsche Wortform (*decide* statt *decision*) = Formfehler, Again, eigene Erklärung; (c) anderes echtes Wort (*affect/effect*, *contract/contact*) nie Tippfehler; (d) britische Schreibweise richtig (A7). |
| M41 | **„Richtig, aber nicht gesucht“** (Synonym) | Lingvist [lingvist §3], Quizlet Smart Grading [quizlet §3] | – | + keine Strafe für gutes Englisch | **Ü** Ausgang „Auch richtig“ (Tutor-Engine): keine Note, das Zielwort kommt nach 3–5 Karten noch einmal. |
| M42 | **„Ich hatte recht“ (Override)** | Quizlet „Override: I was correct“; Tippfehler-Hilfe senkte Overrides um ≥ 50 % (laut Anbieter) [quizlet §3]; Emrah 4.3 „Das wusste ich eigentlich“ | Lena 2.3: Selbsturteil unzuverlässig | + Ventil gegen falsche Automatik · − öffnet die Selbstbewertung | **A** siehe 3.3 W4: nur nach „falsch“ oder „fast richtig“, hebt höchstens auf Hard, wird gezählt; Claude prüft bei offenen Antworten. |
| M43 | **„Aufgabe war unfair“** ohne Planwirkung | RemNote „Skip“ [remnote §3], Lingvist „Report a problem“ [lingvist §3], Readlang „Edit“ [readlang §4] | – | + ein kaputter Satz bestraft nicht das Wort | **Ü** Meldung an die Inhaltsprüfung, Abfrage zählt nicht. |
| M44 | **Hinweis halbiert statt nullt** | Clozemaster, Vocabulary.com [clozemaster §3, vocabulary-com §3] | Lena 3.3 | + Hilfe holen lohnt sich, Raten nicht | **Ü** als Note Hard (M38). |
| M45 | **Zweiter Versuch vor dem Zurücksetzen** | Clozemaster (Versuch mit Hinweis) [clozemaster §3], Mochi (erst in derselben Sitzung nochmal) [mochi §3] | – | + Ausrutscher kostet nicht alles | **A** ein zweiter Versuch mit Hinweis → Hard; erst ein Fehler ohne Erfolg → Again. |
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
| M56 | **Kollokationen in der Rückmeldung** | kaum belegt; Vocabulary.com Bedeutungsgruppen [vocabulary-com §4] | Emrah 3.7, Lena 3.8 | + C1-Kern | **Ü** 2 Wortpartner im Band (Emrah 6), eigener Ausgang „Kollokationsfehler“ (3.2). |

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
| M72 | **Neue Wörter zwischen Wiederholungen eingestreut** | Anki `MixWithReviews` [anki §1.6] | Lena 2.7: Mischen | + kein Block Neues am Ende | **Ü** Emrah 5.2. |
| M73 | **Zufällige Reihenfolge mit festem Startwert**; nicht nach Stapel sortieren | Anki (warnt vor Raten aus dem Kontext) [anki §1.9], Mochi [mochi §1] | – | + kein Raten aus der Reihenfolge; würfelt nicht neu (Kap. 15) | **Ü** |
| M74 | **Wichtigster Fehler am Anfang der nächsten Sitzung** | Busuu Mistake Repair [busuu §4] | Lena 3.7: Fehlerschleife | + gezielte Reparatur | **A** für Kollokationsfehler: Kontrastkarte am Anfang der nächsten Sitzung. |
| M75 | **„Schwierig“-Stapel mit Obergrenze** | Memrise (20) [memrise §1], Vocabulary.com Trouble Words [vocabulary-com §1] | – | + Fehlerwörter üben ohne Flut | **Ü** im freien Trainer (H17 „Schwierig“), höchstens 10. |
| M76 | **Wählbarer Übungsmodus beim Wiederholen** (Hören / Sprechen / Schreiben) | Babbel [babbel §2] | – | + Abwechslung · − Lerner bleibt beim leichten Modus | **A** nur im freien Trainer; in der Pflicht wählt die App. |

**Zahl:** 76 Methoden; Ü 35 · A 31 · V 10 (gezählt nach dem Urteil in der letzten Spalte).

---

## 2. Die beste Kombination für Emrah

**Rahmen:** B2 → C1, Business, nur Handy, 10–30 Min. am Tag, will Wörter aktiv benutzen. Der Rahmen folgt Emrahs Auftrag 4–5. Die Methoden-Nummern zeigen, woher jeder Teil kommt.

### 2.1 Fünf Grundregeln

1. **Ein Lexem, zwei Spuren, ein Plan.** Ein Wort, eine Wendung oder eine Kollokation ist ein Lexem. Es hat die FSRS-Spur „Verstehen“ und die FSRS-Spur „Benutzen“ (M1, M6, M7). Außerhalb der Lernschritte kommt es höchstens einmal am Tag (M8).
2. **Die App benotet.** Die Note entsteht aus Richtigkeit × Form × Hilfe × Zeit (M38, M39, M40, M44). Auswahl ändert den Plan nie (M2, M23). Selbstbewertung gibt es nicht, außer im schmalen Ventil „Das wusste ich eigentlich“ (M42).
3. **Jede Abfrage so schwer wie gerade möglich.** Die Stufe bestimmt die Form (M22). Ab Stufe 3 wird getippt (M24), der Satz wechselt (M57), und jeder 3. Abruf ist ohne Satz (M27).
4. **Gleichmäßig und ehrlich.** Fuzz und Lastausgleich in Minuten (M10, M11), ein Lastbudget für Neues (M12), Rückstand nach Gefährdung (M13). Nach jeder Antwort steht „kommt wieder am …“ (M54). Das Dashboard zeigt Lastvorschau und echte Behaltensrate (M63, M18).
5. **Am Ende steht Benutzen.** Eigener Satz (M33), Transfer-Block (Emrah 4.5), Spur „benutzt“ (M65).

### 2.2 Ablauf einer Abfrage (Beispiel *lead time*, Stufe 3, Spur Benutzen)

1. **Karte erscheint.** Oben die Anweisung „Tippe das fehlende Wort“ und „Wozu?“: „Du rufst es selbst ab. So wird es dein Wort.“ Der Satz ist groß, die Lücke ist das Eingabefeld, die Tastatur ist offen und die Autokorrektur aus. Darunter steht „Gesucht: Lieferzeit“ (M24, M25). Der Satz ist neu, nicht der Ankersatz (M57).
2. **Hilfen:** „Tipp“ zeigt den ersten Buchstaben und die Wortzahl, was die Note auf Hard setzt (M44). „Weiß ich nicht“ ist straffrei und zeigt die Lösung (Note Again, Lernschritt).
3. **Eingabe und Enter.** Gemessen wird die Zeit ab der ersten Anzeige bis Enter.
4. **Auswertung** (M40, M41):
   - richtig → Good, oder Easy, wenn es schnell war und das Wort auf hoher Stufe steht;
   - 1 Buchstabe daneben (*lead tme*) → „fast richtig“, Hard, mit Diff;
   - Synonym (*delivery time*) → „Auch richtig“, keine Note, *lead time* kommt später noch einmal;
   - falsche Form oder falsches Wort → Again;
   - Kollokationsfehler (*make a decision* ↔ *take*) → eigene Erklärung.
5. **Band (eine Rückmeldekarte):**
   - Zeile 1: Urteil;
   - Zeile 2: Vergleich (Diff bei einem Fehler, M48);
   - Zeile 3: Warum, in höchstens 120 Zeichen;
   - dazu 2 Wortpartner („reduce · quote a lead time“) und die Zeile „Kommt wieder: Mo, 9.11.“ (M54);
   - Knöpfe: Ton (normal/langsam), „Mehr“ (Satzübersetzung, weiterer Beispielsatz, M52), „War das auch richtig?“ und, nur nach einem Fehler, „Das wusste ich eigentlich“.
6. **Nach einem Fehler:** kein Abtippen. Das Wort kommt nach 3–5 anderen Karten frei zurück, in einem anderen Satz oder ohne Satz (M49, M53). Danach sinkt es eine Stufe, nie unter Stufe 2 (Emrah 4.4).

### 2.3 Die Stufenleiter (Emrah 4.4, mit Marktbelegen)

| Stufe | Form (Pflicht) | Spur | Vorbild | Aufstieg, wenn … (Vorschlag, konfigurierbar) |
|---|---|---|---|---|
| 1 Kennenlernen | Satz mit Lücke und „Gesucht: …“; erst kurz selbst versuchen, dann Lösung, Ton, 2–3 Wortpartner; „Kenne ich schon“ mit Probe | – | Memrise Prize (M36), Lingvist, Drops-Wischen (M16) | Einführung gesehen |
| 2 Erkennen | Lernschritt: Lücke mit Auswahl (ändert FSRS nicht) **oder** Anfangsbuchstabe | Verstehen | Quizlet, Readlang (M22, M23) | 2 Lernschritte am Tag 0 bestanden |
| 3 Abrufen im Kontext | Lücke tippen, „Gesucht: …“ | Verstehen und Benutzen (siehe 3.3 W1) | Lingvist, Clozemaster (M24) | an 2 verschiedenen Tagen frei richtig |
| 4 Aus der Bedeutung | Deutsch → Englisch, ohne Satz oder im englischen Satz | Benutzen | Anki Rückwärtskarte, Vocabulary.com Spelling (M27) | Stabilität Benutzen ≥ 7 Tage |
| 5 Variieren | neuer Satz, andere Wortform, Wortpartner ergänzen, Situation → Ausdruck | Benutzen | Vocabulary.com „Apply“ (M29), Lena | Stabilität Benutzen ≥ 21 Tage |
| 6 Frei anwenden | eigener Satz zu Emrahs Kontext, Claude prüft | Benutzen | Busuu (M33) | 1 richtiger eigener Satz und Abruf nach ≥ 21 Tagen Pause |
| 7 Gefestigt | selten; im Transfer-Block | Benutzen | Anki „reif“ (M18) | – |

**Abstieg:** bei einem Fehler eine Stufe zurück (nie unter 2), dazu ein Lernschritt. Der Totalreset von Clozemaster und Memrise ist verworfen (M46).
**Formenmischung:** Ab Stufe 3 wechselt die Form (Tippen, Hören → Tippen, ohne Satz, Wortpartner). Keine Form kommt zweimal in Folge (VT 4.2, Kap. 15).

### 2.4 Ablauf einer Tagessitzung (Beispiel: Zielzeit 15 Min.)

1. **Start (Heute oder Wörter):** ein Knopf „Wörter · ca. 14 Min.“ mit einer Zeile „Warum diese?“ („11 fällig, die gefährdetsten zuerst · 3 neue“) (M68, M13). Der Plan ist für den Lerntag eingefroren (Kap. 15).
2. **Teil 1, Wiederholungen** (ca. 8–9 Min.): fällige Lexeme, sortiert nach Abrufwahrscheinlichkeit, gemischt, Geschwister getrennt (M13, M8, M73). Jede Karte nach 2.2.
3. **Teil 2, Neues** (ca. 3 Min.): so viele, wie das Lastbudget erlaubt (M12), **eingestreut** zwischen Wiederholungen (M72). Je neues Lexem: Stufe 1 → Lernschritt A nach mindestens 3 Karten → Lernschritt B nach mindestens 8 Karten und 3 Min. (M9).
4. **Teil 3, Anwenden** (2–4 Min., Emrah 4.5): eine kurze Aufgabe mit 3–5 Lexemen der Stufen 4–6, z. B. eine Mail, in der Emrah ein Meeting verschiebt.
   - Claude prüft Fehler, natürliche Formulierung und welche Zielwörter richtig verwendet wurden.
   - Richtig verwendete Lexeme bekommen Good auf der Spur Benutzen.
   - Ohne Claude: Musterlösung und Selbstvergleich. Das plant nichts (A7; siehe 3.3 W6).
5. **Abschluss** (Emrah 5.4): vier Zeilen:
   - heute gelernt;
   - aufgestiegen (nur echte Schritte);
   - gestolpert (mit „kommt wieder am …“);
   - „Morgen ca. 12 Min.“
   Dazu „Fertig“ und „Noch 5“. „Noch 5“ nimmt nur Fälliges oder Neues, nie heute Gesehenes (Emrah 5).
6. **Danach (freiwillig):** Trainer, „Schwierig“ (höchstens 10, M75), Tempo (M34), Anki-Modus. Alles zählt als Extra (Kap. 2 Nr. 6).

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
8. **Problemwort-Paare** (Anki, SuperMemo: bei Verwechslung eins ruhen lassen) [anki §1.8, supermemo §1]. Emrah verlangt „Merkhilfe/neuer Kontext“. **Vorschlag:** zusätzlich die Paar-Regel (*disappoint/disappear* ist Ankis eigenes Beispiel).
9. **Bedeutungsgruppen** (Vocabulary.com) [vocabulary-com §1]. **Vorschlag:** Mehrdeutige C1-Wörter (*address*, *issue*, *raise*) bekommen je Sinn ein eigenes Lexem.
10. **Höchstens 3-mal verschieben** (SuperMemo-Grenzen) [supermemo §1]. **Vorschlag:** bei der Rückstands-Verteilung, damit kein Wort versandet.

### 3.3 Widersprüche (mit Empfehlung)

| Nr. | Widerspruch | Was der Markt und die Forschung sagen | Empfehlung |
|---|---|---|---|
| W1 | **Emrah 4.1:** „Benutzen“ startet erst bei Stabilität „Verstehen“ ≈ 3 Tage. **Emrah 4.4:** Stufe 3 (Lücke tippen) gehört zu „Verstehen“. **Lena 2.1/2.2:** Produktiver Abruf ab Tag 0 als Hauptspur. | Ein Wort in eine Lücke **tippen** ist Formabruf, also produktiv (Laufer & Goldstein 2004, Lena 2.1). Lingvist fragt vom ersten Kontakt an so ab [lingvist §2]. Quizlet und Readlang steigen noch in derselben Sitzung von Auswahl zu Tippen [quizlet §2, readlang §2]. | **Variante B (empfohlen):** Die getippte Lücke mit „Gesucht: …“ (Stufe 3) zählt auf **beide** Spuren. „Verstehen“ wird zusätzlich mit Bedeutungsabruf (Englisch → Deutsch, Ton → Bedeutung) geübt. Emrahs Schwelle (≈ 3 Tage) gilt für die schweren Benutzen-Formen ab Stufe 4. **Variante A:** genau wie im Auftrag. **Emrah entscheidet.** |
| W2 | **Emrah 4.4:** 7 Stufen. **Vorschau H12/H34 und Lena 3.2:** S0–S5. | – | Emrahs 7 Stufen gelten intern. Für die Anzeige drei Gruppen wie in H34: Erkennst du (1–2), Auf dem Weg (3–5), Bildest du selbst (6–7). Die Stufenbalken im Wort-Detail bekommen 7 Teile. Das Paket V3 passt H12, H34 und H37 an. |
| W3 | **Emrah 4.2:** Lernschritte „1 min → 10 min“. | Ankis Standard ist genau 1 Min. → 10 Min. [anki §1.2]. Bei 10-Minuten-Sitzungen fällt der 10-Minuten-Schritt aber oft nach das Ende. Lena 3.2: nach Karten zählen. | Abstand **nach Karten und Zeit** (M9). Die Zahlen sind konfigurierbar, die 60-Tage-Simulation prüft beides. |
| W4 | **Emrah 4.3:** Override „Das wusste ich eigentlich“. **A7:** keine Selbstbewertung. | Quizlet: Gute Tippfehler- und Synonym-Erkennung senkte den Bedarf an Overrides um mindestens 50 % (laut Anbieter) [quizlet §3]. | Der neue Auftrag hat Vorrang (Entscheidung 30.10.2026). Das Ventil wird aber eng: nur nach „falsch“ oder „fast richtig“, hebt höchstens auf Hard, nie auf Good. Es wird je Woche gezählt (bei mehr als 10 % der Antworten prüft V0 die Bewertung). Bei offenen Antworten prüft Claude. |
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
| „Zu leicht · kenne ich längst“ (Kontrolle in 30 Tagen) | H2 Menü „…“ | M16 |
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
| B4 | **H2/H18 Band `override`** | Nebenknopf „Das wusste ich eigentlich“ nach Fehler → Blatt mit einem Satz („Wird als ‚schwer‘ gewertet, nicht als ‚gut‘.“) und „Rückgängig“ | M42 | V3 |
| B5 | **H18 `collocation`** | eigener Ausgang „Wort richtig, Partner falsch“ mit Kontrast (*make* vs. *take a decision*) | M56, M74 | V2/V3 |
| B6 | **H18 `own-sentence` (Stufe 6)** | Lage → eigener Satz tippen oder per Diktat → Claude-Rückmeldung (richtig, natürlich, Kollokation, bessere Variante); Zustand ohne Claude | M33 | V4 |
| B7 | **Neu H38 „Anwenden“ (Transfer-Block)** | Aufgabe mit 3–5 Zielwörtern als Chips, Textfeld, Rückmeldung je Zielwort ✓/~/✕; Variante `offline` mit Musterlösung, ohne Planwirkung | Emrah 4.5, M32 | V4 |
| B8 | **H17 `default` mit Zeitangabe; H20 mit „Morgen ca. X Min.“** | „Wörter · ca. 14 Min.“ statt nur Zahl; Abschluss mit „aufgestiegen / gestolpert / morgen ca. 12 Min.“ | M68, M71 | V3 |
| B9 | **H24 `words` (Einstellungen)** | Zielzeit 10/15/20/30 Min.; Sicherheit 85/90/95 % mit Minutenangabe | M17, Emrah 5 | V1 (Logik), V4 (Bildschirm) |
| B10 | **H2 `intro` mit kurzem Versuch** | Lücke + „Gesucht: …“ + „Erst kurz überlegen“ → Aufdecken; „Kenne ich schon“ als Probe-Knopf | M36, M16 | V2 |
| B11 | **H1 `pause` / H17 `backlog`** | nach Pause: „32 fällig · heute die 18 gefährdetsten, der Rest verteilt bis Do“ | M13 | V3 |
| B12 | **H33 `pair`** (Werkstatt) | Verwechslungspaar: „*disappoint* ruht, bis *disappear* sitzt“ | M14 | V2 |

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
| M1 FSRS je Spur, ts-fsrs 5 fest | V1 | Unit: Version ist in `package.json` festgelegt (kein `^`-Sprung auf 6); Sim: Behaltensquote 90 % ± 3 |
| M2/M23 Auswahl ohne FSRS-Wirkung | V2 | Unit: Auswahl-Antwort ändert `S`, `D` und `due` nicht; Sim: ≥ 50 % aktive Abfragen ab Stufe 3 (Abnahme 8.2) |
| M6 Zustand am Lexem | V1 | Unit: 3 Sätze eines Lexems ergeben genau 1 Plan-Eintrag je Spur; Migration: Zahl der Lexeme ≤ Zahl der alten Karten |
| M7 zwei Spuren | V1 | Unit: getrennter FSRS-Zustand; Freischaltung nach W1 |
| M8 Geschwister-Sperre und Nachbartage | V1 | Sim: 0 Lexeme mehr als einmal am Tag außerhalb der Lernschritte (Abnahme 8.1); Unit: Spuren eines Lexems nicht an Folgetagen, wenn ein anderer Tag im Korridor frei ist |
| M9 Lernschritte nach Karten und Zeit | V1 (Regel), V3 (Sitzung) | Unit: Schritt 1 nie vor 3 anderen Karten; Sim: Tag-0-Lernschritte enden an ≥ 95 % der Tage in derselben Sitzung |
| M10 Fuzz mit festem Startwert | V1 | Unit: gleiche Eingabe → gleicher Tag (100 Wiederholungen); Korridor nach Ankis Testwerten (7 → 5–9, 17 → 14–20, 37 → 33–41) |
| M11 Lastausgleich in Minuten, Ruhetag | V1 | Sim: Variationskoeffizient der Tageslast vorher/nachher (Abnahme 8.1); Ruhetag ≤ 25 % des Mittels |
| M12 Lastbudget für Neues | V1 | Sim: Tageslast ≤ Zielzeit + 20 % an ≥ 90 % der Tage; an Tagen ohne großen Rückstand ≥ 1 neues Lexem (Kap. 15) |
| M13 Rückstand nach Gefährdung, höchstens 3-mal verschieben | V1 | Sim: Pause 10 Tage → Abbau in ≤ 7 Tagen, kein Lexem länger als 3-mal verschoben, keine fälligen Lexeme unbegrenzt liegen (Abnahme 8.1) |
| M14 Leech 6 + Paar-Regel | V2 | Unit: 6. Fehler → Werkstatt-Ablauf mit neuem Satz; Paar → zweites Wort ruht; Mess: Fehlerquote der Leeches 4 Wochen danach |
| M15 vorgezogen gleitend | V1 | Unit: früher Abruf → kleinerer Stabilitätszuwachs als fälliger (FSRS-R) |
| M16 „Kenne ich schon“ mit Probe | V5 | Unit: ohne Probe keine Stufenänderung; Mess: Fehlerquote der so übersprungenen Wörter bei der 30-Tage-Kontrolle |
| M17 Sicherheit 85/90/95 % mit Minuten | V1 (Logik) | Sim: Minutenangabe je Stufe aus der Simulation, Abweichung ≤ 15 % |
| M18 echte Behaltensrate | V4 | Unit: nur die erste Abfrage des Tages zählt; Mess: Wert nach 4 Wochen sichtbar, Ziel 90 % ± 3 |
| M19 Review-Log vollständig, Anpassung ab 1.000 | V1 | Unit: jedes Log hat Zeit, Form, Spur, Ergebnis, Dauer, Hinweis, Note (Emrah 7); Anpassung gesperrt unter 1.000 |
| M20 Nutzenrang neuer Wörter | V5 | Unit: Gewichtung Band / eigene Funde / Kollokationen; Lehrer prüft die ersten 40 |
| M21 Priorität Kern/Rand | V1 | Sim: bei Rückstand werden nur Randwörter verschoben |
| M22 Form nach Stufe | V2 | Unit: Tabelle Stufe → Formen; Sim: keine Form zweimal in Folge je Lexem |
| M24 Lücke tippen | V2 (Logik), V3 (Karte) | Bild: H18 `gap` auf 390 px, Tastatur offen, Autokorrektur aus |
| M25 „Gesucht: …“ bis Stufe 4 | V2 | Unit: ab Stufe 5 ohne deutsche Bedeutung |
| M26 Wortart- und Formangabe | V2 | Unit: nur bei mehrdeutiger Form; Lehrer-Stichprobe |
| M27 jeder 3. Abruf ohne Satz | V2 | Sim: Anteil ohne Satz ab Stufe 4 bei 30–40 % |
| M28 Bedeutung frei nennen, Sinne getrennt | V2 | Unit: Verstehen-Abfrage wertet die Bedeutung (Claude oder Liste); Lehrer-Charge |
| M29 Situation → Ausdruck | V2 | Lehrer prüft 100 % der Situationen; Unit: Schlüssel vorhanden |
| M30 Hören → Tippen | V2 | Unit: Form im Katalog; Bild H18 `listen` |
| M31 Sprechen per Diktat | V2 | Unit: abgelehnte Erkennung wird nie als Fehler gewertet |
| M32 Satz-Recall im Transfer | V4 | Bild H38 |
| M33 eigener Satz mit Claude | V4 | Prompt-Prüfung (learning-scientist); Unit: ohne Claude keine Planwirkung; Mess: Anteil richtiger eigener Sätze |
| M34 Tempo freiwillig | V3 | Unit: Tempo-Antworten zählen nicht zur Pflicht |
| M36 erst versuchen, dann Lösung | V2 | Bild H2 `intro`; Mess: Tag-1-Abruf mit und ohne Versuch (Wechsel je Woche) |
| M38 Note aus Richtigkeit, Form, Hilfe | V2 | Unit: Notentabelle vollständig (alle Ausgänge × Stufen) |
| M39 Zeit in der Note | V2 | Unit: erste 20 Antworten je Form ohne Zeitwirkung; Schwellen 2,5× / 0,7×; Mess: Easy-Anteil 5–15 % |
| M40 Tippfehler-Regeln | V2 | Unit: Fälle *lead tme* (fast), *decide/decision* (Form), *contract/contact* (Wort), *organise* (richtig) |
| M41 Auch richtig | V2 | Unit: keine Note, Wiederkehr nach 3–5 Karten |
| M42 Override eng | V3 | Unit: höchstens Hard; Mess: Override-Anteil je Woche (Schwelle 10 %) |
| M43 Aufgabe unfair | V3 | Unit: keine Planwirkung, Eintrag in der Inhaltsprüfung |
| M44 Hinweis = Hard | V2 | Unit (Teil der Notentabelle) |
| M45 zweiter Versuch mit Hinweis | V2 | Unit: Fehler + Erfolg mit Hinweis → Hard |
| M48 Diff | V3 | Unit: Diff-Funktion (NFC, Groß/Klein); Bild H18 `near` |
| M49 kein Pflicht-Abtippen, freie Wiederkehr | V3 | Unit: Wiederkehr in anderem Satz oder ohne Satz |
| M50 Erklärung auch bei richtig | V3 | Bild: Band mit Warum bei richtig (besteht, nur prüfen) |
| M51 Ton normal/langsam | V3 | Bild; Unit: US-Stimme |
| M52 Satzübersetzung im „Mehr“ | V3 | Bild H2 `more` |
| M53 Fehlerwort in derselben Sitzung | V3 | Sim: jedes Again kommt in derselben Sitzung frei zurück, solange die Sitzung noch ≥ 3 Karten hat |
| M54 „Kommt wieder am …“ | V3 | Unit: angezeigtes Datum = gespeichertes `due` (Emrahs Rückmeldung 6 vom 10.10.) |
| M55 wörtliche Bedeutung | V5 | Lehrer-Charge (nur wo sinnvoll) |
| M56 Wortpartner und Kollokationsfehler | V2 | Unit: Ausgang „Partner falsch“; Lehrer prüft Partnerlisten |
| M57 Ankersatz, dann wechselnd | V2 | Sim: derselbe Satz für den Formabruf nicht innerhalb von 30 Tagen; Unit: Leck-Prüfung vorhanden |
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
| M72 Neues eingestreut | V3 | Sim: kein Block mit mehr als 2 neuen Lexemen in Folge |
| M73 Reihenfolge mit festem Startwert | V3 | Unit: Neuzeichnen ändert die Reihenfolge nicht |
| M74 Kollokationsfehler am Anfang der nächsten Sitzung | V3 | Unit: Kontrastkarte erscheint als erste Karte der nächsten Sitzung |
| M75 „Schwierig“ höchstens 10 | V3 | Unit |
| M76 Modus-Wahl nur im Trainer | V3 | Unit: Pflicht ignoriert die Modus-Wahl |

**Abdeckung:** Alle 66 übernommenen oder angepassten Methoden stehen in der Liste (M3–M5, M35, M37, M46, M47, M60, M67 und M70 sind verworfen). Zwei Zeilen fassen je zwei Methoden zusammen (M2/M23, M44 bei M38).

**Gesamtabnahme (aus Emrahs Auftrag 8, ergänzt):**
- 60-Tage-Simulation vorher/nachher: Wiederholungen je Lexem und Tag, Variationskoeffizient der Last, längste Lücke, Anteil aktiver Abfragen und neu die simulierte Behaltensquote;
- die Unit-Tests oben;
- Bildschirm-Abnahme B1–B12 durch Emrah am Handy;
- Messwerte nach 4 Wochen: echte Behaltensrate, Override-Anteil, Easy-Anteil, Tag-1-Abruf.

---

## 6. Grenzen dieser Synthese

- **Belege sind ungleich tief.** Anki ist bis in den Quellcode belegt. Quizlet konnte nur über Sekundärquellen belegt werden: Hilfe und Blog antworteten mit 403 [quizlet §Quellen]. Lingvists Modell ist nicht offen [lingvist §1].
- **Unabhängige Studien zur Lernwirkung fehlen** für fast alle Apps. Ausnahmen sind HLR (eigene Daten von Duolingo) und der Memrise Prize (Memrise-Ko-Autoren). Wirkungsaussagen stützen sich deshalb auf die Forschung bei Lena, nicht auf Anbieterzahlen.
- **Antwortzeit als Notenbestandteil** nutzt kein Anbieter nachweislich. Die Regel M39 stützt sich auf Forschung (ARTS) und wird deshalb erst nach 20 Antworten je Form wirksam und nach 4 Wochen gemessen.
- **Die Zahlenwerte** (Schwellen, Stufen-Aufstieg, 3 Karten, 2,5×) sind Startwerte. V1 macht sie konfigurierbar, die Simulation in V0/V1 prüft sie.
