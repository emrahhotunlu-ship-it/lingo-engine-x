# Korrekturliste Inhalte Stufe 1 (James, Englischlehrer)

Stand 27.10.2026. Grundlage: Relaunch-Konzept 8.1 und 8.7 (`docs/relaunch/konzept.md`, Zeile 467 und 554). Diese Korrekturen müssen vor dem ersten Test-Link mit neuen Inhalten erledigt sein.

## 0. Vor dem Umsetzen lesen (sonst gehen Änderungen verloren oder Daten gehen kaputt)

1. **Drei Inhaltsdateien werden aus Quelldateien erzeugt.** Das gilt für `src/content/grammar/tasks-v2.json`, `src/content/grammar/pattern-map.json` und die Einträge mit `pat` in `src/content/c1/order.json`. Erzeugt werden sie von `scripts/grammar/build-content.mjs` aus `scripts/grammar/parts/<thema>/{v2,map,order}.json`. Ändere deshalb immer zuerst die Quelle, dann baue neu. Wer nur die erzeugte Datei ändert, verliert die Änderung beim nächsten Bau. Einige Themen kommen zusätzlich aus `scripts/topics-gen/tp_*.py` (Aufrufe `V.kwt(...)`, `V.find(...)`). Prüfe vor jeder Änderung an tasks-v2 mit grep, ob die Aufgabe dort steht. Wenn ja, ändere auch dort.
2. **In tasks-v2 nie eine Aufgabe löschen und nie die Reihenfolge ändern.** `src/domain/c1x/legacyV2.ts` vergibt die Kennungen `kwt-v2-<n>` und `err-v2-<n>` nach der **Position in der Datei**. Löschen verschiebt alle späteren Kennungen. Dann passen „schon gesehen“, Fehlersätze und Meldungen nicht mehr. Ändere nur Felder oder setze eine Markierung.
3. **toolkit.json hat keine Aufgaben-Kennungen.** Unten steht `tasks[n]` (0-basierter Index im Feld `tasks`) zusammen mit dem wörtlichen `prompt`. Maßgeblich ist der Prompt: Den Eintrag immer über den Prompt suchen.
4. **Der Schlüssel in pattern-map hängt am Prompt.** Er lautet `<topic>|legacyTaskKey(prompt)` (nur Kleinbuchstaben a–z, siehe `src/domain/grammar/key.ts`). Ändert sich ein toolkit-Prompt, muss auch der Schlüssel in `scripts/grammar/parts/<thema>/map.json` mitwandern. Betroffen ist hier nur `tasks[245]` (siehe Punkt 4).
5. Zu Englisch und Zeichen:
   - Englische Texte in US-Schreibweise.
   - `why`-Texte in tasks-v2 und pattern-map: höchstens 140 Zeichen (`WhyRuleSchema`).
   - Typografische Anführungszeichen wie im Bestand.

---

## Punkt 1: `src/content/c1/toolkit.json`

### 1a. Aufgaben (`tasks`), nach Wichtigkeit

**P1: sachlich falsch oder Bedeutung verschoben**

1. Datei `src/content/c1/toolkit.json` · `tasks[84]` (c1-precision, transform, Prompt „About 60% of the documents are scanned. → ___ 60% of the documents are scanned.“) · Feld `expl`
   - alt: „Roughly“ ist im Geschäftsenglisch üblicher als „about“ und kündigt eine gerundete Zahl an.
   - neu: „Roughly“, „around“ und „approximately“ ersetzen „about“ ohne Bedeutungsunterschied. Im Gespräch sind „about“ und „around“ am häufigsten, „approximately“ klingt förmlich (Berichte, Folien). Wichtig ist, zu zeigen, dass die Zahl gerundet ist.
   - Grund: Die Aussage ist falsch. „about“ ist im Geschäftsenglisch deutlich häufiger als „roughly“.
2. dieselbe Aufgabe · Feld `expl_en`
   - alt: “Roughly” is more common than “about” in business English and signals a rounded figure.
   - neu: “Roughly”, “around” and “approximately” replace “about” with no change in meaning. In conversation “about” and “around” are the most common; “approximately” sounds formal (reports, slides). What matters is signaling that the figure is rounded.
   - Grund: wie oben.
3. `tasks[14]` (c1-diplomacy, gap, Prompt „We ___ to sign before the end of Q3.“) · Feld `accepted`
   - alt: `["are hoping", "hope", "hoped", "had been hoping"]`
   - neu: `["are hoping", "hope"]`
   - Grund: „hoped“ und „had been hoping“ klingen nach einer vergangenen, enttäuschten Hoffnung („wir hatten gehofft, aber …“). Das ist keine höfliche Bitte mehr.
4. `tasks[22]` (c1-diplomacy, transform, Prompt „We want a discount. → We ___ hoping for a small discount.“) · Feld `accepted`
   - alt: `["are", "had been"]`
   - neu: `["are"]`
   - Grund: wie bei Nr. 3. „had been hoping“ heißt „wir hatten gehofft“, das ist kein weicher Wunsch.
5. `tasks[85]` (c1-precision, transform) · Feld `prompt`
   - alt: The rollout must be finished before September 30 at the latest. → The rollout must be finished ___ September 30.
   - neu: The rollout must be finished. The deadline is September 30. → The rollout must be finished ___ September 30.
   - Grund: „before … at the latest“ ist eine deutsche Doppelung, und „before September 30“ heißt „bis spätestens 29.“. Der Ausgangssatz hätte also ein anderes Datum als die Lösung „by“.
6. `tasks[216]` (prep-time, transform) · Feld `prompt`
   - alt: Please finish the draft before Thursday. → Please finish the draft ___ Thursday.
   - neu: Please finish the draft. Thursday is the deadline. → Please finish the draft ___ Thursday.
   - Grund: „before Thursday“ ist nicht dasselbe wie „by Thursday“. Die Aufgabe lehrt sonst eine falsche Gleichsetzung.
7. dieselbe Aufgabe · Feld `accepted`
   - alt: `["no later than", "before"]`
   - neu: `["no later than"]`
   - Grund: „before Thursday“ heißt „spätestens Mittwoch“, ist hier also nicht gleichbedeutend.
8. `tasks[273]` (comparison, gap) · Feld `prompt`
   - alt: Our competitor's prices are far ___ than ours, so we win customers.
   - neu: Our prices are far ___ than our competitor's, so we win customers.
   - Grund: Logikfehler. Wenn die Konkurrenz billiger ist, gewinnen wir keine Kunden. `answer` „lower“ und `accepted` „cheaper“ bleiben.
9. `tasks[42]` (discourse, mc) · Feld `prompt`
   - alt: The price is higher than the old system. ___, you save on hardware and maintenance.
   - neu: The license fee is higher than for the old system. ___, you save on hardware and maintenance.
   - Grund: Falscher Vergleich. Ein Preis wird mit einem System verglichen, ein typischer Fehler deutscher Muttersprachler, den wir nicht vormachen dürfen.
10. `tasks[68]` (c1-participle, mc, „Approved by the auditors …“) · Feld `expl`
    - alt: Der Prozess wurde geprüft. Das ist passiv, deshalb steht nur die 3. Verbform: Approved by the auditors, …
    - neu: Der Prozess wurde freigegeben. Das ist passiv, deshalb steht nur die 3. Verbform: Approved by the auditors, …
    - Grund: „approved“ heißt „freigegeben“ oder „genehmigt“, nicht „geprüft“ (das wäre „audited“ oder „reviewed“).
11. `tasks[257]` (linkers, mc) · Feld `prompt`
    - alt: The sales team hit its target, ___ the support team missed theirs.
    - neu: The sales team hit its target, ___ the support team fell short.
    - Grund: „its … theirs“ passt im selben Satz nicht zusammen. Die neue Form ist natürlich und eindeutig.

**P2: Lehnübersetzung oder Kollokation**

12. `tasks[56]` (nominal, mc) · Feld `prompt`
    - alt: Upon ___ of the contract, we will send you the access data.
    - neu: Upon ___ of the contract, we will send you your login credentials.
    - Grund: „access data“ ist eine Lehnübersetzung von „Zugangsdaten“. Auf US-Englisch heißt das „login credentials“ (oder „login details“).
13. `tasks[73]` (c1-participle, correct) · Feld `prompt`
    - alt: Having sign the contract, the customer received the access data.
    - neu: Having sign the contract, the customer received the login credentials.
    - Grund: wie Nr. 12.
14. dieselbe Aufgabe · Feld `answer`
    - alt: Having signed the contract, the customer received the access data.
    - neu: Having signed the contract, the customer received the login credentials.
    - Grund: wie Nr. 12.
15. `tasks[80]` (c1-precision, mc) · Feld `prompt`
    - alt: The cloud version costs ___ of the on-premise license.
    - neu: The cloud version costs ___ of what the on-premise license costs.
    - Grund: Unlogischer Vergleich. Die Version kostet nicht einen Bruchteil „der Lizenz“, sondern einen Bruchteil dessen, was die Lizenz kostet.
16. `tasks[94]` (time-clauses, gap) · Feld `prompt`
    - alt: Don't switch off the server until the backup ___ completed.
    - neu: Don't shut down the server until the backup ___ completed.
    - Grund: Bei Servern sagt man im US-Englisch „shut down“, „switch off“ passt zu Lampen und Geräten.
17. `tasks[190]` (countable, gap) · Feld `prompt`
    - alt: Please make sure you have enough ___ for the trip.
    - neu: We have too much ___ for one taxi.
    - Grund: Der alte Satz ist unnatürlich (man hat nicht „genug Gepäck“), und „enough“ prüft den Unterschied zählbar/unzählbar gar nicht. `answer` „luggage“, `accepted` „baggage“ und `hint` bleiben.
18. dieselbe Aufgabe · Feld `expl`
    - alt: „luggage“ ist unzählbar; „enough“ passt zu beiden Arten.
    - neu: „luggage“ ist unzählbar: kein -s, und davor „much“, nicht „many“.
    - Grund: passt zum neuen Satz.
19. dieselbe Aufgabe · Feld `expl_en`
    - alt: “Luggage” is uncountable; “enough” works with both kinds.
    - neu: “Luggage” is uncountable: no -s, and “much”, not “many”, before it.
    - Grund: passt zum neuen Satz.

**P3: Britisch statt US oder Ablenkung vom Lernziel**

20. `tasks[238]` (phrasal-syntax, gap, Prompt „Please fill ___ this form and send it back to HR.“) · Feld `answer`
    - alt: in
    - neu: out
    - Grund: Im US-Englisch ist „fill out“ der Standard. Britisch „fill in“ bleibt richtig.
21. dieselbe Aufgabe · Feld `accepted`
    - alt: `["out"]`
    - neu: `["in"]`
    - Grund: wie Nr. 20.
22. dieselbe Aufgabe · Feld `expl`
    - alt: „fill in“ oder „fill out“ heißt „ausfüllen“.
    - neu: „fill out“ (US) oder „fill in“ (britisch) heißt „ausfüllen“.
    - Grund: wie Nr. 20.
23. dieselbe Aufgabe · Feld `expl_en`
    - alt: “Fill in” or “fill out” means to complete.
    - neu: “Fill out” (US) or “fill in” (British) means to complete.
    - Grund: wie Nr. 20.
24. `tasks[243]` (phrasal-syntax, correct) · Feld `prompt`
    - alt: She quickly got on well her new team.
    - neu: She quickly got along well her new team.
    - Grund: Im US-Englisch heißt es „get along with“. Britisch „get on with“ heißt außerdem auch „weitermachen mit“ und ist damit doppeldeutig.
25. dieselbe Aufgabe · Feld `answer`
    - alt: She quickly got on well with her new team.
    - neu: She quickly got along well with her new team.
    - Grund: wie Nr. 24.
26. dieselbe Aufgabe · Feld `accepted`
    - alt: `["She quickly got along well with her new team."]`
    - neu: `["She quickly got on well with her new team."]`
    - Grund: wie Nr. 24.
27. dieselbe Aufgabe · Feld `expl`
    - alt: „get on with“ braucht die Präposition „with“.
    - neu: „get along with“ (US; britisch „get on with“) braucht die Präposition „with“.
    - Grund: wie Nr. 24.
28. dieselbe Aufgabe · Feld `expl_en`
    - alt: “Get on with” needs the preposition “with”.
    - neu: “Get along with” (US; British “get on with”) needs the preposition “with”.
    - Grund: wie Nr. 24.
29. `tasks[194]` (countable, correct) · Feld `prompt`
    - alt: The staff are very friendly, but the informations on the website are outdated.
    - neu: The website looks great, but the informations on it are outdated.
    - Grund: Das britisch geprägte „staff are“ lenkt vom eigentlichen Fehler („informations“) ab. US-Englisch sagt meist „staff is“.
30. dieselbe Aufgabe · Feld `answer`
    - alt: The staff are very friendly, but the information on the website is outdated.
    - neu: The website looks great, but the information on it is outdated.
    - Grund: wie Nr. 29.
31. dieselbe Aufgabe · Feld `accepted`
    - alt: `["The staff is very friendly, but the information on the website is outdated.", "The staff are very friendly, but the information on the website is out of date.", "The staff is very friendly, but the information on the website is out of date."]`
    - neu: `["The website looks great, but the information on it is out of date."]`
    - Grund: wie Nr. 29.
32. `tasks[235]` (phrasal-syntax, mc) · Feld `prompt`
    - alt: The meeting was called ___ because the CEO was ill.
    - neu: The meeting was called ___ because the CEO was sick.
    - Grund: Im US-Alltag sagt man „sick“, „ill“ klingt britisch oder förmlich. Niedrige Priorität.

**P1: Wortstellung (B1-Stoff), gehört zu Punkt 4**

33. `tasks[245]`: Ersatz siehe Punkt 4, Einträge 4.1 bis 4.5.

### 1b. Themen (`topics`) und Regelblätter (`rules`)

34. `rules["c1-precision"].forms` (Zeile ~1002), Beispiel
    - alt: The cloud version costs a fraction of the old license.
    - neu: The cloud version costs a fraction of what the old license cost.
    - Grund: unlogischer Vergleich, wie bei Nr. 15.
35. `rules["verb-patterns"].forms` (Zeile ~1712), Beispiel
    - alt: She stopped checking emails on holiday.
    - neu: She stopped checking emails on vacation.
    - Grund: „on holiday“ ist britisch, US sagt „on vacation“.
36. `rules["verb-patterns"].signals`, Eintrag „look forward to + -ing“ (Zeile 1736), englische Glosse
    - alt: to anticipate
    - neu: to be excited about something ahead
    - Grund: „anticipate“ heißt „erwarten, vorhersehen“, nicht „sich freuen auf“.
37. `rules.countable.forms` (Zeile ~1904), Beispiel zur Form „much / a little / some + singular“
    - alt: We have little information.
    - neu: We don't have much information yet.
    - Grund: „little“ (= kaum) ist nicht „a little“ (= etwas). Das Beispiel widerspricht der eigenen Form.
38. `rules.linkers.forms` (Zeile ~2440), Beispiel
    - alt: Costs rose; therefore, we reacted.
    - neu: Costs rose; therefore, we adjusted our prices.
    - Grund: „we reacted“ ohne Ergänzung ist unnatürlich und unpräzise.
39. `rules.comparison.forms` (Zeile ~2512), Beispiel
    - alt: This is as fast as that.
    - neu: The new scanner is as fast as the old one.
    - Grund: Das alte Beispiel ist inhaltsleer und unnatürlich.
40. `rules.comparison.forms` (Zeile ~2520), Beispiel
    - alt: It is faster than that.
    - neu: The cloud version is faster than the on-premise one.
    - Grund: wie Nr. 39.
41. `rules["compound-mod"].forms` (Zeile 2167), Form
    - alt: well-/highly-/user- + Partizip
    - neu: well-/user- + Partizip; -ly-Adverb ohne Bindestrich (highly skilled)
    - Grund: Nach -ly-Adverbien steht kein Bindestrich. „highly-“ lehrt die falsche Schreibung, auch wenn das Beispiel „a highly skilled engineer“ selbst richtig ist.
42. `topics` Eintrag `compound-mod`, Feld `ex` (Zeile 275)
    - alt: She bought a new black German laptop.
    - neu: They hired a small new German software company.
    - Grund: Drei gestapelte Farb- und Herkunftsadjektive sind ein Lehrbuchsatz. Der neue Satz ist berufsnah und übt dieselbe Reihenfolge.
43. `topics` Eintrag `word-order`, Felder `rule`, `rule_en`, `ex`: siehe Punkt 4, Einträge 4.6 bis 4.8.
44. `rules["word-order"]`, Felder `core`, `steps`, `forms`, `traps`: siehe Punkt 4, Einträge 4.9 bis 4.13.

**P3: nur, wenn angezeigt**

45. In `rules.*.signals` steht das Pronomen „I“ an mehreren Stellen kleingeschrieben, zum Beispiel Zeile 2755 „i do / we do“, Zeile 2879 „i think so / i hope so“ und Zeile 3279 „i was hoping / i am hoping“. Weitere Stellen: „that i“, „i'd love to“.
    - Aktion: zuerst mit grep im Code prüfen, ob `signals` im Regelblatt **angezeigt** werden. Wenn ja, „i“ als Pronomen überall zu „I“ ändern. Wenn sie nur zum Abgleich dienen, nichts ändern.
    - Grund: Das kleine „i“ ist falsch geschrieben, sobald Emrah es sieht.

---

## Punkt 2: tasks-v2, Aufgabe `cm-par-k1`

Ändere die Quelle `scripts/grammar/parts/compound-mod/v2.json` (ab Zeile ~740) und baue danach neu. Die erzeugte Aufgabe liegt in `src/content/grammar/tasks-v2.json` ab Zeile 9774.

2.1 · id `cm-par-k1` · Feld `from`
- alt: Everyone knows her work very well.
- neu: Many people in our industry know this designer.
- Grund: „Alle kennen ihre Arbeit sehr gut“ heißt nicht „sie ist bekannt“. Der Ausgangssatz sagt etwas über das Wissen der anderen, nicht über ihren Ruf. Bei C1-Umformungen muss die Bedeutung exakt gleich bleiben.

2.2 · id `cm-par-k1` · Feld `frame`
- alt: She is ___ designer.
- neu: She is ___ designer in our industry.
- Grund: Der Bereich „in our industry“ muss erhalten bleiben, sonst verschiebt sich die Bedeutung wieder.

`answer` („a well-known“), `accepted` („a widely known“) und `why` bleiben. Die Lösung hat weiter nur 2 Wörter, deshalb gilt auch Punkt 3: `cm-par-k1` wird „nur Übung“.

---

## Punkt 3: Umformungen (kwt) mit 2 Wörtern werden „nur Übung“

### Gibt es schon ein Feld dafür? Nein.

Es gibt **kein** Feld in den Aufgabendaten, das „nur Übung“ bedeutet. Gesucht habe ich in `src/content`, `src/domain` und den Schemas nach practiceOnly, testExcluded, noTest, exam und pool.

Das gibt es schon:
- **tasks-v2 (`V2TaskSchema`, kwt-Zweig, `src/domain/grammar/patternTypes.ts` Zeile 72–85):** nur `words: [von, bis]`. Das ist die erlaubte Wortzahl in der Lücke, keine Markierung.
- **c1x (`src/domain/c1x/types.ts`, `C1Base`):** `probe?: true` heißt „nur C1-Check“, `pool?: 'gate' | 'place'` heißt „nur Kapitelprüfung bzw. Einstufung“. Beide meinen also **das Gegenteil** („nur Prüfung, nie Übung“). `trainable()` in `src/domain/c1x/select.ts` Zeile 56 schließt sie vom Üben aus.
- **Nur Kommentar:** In `Kwt.words` steht „sonst gilt 3–6 nach Cambridge“.

Heutiger Stand: Kein vorhandener Test zieht tasks-v2-Umformungen. C1-Check, Kapitelprüfung und Einstufung nehmen eigene c1x-Vorräte mit `probe` bzw. `pool`. Die Markierung wird also erst für den neuen Themen-Test des Relaunchs nötig (Konzept 4.2, Schritt 6: „kwt mit 3–6 Wörtern“). Sie muss aber vorher in den Daten stehen.

### Vorschlag für das neue Feld: `practiceOnly: true`

1. **Schema:** Im kwt-Zweig von `V2TaskSchema` (`src/domain/grammar/patternTypes.ts`) ergänzen: `practiceOnly: z.literal(true).optional()`. Wichtig: zod-Objekte werfen unbekannte Felder **still weg**. Ohne diese Schema-Zeile hat das Feld also keine Wirkung.
2. **Daten:** Bei jeder unten genannten Aufgabe `"practiceOnly": true` eintragen, und zwar in der Quelle `scripts/grammar/parts/<thema>/v2.json` bzw. `scripts/topics-gen/tp_*.py`, danach neu bauen.
3. **Weitergabe nach c1x:** In `kwtFrom()` (`src/domain/c1x/legacyV2.ts`) das Feld durchreichen. Dazu in `C1Base` (`src/domain/c1x/types.ts`) und dem zod-Schema in `src/domain/c1x/schema.ts` `practiceOnly?: true` ergänzen.
4. **Wirkung:** Der neue Themen-Test und alle künftigen Test- und Check-Vorräte schließen `practiceOnly` aus. Beim Üben ändert sich nichts.
5. **Absicherung:** ein Unit-Test, der Folgendes prüft: Jede tasks-v2-Umformung, deren `answer` nach Leerzeichen weniger als 3 Wörter hat, trägt `practiceOnly: true`.

### Liste: 181 von 465 Umformungen in tasks-v2 haben eine Lösung aus 2 Wörtern

Aktion bei jeder id: `"practiceOnly": true`.

**Normale Fälle (174):**

art-ind-k1, art-ind-k2, art-snd-k1, art-snd-k2, art-uni-k1, art-uni-k2, art-zer-k2, art-fix-k1, dp-ho-k2, dm-con-k1, dm-con-k2, dm-ctr-k2, dm-sum-k1, em-wc-k1, em-oi-k1, em-oi-k2, hg-mod-k1, hg-mod-k2, hg-inc-k2, hg-dow-k1, hg-dow-k2, nm-nf-k1, nm-nf-k2, nm-oo-k1, nm-fo-k2, nm-np-k1, cp-hav-k1, cp-hav-k2, cp-ing-k1, cp-ing-k2, cp-pp-k1, cp-pp-k2, cp-sub-k1, cp-sub-k2, cp-bu-k1, cp-wi-k2, cmp-form-k2, cmp-deg-k1, cmp-deg-k2, cm-mea-k1, cm-mea-k2, cm-ord-k1, cm-ord-k2, cm-fix-k1, cm-fix-k2, cm-par-k1, cm-par-k2, ca-buf-k1, ca-buf-k2, cn-s-k1, cn-w-k2, cn-t-k1, cnt-unc-k2, cnt-dbl-k1, el-k1, el-k2, el-k3, el-k6, el-k7, el-k8, ep-k1, ep-k2, ep-k3, ep-k4, ep-k5, ep-k6, ep-k7, ep-k8, ff-wn-k1, ff-wn-k2, ff-ft-k1, ff-ab-k2, fp-k3, fp-k4, fp-k5, fp-k6, fp-k7, gi-ing-k1, gi-ing-k2, gi-prep-k2, gi-mean-k1, inv-k3, inv-k4, inv-k5, inv-k6, inv-k7, mc.kwt1, mc.kwt2, mc.kwt5, mc.kwt8, mc.kwt9, mc.kwt11, mc.kwt12, ma-sho-k1, md-mn-k2, md-mi-k2, mp-k1, mp-k2, mp-k3, mp-k4, mp-k7, mp-k8, np-k1, np-k2, np-k4, np-k10, pp-mod-k1, pp-per-k3, pp-bei-k2, pp-rep-k1, pp-rep-k3, ph-tog-k2, pn-for-k1, pn-for-k2, pn-in-k1, pn-in-k2, pn-of-k1, pn-of-k2, pn-ab-k1, pn-ab-k2, pn-to-k1, pn-to-k2, pn-at-k1, pn-at-k2, pt-ai-k1, pt-ai-k2, pt-bu-k1, pt-bu-k2, pt-dw-k1, prp-ver-k1, prp-ver-k2, prp-adj-k1, prp-adj-k2, prp-per-k2, prp-ing-k2, psc-hab-k1, psc-hab-k2, qn-k1, qn-k2, qn-k3, qn-k4, qn-k5, qn-k6, qu-ind-k1, qu-iw-k1, qu-iw-k2, qu-sub-k2, qu-dir-k1, qu-dir-k2, qu-tag-k1, qu-tag-k2, rc-ww-k1, rc-ww-k2, rc-wh-k1, rc-cm-k1, rc-cm-k2, rv-ad-k1, rv-ad-k2, rv-sr-k1, rv-sr-k2, rs-tl-k2, sa-k1, sa-k2, sa-k3, sa-k4, sa-k5, sa-k6, sa-k7, sa-k8, ut-wld-k1, vp-ing-k2, vp-rf-k1, vp-st-k1, vp-rg-k2

**Grenzfälle mit Kurzform (7):** mc.kwt7 („hadn't sent“), md-cn-k2 („can't be“), pv-sim-k1 („weren't told“), prp-nop-k1 („didn't attend“), prp-nop-k2 („didn't mention“), psc-sta-k2 („don't understand“), psc-dua-k1 („don't think“).

Nach Cambridge zählen diese Lösungen als 3 Wörter, weil eine Kurzform zwei Wörter sind. `kwtWords()` zählt sie ebenfalls als 3. Ich empfehle trotzdem `"practiceOnly": true`: Inhaltlich wird nur ein einziges Wort getauscht, das ist eine B1/B2-Umformung und kein C1-Prüfungsniveau.

**Zusätzlich aus Punkt 4 (5 Wörter, aber keine echte Umformung):** wo-pt-k1, wo-pt-k2. Siehe 4.16.

### c1x-Umformungen

Die c1x-Dateien enthalten 211 Umformungen: `src/content/c1x/src/kwt/*.json`, `pilot/kwt.json`, `check/*.json`, `gate/k1.json` und `place/*.json`. Bei **keiner** besteht die erste Lösungsvariante aus 2 Wörtern (Teil a und Teil b je ein Wort): 0 Treffer. Es gibt keine Aktion.

---

## Punkt 4: Wortstellung „in Munich tomorrow“ (B1)

Meine Lehrer-Einschätzung:
- **Ort vor Zeit** ist B1-Stoff und außerdem keine feste Regel. Die eigene Aufgabe `wo-pt-m1` sagt richtig, dass beide Reihenfolgen gehen. Für den C1-Weg ist das kein Lernziel.
- Der Fehler, den deutsche Muttersprachler auch auf B2 noch machen, ist ein anderer: **Verb und Objekt werden getrennt** („visit in Boston the client“). Den deckt das Muster `wo.verb-object` ab. Die zweite echte B2/C1-Lücke ist die **Stellung von still, already und also** („We haven't still received …“ nach dem deutschen „noch immer nicht“).
- Deshalb: Ort vor Zeit wird zur Wiederholung herabgestuft. Das Muster selbst wird nicht gelöscht, weil Aufgaben, Zuordnungen und der Test `tests/unit/fkContent.test.ts` davon abhängen. In toolkit wird es ersetzt.

### toolkit.json, Aufgabe `tasks[245]` (Zeile 6642–6655, Prompt „We are holding the workshop ___.“)

4.1 · Feld `prompt`
- alt: We are holding the workshop ___.
- neu: We ___ the signed contract from the client.
- Grund: B1-Stoff, und die Ablenker („Munich in tomorrow“) sind sinnlos, also nicht prüfungstauglich. Ersetzt wird durch einen echten deutschen Fehler auf B2/C1-Niveau.

4.2 · Feld `options`
- alt: `["in Munich tomorrow", "in tomorrow Munich", "Munich in tomorrow", "tomorrow Munich in"]`
- neu: `["still haven't received", "haven't still received", "haven't received still", "didn't still receive"]`
- Grund: Jeder Ablenker ist ein Fehler, den deutsche Lernende wirklich machen.

4.3 · Feld `answer`
- alt: in Munich tomorrow
- neu: still haven't received
- Grund: wie 4.1.

4.4 · Feld `expl`
- alt: Ort steht vor Zeit.
- neu: Bei Verneinung steht „still“ vor dem Hilfsverb: „We still haven't received …“. Das deutsche „noch immer nicht“ verleitet zu „haven't still“.
- Grund: wie 4.1.

4.5 · Feld `expl_en`
- alt: Place comes before time.
- neu: With a negative, “still” goes before the auxiliary: “We still haven't received …”. German “noch immer nicht” tempts learners to say “haven't still”.
- Grund: wie 4.1.

### toolkit.json, Thema `word-order` (Zeile 297–303)

4.6 · Feld `rule`
- alt: Ort steht meist vor Zeit („in Munich tomorrow“). Nach verneinenden Einleitungen wie „never“, „rarely“, „not only“ folgt die Frage-Stellung: „Rarely have we seen …“.
- neu: Verb und Objekt bleiben zusammen, das Adverb steht davor oder dahinter. „already“, „also“ und „always“ stehen nach dem ersten Hilfsverb, „still“ steht bei Verneinung vor dem Hilfsverb („We still haven't …“). Nach verneinenden Einleitungen wie „never“, „rarely“, „not only“ folgt die Frage-Stellung: „Rarely have we seen …“.
- Grund: Die B1-Regel weicht den Fehlern, die auf dem Weg zu C1 wirklich vorkommen.

4.7 · Feld `rule_en`
- alt: Place usually comes before time (“in Munich tomorrow”). After negative openers like never, rarely and not only, question word order follows: “Rarely have we seen …”.
- neu: Keep the verb and its object together; the adverb goes before or after. “Already”, “also” and “always” go after the first auxiliary; in negatives, “still” goes before the auxiliary (“We still haven't …”). After negative openers like never, rarely and not only, question word order follows: “Rarely have we seen …”.
- Grund: wie 4.6.

4.8 · Feld `ex`, zweiter Eintrag
- alt: We will meet in Berlin next week.
- neu: We still haven't received the signed contract.
- Grund: wie 4.6.

### toolkit.json, `rules["word-order"]` (Zeile 2302–2388)

4.9 · `core[0]` (Deutsch)
- alt: Zwischen Verb und Objekt steht kein Adverb: „I like coffee very much.“ (nicht: I like very much coffee). Der Ort kommt vor der Zeit. Nach never, rarely, seldom, hardly, not only und no sooner steht das Hilfsverb vor dem Subjekt: „Rarely have we seen this.“
- neu: Zwischen Verb und Objekt steht kein Adverb: „We discussed the proposal in detail.“ (nicht: We discussed in detail the proposal). already, also und always stehen nach dem ersten Hilfsverb; „still“ steht bei Verneinung vor dem Hilfsverb: „We still haven't heard back.“ Nach never, rarely, seldom, hardly, not only und no sooner steht das Hilfsverb vor dem Subjekt: „Rarely have we seen this.“
- Grund: Die B1-Regel fällt weg, und das Beispiel wird berufsnah.

4.10 · `core[1]` (Englisch)
- alt: Do not put an adverb between the verb and its object: “I like coffee very much.” (not: I like very much coffee). Place comes before time. After never, rarely, seldom, hardly, not only and no sooner the auxiliary goes before the subject: “Rarely have we seen this.”
- neu: Do not put an adverb between the verb and its object: “We discussed the proposal in detail.” (not: We discussed in detail the proposal). Already, also and always go after the first auxiliary; in negatives, “still” goes before the auxiliary: “We still haven't heard back.” After never, rarely, seldom, hardly, not only and no sooner the auxiliary goes before the subject: “Rarely have we seen this.”
- Grund: wie 4.9.

4.11 · `steps[0][3]` und `steps[1][3]`
- alt DE: Reihenfolge am Satzende: Art und Weise, Ort, Zeit.
- neu DE: already/also/always nach dem ersten Hilfsverb; bei Verneinung „still“ vor das Hilfsverb.
- alt EN: Order at the end: manner, place, time.
- neu EN: Already/also/always after the first auxiliary; with a negative, “still” before the auxiliary.
- Grund: wie 4.9.

4.12 · `forms[2]` (der ganze Eintrag)
- alt: `[["Ort und Zeit", "Place and time"], "Ort vor Zeit", "We meet in Munich tomorrow."]`
- neu: `[["Adverb-Stellung", "Adverb position"], "S + still + Hilfsverb-n't + Verb · S + Hilfsverb + already/also + Verb", "We still haven't received the payment."]`
- Grund: wie 4.9. Die Form-Spalte bleibt wie im übrigen Bestand auf Deutsch.

4.13 · `traps`: einen dritten Eintrag **anhängen**
- neu: `{"bad": "We haven't still received the payment.", "good": "We still haven't received the payment.", "why": ["„still“ steht bei Verneinung vor dem Hilfsverb. Das deutsche „noch immer nicht“ verleitet zu „haven't still“.", "In negatives, “still” goes before the auxiliary. German “noch immer nicht” tempts learners to say “haven't still”."]}`
- Grund: Das ist ein typischer Fehler deutscher Muttersprachler in Status-Mails.

### Zuordnung zu `tasks[245]` (pattern-map)

4.14 · Datei `scripts/grammar/parts/word-order/map.json` (Zeile 29–54), danach neu bauen. Erzeugt wird `src/content/grammar/pattern-map.json`, Zeile 20293–20318.
- alt: Schlüssel `"We are holding the workshop ___."` mit `pat` `wo.place-time` und den drei Munich-Erklärungen
- neu: Schlüssel `"We ___ the signed contract from the client."`. In pattern-map.json heißt der Schlüssel dann `word-order|wethesignedcontractfromtheclient`. Wert:

```json
{
 "pat": "wo.verb-object",
 "why": {
  "ok": {
   "de": "Richtig: Bei Verneinung steht still vor dem Hilfsverb: We still haven't received …",
   "en": "Right: in a negative, still goes before the auxiliary: We still haven't received …"
  },
  "wrong": [
   { "opt": "haven't still received", "de": "Das deutsche „noch immer nicht“ verleitet dazu. Bei Verneinung steht still vor haven't.", "en": "German “noch immer nicht” tempts you here. In a negative, still goes before haven't." },
   { "opt": "haven't received still", "de": "Am Satzende klingt still hier falsch. Es steht vor dem Hilfsverb: still haven't.", "en": "At the end, still sounds wrong here. It goes before the auxiliary: still haven't." },
   { "opt": "didn't still receive", "de": "Zwei Fehler: still gehört vor das Hilfsverb, und „bis jetzt“ verlangt das Present Perfect.", "en": "Two errors: still goes before the auxiliary, and “up to now” needs the present perfect." }
  ]
 }
}
```

- Grund: Der alte Schlüssel trifft nach 4.1 nicht mehr. `wo.verb-object` (Adverb vor dem Verb, nicht dazwischen) ist das passende vorhandene Muster.

### Muster-Datei `src/content/grammar/patterns/word-order.json`

4.15 · Feld `canDo.de`
- alt: Ich kann Sätze genau bauen: Verb und Objekt zusammenhalten, meist Ort vor Zeit setzen und nach never, not only, hardly, no sooner und only förmlich invertieren.
- neu: Ich kann Sätze genau bauen: Verb und Objekt zusammenhalten und nach never, not only, hardly, no sooner und only förmlich invertieren.
- Grund: Ort vor Zeit ist kein C1-Ziel.

4.15b · Feld `canDo.en`
- alt: I can build sentences precisely: keep verb and object together, put place before time, and invert formally after never, not only, hardly, no sooner and only.
- neu: I can build sentences precisely: keep verb and object together and invert formally after never, not only, hardly, no sooner and only.
- Grund: wie 4.15.

4.15c · Feld `decide.de` und `decide.en`: jeweils den **dritten** Eintrag streichen
- alt DE: Folgen mehrere Angaben am Satzende? Meist Art und Weise, dann Ort, dann Zeit.
- alt EN: Do several details close the sentence? Usually manner, then place, then time.
- Grund: B1-Regel. Das Schema verlangt 2 bis 3 Einträge, 2 bleiben.

4.15d · Felder `order` und `introPlan`
- alt `order`: `["wo.verb-object","wo.place-time","wo.neg-inv","wo.not-only","wo.hardly-sooner","wo.only-inv"]`
- neu `order`: `["wo.verb-object","wo.neg-inv","wo.not-only","wo.hardly-sooner","wo.only-inv","wo.place-time"]`
- alt `introPlan`: `[["wo.verb-object","wo.place-time"],["wo.neg-inv","wo.not-only"],["wo.hardly-sooner","wo.only-inv"]]`
- neu `introPlan`: `[["wo.verb-object","wo.neg-inv"],["wo.not-only","wo.hardly-sooner"],["wo.only-inv","wo.place-time"]]`
- Grund: Das B1-Muster soll nicht als Erstes eingeführt werden, sondern ans Ende rücken. Das Schema bleibt erfüllt (höchstens 2 je Schritt, alle Muster enthalten).
- Hinweis: Hängt ein Test an der Reihenfolge, gilt diese Änderung als optional.

### Aufgaben zu `wo.place-time` in tasks-v2

Quelle `scripts/grammar/parts/word-order/v2.json`, Zeile ~217–379. Erzeugt in `src/content/grammar/tasks-v2.json`, Zeile 46684–46880. **Nicht löschen** (siehe 0.2).

4.16 · ids `wo-pt-k1`, `wo-pt-k2` · Aktion `"practiceOnly": true`
- Grund: Das sind keine echten Umformungen. Das Schlüsselwort wird nur aus dem Ausgangssatz kopiert, und die Satzteile werden umgestellt. Außerdem ist es B1-Stoff.

4.17 · id `wo-pt-f1` · Feld `pat`
- alt: wo.place-time
- neu: wo.verb-object
- Grund: Der Fehler ist „meeting in Denver the client“, also Verb und Objekt getrennt. Das ist ein echter B2-Fehler deutscher Muttersprachler, und die vorhandenen `why`-Texte passen schon dazu.

4.18 · id `wo-pt-f2` · Feld `pat`
- alt: wo.place-time
- neu: wo.verb-object
- Grund: wie 4.17 („visit in Boston the client“).

4.19 · id `wo-pt-f3` · Aktion `"practiceOnly": true`
- Grund: Ein Satz ohne Fehler zu Ort und Zeit ist B1-Stoff, kein Testmaterial.
- Das Feld aus Punkt 3 gibt es bisher nur für kwt. Für `find` und `meaning` muss es im Schema genauso ergänzt werden.

4.20 · id `wo-pt-m1` · Aktion `"practiceOnly": true`
- Grund: Die Antwort „beide“ ist ohne Nachdenken lösbar, die Aufgabe hat keinen Lernwert. Löschen geht nicht, siehe 0.2.

### Weitere Stellen

4.21 · Datei `src/content/c1x/src/place/p01.json` · id `err-0413` (Zeile 2812–2830)
- Feld `level`: alt `B2+`, neu `B2`
- Feld `b`: alt `0.6`, neu `-0.8`
- Grund: Ein fehlerfreier Satz mit Ort vor Zeit ist B1-leicht. Als schwere Aufgabe (b 0.6) verfälscht er die Einstufung. Die übrigen leichten B2-Aufgaben liegen bei −0,6 bis −0,7.

4.22 · Datei `src/content/fk/b1.json` · id `b1-wo-01`: **keine Änderung.**
- Grund: Der B1-Wiederholungsvorrat ist genau der richtige Ort für dieses Muster. `tests/unit/fkContent.test.ts` erwartet es dort.

4.23 · Datei `src/content/c1/order.json`, Zeile 10659–10683 (Satzbau, `wo.place-time`): **keine Änderung.**
- Grund: Die Übung ist harmlos und lässt alle Varianten gelten. Sie zählt nicht als Test.

4.24 · Die Muster-Beschreibung von `wo.place-time` (`use`, `trap`, `ccq`) bleibt.
- Grund: Inhaltlich richtig, nur das Niveau war falsch eingeordnet.

---

## Zahlen

| Datei | geprüft | mit Befund |
|---|---|---|
| `src/content/c1/toolkit.json`, `tasks` | 280 von 280 | 19 Aufgaben (Nr. 1–33 oben, dazu `tasks[245]` aus Punkt 4) |
| `src/content/c1/toolkit.json`, `topics` | 31 von 31 | 2 (compound-mod, word-order) |
| `src/content/c1/toolkit.json`, `rules` | 31 Regelblätter | 7 Regelblätter (c1-precision, verb-patterns ×2, countable, linkers, comparison, compound-mod, word-order), dazu P3 kleines „i“ |
| `src/content/grammar/tasks-v2.json`, kwt-Wortzahl | 465 von 465 | 181 mit 2-Wort-Lösung, davon 7 Grenzfälle mit Kurzform |
| `src/content/grammar/tasks-v2.json`, Inhalt | 7 Aufgaben (`cm-par-k1`, 6 × `wo.place-time`) | 6 (`cm-par-k1`, wo-pt-k1, k2, f1, f2, f3, m1; f3 und m1 nur Herabstufung) |
| c1x-Umformungen (`src/content/c1x/src/**`), Wortzahl | 211 | 0 |
| `src/content/grammar/patterns/word-order.json` | ganz | 4 Felder |
| `scripts/grammar/parts/word-order/map.json` bzw. `pattern-map.json` | Eintrag Workshop/Munich | 1 |
| `src/content/c1x/src/place/p01.json` | `err-0413` | 1 |

## nicht_geprüft

- **tasks-v2.json, Inhalt der übrigen etwa 1.260 Aufgaben:** Bei allen Umformungen habe ich nur die Wortzahl geprüft. Gleiche Bedeutung, Natürlichkeit und US-Schreibweise der 181 markierten und der 284 übrigen Umformungen habe ich nicht einzeln geprüft. Das gilt auch für alle `find`-, `meaning`-, `mc`- und `gap`-Aufgaben außer den 7 oben genannten. Konzept 8.7 fordert vor der Nutzung im Test einen eigenen Prüfdurchgang.
- **c1x-Umformungen (211), Inhalt:** Gleiche Bedeutung und Natürlichkeit nicht geprüft. Bei der Wortzahl nur die erste Lösungsvariante, nicht alle Alternativen.
- **Die Form-Spalte in `rules.*.forms` ist durchgehend Deutsch** (z. B. „Never/Rarely + Hilfsverb + Subjekt“, „Should you + Grundform, … (ohne if)“). Nicht geprüft, ob sie in der englischen Oberfläche erscheint. Falls ja, ist das gemischte Sprache (Kap. 15).
- **Ob `signals` angezeigt oder nur zum Abgleich benutzt werden** (betrifft Eintrag 45).
- **Ob `scripts/topics-gen/apply.py` toolkit-Themen oder -Regelblätter beim nächsten Lauf neu schreibt:** nicht geprüft, besonders beim Regelblatt compound-mod (Eintrag 41). Falls ja, auch dort ändern.
- **Tests:** Ich kann nur lesen und habe nichts ausgeführt. Möglicherweise betroffen sind `tests/fixtures/quality-exceptions.json` (Schlüssel `word-order|weareholdingtheworkshopinmunichonfriday` gehört zu `wo-pt-f3` und bleibt gültig), `tests/tutor/lint-report.txt` und Tests, die Anzahlen oder pattern-map-Schlüssel zählen.
- **Nicht Teil des Auftrags und nicht geprüft:** `src/content/legacy/*`, `src/content/grammar-bank.json`, `src/content/c1/pack.json`, die übrigen Einträge in `src/content/c1/order.json` und `src/content/fk/*`, alle Wortschatz- und Lese-Inhalte sowie `dist/index.html` (Bauergebnis).
- **Die Werte für `b` in der Einstufung (4.21):** Mein Vorschlag −0,8 stammt aus dem Vergleich mit den Nachbaraufgaben, nicht aus einer Kalibrierung. Lena oder Tarek sollten den Wert bei der nächsten Auswertung nachstellen.
