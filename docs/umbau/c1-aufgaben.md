# C1-Übungsarten als Engine-Bausteine

Englischlehrer und Aufgabenautor (Cambridge C1 Advanced, Business) · 06.10.2026 · Branch `claude/umbau-fokus` · nur gelesen, nur diese Datei geschrieben. Pfade relativ zu `/home/user/lingo-engine-x`. **(Annahme)** = Startwert ohne Messung, **(Modell)** = Rechnung, **(Gedächtnis)** = nicht neu nachgeprüft, vor dem Bau gegenprüfen.

Baut auf dem beschlossenen Fundament auf (parallel in `docs/umbau/lernplattform-2.md`): jede Aufgabe zeigt auf genau **ein Muster** (Teilregel mit Formel, Signalwörtern, Beispiel, typischem Fehler Deutscher, Kontrast), alle Übungen laufen im Gerüst `<ExerciseShell>` mit **einer** Erklär-/Ergebnis-Karte, der Plan ist auf allen Geräten gleich, das Gerät bestimmt nur die Eingabeform. Heißen Bauteile dort anders, gilt der Name aus `lernplattform-2.md`.

---

## 0 In einfachen Worten (für Emrah)

1. Bisher kennt die Grammatik nur vier allgemeine Aufgabenformen: Auswahl, Lücke, Umformen und Satz verbessern. Die Cambridge-C1-Prüfung prüft Wortschatz und Grammatik aber mit vier ganz bestimmten Formaten, und genau die fehlen.
2. Dieses Dokument beschreibt **neun neue Übungsarten**, jede als eigener Baustein mit eigener Bedienung, eigener Bewertung und eigener Rückmeldung. Das ist neue Lernfunktion, kein neues Aussehen.
3. Vier davon sind die Prüfungsformate selbst: Wortwahl in der Lücke, offene Lücke (kleine Wörter wie *had*, *whose*), Wortbildung (aus PRECEDENT wird *unprecedented*) und die Schlüsselwort-Umformung mit Teilpunkten wie bei Cambridge.
4. Fünf weitere zielen auf die Fehler, die Deutsche auf C1-Niveau typisch machen: Fehler finden (auch in Sätzen, die gar keinen Fehler haben), Bedeutungspaare („I stopped to smoke“ gegen „I stopped smoking“), Wortpartner-Netze („meet a deadline“, nicht „hold“), förmlicher schreiben und denselben Gedanken anders sagen.
5. **Am Handy tippst du höchstens ein einzelnes Wort.** Alles andere geht mit Antippen, Auswählen, Bausteinen und Verbinden. Am Laptop schreibst du ganze Sätze, dort steht die Regel daneben.
6. Jede Antwort wird von der App bewertet, auch halb richtig (1 von 2 Punkten). Die Erklärung danach zeigt immer das Muster: Formel, typischer deutscher Fehler, Gegenbeispiel und warum die anderen Antworten falsch sind.
7. Rund **1.900 Aufgaben** werden vorab von Fachleuten geschrieben und geprüft, zuerst etwa 770. Claude darf später Nachschub liefern, aber nur formal geprüft und sichtbar gekennzeichnet, mit Knopf „Melden“.
8. Alle acht Wochen gibt es freiwillig eine **C1-Probe** im Prüfungsformat (30 Aufgaben, 36 Punkte). Sie zeigt ehrlich, ob du dich dem C1-Niveau näherst. Sie ist ein grober Richtwert, keine offizielle Note.
9. Ehrlich: Echte Videos passen nicht in die App (eine Minute Video ist fast so groß wie die ganze erlaubte Datei). Stattdessen gibt es kurze, ruhige Animationen, die das Muster zeigen: Wörter gleiten an ihren Platz, Teile eines Worts setzen sich zusammen, Linien verbinden Satz und Bedeutung.
10. Zuerst kommen die Umformung mit Schlüsselwort und „Fehler finden“, weil sie für C1 am meisten bringen und am Handy heute am schlechtesten gehen (dort musst du bisher ganze Sätze tippen).

---

## 1 Ausgangslage im Code

| Baustein | Beleg | Befund für C1 |
|---|---|---|
| Aufgabenarten | `src/domain/learn/types.ts:13` | nur `mc · gap · transform · correct`; kein Format kennt Teilpunkte, Options-Begründung, fehlerfreie Sätze oder Bedeutungskontrast |
| Aufgabe | `src/domain/learn/types.ts:16-32` | ein `answer`, eine Liste `accepted`, eine Erklärung; kein Muster, keine Begründung je Option |
| Nur eine Lücke | `src/domain/grammar/tasks.ts:55-57` | richtig für die heutige Bedienung; ein Cambridge-Text mit 8 Lücken braucht einen eigenen Textmodus (3.1) |
| Formsteuerung | `src/domain/grammar/tasks.ts:144-148` | `wantTypes(p)` wählt nur zwischen den vier Arten |
| Prüfung | `src/domain/grammar/check.ts:94` | Urteil `correct/near/wrong`, keine Punkte; `closeVariant` (`:134`) erkennt nur „sehr ähnlich“ |
| Buchung | `src/domain/grammar/write.ts:40` | `ok = verdict !== 'wrong'`: „fast richtig“ zählt für BKT als richtig; eine halbe KWT-Lösung darf das nicht |
| Fehlerschleife | `src/domain/grammar/errors.ts:184-208` | Fehlersätze kommen nur als `gap` oder `correct` (ganzer Satz) zurück; am Handy heißt das Ganzsatz-Tippen |
| Ganzsatz-Feld | `src/features/grammar/GrammarItem.tsx:303-331` | `textarea` für `correct` und Umformungen ohne Lücke: am iPhone das, was Emrah nicht will |
| Auswahl | `src/engine/Choices.tsx:24-33` | Karten A–D mit ✓/✕, Ziffern 1–4; trägt MC-Cloze und Paraphrase-Auswahl |
| Lücke | `src/engine/KineticGap.tsx:18-34` | Tippen in der Lücke, Maske, Markierungen; trägt offene Lücke, Wortbildung, KWT am Laptop |
| Bausteine | `src/engine/Tiles.tsx:10-21`, `:39` | Plätze standardmäßig = Zahl der Bausteine ohne Ablenker: verrät bei KWT die Wortzahl (3.4) |
| Wort antippen | `src/engine/EnglishText.tsx:19`, `:28` | `highlight` und `onWord` (Abfangen des Antippens) sind da: Grundlage für „Fehler finden“ |
| Notentabelle | `src/domain/grade/index.ts:57-80` | eine Tabelle, Schlüssel je Aufgabenart; neue Schlüssel nötig (2.5) |
| Gewichtung | `src/domain/srs/weight.ts:8` | Auswahl 0,55 · Stütze 0,8 · frei 1 · eigener Satz 1,1 |
| Kurzformen | `src/domain/text/normText.ts:10`, `:13` | `'d` wird immer zu *would*, `'s` immer zu *is*: „wish I'd checked“ und „it's been“ würden falsch normalisiert; KWT braucht eine eigene Auflösung (3.4) |
| Vorhandene C1-Formate | `src/content/nb/transforms.json` (30 KWT), `extras.json` (20 Wortbildung, 20 Register), `collocations.json` (40 Netze); Schemas `src/content/nb/schemas.ts:65`, `:75`, `:129`, `:140` | nur im Reiter „Anwenden“ (`docs/umbau/stand.md:58`), ohne BKT, ohne Fehlerschleife, ohne Muster; KWT dort 2–6 Wörter (`src/domain/nbdrill/transform.ts:8-9`) statt Cambridge 3–6 |
| Grammatikaufgaben | `src/content/c1/toolkit.json` (280: 86 mc, 77 gap, 66 correct, 51 transform), `src/content/grammar-bank.json` (240) | Rohstoff für Ernte (4.1) |
| Laufzeit-Nachschub | `src/domain/drills/orderPool.ts:141-166`, `src/features/drills/orderGen.ts:8-27` | bewährtes Muster: Vorrat im Browser, eine Anfrage je Handlung, 20 Min. Pause, formale Prüfung, Kennzeichnung |
| Bundle | `dist/index.html` = 4.809.431 Byte | Budget laut `docs/umbau/gesamtkonzept.md:153`: Warnung 4,5 MB, Fehler 6 MB, Grenze 16 MB |

**Fazit:** Engine-Teile (Lücke, Auswahl, Bausteine, Wort antippen, Satzvergleich) sind gut und werden wiederverwendet. Es fehlen die **Aufgabenformate**, die **Teilpunkte**, die **Begründung je falscher Option**, **fehlerfreie Sätze**, **Bedeutungskontraste** und eine Handy-Bedienung ohne Ganzsatz-Tippen.

---

## 2 Gemeinsames Fundament der neun Bausteine

### 2.1 Die neun Arten auf einen Blick

| Kürzel | Übungsart | Cambridge-Bezug | Bereich | Handy | Laptop |
|---|---|---|---|---|---|
| `mcc` | Wortwahl in der Lücke (Kollokation, Nuance) | Teil 1 | gram oder lex | A–D antippen | Tasten 1–4, Textmodus |
| `ocl` | Offene Lücke (Funktionswörter) | Teil 2 | gram | 1 Wort tippen | 1 Wort tippen, Textmodus |
| `wf` | Wortbildung mit Stamm | Teil 3 | lex | 1 Wort tippen | 1 Wort tippen, Textmodus |
| `kwt` | Schlüsselwort-Umformung, 2 Teilpunkte | Teil 4 | gram | Bausteine | 3–6 Wörter tippen |
| `err` | Fehler finden, auch fehlerfreie Sätze | – | gram | Wort antippen + Korrektur wählen | Wort anklicken + Korrektur tippen |
| `pair` | Bedeutungspaare (stop to / stop -ing) | Teil 1 „semantic precision“ | gram | Satz mit Bedeutung verbinden | verbinden + Transfer-Lücke |
| `cnet` | Kollokations-Netz | Teil 1 „collocations“ | lex | Partner antippen (Gitter) | Netz, Tasten |
| `reg` | Register umschreiben (neutral → formell) | – (Business) | gram | Abschnitte per Chip tauschen | ganzen Satz umschreiben |
| `para` | Satz-Paraphrase | Teil 4/5 „meaning“ | gram | den gleichbedeutenden Satz wählen | Satz mit vorgegebenem Anfang schreiben |

Cambridge-Formate laut Prüfungsanbieter: Teil 1 Multiple-choice cloze (8 Fragen, je 1 Punkt; „fixed phrases, complementation, phrasal verbs and semantic precision“), Teil 2 Open cloze (8, je 1; „articles, auxiliaries, prepositions, pronouns, verb tenses and forms … linkers and words within fixed phrases“, Rechtschreibung muss stimmen), Teil 3 Word formation (8, je 1; „prefixes, suffixes, internal changes and compounds“), Teil 4 Key word transformation (6, bis 2 Punkte; „between three and six words, one of which must be the key word. The key word must not be changed in any way“). Quellen: [Format](https://www.cambridgeenglish.org/exams-and-tests/qualifications/advanced/format/), [Reading Overview PDF](https://cambridgeenglish.org/Images/167860-cambridge-english-c1-advanced-reading-overview.pdf).

**Bereich** `gram` bucht auf eines der 39 Grammatikthemen (`grammar/<topic>`, BKT). **Bereich** `lex` (Wortbildung, Netze, Wort-Kollokationen) hat kein Grammatikthema; er bucht ins Verlaufsdokument `out/<Monat>` wie die heutigen Trainings und seine Fehler in `app/repair` (2.8). Fortschritt je Muster bekommt in beiden Fällen `pattern` + Punkte.

### 2.2 Ordner und Bauteile

- **Inhalte:** `src/content/c1x/<kind>.json` (eine Datei je Art), zur Build-Zeit komprimiert (2.3).
- **Domäne (rein, testbar):** `src/domain/c1x/types.ts` (Typen), `schema.ts` (zod), `score.ts` (`scoreC1`), `accept.ts` (Prüfung erzeugter Aufgaben), `select.ts` (Auswahl je Muster, Gerät, Beherrschung), `kwtNorm.ts`.
- **Bildschirme:** `src/features/c1x/` je Art eine Komponente im `<ExerciseShell>`: `McCloze`, `OpenCloze`, `WordForm`, `KeyTransform`, `SpotError`, `MeaningPair`, `CollocNet`, `RegisterShift`, `Paraphrase`.
- **Neue Engine-Teile** (`src/engine/`): `TapSentence` (Wort oder Spanne antippen, baut auf `EnglishText` mit `onWord`/`highlight` auf), `ChipRow` (3–4 kleine Auswahl-Chips mit ✓/✕), `LinkPairs` (zwei Spalten verbinden, SVG-Linien), `RadialNet` (Netz um ein Wort), `SegmentSwap` (markierte Satzteile austauschen), `PartBar` (Teilpunkte als Segmente), `MorphSplit` (Wortzerlegung), `WordCounter` (Wortzahl live, Tabellenziffern).
- **Prompts:** `src/prompts/c1Gen.ts` (`c1-gen@1`, Nachschub), `src/prompts/c1Judge.ts` (`c1-judge@1`, Urteil über frei geschriebene Sätze am Laptop, nur auf Knopfdruck).

### 2.3 Gemeinsames Inhaltsformat

```ts
type Bi = { de: string; en: string };
type C1Kind = 'mcc' | 'ocl' | 'wf' | 'kwt' | 'err' | 'pair' | 'cnet' | 'reg' | 'para';

type C1Base = {
  id: string;              // 'kwt-0042', dauerhaft (Grundlage von seen, Fehlersatz, Melden)
  kind: C1Kind;
  area: 'gram' | 'lex';
  pattern: string;         // Muster-ID 'gerund-inf/stop-ing-vs-to' (Format aus lernplattform-2.md)
  topic?: string;          // Pflicht bei area 'gram': eines der 39 Themen
  lex?: string[];          // betroffene Wörter/Wendungen (Brücke zu Karten)
  trap?: string;           // Deutsch-Falle f01–f28 (src/content/nb/traps.ts)
  level: 'B2' | 'B2+' | 'C1';
  dom: 'biz' | 'life';     // Ziel ⅔ Beruf, ⅓ Alltag (02-lehrplan.md:43)
  why: Bi;                 // Kernbegründung, ≤ 180 Zeichen je Sprache
  src: 'seed' | 'ai';
  set?: string; seq?: number; // Textmodus: Aufgaben eines Absatzes
  probe?: true;            // für die C1-Probe zurückgehalten, nie im Training
};
```

```ts
const t = z.string().trim().min(1);
const bi = z.object({ de: t, en: t });
const oneGap = t.refine((s) => (s.match(/_{3,}/g) ?? []).length === 1, 'genau eine Lücke');
export const c1Base = z.object({
  id: z.string().regex(/^(mcc|ocl|wf|kwt|err|pair|cnet|reg|para)-\d{4}$/),
  area: z.enum(['gram', 'lex']),
  pattern: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  topic: z.string().optional(), lex: z.array(t).max(3).optional(),
  trap: z.string().regex(/^f\d{2}$/).optional(),
  level: z.enum(['B2', 'B2+', 'C1']), dom: z.enum(['biz', 'life']),
  why: bi, src: z.enum(['seed', 'ai']),
  set: z.string().optional(), seq: z.number().int().min(1).optional(), probe: z.literal(true).optional(),
});
// Je Art: c1Base.extend({ kind: z.literal('…'), … }) – siehe Abschnitt 3.
export const c1Item = z.discriminatedUnion('kind', [mcc, ocl, wf, kwt, err, pair, cnet, reg, para]);
```

Querprüfungen, die zod schlecht ausdrückt (Lösung an genau einer Stelle, Themen-ID bekannt, Ablenker ≠ Lösung), stehen in `checkC1Content(item)` (rein) und laufen in einem Unit-Test über **alle** Inhalte (4.3).

**Größe und Laden.** Gemessen an den 27 Beispielen unten (minifiziert): mcc 1.157 · ocl 456 · wf 583 · kwt 842 · err 459 · pair 835 · cnet 1.374 · reg 1.320 · para 1.353 Byte je Aufgabe. Für 1.920 Aufgaben (4.1) sind das **≈ 1,67 MB** Text (Modell). Komprimiert (deflate, gemessen 23–32 % auf `toolkit.json`, `grammar-bank.json`, `pack.json` und den Beispielen) plus Base64 (+33 %) bleiben **≈ 0,55–0,7 MB**. Vorschlag: Build-Schritt packt `c1x/*.json` mit deflate-raw, die App entpackt eine Art erst beim ersten Gebrauch mit `DecompressionStream` (in Safari seit 16.4, [web.dev](https://web.dev/blog/compressionstreams)); ohne diese Schnittstelle wird die Art nicht angeboten und `logWarn` meldet es. `dist` wächst von 4,81 MB auf **≈ 5,4–5,5 MB** (unter dem 6-MB-Fehlerbudget), unkomprimiert wären es ≈ 6,5 MB. Release 1 (770 Aufgaben) braucht unkomprimiert ≈ 0,67 MB und ginge auch ohne Packen.

### 2.4 Gerät bestimmt nur die Eingabe

`inputProfile()` in `src/engine/inputProfile.ts`: `'desk'`, wenn `(any-pointer: fine)` zutrifft (Maus, Trackpad, iPad mit Tastatur-Trackpad), sonst `'touch'`; dieselbe Abfrage nutzt heute `hasFinePointer` (`src/engine/TilesKeyboard.tsx:22`). Der Handy-Modus mit Einstellung wurde in W2 entfernt (`docs/umbau/stand.md:39`); hier entscheidet nur der Zeiger, ohne Schalter.

| Art | längste Tipp-Eingabe am Handy | Handy-Eingabe | Laptop-Eingabe |
|---|---|---|---|
| mcc | 0 | Karten A–D | Karten A–D, Tasten 1–4; Textmodus mit 4–8 Lücken |
| ocl | 1 Wort, meist ≤ 6 Zeichen | Lücke | Lücke; Textmodus |
| wf | 1 Wort, ≤ 16 Zeichen | Lücke | Lücke; Textmodus |
| kwt | 0 | Bausteine (`Tiles`) | 3–6 Wörter in der Lücke (`KineticGap`) |
| err | 0 | Wort antippen, Korrektur-Chip | Wort anklicken oder ←/→ + Leertaste, Korrektur in der Lücke tippen |
| pair | 0 | verbinden | verbinden, dazu Transfer-Lücke (1–3 Wörter) |
| cnet | 0 | Chips im Gitter | Netz im Kreis, Tasten 1–8 |
| reg | 0 | je Abschnitt ein Chip | ganzer Satz (Feld mit Ausgangssatz vorbefüllt) |
| para | 0 | 4 Sätze, einer stimmt | Satz B mit festem Anfang tippen |

Dieselbe Aufgabe hat auf beiden Geräten dieselbe Punktzahl-Logik; nur Note und Gewicht folgen der Eingabeform (Auswahl und Bausteine nie „Leicht“, `src/domain/grade/index.ts:57-80`).

### 2.5 Prüfen, Punkte, Note, Buchung

```ts
type PartId = 'a' | 'b' | 'loc' | 'fix' | 'meaning' | 'form' | 'transfer' | `seg${number}` | `link${number}`;
type PartResult = { id: PartId; ok: boolean; why?: Bi };
type C1Score = { got: number; max: number; parts: PartResult[];
  reason?: 'key' | 'length' | 'trap' | 'family' | 'falseAlarm' | 'missed'; us?: string };
export function scoreC1(item: C1Item, r: C1Response, inp: 'touch' | 'desk'): C1Score; // rein
export const verdictOf = (s: C1Score): Verdict => (s.got >= s.max ? 'correct' : s.got > 0 ? 'near' : 'wrong');
```

- **Buchung ins Thema (BKT):** nur volle Punktzahl ist „ok“. Änderung in `src/domain/grammar/write.ts:40`: `ok = … && (!a.pts || a.pts[0] === a.pts[1])`. Bei Auswahlformen wird `nOptions` an `bktStep` übergeben (Ratekorrektur), bei `pair` als 6 (zwei Verbindungen aus drei Bedeutungen), bei `cnet` als 4 **(Annahme)**.
- **Fehlerschleife:** jede Antwort unter voller Punktzahl und jedes „Weiß ich nicht“ erzeugt genau einen Fehlersatz mit `cid` (Aufgaben-ID); die Wiederholung zeigt **denselben Baustein** in der Eingabeform des Geräts, ab Box 1 eine ungesehene Aufgabe **desselben Musters und derselben Art** (heute: gleiches Thema und gleicher Typ, `src/domain/grammar/tasks.ts:251-255`).
- **Neue Notenschlüssel** (Startwerte **(Annahme)**, nach 2 Wochen aus den gemessenen Median-Zeiten je Art nachstellen):

| Schlüssel | Form | „Gut“ bis | „Leicht“ bis | Gewicht (`weight.ts`) |
|---|---|---|---|---|
| `mcc` | Auswahl | 9 s | nie | 0,55 |
| `ocl` | getippt (erstes Zeichen) | 6 s | 2,5 s | 1,0 |
| `wf` | getippt (erstes Zeichen) | 9 s | 3,5 s | 1,0 |
| `kwt` | Umformen (Abschicken) | 20 s | 8 s | 1,0 |
| `kwt_tiles` | Bausteine | 14 s + 0,6 s je Baustein | nie | 0,8 |
| `err_tap` | Auswahl | 10 s | nie | 0,55 |
| `err_fix` | getippt | 8 s | 3 s | 1,0 |
| `pair` | Auswahl | 14 s | nie | 0,55 |
| `cnet` | Auswahl | 15 s | nie | 0,55 |
| `reg_chips` | Auswahl | 12 s | nie | 0,55 |
| `reg` | Umformen | 25 s | 10 s | 1,0 |
| `para_pick` | Auswahl | 16 s | nie | 0,55 |
| `para` | Umformen | 35 s | 15 s | 1,1 (eigener Satz) |

- **Teilpunkte und Note:** `near` (z. B. 1 von 2) ergibt Note 2 wie heute (`03-lernmodell.md:73`); die Hilfe-Deckel gelten unverändert (H1 ≤ 3, H2 ≤ 2, H3 = 1).
- **„Ich lag richtig“** (`OverrideButton`, `src/features/learn/ui.tsx:294`) bleibt bei allen frei getippten Formen; der Fall landet zusätzlich in der Prüfliste des Lehrers (fehlende Variante ergänzen).

### 2.6 Hinweisleiter je Art

| Art | H1 Tipp (Note ≤ 3) | H2 (Note ≤ 2) | H3 |
|---|---|---|---|
| mcc | Muster-Formel ohne Lösung („Verb + to = Ursache“) | eine falsche Option wird ausgegraut | Lösung |
| ocl | Wortklasse („ein Hilfsverb“) | 4 Chips (Lösung + 3 aus `chips`) | Lösung |
| wf | Wortart und „mit Vorsilbe?“ | Platzhalter + erster Buchstabe (`maskOf`) | Lösung |
| kwt | Muster-Formel („Subjekt + is said + to …“) | erster Baustein liegt bzw. erstes Wort steht | Lösung |
| err | Bereich („Schau auf das Verb nach der Präposition“) | die Satzhälfte mit dem Fehler wird markiert | Lösung |
| pair | beide Formeln nebeneinander | der Ablenker wird ausgegraut | Lösung |
| cnet | Anzahl der richtigen („4 passen“) | ein richtiger Partner wird aufgedeckt | Lösung |
| reg | Zielregel („volle Formen, keine Phrasal Verbs“) | erster Abschnitt gelöst | Lösung |
| para | Strukturhinweis („Nomen + led to“) | längerer Satzanfang | Lösung |

Wochen-Check und C1-Probe: keine Hilfe (`noHelp`, wie `src/features/grammar/GrammarItem.tsx:50-51`). „Erst Hinweis, dann zweiter Versuch“ (`GrammarItem.tsx:131-140`) gilt für alle getippten Formen, nicht für Auswahl.

### 2.7 Die Erklär-/Ergebnis-Karte (gilt für alle neun)

Reihenfolge fest, auch bei richtiger Antwort (`docs/umbau/gesamtkonzept.md:127`), kein Auto-Weiter unter 4 s (`03-lernmodell.md:102`):

1. **Urteil + Punkte:** „Richtig · 2 von 2“, „Fast · 1 von 2“, „Noch nicht · 0 von 2“; bei Teilformen `PartBar` (z. B. „Teil 1 ✓ is said · Teil 2 ✕ to be“). Farbe nie allein: ✓/✕/↔ dazu.
2. **Du / Richtig, einmal:** die gewertete Eingabe mit `SentenceDiff`; bei Auswahl ist die Lösung schon im Satz eingesetzt (kein zweites „Richtig“).
3. **Muster-Karte** (aus dem Muster, nicht aus der Aufgabe): Name, Formel, Signalwörter, typischer Fehler Deutscher, Kontrast (zwei Mini-Sätze nebeneinander). In der Lernphase (p < 0,4) stand sie schon vor der Antwort offen; in der Wiederholung erst jetzt (Abruf vor Erklärung).
4. **Warum nicht …?** Je falscher Option, falschem Chip, falschem Partner eine Zeile mit Kategorie: *Deutsch gedacht* (`calque`) · *falscher Partner* (`partner`) · *passt grammatisch nicht* (`grammar`) · *andere Bedeutung* (`meaning`) · *falsche Stilebene* (`register`). Die Kategorie geht als Radar-Ereignis an `app/radar` (vorhandener Weg `RadarEvent`, `src/domain/learn/types.ts:69`).
5. **Beispiele ▸** (2–3, antippbar) und „Auch richtig“.
6. **Menü ⋯:** „Ich lag richtig“ (getippte Formen) · „Aufgabe melden“ · „Muster üben ›“ (4 Aufgaben dieses Musters, gemischte Arten, freiwillig).

Begründung in der Wissenschaft: Auswahlaufgaben können falsche Optionen festsetzen; sofortige oder verzögerte Rückmeldung hebt den Lerneffekt und senkt diese „Einschleppungen“ ([Butler & Roediger 2008](https://pubmed.ncbi.nlm.nih.gov/18491500/)). Deshalb bekommt jede Option eine Begründung. Fehlversuche mit sofortiger Rückmeldung fördern das Behalten ([Kornell, Hays & Bjork 2009](https://pubmed.ncbi.nlm.nih.gov/19586265/)). Sicher geglaubte Fehler werden nach Rückmeldung besonders gut korrigiert ([Butterfield & Metcalfe 2001](https://en.wikipedia.org/wiki/Hypercorrection_(psychology))); deshalb ist ein „Fehlalarm“ bei fehlerfreien Sätzen (3.5) ein wertvoller Moment mit ausführlicher Erklärung.

### 2.8 Datenmodell (nur ergänzend)

| Ort | Neues Feld / neuer Pfad | Zweck | Grenze, Prüfung |
|---|---|---|---|
| `GrammarTask` (Laufzeit, nicht gespeichert) | `c1?: C1Item`; `type` bleibt eine der vier alten Arten: mcc/pair/cnet/para-Auswahl → `mc`, ocl/wf → `gap`, kwt/reg/para-Text → `transform`, err → `correct` | alte Felder bleiben die Wahrheit, die alte App kann `grammar/*` weiter lesen | – |
| Antwort im Log | `pts?: [got, max]`, `c1k?: C1Kind`, `inp?: 'touch' \| 'desk'`, `pat?: string` | Teilpunkte, Gerät, Muster | ein paar Byte je Antwort |
| `grammar/<topic>.seen` | Schlüssel `c1:<id>` | ungesehen-Logik bleibt | `SEEN_MAX` 80 (`write.ts`) |
| `grammar/<topic>.errors[]` | `cid?: string`, `pts?: [n, n]` | Wiederholung im Baustein statt Ganzsatz | `ERRORS_MAX` 10 (`errors.ts:20`) |
| `app/repair.items[]` | `src: 'c1x'` (neuer Wert, `RepairSrc` in `src/domain/repair/repair.ts:19`), `cid?` | Fehlerschleife der Lexik-Arten; füllt „Fehler korrigieren“, das seit dem Umbau oft leer ist (`03-lernmodell.md:118`) | bestehende Grenzen |
| `out/<YYYY-MM>` | weitere `OutKind`-Werte `mcc · wf · cnet` (`src/domain/nbdrill/outDoc.ts:20`) | Verlauf der Lexik-Arten | 200 KiB, 400 Einträge (`outDoc.ts:16-17`) |
| `c1gen/<YYYY-MM>` **neu** | `{ items: C1Item[] (nur beantwortete Claude-Aufgaben), flag?: Record<id, t> }` | Fehlersätze und „Melden“ brauchen die ganze Aufgabe | ≤ 300 Aufgaben, < 200 KiB, +12 Dokumente im Jahr |
| `app/profile.c1probe[]` **neu** | `{ d, p1, p2, p3, p4, pts, max, inp }` | C1-Probe (Kap. 5) | ≤ 30 Einträge |
| `localStorage lx:c1gen:<kind>:v1` | Vorrat ≤ 24 Aufgaben | wie `orderGen.ts` | Bequemlichkeit, ersetzbar |

Alles additiv nach den Leitplanken (`gesamtkonzept.md:160`): kein Feld wird umgedeutet oder gelöscht, neue Pfade mit Schema, Register, Seed und Test; data-guard prüft vor dem Bau. Fortschritt **je Muster** (Zähler, Zustand) definiert `lernplattform-2.md`; dieses Dokument liefert je Antwort `pat` und `pts`.

### 2.9 Engine-Momente statt Video

Ruhige Bewegung, die eine Handlung bestätigt (Kap. 4.6, `docs/auftrag.md:108`), 150–300 ms, Framer Motion und SVG (beides schon im Bundle, 0 KB extra), bei `prefers-reduced-motion` nur Überblenden.

| Art | Moment | Technik |
|---|---|---|
| mcc | Die gewählte Karte gleitet in die Lücke und rastet ein; falsche Karten kippen leicht nach hinten und zeigen ihre Begründung | `layoutId` wie Heldenkarte (`src/engine/shared.tsx`) |
| ocl | Buchstaben fliegen in die Lücke (vorhanden, `KineticGap`) | vorhanden |
| wf | **Zerlegung:** nach dem Prüfen teilt sich das Wort in Plättchen *un · precedent · ed*, Stamm in der Mitte, Vor- und Nachsilbe gleiten an | `MorphSplit`, Layout-Animation |
| kwt | Das Schlüsselwort-Plättchen ist magnetisch: es rastet golden ein; die zwei Teilpunkte leuchten als zwei Segmente nacheinander auf | `Tiles` + `PartBar` |
| err | Das angetippte Wort hebt sich an; nach dem Prüfen klappt es um und die Korrektur erscheint an seiner Stelle | `TapSentence` |
| pair | Linien zwischen Satz und Bedeutung zeichnen sich; danach Kontrast-Tafel mit zwei Mini-Zeitstrahlen (remember + to: Erinnern vor der Handlung · remember + -ing: Erinnern danach) | SVG-Pfade, `pathLength` |
| cnet | Kanten zum Wort in der Mitte zeichnen sich; falsch gewählte reißen mit kurzem Zittern ab, übersehene erscheinen gestrichelt in Gold | `RadialNet` |
| reg | Der gewählte Chip schiebt das alte Satzstück heraus; am Ende liest sich der Satz als Ganzes, Register-Skala locker → formell rückt einen Schritt | `SegmentSwap` |
| para | Satz A und die gewählte Fassung stehen übereinander, gleiche Inhalte verbinden sich farblich (Ursache ↔ Ursache) | Hervorhebung, keine Bewegung nötig |

**„Muster-Film“ (Vorschlag, Paket P10):** je Muster eine 6–10 s lange Szene als JSON-Zeitleiste (z. B. Satz A zerfällt in Bausteine, das Schlüsselwort fliegt ein, Satz B rastet ein), ≈ 2–4 KB je Muster, ≈ 120 KB für 39 Themen **(Modell)**; abspielbar in der Muster-Karte, Stopp jederzeit.

### 2.10 Einordnung in den Lernweg und in die Runde

Ersetzt `wantTypes(p)` (`src/domain/grammar/tasks.ts:144-148`) durch `wantKinds(p, inp, pattern)`: das Muster nennt seine erlaubten Arten, `p` wählt die Stufe.

| Schritt (`03-lernmodell.md` §3) | p | Handy | Laptop |
|---|---|---|---|
| ② Erkennen, gelenkt | < 0,4 | mcc, pair, err (mit Chips), cnet | dasselbe |
| ③ gelenkt produzieren | 0,4–0,7 | ocl, wf, kwt (Bausteine), reg (Chips) | ocl, wf, kwt (getippt) |
| ④ frei | > 0,7 | err, para (Auswahl), kwt (Bausteine, ohne Tipp) | kwt, reg, para (geschrieben), err (getippt) |
| ⑤ Fehlerschleife | – | gleicher Baustein, ungesehene Aufgabe desselben Musters | dasselbe |

**Zeit je Aufgabe inkl. Rückmeldung (Annahme, messen):** mcc 30 s · ocl 30 s · wf 35 s · kwt 75 s (Bausteine) / 90 s (getippt) · err 40 s · pair 45 s · cnet 50 s · reg 60 s / 100 s · para 45 s / 120 s. Block „Grammatik“ (7 Min.) fasst damit am Handy ≈ 9, am Laptop ≈ 6–7 Aufgaben. Verschachtelung wie heute: ≥ 3 Themen, höchstens 2 gleiche hintereinander (`tasks.ts:306-332`), zusätzlich höchstens 2 gleiche **Arten** hintereinander.

**Muster → Arten (Beispiele):** `gerund-inf/stop-ing-vs-to` → pair, kwt, err · `prepositions/*` → mcc, ocl, err · `c1-emphasis/*` → ocl, kwt, para · `c1-nominal/*` → kwt, para, wf · `passive-plus/*` → kwt, para, err · `c1-hedging/*`, `c1-diplomacy/*` → reg, para, mcc · `lex/<nomen>-verbs` → cnet, mcc, err (aus Lehnübersetzungen erzeugt, 3.7).

**Ablösung im Reiter „Anwenden“:** Die Trainings Kollokationen, Satz-Umformung, Wortbildung und Register (`docs/umbau/stand.md:58`) gehen inhaltlich in cnet, kwt, wf und reg auf; Phrasal Verbs und Überleitungen bleiben vorerst. `out/<Monat>` und alle Daten bleiben.

---

## 3 Die neun Übungsarten

Aufwand je Paket: **S** ≤ ½ Arbeitstag · **M** 1–2 · **L** 3–5 · **XL** > 5 (Claude-Code-Sitzungen inklusive Tests und Prüfer).

### 3.1 `mcc` Wortwahl in der Lücke (Multiple-choice cloze)

**Zweck.** Cambridge Teil 1 prüft feste Wendungen, Ergänzungen (Verb + Präposition), Phrasal Verbs und „semantic precision“. Für Deutsche ist das der größte Hebel: In der Studie zu Kollokationen fortgeschrittener deutschsprachiger Lerner hatte die Muttersprache einen Einfluss „far beyond what was previously expected“ ([Nesselhauf 2003, Applied Linguistics 24/2](https://heibib.ub.uni-heidelberg.de/search/Record/1814339116)). Darum hat jede Aufgabe möglichst einen deutschen Ablenker (`tag: 'calque'`).

**Handy, von oben nach unten**
1. Kopf aus `<ExerciseShell>` (✕, Balken, `n / total`).
2. Status (Sicherheit des Musters, Art „Wortwahl“).
3. Aufgabenzeile: „Welches Wort passt genau? Achte auf das Wort nach der Lücke.“ (zweiter Teil aus dem Muster; in der Wiederholung ohne Thema).
4. Satz mit Lücke, 8–30 Wörter, Wörter antippbar (außer Lösung).
5. Vier Karten A–D (`Choices` mit `letters`, ≥ 56 px). Antippen = Antwort, kein „Prüfen“.
6. Rückmeldung: die Lücke füllt sich, jede Karte zeigt ✓/✕ und ihre Begründung (die gewählte zuerst, aufgeklappt), dann die Ergebnis-Karte (2.7) und „Weiter“ in der Aktionsleiste unten.

**Laptop.** Zweispaltig: links Satz und Karten (Tasten 1–4), rechts das Regel-Panel (in der Lernphase offen, sonst erst nach der Antwort). **Textmodus** (Paket P10): 4–8 Aufgaben mit demselben `set` als ein Absatz wie bei Cambridge, Tab springt zur nächsten Lücke, Optionen erscheinen unter der aktiven Lücke; bewertet wird jede Lücke einzeln.

**Bewertung.** Exakt (Index). Kein Teilpunkt. Note `mcc` (Auswahl, nie „Leicht“), Gewicht 0,55, BKT mit `nOptions = 4`. Lösungsposition wird je Aufgabe und Tag fest gemischt; der Inhalt selbst ist bereits gemischt (die Grammatik-Bank hatte die Lösung zu 52 % an Platz 2, `docs/umbau/stand.md:64`).

**Rückmeldung.** Kategorie der falschen Wahl als Überschrift („Deutsch gedacht: *strongly* passt zu Verben“), dann Muster-Karte; bei `area: 'lex'` zusätzlich „Als Karte“ für die Wendung (vorhandener Anlegeweg mit `hasCard`, nie automatisch).

**Inhaltsformat**
```ts
type McOpt = { w: string; why: Bi; tag?: 'calque' | 'partner' | 'grammar' | 'meaning' | 'register' };
type Mcc = C1Base & { kind: 'mcc'; text: string; options: [McOpt, McOpt, McOpt, McOpt]; answer: 0 | 1 | 2 | 3 };
const mcc = c1Base.extend({
  kind: z.literal('mcc'), text: oneGap,
  options: z.array(z.object({ w: t, why: bi, tag: z.enum(['calque', 'partner', 'grammar', 'meaning', 'register']).optional() })).length(4),
  answer: z.number().int().min(0).max(3),
});
```

**Herkunft und Menge.** Bauzeit **300** (150 gram, 150 lex), davon 24 für die Probe. Ernte: kaum (die 86 `mc` in `toolkit.json` sind Formfragen, keine Kollokationen; ≈ 30 lassen sich mit vier Begründungen umbauen). Laufzeit: **ja**, mit Prüfung `acceptMcc`: genau eine Lücke, 8–30 Wörter; vier verschiedene Optionen (ohne Groß-/Kleinschreibung); jede Option mit Begründung DE und EN ≥ 20 Zeichen in der richtigen Sprache (`isWrongLang` wie `orderPool.ts:157`); Lösungswort kommt im Satz nicht schon vor; alle vier Optionen stehen im Wörterbuch oder Atlas (`src/content/legacy/dict.json`, `src/content/atlas/atlas.json`), sonst verwerfen; US-Schreibung (Regel `BRITISH`, `orderPool.ts:126`); keine Dublette (`legacyNorm` gegen bekannte Sätze).

**Beispiele**
```json
[
  {
    "id": "mcc-0001", "kind": "mcc", "area": "gram", "pattern": "prepositions/cause-verbs", "topic": "prepositions", "lex": ["attribute sth to sth"], "level": "C1", "dom": "biz", "src": "seed",
    "text": "The delay was largely ___ to a shortage of qualified staff.",
    "options": [
      {"w": "blamed", "tag": "partner", "why": {"de": "blame braucht „on“: The delay was blamed on a shortage …", "en": "blame takes \"on\": The delay was blamed on a shortage …"}},
      {"w": "caused", "tag": "grammar", "why": {"de": "Im Passiv folgt „by“: was caused by, nicht „to“.", "en": "The passive takes \"by\": was caused by, not \"to\"."}},
      {"w": "attributed", "why": {"de": "attribute sth to sth = etwas auf etwas zurückführen; passt zu „to“.", "en": "attribute sth to sth = say sth is caused by sth; it fits \"to\"."}},
      {"w": "resulted", "tag": "grammar", "why": {"de": "result hat kein Passiv: The delay resulted from a shortage …", "en": "result has no passive: The delay resulted from a shortage …"}}
    ],
    "answer": 2,
    "why": {"de": "Bei Ursachen entscheidet die Präposition: attributed to · blamed on · caused by · resulted from.", "en": "With causes, the preposition decides: attributed to · blamed on · caused by · resulted from."}
  },
  {
    "id": "mcc-0002", "kind": "mcc", "area": "lex", "pattern": "lex/fixed-phrases-hope", "lex": ["give up hope"], "level": "B2+", "dom": "biz", "src": "seed",
    "text": "We lost the tender, but nobody is ready to ___ up hope just yet.",
    "options": [
      {"w": "take", "tag": "meaning", "why": {"de": "take up = mit etwas anfangen (take up a hobby).", "en": "take up = start something (take up a hobby)."}},
      {"w": "give", "why": {"de": "give up hope = die Hoffnung aufgeben (feste Wendung).", "en": "give up hope = stop hoping (fixed phrase)."}},
      {"w": "let", "tag": "meaning", "why": {"de": "let up = nachlassen; ohne Objekt (The rain let up).", "en": "let up = become weaker; no object (The rain let up)."}},
      {"w": "put", "tag": "meaning", "why": {"de": "put up = aufhängen, aufbauen; put up with = ertragen.", "en": "put up = hang or build; put up with = tolerate."}}
    ],
    "answer": 1,
    "why": {"de": "Teilchen „up“ allein sagt wenig; erst das Verb macht die Bedeutung. Lern die ganze Wendung: give up hope.", "en": "The particle \"up\" says little on its own; the verb carries the meaning. Learn the whole phrase: give up hope."}
  },
  {
    "id": "mcc-0003", "kind": "mcc", "area": "gram", "pattern": "comparison/intensify-comparative", "topic": "comparison", "level": "B2+", "dom": "biz", "src": "seed",
    "text": "Our sales figures for Q3 are ___ better than we expected.",
    "options": [
      {"w": "highly", "tag": "partner", "why": {"de": "highly steht vor Grundformen (highly effective), nie vor „better“.", "en": "highly goes with base adjectives (highly effective), never with \"better\"."}},
      {"w": "strongly", "tag": "calque", "why": {"de": "„stark besser“ ist Deutsch gedacht; strongly passt zu Verben (strongly recommend).", "en": "\"Strongly better\" is a German pattern; strongly goes with verbs (strongly recommend)."}},
      {"w": "heavily", "tag": "partner", "why": {"de": "heavily passt zu Menge oder Last (heavily invested), nicht zu Vergleichen.", "en": "heavily goes with amount or weight (heavily invested), not comparisons."}},
      {"w": "considerably", "why": {"de": "Vor einem Komparativ: much, far, considerably, significantly.", "en": "Before a comparative: much, far, considerably, significantly."}}
    ],
    "answer": 3,
    "why": {"de": "Komparative werden mit much/far/considerably verstärkt, nicht mit very oder strongly.", "en": "Comparatives are intensified with much/far/considerably, not very or strongly."}
  }
]
```

**Aufwand M.** **Abnahme:** (1) Unit: alle Inhalte schemagültig, je Option Begründung DE+EN, Lösung je Position 20–30 %; (2) E2E 390 × 844 px: Antippen beantwortet, Lücke gefüllt, alle vier Begründungen sichtbar, „Weiter“ nicht automatisch vor 4 s; (3) Laptop: Ziffern 1–4 wählen, Enter geht weiter.

### 3.2 `ocl` Offene Lücke (Funktionswörter)

**Zweck.** Cambridge Teil 2: ein einzelnes Wort, grammatisch (Artikel, Hilfsverben, Präpositionen, Pronomen) oder lexiko-grammatisch (Linker, Wörter in festen Wendungen); Rechtschreibung muss stimmen (Quelle 2.1). Für Emrah: Abruf statt Wiedererkennen, und die kleinen Wörter verraten Deutsche (Inversion, *whose*, *the … the*).

**Handy**
1. Kopf, Status (Art „Offene Lücke“).
2. Aufgabenzeile: „Ein Wort fehlt. Schreib es in die Lücke.“; in der Lernphase dazu „Gesucht: ein Hilfsverb“ (aus `cls`).
3. Satz mit `KineticGap`, Tastatur öffnet sich, der Satz bleibt sichtbar (`visualViewport`), `autoCorrect`/`autoCapitalize` aus.
4. Aktionsleiste: „Prüfen“; daneben „Tipp“ und „Weiß ich nicht“.
5. Rückmeldung: Lücke grün oder rot, Ergebnis-Karte.

**Laptop.** Gleich, Regel-Panel rechts; Textmodus wie 3.1.

**Bewertung.** Exakt gegen `accept` (mehrere Lösungen erlaubt), Groß-/Kleinschreibung egal. Tippfehler: Budget 0 bis 4 Buchstaben (`phraseTypoBudget`, `src/domain/nbdrill/check.ts:29`), darüber 1 → „fast“ (Note 2, BKT falsch, wie Cambridge: falsch geschrieben zählt nicht). Note `ocl`, Gewicht 1,0; nach H2 (Chips) Gewicht 0,8 und Note ≤ 2.

**Rückmeldung.** Muster-Formel mit eingesetztem Wort („Hardly + **had** + Subjekt + 3. Form … when“); bei einer Antwort aus den `chips`: warum sie hier nicht passt (Wortklasse oder Bedeutung).

**Inhaltsformat**
```ts
type FnClass = 'art' | 'aux' | 'prep' | 'pron' | 'rel' | 'conj' | 'det' | 'adv' | 'part';
type Ocl = C1Base & { kind: 'ocl'; text: string; accept: string[]; cls: FnClass; chips: [string, string, string] };
const ocl = c1Base.extend({
  kind: z.literal('ocl'), text: oneGap,
  accept: z.array(z.string().regex(/^[A-Za-z']+$/)).min(1),
  cls: z.enum(['art', 'aux', 'prep', 'pron', 'rel', 'conj', 'det', 'adv', 'part']),
  chips: z.array(z.string().regex(/^[A-Za-z']+$/)).length(3),
});
```

**Herkunft und Menge.** Bauzeit **300**, 24 für die Probe. Ernte: **49** der 178 Lücken-Aufgaben in `grammar-bank.json`, `toolkit.json`, `legacy/grammar.json` und `grammar-extra.json` haben ein einzelnes Funktionswort als Lösung (gezählt am 06.10.); sie bekommen `cls` und `chips`. Laufzeit: **ja**, `acceptOcl`: Lösung ein Wort aus der Funktionswort-Liste der Klasse, Chips aus derselben Klasse und nicht in `accept`, Satz 8–30 Wörter, Sprache und US-Schreibung wie 3.1.

**Beispiele**
```json
[
  {
    "id": "ocl-0001", "kind": "ocl", "area": "gram", "pattern": "c1-emphasis/negative-inversion", "topic": "c1-emphasis", "level": "C1", "dom": "biz", "src": "seed",
    "text": "Hardly ___ we signed the contract when the client asked for changes.",
    "accept": ["had"],
    "cls": "aux",
    "chips": ["did", "have", "were"],
    "why": {"de": "Hardly … when: Vorzeitigkeit, also Past Perfect, und nach „Hardly“ steht das Hilfsverb vor dem Subjekt.", "en": "Hardly … when shows the earlier event, so past perfect, and after \"Hardly\" the auxiliary comes before the subject."}
  },
  {
    "id": "ocl-0002", "kind": "ocl", "area": "gram", "pattern": "comparison/the-more-the-more", "topic": "comparison", "level": "B2+", "dom": "biz", "src": "seed",
    "text": "The more data we collect, ___ harder it becomes to see what really matters.",
    "accept": ["the"],
    "cls": "art",
    "chips": ["more", "so", "much"],
    "why": {"de": "Je … desto: the + Komparativ in beiden Satzhälften.", "en": "The more … the more: the + comparative in both halves."}
  },
  {
    "id": "ocl-0003", "kind": "ocl", "area": "gram", "pattern": "relative/whose", "topic": "relative", "level": "B2", "dom": "biz", "src": "seed",
    "text": "The supplier, ___ contract expires in May, has just raised its prices.",
    "accept": ["whose"],
    "cls": "rel",
    "chips": ["which", "that", "who's"],
    "why": {"de": "Besitz im Relativsatz: whose (dessen/deren). who's = who is.", "en": "Possession in a relative clause: whose. who's = who is."}
  }
]
```

**Aufwand S–M** (Lücke vorhanden). **Abnahme:** Unit: jede Lösung in `accept` ergibt 1/1, jeder Chip 0; Tippfehler in Wörtern ≤ 4 Buchstaben ist falsch; E2E Handy: Tastatur verdeckt den Satz nicht (Bildlauf-Messung wie Invariante 11, `03-lernmodell.md:105`).

### 3.3 `wf` Wortbildung mit Stamm

**Zweck.** Cambridge Teil 3 prüft Vorsilben, Nachsilben, innere Änderungen und Zusammensetzungen (Quelle 2.1). Auch fortgeschrittene Lerner kennen oft nur einen Teil der Wortfamilie; in der Studie mit 106 fortgeschrittenen Lernenden wurden Verben am sichersten gebildet, Adverbien am schlechtesten ([Schmitt & Zimmerman 2002, TESOL Quarterly 36/2](https://www.norbertschmitt.co.uk/articles)). Schwerpunkt deshalb: Adjektive, Adverbien, Verneinungen, Nomen auf -ity/-ance/-ment.

**Handy**
1. Kopf, Status (Art „Wortbildung“).
2. Aufgabenzeile: „Bilde aus dem Stamm das passende Wort.“
3. Stamm-Chip in Großbuchstaben, golden, über dem Satz (bei Cambridge steht er am Zeilenende; am Handy ist oben lesbarer).
4. Satz mit `KineticGap` (ein Wort, Tastatur ohne Autokorrektur).
5. „Prüfen“ · „Tipp“ · „Weiß ich nicht“.
6. Rückmeldung: **Zerlegung** `MorphSplit` (*un · precedent · ed*), darunter die Wortfamilie als Zeile, jedes Wort antippbar; Ergebnis-Karte.

**Laptop.** Gleich; nach der Antwort zeigt das Panel die Familie als Tabelle (Nomen · Verb · Adjektiv · Adverb · Gegenteil); Textmodus wie 3.1.

**Bewertung.** Exakt gegen `accept`, britische Schreibweise gilt als richtig mit US-Hinweis (A7.3, `toUS`). Zusatzprüfung **Familie:** steht die Antwort in `family`, ist aber nicht gesucht → falsch mit Grund „richtige Familie, falsche Wortart (gesucht: Adverb)“ (`reason: 'family'`). Tippfehler nur im Stamm und im Budget → „fast“; ein falsches Affix (*inprecedented*) ist immer falsch („Form“), wie `otherForm` in `check.ts`. Note `wf`, Gewicht 1,0. Bereich `lex`: Buchung in `out/<Monat>`, Fehler in `app/repair` mit `cid`.

**Rückmeldung.** Zerlegung, Regel des Affixes („-ible/-able → -ibility/-ability“), Familie, Beispiel; bei `reason: 'family'` die gegebene und die gesuchte Form nebeneinander mit Wortart.

**Inhaltsformat**
```ts
type Wf = C1Base & { kind: 'wf'; text: string; stem: string; accept: string[];
  pos: 'noun' | 'verb' | 'adj' | 'adv'; parts: { pre?: string; base: string; suf?: string[]; change?: string }; family: string[] };
const wf = c1Base.extend({
  kind: z.literal('wf'), text: oneGap, stem: z.string().regex(/^[A-Z-]+$/),
  accept: z.array(t).min(1), pos: z.enum(['noun', 'verb', 'adj', 'adv']),
  parts: z.object({ pre: t.optional(), base: t, suf: z.array(t).optional(), change: t.optional() }),
  family: z.array(t).min(2),
});
```

**Herkunft und Menge.** Bauzeit **250**, 24 für die Probe. Ernte: **20** aus `src/content/nb/extras.json` (`wordFormation`; `base` → `stem`, `gap` → `text`, `answers` → `accept`, `parts` von Hand). Laufzeit: **ja**, `acceptWf`: Lösung ≠ Stamm, Lösung enthält den Stamm oder seine bekannte Wurzel (gemeinsamer Anfang ≥ 60 % des Stamms, sonst nur mit `change`), Lösung steht in `family` **und** im Wörterbuch oder Atlas (verhindert erfundene Wörter wie *unprecedentness*), `pos` passt zur Wörterbuch-Wortart.

**Beispiele**
```json
[
  {
    "id": "wf-0001", "kind": "wf", "area": "lex", "pattern": "wordform/adverb-before-adjective", "lex": ["overwhelming"], "level": "C1", "dom": "biz", "src": "seed",
    "text": "The response to our new pricing model has been ___ positive.",
    "stem": "OVERWHELM",
    "accept": ["overwhelmingly"],
    "pos": "adv",
    "parts": {"base": "overwhelm", "suf": ["ing", "ly"]},
    "family": ["overwhelm", "overwhelmed", "overwhelming", "overwhelmingly"],
    "why": {"de": "Vor einem Adjektiv (positive) steht ein Adverb: overwhelm → overwhelming → overwhelmingly.", "en": "An adverb comes before an adjective (positive): overwhelm → overwhelming → overwhelmingly."}
  },
  {
    "id": "wf-0002", "kind": "wf", "area": "lex", "pattern": "wordform/negative-prefix", "lex": ["unprecedented"], "level": "C1", "dom": "biz", "src": "seed",
    "text": "Due to ___ demand, we will repeat the webinar next week.",
    "stem": "PRECEDENT",
    "accept": ["unprecedented"],
    "pos": "adj",
    "parts": {"pre": "un", "base": "precedent", "suf": ["ed"]},
    "family": ["precede", "precedent", "preceding", "unprecedented"],
    "why": {"de": "Vor dem Nomen „demand“ steht ein Adjektiv; un- + precedent + -ed = noch nie dagewesen.", "en": "An adjective comes before the noun \"demand\"; un- + precedent + -ed = never seen before."}
  },
  {
    "id": "wf-0003", "kind": "wf", "area": "lex", "pattern": "wordform/able-ability", "lex": ["feasibility"], "level": "C1", "dom": "biz", "src": "seed",
    "text": "The board has asked for a study on the ___ of the new pricing model.",
    "stem": "FEASIBLE",
    "accept": ["feasibility"],
    "pos": "noun",
    "parts": {"base": "feasible", "suf": ["ity"], "change": "ble → bil"},
    "family": ["feasible", "feasibly", "feasibility", "unfeasible"],
    "why": {"de": "Nach „the … of“ steht ein Nomen; aus -ible/-able wird -ibility/-ability.", "en": "A noun follows \"the … of\"; -ible/-able becomes -ibility/-ability."}
  }
]
```

**Aufwand M** (`MorphSplit` neu). **Abnahme:** Unit: jede Lösung 1/1, jedes andere Familienmitglied 0 mit `reason: 'family'`; britische Variante richtig mit `us`; E2E: Zerlegung erscheint nach dem Prüfen, bei reduzierter Bewegung ohne Animation.

### 3.4 `kwt` Schlüsselwort-Umformung mit Teilpunkten

**Zweck.** Cambridge Teil 4: Satz A, ein Schlüsselwort, Satz B mit Lücke; 3–6 Wörter, Schlüsselwort unverändert; geprüft werden Grammatik, Wortschatz und Kollokation; bis 2 Punkte je Aufgabe (Quelle 2.1). Die Antwort wird in zwei Teile zerlegt, je ein Punkt **(Gedächtnis: Konvention der Cambridge-Lösungsschlüssel, im Handbuch-Schlüssel nachprüfen)**. Für Emrah ist das genau das C1-Kriterium „dieselbe Aussage auf mindestens zwei Wegen sagen“ (`docs/umbau/02-lehrplan.md:7`).

**Handy (Bausteine, kein Tippen)**
1. Kopf, Status (Art „Umformung“).
2. Aufgabenzeile: „Gleiche Bedeutung, 3–6 Wörter, mit **SAID**. Leg die Bausteine in die Lücke.“
3. Satz A, gedämpft, antippbar.
4. Schlüsselwort-Chip **SAID** (gold, groß).
5. Satz B: Anfang · Antwortzeile · Ende. Die Antwortzeile **wächst** mit (kein fester Platz je Wort; `Tiles` mit `slots = placed.length + 1`, sonst verrät die Platzzahl die Länge, `Tiles.tsx:39`). Darunter `WordCounter`: „3–6 Wörter · jetzt 0“.
6. Vorrat: Bausteine aus `tiles`, `extra` und dem Schlüsselwort (golden umrandet), 6–9 Stück. Tippen legt ans Ende, Ziehen sortiert um (vorhanden).
7. „Prüfen“ wird erst aktiv, wenn 3–6 Wörter liegen und das Schlüsselwort dabei ist (nichts springt unter dem Finger, Fehler vom 04.10., CLAUDE.md A7).
8. Rückmeldung: `PartBar` mit zwei Segmenten, ganzer Satz B mit Vergleich, Muster-Karte.

**Laptop (Tippen)**
1–4 wie Handy; 5. Satz B mit `KineticGap` für mehrere Wörter (Leerzeichen erlaubt), `WordCounter` live; das Schlüsselwort leuchtet grün, sobald es **unverändert** getippt ist (strenger als `hasKeyword`, `src/domain/nbdrill/check.ts:61-68`, das gebeugte Formen zulässt); 6. Enter prüft; Regel-Panel rechts.

**Bewertung (rein, `scoreKwt`)**
```
n = kwtNorm(eingabe)          // wie normText, aber: 'd + 3. Form = had, 'd + Grundform = would; 's + been/got = has
wenn Schlüsselwort nicht unverändert enthalten  → 0/2, reason 'key'
wenn Wortzahl < 3 oder > 6                       → 0/2, reason 'length'   (Gedächtnis: Cambridge vergibt dann 0)
für jede Lösungsvariante k in keys:
  punkte = (n beginnt mit einem k.a ? 1 : 0) + (n endet mit einem k.b ? 1 : 0)
  wenn n == a + ' ' + b für ein Paar → 2
ergebnis = höchste Punktzahl über alle k; passt n zu einem trap → reason 'trap' mit dessen Begründung
```
- **Varianten mit Abhängigkeit:** Teile hängen oft zusammen (*had not been so high* gegen *had been lower*). Deshalb ist `keys` eine Liste ganzer Varianten mit je Teil A und Teil B; gewertet wird die beste Variante, nie A aus der einen und B aus der anderen.
- **Wortzählung:** nach `kwtNorm`; Kurzformen zählen wie ausgeschrieben (*I'd* = 2), *supplier's* zählt als 1 Wort **(Gedächtnis: Cambridge zählt Kurzformen als zwei Wörter, Ausnahme *can't*; prüfen)**. Hinweis an `normText` (`src/domain/text/normText.ts:10`, `:13`): seine Auflösung von `'d` und `'s` ist für KWT falsch, deshalb eigene Funktion statt Änderung dort.
- **Note:** `kwt` (getippt, Gewicht 1,0) bzw. `kwt_tiles` (Bausteine, nie „Leicht“, Gewicht 0,8). 1 von 2 = „fast“ (Note 2, BKT falsch, Fehlersatz).

**Rückmeldung.** Teil-Balken („Teil 1 ✓ *wish I* · Teil 2 ✕ *would have checked*“), bei `trap` die typische deutsche Begründung, Muster-Karte, Zeile „So zählt Cambridge: 3–6 Wörter, Schlüsselwort unverändert“.

**Inhaltsformat**
```ts
type KwtKey = { a: string[]; b: string[] };             // Teil A, Teil B (je 1 Punkt)
type Kwt = C1Base & { kind: 'kwt'; lead: string; key: string; before: string; after: string;
  keys: KwtKey[]; tiles: string[]; extra: string[]; traps?: Array<{ text: string; why: Bi }> };
const kwt = c1Base.extend({
  kind: z.literal('kwt'), lead: t, key: z.string().regex(/^[A-Z']+$/), before: z.string(), after: t,
  keys: z.array(z.object({ a: z.array(t).min(1), b: z.array(t).min(1) })).min(1),
  tiles: z.array(t).min(1), extra: z.array(t).min(2).max(4),
  traps: z.array(z.object({ text: t, why: bi })).optional(),
});
// checkC1Content: keys[0].a[0] + keys[0].b[0] hat 3–6 Wörter, enthält key; tiles ∪ {key} = Wörter dieser Lösung;
// extra ∩ Lösung = ∅; key kommt in lead nicht vor; jede trap ergibt < 2 Punkte.
```

**Herkunft und Menge.** Bauzeit **150** (Auftrag), 18 für die Probe. Ernte: **30** aus `src/content/nb/transforms.json` (`a` → `lead`, `gap` → `before`/`after`, `answers` → `keys` von Hand in Teile zerlegt; dort sind 2–6 Wörter erlaubt, nach Cambridge 3–6 nachprüfen). Laufzeit: **ja, strenger** (`acceptKwt`): alle Regeln aus `checkC1Content`; Satz A und B je 6–25 Wörter; Satz B ≠ Satz A; Lösung nicht wörtlich in Satz A; jede Variante ≤ 6 Wörter; mindestens ein `trap`; US-Schreibung; Begründung DE und EN.

**Beispiele**
```json
[
  {
    "id": "kwt-0001", "kind": "kwt", "area": "gram", "pattern": "passive-plus/said-to-be", "topic": "passive-plus", "level": "C1", "dom": "biz", "src": "seed",
    "lead": "People say the company is planning to move its headquarters.",
    "key": "SAID",
    "before": "The company",
    "after": "planning to move its headquarters.",
    "keys": [
      {"a": ["is said"], "b": ["to be"]}
    ],
    "tiles": ["is", "to", "be"],
    "extra": ["was", "being", "that"],
    "traps": [
      {"text": "is said that it is", "why": {"de": "„It is said that …“ braucht „It“ am Satzanfang. Nach „The company“ geht nur: is said to be.", "en": "\"It is said that …\" needs \"It\" at the start. After \"The company\" only \"is said to be\" works."}}
    ],
    "why": {"de": "Berichtspassiv: Subjekt + is said + to-Infinitiv; laufende Handlung: to be + -ing.", "en": "Reporting passive: subject + is said + to-infinitive; ongoing action: to be + -ing."}
  },
  {
    "id": "kwt-0002", "kind": "kwt", "area": "gram", "pattern": "mixed-cond/wish-past-perfect", "topic": "mixed-cond", "level": "B2+", "dom": "biz", "src": "seed",
    "lead": "I regret not checking the figures before the meeting.",
    "key": "WISH",
    "before": "I",
    "after": "the figures before the meeting.",
    "keys": [
      {"a": ["wish I"], "b": ["had checked", "'d checked"]}
    ],
    "tiles": ["I", "had", "checked"],
    "extra": ["would", "have", "did"],
    "traps": [
      {"text": "wish I would have checked", "why": {"de": "Deutsch „hätte … gemacht“ verleitet zu would have. Nach wish steht für die Vergangenheit had + 3. Form.", "en": "German \"hätte … gemacht\" suggests would have. After wish, the past takes had + past participle."}}
    ],
    "why": {"de": "Bedauern über die Vergangenheit: wish + Past Perfect.", "en": "Regret about the past: wish + past perfect."}
  },
  {
    "id": "kwt-0003", "kind": "kwt", "area": "gram", "pattern": "c1-nominal/failure-to", "topic": "c1-nominal", "level": "C1", "dom": "biz", "src": "seed",
    "lead": "The project was delayed because the supplier did not deliver on time.",
    "key": "FAILURE",
    "before": "The project was delayed",
    "after": "to deliver on time.",
    "keys": [
      {"a": ["due to", "owing to", "because of", "on account of"], "b": ["the supplier's failure"]}
    ],
    "tiles": ["due to", "the", "supplier's"],
    "extra": ["of", "because", "fail"],
    "traps": [
      {"text": "due to the failure of the supplier", "why": {"de": "Sieben Wörter: zu lang. Mit dem s-Genitiv passt es in 3–6 Wörter.", "en": "Seven words: too long. The possessive 's fits into 3–6 words."}}
    ],
    "why": {"de": "Nominalstil: did not deliver → failure to deliver; der Grund steht nach due to/owing to.", "en": "Nominal style: did not deliver → failure to deliver; the reason follows due to/owing to."}
  }
]
```

**Aufwand L.** **Abnahme:** (1) Eigenschaftstest über alle Inhalte: jede Variante 2/2; nur Teil A 1/2; nur Teil B 1/2; 7 Wörter 0 mit `length`; Schlüsselwort verändert (*SAYS* statt *SAID*) 0 mit `key`; „wish I'd checked“ 2/2; jede `trap` < 2; (2) E2E Handy: Aufgabe ohne Bildschirmtastatur lösbar, „Prüfen“ erst bei 3–6 Wörtern mit Schlüsselwort aktiv, Platzzahl verrät die Länge nicht; (3) Laptop: Wortzähler und grünes Schlüsselwort live.

### 3.5 `err` Fehler finden (auch fehlerfreie Sätze)

**Zweck.** C1-Kriterium „eigene Fehler finden (≥ 80 %)“ und neue Form „Fehler finden“ im Lehrplan (`docs/umbau/02-lehrplan.md:7`, `:114`). **25–35 % der Sätze sind fehlerfrei.** Sonst lernt man die Strategie „irgendwo ist immer ein Fehler“, und die App misst Raten statt Urteil. Gemessen werden Treffer **und** Fehlalarme.

**Handy**
1. Kopf, Status (Art „Fehler finden“).
2. Aufgabenzeile: „Steckt ein Fehler im Satz? Tipp auf das falsche Wort – oder auf ‚Kein Fehler‘.“
3. Satz groß, jedes Wort ein Knopf mit ≥ 44 px Trefferhöhe (größerer Zeilenabstand), `TapSentence`. Nachschlagen per Antippen ist während der Frage aus (Antippen = Antwort), nach dem Prüfen wieder an.
4. Knopf „Kein Fehler“ (volle Breite, zweitrangig).
5. Nach dem Antippen hebt sich das Wort an; darunter `ChipRow` mit drei Korrekturen (gemischt) und „Doch nicht“.
6. Ein Chip = Prüfen. Rückmeldung: Satz mit deinem Tipp und der echten Stelle, Korrektur gleitet hinein, Ergebnis-Karte.

**Laptop.** Wort anklicken oder mit ←/→ wandern und Leertaste; die Spanne wird zur Lücke (`KineticGap`, vorbefüllt mit dem falschen Text), Korrektur tippen, Enter. Taste N = „Kein Fehler“.

**Bewertung (2 Punkte).** Fundort: angetipptes Wort liegt in der Spanne `bad.span` (1). Korrektur: eingesetzte Spanne entspricht einer Fassung in `bad.fix` (normalisiert, britisch gilt) (1). Fehlerfreier Satz: „Kein Fehler“ = 2/2, jedes angetippte Wort = 0 (`reason: 'falseAlarm'`). Fehlerhafter Satz und „Kein Fehler“ = 0 (`reason: 'missed'`). Note `err_tap` (Handy) bzw. `err_fix` (Laptop). **Messwerte je Muster:** Trefferquote und Fehlalarmquote (Grundlage für „+F Fehler finden ≥ 80 %“, `02-lehrplan.md:48`).

**Rückmeldung.** Bei Fehlalarm ausführlich: „Der Satz war richtig. Warum er falsch aussieht: …“ (sicher geglaubte Fehler werden nach Rückmeldung besonders gut korrigiert, 2.7). Sonst Muster-Karte und Verweis auf die Deutsch-Falle (`trap`).

**Inhaltsformat**
```ts
type ErrBad = { span: string; nth?: number; fix: string[]; choices: [string, string, string] };
type Err = C1Base & { kind: 'err'; text: string; bad: ErrBad | null };
const err = c1Base.extend({
  kind: z.literal('err'), text: t,
  bad: z.object({ span: t, nth: z.number().int().min(1).optional(), fix: z.array(t).min(1), choices: z.array(t).length(3) }).nullable(),
});
// checkC1Content: span kommt (nth-mal) im Satz vor; fix[0] ∈ choices; genau ein choice ∈ fix; Satz mit fix[0] ≠ Satz.
```

**Herkunft und Menge.** Bauzeit **300**, davon ≥ 75 fehlerfrei. Ernte: 75 Drills der Deutsch-Fallen (`src/content/nb/traps.ts`, je 3 `drills` mit `wrong`/`right`, Schema `schemas.ts:26-37`) und 71 Regel-Fallen (`bad`/`good` in `rules.json` 32 + `toolkit.json` 39). Die Spanne entsteht automatisch aus dem Wortvergleich (`alignWords`), nur Fälle mit **einer** zusammenhängenden Abweichung. Die richtige Fassung derselben Falle ist ein natürlicher **fehlerfreier** Satz; beide Fassungen nie in derselben Runde oder am selben Tag. Laufzeit: **ja** (`acceptErr`): Regeln aus `checkC1Content`, Satz 6–25 Wörter, je Anfrage von 6 Sätzen mindestens 2 fehlerfrei, Begründung DE und EN.

**Beispiele**
```json
[
  {
    "id": "err-0001", "kind": "err", "area": "gram", "pattern": "gerund-inf/preposition-ing", "topic": "gerund-inf", "trap": "f17", "level": "B2", "dom": "biz", "src": "seed",
    "text": "I'm really looking forward to hear from you.",
    "bad": {"span": "hear", "fix": ["hearing"], "choices": ["hearing", "heard", "have heard"]},
    "why": {"de": "„to“ ist hier eine Präposition (look forward to sth); danach steht -ing.", "en": "Here \"to\" is a preposition (look forward to sth), so -ing follows."}
  },
  {
    "id": "err-0002", "kind": "err", "area": "gram", "pattern": "questions/indirect-no-do", "topic": "questions", "trap": "f20", "level": "B2", "dom": "biz", "src": "seed",
    "text": "The client asked me where do we store the backups.",
    "bad": {"span": "do we store", "fix": ["we store", "we stored"], "choices": ["we store", "did we store", "are we storing"]},
    "why": {"de": "Indirekte Frage: kein do, Wortstellung wie im Aussagesatz (where we store).", "en": "Indirect question: no do, statement word order (where we store)."}
  },
  {
    "id": "err-0003", "kind": "err", "area": "gram", "pattern": "cond-alt/inversion-had", "topic": "cond-alt", "level": "C1", "dom": "biz", "src": "seed",
    "text": "Had we known about the outage, we would have informed our customers.",
    "bad": null,
    "why": {"de": "Kein Fehler: „Had we known …“ ist die förmliche Inversion von „If we had known …“.", "en": "No mistake: \"Had we known …\" is the formal inversion of \"If we had known …\"."}
  }
]
```

**Aufwand L** (`TapSentence` neu). **Abnahme:** Unit: Fundort + Korrektur 2/2, nur Fundort 1/2, Fehlalarm 0, übersehen 0; Anteil fehlerfreier Sätze im Bestand 25–35 %; E2E Handy: jedes Wort einzeln treffbar (Trefferfläche ≥ 44 px gemessen), Nachschlagen während der Frage aus, danach an.

### 3.6 `pair` Bedeutungspaare

**Zweck.** Formen, die das Deutsche mit einer Form ausdrückt, das Englische aber trennt: *stop to / stop -ing*, *remember to / -ing*, *mustn't / don't have to*, *used to / be used to*, *since / for*, *still / yet*, *make / let / have sb do*. Kontrast mit der Muttersprache und Übersetzung als formfokussierter Unterricht wirkte im Wortschatz besser als bloßes Üben im Text ([Laufer & Girsai 2008, Applied Linguistics 29/4](https://appliedlinguistics.ucsb.edu/sites/secure.lsit.ucsb.edu.germ.d7_al/files/sitefiles/events/event_22_1.pdf); die Methodik ist umstritten, siehe Quelle). Ein Paar zwingt zum Unterscheiden statt zum Wiedererkennen.

**Handy**
1. Kopf, Status (Art „Bedeutungspaar“).
2. Aufgabenzeile: „Zwei ähnliche Sätze – was bedeutet welcher? Verbinde jeden Satz mit seiner Bedeutung.“
3. Satz-Karte A und Satz-Karte B, die Stelle mit dem Unterschied ist dezent unterstrichen.
4. Drei Bedeutungs-Karten in der Oberflächensprache (eine ist Ablenker).
5. Satz antippen, dann Bedeutung antippen: eine Linie verbindet beide (`LinkPairs`). Erneutes Antippen löst die Verbindung. Nach der zweiten Verbindung wird geprüft.
6. Rückmeldung: Kontrast-Tafel mit beiden Formeln und Mini-Zeitstrahl, Ergebnis-Karte.

**Laptop.** Gleich (Tasten: 1/2 für Satz, A/B/C für Bedeutung), danach **Transfer**: „Jetzt du:“ ein dritter Satz mit Lücke und Stichwort (`transfer`), 1–3 Wörter tippen. Höchstpunktzahl Handy 2, Laptop 3.

**Bewertung.** Je richtige Verbindung 1 Punkt, Transfer 1 Punkt (exakt gegen `accept`). Raten ergibt 2/2 mit Wahrscheinlichkeit 1/6, deshalb `nOptions = 6` für BKT. Note `pair` (Auswahl); Transfer zählt als getippte Teilantwort (Note des Ganzen bleibt Auswahl-Deckel ≤ 3).

**Rückmeldung.** Kontrast-Tafel: links Satz A + Bedeutung + Formel, rechts Satz B + Bedeutung + Formel; darunter der typische deutsche Fehler.

**Inhaltsformat**
```ts
type Pair = C1Base & { kind: 'pair'; a: string; b: string; means: [Bi, Bi, Bi]; // 0 = a, 1 = b, 2 = Ablenker
  transfer?: { text: string; cue: string; accept: string[] } };
const pair = c1Base.extend({
  kind: z.literal('pair'), a: t, b: t, means: z.array(bi).length(3),
  transfer: z.object({ text: oneGap, cue: t, accept: z.array(t).min(1) }).optional(),
});
```

**Herkunft und Menge.** Bauzeit **120** Paare, keine Ernte. Laufzeit: **nein**. Bedeutungsunterschiede sind subtil, eine formale Prüfung erkennt eine falsche Bedeutungs-Karte nicht; die Gefahr, etwas Falsches einzuprägen, ist größer als der Nutzen.

**Beispiele**
```json
[
  {
    "id": "pair-0001", "kind": "pair", "area": "gram", "pattern": "gerund-inf/stop-ing-vs-to", "topic": "gerund-inf", "level": "B2", "dom": "life", "src": "seed",
    "a": "On the way to the client, we stopped to get coffee.",
    "b": "We stopped getting coffee from that café last year.",
    "means": [
      {"de": "Wir haben unterwegs angehalten, um Kaffee zu holen.", "en": "We paused the trip in order to get coffee."},
      {"de": "Wir holen dort keinen Kaffee mehr.", "en": "We no longer get coffee there."},
      {"de": "Wir holen dort weiterhin Kaffee.", "en": "We still get coffee there."}
    ],
    "transfer": {"text": "Please stop ___ me reminders; I've already paid.", "cue": "send", "accept": ["sending"]},
    "why": {"de": "stop + to = anhalten, UM etwas zu tun · stop + -ing = mit etwas aufhören.", "en": "stop + to = pause in order to do sth · stop + -ing = no longer do sth."}
  },
  {
    "id": "pair-0002", "kind": "pair", "area": "gram", "pattern": "gerund-inf/remember-ing-vs-to", "topic": "gerund-inf", "level": "B2", "dom": "biz", "src": "seed",
    "a": "I remembered to send the contract.",
    "b": "I remember sending the contract.",
    "means": [
      {"de": "Ich habe daran gedacht und ihn dann geschickt.", "en": "I didn't forget, so I sent it."},
      {"de": "Ich erinnere mich, dass ich ihn geschickt habe.", "en": "I have a memory of sending it."},
      {"de": "Ich muss noch daran denken, ihn zu schicken.", "en": "I still have to remember to send it."}
    ],
    "transfer": {"text": "Did you remember ___ the office last night?", "cue": "lock", "accept": ["to lock"]},
    "why": {"de": "remember + to = an eine Aufgabe denken (danach) · remember + -ing = sich an Erlebtes erinnern (davor).", "en": "remember + to = not forget a task (it comes after) · remember + -ing = recall sth you did (it came before)."}
  },
  {
    "id": "pair-0003", "kind": "pair", "area": "gram", "pattern": "modals-advice/mustnt-vs-dont-have-to", "topic": "modals-advice", "level": "B2", "dom": "biz", "src": "seed",
    "a": "You mustn't share your login details.",
    "b": "You don't have to share your screen.",
    "means": [
      {"de": "Das ist verboten.", "en": "It is not allowed."},
      {"de": "Das ist nicht nötig.", "en": "It is not necessary."},
      {"de": "Das wird dringend empfohlen.", "en": "It is strongly recommended."}
    ],
    "transfer": {"text": "It's optional: you ___ attend the Friday call.", "cue": "not necessary", "accept": ["don't have to", "do not have to", "don't need to", "do not need to", "needn't"]},
    "why": {"de": "mustn't = verboten · don't have to = nicht nötig. Deutsch „muss nicht“ ist don't have to.", "en": "mustn't = not allowed · don't have to = not necessary. German \"muss nicht\" is don't have to."}
  }
]
```

**Aufwand M** (`LinkPairs` neu). **Abnahme:** Unit: beide Verbindungen richtig 2/2, eine 1/2, Ablenker gewählt 0 für diese Verbindung; E2E Handy: Verbinden nur mit Antippen (ohne Ziehen) möglich, Linien bei reduzierter Bewegung ohne Animation; Laptop: Transfer-Lücke nach dem Verbinden.

### 3.7 `cnet` Kollokations-Netz

**Zweck.** Wortpartner gehören zum C1-Kern; Deutsche übersetzen sie wörtlich (*hold a deadline*, *go a risk*, *make a meeting*), Beleg wie 3.1. Im Netz entscheidet Emrah über mehrere Partner auf einmal und sieht danach das ganze Feld eines Worts. Vorhanden sind 40 Netze mit 2–4 Verben und einer Lehnübersetzung (`src/content/nb/collocations.json`, Schema `schemas.ts:65-73`).

**Handy**
1. Kopf, Status (Art „Wortpartner“).
2. Aufgabenzeile: „Welche Verben passen zu **deadline**? Tippe alle passenden an.“
3. Das Wort als Kreis in der Mitte; darunter 6–8 Chips als Gitter in zwei Spalten (unter 400 px Breite), ab 400 px im Kreis um das Wort.
4. Angetippte Chips ziehen eine Linie zum Wort; erneutes Antippen nimmt sie zurück.
5. „Prüfen“ (aktiv ab einer Wahl).
6. Rückmeldung: richtige Kanten grün, jede mit Beispielsatz beim Antippen; falsch gewählte reißen ab und zeigen den Grund; übersehene erscheinen gestrichelt in Gold; „Als Karte“ je richtiger Verbindung (z. B. *meet a deadline*).

**Laptop.** Netz im Kreis, Tasten 1–8 schalten Chips, Enter prüft; das Panel zeigt danach alle Beispielsätze untereinander.

**Bewertung.** Treffer h, Fehlgriffe f, richtige Partner R: Punkte = max(0, h − f), höchstens R. `correct` bei h = R und f = 0, `near` ab der Hälfte, sonst `wrong`. Einträge in `also` (z. B. *make the deadline*, US-umgangssprachlich) erscheinen nicht als Chip. Note `cnet` (Auswahl), Bereich `lex`. **Fehlerschleife:** jede gewählte Lehnübersetzung (`calque: true`) erzeugt einen `err`-Fehlersatz aus dem Beispielsatz des richtigen Partners („We worked all weekend to **hold** the deadline.“ → *meet*), ohne Claude.

**Rückmeldung.** Netz bleibt stehen; darunter die Muster-Zeile („Zu deadline gehören meet/miss/extend/set“) und je Fehlgriff die Kategorie.

**Inhaltsformat**
```ts
type Cnet = C1Base & { kind: 'cnet'; hub: string; slot: 'V+N' | 'Adj+N' | 'N+prep' | 'Adv+Adj';
  right: Array<{ w: string; de: string; ex: string }>; wrong: Array<{ w: string; why: Bi; calque?: boolean }>;
  also?: Array<{ w: string; note: Bi }> };
const cnet = c1Base.extend({
  kind: z.literal('cnet'), hub: t, slot: z.enum(['V+N', 'Adj+N', 'N+prep', 'Adv+Adj']),
  right: z.array(z.object({ w: t, de: t, ex: t })).min(3).max(4),
  wrong: z.array(z.object({ w: t, why: bi, calque: z.boolean().optional() })).min(3).max(4),
  also: z.array(z.object({ w: t, note: bi })).optional(),
});
// checkC1Content: jedes ex enthält hub und den Partner (auch gebeugt, lemmaCandidates); right ∩ wrong ∩ also = ∅.
```

**Herkunft und Menge.** Bauzeit **150** Netze (90 Verb + Nomen, 30 Adjektiv + Nomen, 30 Nomen + Präposition für das Thema `prep-noun`). Ernte: **40** (je ein Fehlgriff vorhanden, zwei weitere pro Netz ergänzen). Laufzeit: **nein**. Ob eine Verbindung üblich ist, kann eine formale Prüfung ohne Korpus nicht entscheiden; bei *make the deadline* liegt selbst ein Lehrer ohne Nachschlagen leicht falsch.

**Beispiele**
```json
[
  {
    "id": "cnet-0001", "kind": "cnet", "area": "lex", "pattern": "lex/deadline-verbs", "lex": ["deadline"], "level": "B2+", "dom": "biz", "src": "seed",
    "hub": "deadline",
    "slot": "V+N",
    "right": [
      {"w": "meet", "de": "einhalten", "ex": "We worked all weekend to meet the deadline."},
      {"w": "miss", "de": "verpassen", "ex": "If we miss the deadline, the bank will reject the application."},
      {"w": "extend", "de": "verlängern", "ex": "The client agreed to extend the deadline by a week."},
      {"w": "set", "de": "festlegen", "ex": "Let's set a realistic deadline for the first draft."}
    ],
    "wrong": [
      {"w": "hold", "calque": true, "why": {"de": "„Frist einhalten“ ist nicht hold: Man sagt meet a deadline.", "en": "German \"einhalten\" is not hold: you meet a deadline."}},
      {"w": "keep", "calque": true, "why": {"de": "keep a deadline ist eine Lehnübersetzung; üblich ist meet.", "en": "\"Keep a deadline\" is a translation from German; say meet."}},
      {"w": "fulfill", "why": {"de": "fulfill passt zu requirements oder obligations, nicht zu deadline.", "en": "fulfill goes with requirements or obligations, not deadlines."}}
    ],
    "also": [
      {"w": "make", "note": {"de": "make the deadline = es rechtzeitig schaffen (US, locker) – auch richtig, wird aber nicht abgefragt.", "en": "make the deadline = manage it in time (US, informal) – also correct, not tested here."}}
    ],
    "why": {"de": "Zu deadline gehören meet/miss/extend/set. „Einhalten“ ist hier meet.", "en": "deadline goes with meet/miss/extend/set. German \"einhalten\" is meet here."}
  },
  {
    "id": "cnet-0002", "kind": "cnet", "area": "lex", "pattern": "lex/risk-verbs", "lex": ["risk"], "level": "B2+", "dom": "biz", "src": "seed",
    "hub": "risk",
    "slot": "V+N",
    "right": [
      {"w": "take", "de": "eingehen", "ex": "We can't afford to take that risk right now."},
      {"w": "run", "de": "laufen (Gefahr laufen)", "ex": "Companies that skip updates run the risk of a breach."},
      {"w": "pose", "de": "darstellen", "ex": "Outdated software poses a serious risk to your data."},
      {"w": "reduce", "de": "verringern", "ex": "Two-factor login reduces the risk of a breach."}
    ],
    "wrong": [
      {"w": "go", "calque": true, "why": {"de": "„ein Risiko eingehen“ ist take a risk, nicht go.", "en": "German \"eingehen\" is take here, not go."}},
      {"w": "make", "why": {"de": "make a risk gibt es nicht; ein Risiko schafft man mit create oder pose.", "en": "\"Make a risk\" doesn't exist; use create or pose."}},
      {"w": "do", "why": {"de": "do passt nicht zu risk.", "en": "do does not go with risk."}},
      {"w": "hold", "why": {"de": "hold a risk ist kein Englisch; gemeint ist meist carry oder pose.", "en": "\"Hold a risk\" is not English; you probably mean carry or pose."}}
    ],
    "also": [
      {"w": "carry", "note": {"de": "carry a risk = ein Risiko mit sich bringen – auch richtig.", "en": "carry a risk = involve a risk – also correct."}}
    ],
    "why": {"de": "take/run = selbst eingehen · pose = für andere darstellen · reduce = verringern.", "en": "take/run = accept a risk yourself · pose = be a risk to others · reduce = make smaller."}
  },
  {
    "id": "cnet-0003", "kind": "cnet", "area": "lex", "pattern": "lex/meeting-verbs", "lex": ["meeting"], "trap": "f21", "level": "B2", "dom": "biz", "src": "seed",
    "hub": "meeting",
    "slot": "V+N",
    "right": [
      {"w": "hold", "de": "abhalten", "ex": "We hold a team meeting every Monday morning."},
      {"w": "chair", "de": "leiten", "ex": "Who's going to chair the meeting tomorrow?"},
      {"w": "schedule", "de": "ansetzen", "ex": "Can we schedule a meeting for Thursday afternoon?"},
      {"w": "attend", "de": "teilnehmen an", "ex": "Twelve people attended the meeting in person."}
    ],
    "wrong": [
      {"w": "make", "calque": true, "why": {"de": "„ein Meeting machen“ ist nicht make a meeting; man hält es ab: hold.", "en": "German \"ein Meeting machen\" is hold a meeting, not make."}},
      {"w": "visit", "calque": true, "why": {"de": "„ein Meeting besuchen“ heißt attend a meeting.", "en": "German \"besuchen\" is attend here, not visit."}},
      {"w": "give", "why": {"de": "give a meeting gibt es nicht; give passt zu presentation oder talk.", "en": "\"Give a meeting\" doesn't exist; give goes with presentation or talk."}}
    ],
    "why": {"de": "Meeting-Verben: hold/chair/schedule/attend. Deutsch „machen/besuchen“ führt in die Irre.", "en": "Meeting verbs: hold/chair/schedule/attend. German \"machen/besuchen\" misleads."}
  }
]
```

**Aufwand L** (`RadialNet` neu, SVG). **Abnahme:** Unit: Punkte-Formel inkl. Fehlgriffe; jede Lehnübersetzung erzeugt genau einen Fehlersatz; E2E 360 px: Gitter ohne Querscrollen, alle Chips ≥ 44 px; 1280 px: Kreis.

### 3.8 `reg` Register umschreiben (neutral → formell, direkt → diplomatisch)

**Zweck.** Im Beruf entscheidet die Stilebene, ob ein Satz kompetent oder schroff wirkt; deutsche Direktheit ist Falle f25 (`src/content/nb/traps.ts:515`), Umformen mit Register steht im Lehrplan (`02-lehrplan.md:115`).

**Handy (Abschnitte tauschen)**
1. Kopf, Status (Art „Register“).
2. Situationszeile: „Antwort-Mail an einen neuen Großkunden · Ziel: formell“.
3. Satz mit 1–3 markierten, nummerierten Abschnitten.
4. Für den aktiven Abschnitt `ChipRow` mit 3 Chips; die Wahl schiebt das alte Stück heraus (`SegmentSwap`), dann ist der nächste Abschnitt dran.
5. „Prüfen“, sobald alle Abschnitte gewählt sind; Rückmeldung je Abschnitt ✓/✕ mit Grund, dazu 1–2 ganze Musterfassungen.

**Laptop (ganzer Satz).** Situation, Satz, darunter ein Feld mit dem Ausgangssatz vorbefüllt (bewährt bei Reparatur-Sätzen, CLAUDE.md A7 02.10.); Emrah schreibt um, Enter prüft.

**Bewertung.** Handy: je Abschnitt 1 Punkt (Chip ∈ `accept`). Laptop: je Abschnitt 1 Punkt, wenn eine `accept`-Fassung im Text steht **und** die alte Fassung nicht mehr; ganzer Satz in `answers` = volle Punkte. Sind alle Abschnitte erfüllt, der Satz aber nicht in `answers`: „nicht sicher prüfbar“ mit Knopf **„Claude prüfen lassen“** (`c1-judge@1`, `default`, nur auf Knopfdruck, nie automatisch wiederholt, A6.2/A6.3): Antwort `{ meaning: 'same' | 'changed', register: 'ok' | 'too_casual' | 'too_stiff', grammar: 'ok' | 'error', fix?: string, why: Bi }`, angezeigt als „Urteil von Claude · kann irren“. Ohne Claude: lokales Ergebnis plus „Ich lag richtig“. Note `reg_chips` bzw. `reg`.

**Inhaltsformat**
```ts
type RegSeg = { span: string; accept: string[]; choices: [string, string, string]; why: Bi };
type Reg = C1Base & { kind: 'reg'; ctx: Bi; from: 'casual' | 'neutral' | 'direct'; to: 'neutral' | 'formal' | 'diplomatic';
  text: string; segs: RegSeg[]; answers: string[] };
const reg = c1Base.extend({
  kind: z.literal('reg'), ctx: bi, from: z.enum(['casual', 'neutral', 'direct']), to: z.enum(['neutral', 'formal', 'diplomatic']),
  text: t, segs: z.array(z.object({ span: t, accept: z.array(t).min(1), choices: z.array(t).length(3), why: bi })).min(1).max(3),
  answers: z.array(t).min(1),
});
// checkC1Content: jede span steht im Text; genau ein choice je Abschnitt ∈ accept; jede answer erfüllt alle Abschnitte.
```

**Herkunft und Menge.** Bauzeit **200**. Ernte: **20** aus `extras.json` (`register`, Ein-Wort-Leiter locker/neutral/formell; als Abschnitt mit einem Wort übernehmbar). Laufzeit: **nein** für neue Aufgaben (Stilurteile sind formal nicht prüfbar); Claude nur als Urteil auf Knopfdruck am Laptop.

**Beispiele**
```json
[
  {
    "id": "reg-0001", "kind": "reg", "area": "gram", "pattern": "c1-diplomacy/formal-reply", "topic": "c1-diplomacy", "level": "C1", "dom": "biz", "src": "seed",
    "ctx": {"de": "Antwort-Mail an einen neuen Großkunden", "en": "Reply to a new key account"},
    "from": "casual",
    "to": "formal",
    "text": "We got your email and we'll get back to you soon.",
    "segs": [
      {"span": "got", "accept": ["have received", "received"], "choices": ["have received", "have gotten", "have taken"], "why": {"de": "have gotten ist US-korrekt, aber locker; formell: have received.", "en": "have gotten is correct US English but casual; formal: have received."}},
      {"span": "we'll get back to you soon", "accept": ["will respond shortly", "will reply shortly", "will be in touch shortly", "will get back to you shortly"], "choices": ["will respond shortly", "will get back at you soon", "will come back to you soon"], "why": {"de": "get back AT sb = sich rächen; come back to you ist eine Lehnübersetzung von „sich melden“.", "en": "get back AT sb = take revenge; come back to you is a translation of German \"sich melden\"."}}
    ],
    "answers": ["We have received your email and will respond shortly.", "We have received your email and will be in touch shortly.", "We received your email and will respond shortly."],
    "why": {"de": "Formell: vollständige Formen statt Kurzformen, received statt got, shortly statt soon.", "en": "Formal: full forms instead of contractions, received instead of got, shortly instead of soon."}
  },
  {
    "id": "reg-0002", "kind": "reg", "area": "gram", "pattern": "c1-hedging/below-budget", "topic": "c1-hedging", "level": "C1", "dom": "biz", "src": "seed",
    "ctx": {"de": "Verhandlung mit einem Lieferanten, den du behalten willst", "en": "Negotiation with a supplier you want to keep"},
    "from": "direct",
    "to": "diplomatic",
    "text": "Your offer is too expensive for us.",
    "segs": [
      {"span": "is too expensive for us", "accept": ["is slightly above our budget", "is a little above our budget", "might be a bit above our budget", "seems to be slightly above our budget"], "choices": ["is slightly above our budget", "is overpriced", "is not possible for us"], "why": {"de": "Diplomatisch: Problem auf das eigene Budget verlagern und abschwächen (slightly, a bit, might).", "en": "Diplomatic: move the problem to your own budget and soften it (slightly, a bit, might)."}}
    ],
    "answers": ["Your offer is slightly above our budget.", "Your offer might be a bit above our budget.", "Your offer is a little above our budget."],
    "why": {"de": "Englische Geschäftssprache schwächt Kritik ab; deutsche Direktheit wirkt schroff (f25).", "en": "Business English softens criticism; German directness sounds blunt (f25)."}
  },
  {
    "id": "reg-0003", "kind": "reg", "area": "gram", "pattern": "prepositions/discuss-no-about", "topic": "prepositions", "trap": "f15", "level": "B2+", "dom": "biz", "src": "seed",
    "ctx": {"de": "Mail an die Geschäftsführung", "en": "Email to senior management"},
    "from": "neutral",
    "to": "formal",
    "text": "We need to talk about the problems with the rollout.",
    "segs": [
      {"span": "talk about", "accept": ["discuss"], "choices": ["discuss", "discuss about", "speak over"], "why": {"de": "discuss hat ein direktes Objekt: discuss sth, nie discuss about.", "en": "discuss takes a direct object: discuss sth, never discuss about."}},
      {"span": "the problems with", "accept": ["the issues with", "the issues regarding", "the issues concerning", "the challenges with"], "choices": ["the issues regarding", "the problematics of", "the troubles with"], "why": {"de": "„Problematik“ ist nicht problematics; formell: issues regarding/concerning.", "en": "German \"Problematik\" is not problematics; formal: issues regarding/concerning."}}
    ],
    "answers": ["We need to discuss the issues regarding the rollout.", "We need to discuss the issues with the rollout.", "We need to discuss the issues concerning the rollout."],
    "why": {"de": "Formell: ein Verb statt Verb + Präposition (discuss) und neutralere Nomen (issues statt problems).", "en": "Formal: one verb instead of verb + preposition (discuss) and more neutral nouns (issues, not problems)."}
  }
]
```

**Aufwand L** (`SegmentSwap`, Urteils-Prompt mit Schema). **Abnahme:** Unit: jede `answer` volle Punkte, je Abschnitt Teilpunkte; Urteils-Prompt: Eingabe < 4 KB, Antwort per zod geprüft, Fehlercodes ohne Wiederholung; E2E Handy: Satz nach jeder Wahl lesbar, keine Verschiebung der Chips beim Antippen (Invariante 11).

### 3.9 `para` Satz-Paraphrase

**Zweck.** Bedeutung genau erhalten bei anderer Struktur (Nominalstil, Passiv, Inversion, Spaltsatz, Partizip, Verbmuster): C1-Kriterium „dieselbe Aussage auf ≥ 2 Wegen“ (`02-lehrplan.md:7`) und Bedeutungsgenauigkeit (Cambridge Teil 1 und 4). Am Handy wird daraus ein Bedeutungsvergleich, am Laptop eine echte Schreibaufgabe.

**Handy (Auswahl)**
1. Kopf, Status (Art „Gleiche Bedeutung“).
2. Aufgabenzeile: „Welcher Satz sagt genau dasselbe?“
3. Satz A.
4. Vier Satz-Karten (mehrzeilig, ≥ 56 px); Antippen = Antwort.
5. Rückmeldung je Karte (`optWhy`): *Ursache und Wirkung vertauscht*, *Zeitbezug falsch*, *neues Subjekt*, *grammatisch falsch*; dann Muster-Karte. Die Inhalte, die gleich geblieben sind, werden in Satz A und der richtigen Fassung gleich hervorgehoben.

**Laptop (Schreiben).** Satz A; darunter „Beginne mit: *The failure of* …“ als fester, nicht löschbarer Anfang im Feld; Emrah schreibt den Rest, Enter prüft. Danach Panel mit allen erlaubten Fassungen.

**Bewertung.** Handy: exakt (Index), Note `para_pick`. Laptop: 2 Punkte (Bedeutung, Form). Treffer in `answers` (normalisiert, britisch gilt) = 2/2. Sonst `closeVariant` (`src/domain/grammar/check.ts:134`): ähnlich → „nicht sicher prüfbar“ mit „Claude prüfen lassen“ (`c1-judge@1` wie 3.8, Felder `meaning` und `grammar` ergeben je 1 Punkt); nicht ähnlich → 0 mit Musterfassungen. Note `para`, Gewicht 1,1 (eigener Satz).

**Inhaltsformat**
```ts
type Para = C1Base & { kind: 'para'; focus: 'nominal' | 'passive' | 'cleft' | 'inversion' | 'participle' | 'verb-pattern' | 'reported';
  a: string; start: string; answers: string[]; options: [string, string, string, string]; answer: 0 | 1 | 2 | 3; optWhy: [Bi, Bi, Bi, Bi] };
const para = c1Base.extend({
  kind: z.literal('para'), focus: z.enum(['nominal', 'passive', 'cleft', 'inversion', 'participle', 'verb-pattern', 'reported']),
  a: t, start: t, answers: z.array(t).min(1), options: z.array(t).length(4),
  answer: z.number().int().min(0).max(3), optWhy: z.array(bi).length(4),
});
// checkC1Content: jede answer beginnt mit start; options[answer] ∈ answers; keine andere Option ∈ answers.
```

**Herkunft und Menge.** Bauzeit **150**. Ernte: keine direkte (die 51 `transform` in `toolkit.json` sind Teilumformungen; ein Teil taugt als Satz A). Laufzeit: **Stufe 2**, nur die Auswahl-Fassung, wenn die Ausschussquote der anderen Arten gemessen und unter 30 % liegt.

**Beispiele**
```json
[
  {
    "id": "para-0001", "kind": "para", "area": "gram", "pattern": "c1-nominal/cause-noun", "topic": "c1-nominal", "level": "C1", "dom": "biz", "src": "seed", "focus": "nominal",
    "a": "We postponed the launch because the tests had failed.",
    "start": "The failure of",
    "answers": ["The failure of the tests led to the postponement of the launch.", "The failure of the tests resulted in the postponement of the launch.", "The failure of the tests led to the launch being postponed.", "The failure of the tests forced us to postpone the launch.", "The failure of the tests made us postpone the launch."],
    "options": ["The failure of the tests was caused by the postponement of the launch.", "The failure of the tests led to the postponement of the launch.", "The failure of the tests happened despite the postponement of the launch.", "The failure of the tests will lead to the postponement of the launch."],
    "answer": 1,
    "optWhy": [
      {"de": "Ursache und Wirkung vertauscht.", "en": "Cause and effect are reversed."},
      {"de": "Gleiche Bedeutung: Grund → Folge, nur als Nomen.", "en": "Same meaning: cause → result, expressed with nouns."},
      {"de": "despite = trotz: Gegensatz statt Grund.", "en": "despite = contrast, not cause."},
      {"de": "will = Zukunft; das Original ist abgeschlossen.", "en": "will = future; the original is finished."}
    ],
    "why": {"de": "Nominalstil: failed → the failure of, postponed → the postponement of; verbunden mit led to/resulted in.", "en": "Nominal style: failed → the failure of, postponed → the postponement of; linked with led to/resulted in."}
  },
  {
    "id": "para-0002", "kind": "para", "area": "gram", "pattern": "c1-emphasis/only-after-inversion", "topic": "c1-emphasis", "level": "C1", "dom": "biz", "src": "seed", "focus": "inversion",
    "a": "We only noticed the gap after the audit.",
    "start": "Only after",
    "answers": ["Only after the audit did we notice the gap."],
    "options": ["Only after the audit we noticed the gap.", "Only after we noticed the gap did the audit start.", "Only the audit noticed the gap afterwards.", "Only after the audit did we notice the gap."],
    "answer": 3,
    "optWhy": [
      {"de": "Bedeutung stimmt, aber nach „Only after + Zeitangabe“ fehlt die Inversion.", "en": "Meaning is right, but \"Only after + time\" needs inversion."},
      {"de": "Reihenfolge vertauscht: hier käme die Lücke vor dem Audit.", "en": "Order reversed: here the gap comes before the audit."},
      {"de": "Neues Subjekt: Das Audit bemerkt etwas, nicht wir.", "en": "New subject: the audit notices, not we."},
      {"de": "Gleiche Bedeutung, Betonung durch Inversion (did we notice).", "en": "Same meaning, emphasis through inversion (did we notice)."}
    ],
    "why": {"de": "Only after/Only when + Satzteil am Anfang: danach Hilfsverb vor Subjekt (did we notice).", "en": "Only after/Only when + phrase at the start: then auxiliary before subject (did we notice)."}
  },
  {
    "id": "para-0003", "kind": "para", "area": "gram", "pattern": "verb-patterns/blame-for-on", "topic": "verb-patterns", "level": "B2+", "dom": "biz", "src": "seed", "focus": "verb-pattern",
    "a": "The client said it was our fault that the data was lost.",
    "start": "The client blamed",
    "answers": ["The client blamed us for the loss of the data.", "The client blamed us for the data loss.", "The client blamed us for losing the data.", "The client blamed the loss of the data on us.", "The client blamed the data loss on us."],
    "options": ["The client blamed us for the loss of the data.", "The client blamed itself for losing the data.", "The client blamed us of losing the data.", "The client blamed the lost data for us."],
    "answer": 0,
    "optWhy": [
      {"de": "Gleiche Bedeutung: blame sb for sth.", "en": "Same meaning: blame sb for sth."},
      {"de": "itself = der Kunde selbst: Bedeutung geändert.", "en": "itself = the client: the meaning changes."},
      {"de": "blame sb FOR sth, nicht „of“ (Deutsch: beschuldigen + Genitiv).", "en": "blame sb FOR sth, not \"of\"."},
      {"de": "Es heißt blame sth ON sb; „for us“ ergibt keinen Sinn.", "en": "It is blame sth ON sb; \"for us\" makes no sense."}
    ],
    "why": {"de": "blame hat zwei Muster: blame sb for sth · blame sth on sb.", "en": "blame has two patterns: blame sb for sth · blame sth on sb."}
  }
]
```

**Aufwand L** (Laptop-Prüfung mit Urteil). **Abnahme:** Unit: jede Musterfassung 2/2, ähnliche Abweichung → „nicht sicher prüfbar“, ohne Claude nie ein Warten; E2E Laptop: fester Satzanfang nicht löschbar; Handy: vier Karten ohne Querscrollen bei 360 px.

---

## 4 Inhalte: Bauzeit und Laufzeit

### 4.1 Mengenplan

| Art | Bauzeit-Ziel | Probe-Reserve | Release 1 | Ernte heute | Laufzeit-Nachschub |
|---|---|---|---|---|---|
| mcc | 300 | 24 | 120 | ≈ 30 umbaubar | ja |
| ocl | 300 | 24 | 120 | 49 | ja |
| wf | 250 | 24 | 100 | 20 | ja |
| kwt | 150 | 18 | 60 | 30 | ja, strenger |
| err | 300 (≥ 75 fehlerfrei) | – | 120 | 75 Drills + 71 Regel-Fallen | ja |
| pair | 120 | – | 50 | 0 | nein |
| cnet | 150 | – | 60 | 40 | nein |
| reg | 200 | – | 80 | 20 | nein (Claude nur als Urteil) |
| para | 150 | – | 60 | 0 | Stufe 2 |
| **Σ** | **1.920** | **90** | **770** | ≈ 335 Rohstoff | |

**Verteilung:** Grammatik-Arten ≈ 1.370 Aufgaben auf 39 Themen ≈ 35 je Thema; zusammen mit den heutigen ≈ 12–20 je Thema ist das Lehrplanziel „≥ 24 je Thema“ (`02-lehrplan.md:47`) erfüllt. Jedes Muster bekommt ≥ 6 Aufgaben in ≥ 3 Arten. Lexik-Arten ≈ 550 Aufgaben, bevorzugt zu Einträgen der Bänder Wendungen und C1-Business (`02-lehrplan.md:16-17`).

### 4.2 Produktion zur Bauzeit

Chargen zu 25–40 Aufgaben je Art und Thema, Rohfassung vom Fach-Agenten `english-teacher` mit dem Muster-Blatt als Vorgabe (US-Englisch, ⅔ Beruf mit Emrahs Feldern Vertrieb, DMS/ECM, Cloud; ⅓ Alltag). Eigene Sätze, **keine** Cambridge-Originalaufgaben (urheberrechtlich geschützt).

### 4.3 Prüfkette (für 100 % der Aufgaben automatisch, dann Menschen-Stichprobe)

1. **Unit-Test `tests/unit/c1Content.test.ts`** (läuft in `npm test`): Schema; `checkC1Content`; `scoreC1(item, Lösung) = max` für **jede** Lösungsvariante; jeder Ablenker, Chip, falsche Partner und jede `trap` < max; IDs eindeutig; `probe`-Aufgaben nie in `select.ts`; Anteil fehlerfreier `err` 25–35 %; Lösungsposition bei mcc/para je 20–30 %; Regel `BRITISH`; keine Dubletten (`legacyNorm`); Begründungen in der richtigen Sprache.
2. **Löser-Probe:** ein zweiter Agent ohne Lösung löst jede Aufgabe; jede Abweichung kommt auf die Prüfliste (bei mcc: zweite mögliche Option → Ablenker tauschen; bei kwt/ocl: gültige Variante → `keys`/`accept` ergänzen).
3. **Kritiker-Durchgang** mit anderem Auftrag (Natürlichkeit, Niveau C1, Eindeutigkeit, deutsche Falle sinnvoll).
4. **Lehrer-Stichprobe** 20 % je Charge (mindestens 10). Zulässig wie `02-lehrplan.md:25`: ≤ 2 harte Fehler je 100 = ok, 3–5 = Muster nachbessern, > 5 = Charge neu.
5. Im Betrieb: „Aufgabe melden“ blendet die Aufgabe sofort aus (`c1gen`-Flag bzw. Liste gemeldeter Bauzeit-IDs im selben Monatsdokument); gemeldete Bauzeit-IDs gehen in die nächste Lehrer-Runde.

### 4.4 Nachschub durch Claude zur Laufzeit

- **Wann:** am Ende einer Runde, wenn ein Muster weniger als 8 ungesehene Aufgaben einer Art hat (wie `unseenCount`, `tasks.ts:351-356`); eine Anfrage je Handlung, danach 20 Min. Ruhe, auch nach Fehler; nie per Timer, nie in Schleife; einmaliger zweiter Versuch nur bei Schemafehler mit Fehlerbeschreibung (A6.3).
- **Vorlage `c1-gen@1`** (`default`): Muster-Blatt (Formel, Signale, Kontrast, typischer Fehler), 2 Beispielaufgaben derselben Art, Liste „nicht wiederholen“ (≤ 200 Schlüssel), Ausgabe: 6 Aufgaben als JSON nach dem Art-Schema. Eingabe ≈ 6–12 KB, deutlich unter 64 KiB (`contract/sample.d.ts:133`).
- **Prüfung:** `accept<Art>` je Abschnitt 3.x plus Unit-gleiche Regeln (`scoreC1` löst die eigene Lösung voll, Ablenker nicht). Ausschussquote wird im Diagnose-Protokoll gezählt; über 50 % in 3 Anfragen → Nachschub für diese Art aus, Hinweis in der Diagnose.
- **Kennzeichnung:** Status-Zeile „Neu von Claude · nur formal geprüft · kann Fehler enthalten“; „Melden“ im Menü. Eine falsche Antwort auf eine Claude-Aufgabe bucht normal, „Melden“ macht die Buchung wie „Ich lag richtig“ rückgängig (höchstens „Gut“).
- **Grenzen:** höchstens ⅓ einer Runde; nie im Wochen-Check, in der C1-Probe oder als einzige Quelle einer Pflicht; jede Pflicht bleibt ohne KI erfüllbar (`03-lernmodell.md:109`).
- **Speicher:** Vorrat in `localStorage` (≤ 24 je Art, wie `orderGen.ts:21-27`); erst eine **beantwortete** Aufgabe kommt in `c1gen/<Monat>`, damit Fehlersatz und Meldung sie wiederfinden.

---

## 5 C1-Probe im Prüfungsformat

- **Format:** Teil 1 = 8 mcc, Teil 2 = 8 ocl, Teil 3 = 8 wf, Teil 4 = 6 kwt; 30 Aufgaben, 36 Punkte, Punkte wie Cambridge (Quelle 2.1). Am Laptop Teile 1–3 im Textmodus (8 Lücken in einem Absatz) und Teil 4 getippt; am Handy satzweise und Teil 4 mit Bausteinen, dann mit dem Vermerk „Handy-Fassung, leichter als die Prüfung“.
- **Aufgaben:** nur aus der Reserve (`probe: true`, 90 Aufgaben = 3 Proben), nie im Training gesehen; ab Release 2 weitere Sätze.
- **Ablauf:** freiwillig, alle 8 Wochen angeboten (Fortschritt › Rückblick), ≈ 25–30 Min. **(Annahme)**; keine Hilfe, kein Claude, Rückmeldung erst am Ende; Abbruch speichert nichts als Ergebnis.
- **Anzeige:** „27 von 36 (75 %) · Teil 4: 7 von 12 · schwächstes Muster: *wish + Past Perfect*“; Verlauf über die Proben. Richtwert ≈ 60–65 % in zwei Proben nacheinander (`02-lehrplan.md:136`), ausdrücklich **grob und nicht geeicht**: Die Cambridge-Skala entsteht aus allen Prüfungsteilen und lässt sich nicht nachbilden.
- **Danach:** jede falsche Probe-Aufgabe wird Fehlersatz (sie ist danach „gesehen“ und fällt aus der Reserve).
- **Daten:** `app/profile.c1probe[]` (2.8). **Aufwand M**, **Abnahme:** Probe zieht nur Reserve-Aufgaben; Punkte je Teil = Summe der `scoreC1`; ohne Claude vollständig; Ergebnis nur bei vollständiger Probe gespeichert.

---

## 6 Was in einem Artefakt nicht geht – und was stattdessen

| Wunsch | Warum nicht | Stattdessen |
|---|---|---|
| Echte Erklärvideos je Muster | Eine Minute Video in 720p mit 1–2 Mbit/s sind ≈ 7,5–15 MB **(Modell)**, die ganze App darf 16 MB haben; Videos von außen blockiert die Sicherheitsregel (Kap. 3.1) | „Muster-Filme“ als JSON-Zeitleiste mit SVG und Framer Motion, ≈ 3 KB je Muster (2.9) |
| Eigene Tonaufnahmen | gleiche Größenfrage, kein externer Speicher | Sprachausgabe des Geräts (iPhone-Stimme bleibt robotisch, A7 29.09.) |
| Spiele-Engine (WebGL, 3D) | ginge eingebettet (≈ 0,5 MB+), bringt beim Grammatiklernen keinen Lerngewinn, kostet Akku und Startzeit | Mikro-Animationen mit Framer Motion, schon im Bundle |
| Zweiter Claude prüft jede Laufzeit-Aufgabe inhaltlich | jede Prüfung wäre ein zweiter Aufruf aus Emrahs Kontingent und dauert 5–60 s | formale Prüfung, Kennzeichnung, „Melden“; inhaltliche Prüfung nur zur Bauzeit |
| Cambridge-Originalaufgaben | urheberrechtlich geschützt | eigenes Material im selben Format |
| Offizielle C1-Note | Skala nicht nachbildbar | C1-Probe als ehrlicher Trend (Kap. 5) |
| Gesprochene Antworten bewerten | Bewertung braucht die exakte Form, Spracherkennung korrigiert still | Sprechen bleibt freiwilliges Extra (Rollenspiel, Einwand-Training) |

---

## 7 Umsetzungsreihenfolge

| Paket | Inhalt | Aufwand | Abnahme (Kurzform) | hängt ab von |
|---|---|---|---|---|
| P1 Fundament | Typen, Schemas, Laden mit Entpacken, `scoreC1`, Notenschlüssel, `pts` in `write.ts`, `cid` in Fehlersätzen, Ergebnis-Karte mit `PartBar`, `inputProfile` | L | `c1Content.test.ts` grün; eine Beispielaufgabe je Art durchläuft Prüfen → Buchen → Fehlersatz → Wiederholung im selben Baustein | `ExerciseShell`, Muster-IDs aus `lernplattform-2.md` |
| P2 kwt | Bausteine (Handy), Tippen (Laptop), `kwtNorm`, 60 Aufgaben inkl. 30 geernteter | L | 3.4 | P1 |
| P3 err | `TapSentence`, `ChipRow`, 120 Aufgaben aus Fallen und Regel-Fallen | L | 3.5 | P1 |
| P4 mcc + ocl | Begründung je Option, 240 Aufgaben | M | 3.1, 3.2 | P1 |
| P5 wf | `MorphSplit`, 100 Aufgaben | M | 3.3 | P1 |
| P6 pair | `LinkPairs`, Kontrast-Tafel, 50 Paare | M | 3.6 | P1 |
| P7 cnet | `RadialNet`, 60 Netze, Lehnübersetzung → `err` | L | 3.7 | P1, P3 |
| P8 reg + para | `SegmentSwap`, `c1-judge@1`, 140 Aufgaben | L | 3.8, 3.9 | P1 |
| P9 Nachschub | `c1-gen@1`, `accept*`, `c1gen/<Monat>`, Melden | L | 4.4 | P2–P5 |
| P10 Probe + Textmodus + Muster-Filme | Kap. 5, Textmodus 3.1, Zeitleisten | M | Kap. 5 | P2, P4, P5 |
| P11 Release 2 | Inhalte auf 1.920 | XL | 4.3 je Charge | alle |

**Warum P2 und P3 zuerst:** Sie bringen für einen deutschen B2-Lerner am meisten in Richtung C1 (umformulieren können, eigene Fehler erkennen) und schließen die größte Handy-Lücke: Umformungen und Fehlersätze verlangen dort heute ganze getippte Sätze (`GrammarItem.tsx:303-331`, `errors.ts:198`).

**Prüfer je Paket:** learning-scientist (vier Pflichtfragen, Notenlogik), english-teacher (Inhalte), ux-reviewer (Handy und Laptop, drei Modi), data-guard (P1, P9, P10), platform-guard (Größe, Entpacken, keine Ladeziele). Je Prüfer eine Runde plus eine Nachprüfung (CLAUDE.md A2).

---

## 8 Risiken und offene Entscheidungen

**Risiken**
1. **Größe:** +1,67 MB Text; ohne Packen ≈ 6,5 MB und damit über dem 6-MB-Budget. Gegenmittel: Entpacken (2.3) oder Release 1 zuerst (≈ 0,67 MB).
2. **Eindeutigkeit der Inhalte:** mcc mit zwei richtigen Optionen (britisch/amerikanisch, z. B. *take/make a decision*), kwt mit nicht vorgesehenen gültigen Varianten. Gegenmittel: Löser-Probe, „Ich lag richtig“, Prüfliste.
3. **Teilpunkte und Lernstand:** „1 von 2“ darf BKT nicht heben; die Änderung an `write.ts:40` muss mit Tests abgesichert werden, sonst steigen Themen zu schnell.
4. **Kurzformen:** `normText` löst `'d`/`'s` für KWT falsch auf (`normText.ts:10`, `:13`); `kwtNorm` muss eigene Tests haben.
5. **Laufzeit-Aufgaben:** formal geprüft heißt nicht inhaltlich richtig; Kontingent und Wartezeit gehen zu Lasten von Emrahs Abo. Begrenzung ⅓ je Runde, Melden, Abschaltung bei hohem Ausschuss.
6. **Namenskonflikt:** `src/domain/patterns/` meint heute die Deutsch-Fallen (`app/patterns`); das neue „Muster“ braucht einen eindeutigen Namen (Vorschlag: Feld `pattern` an der Aufgabe, Modul in `domain/grammar/`).
7. **Abhängigkeit vom Fundament:** Muster-IDs, `ExerciseShell` und Ergebnis-Karte kommen aus `lernplattform-2.md`; weicht dort etwas ab, sind Typen und Abnahmen anzupassen.
8. **Inhaltsaufwand:** 1.920 Aufgaben mit Prüfkette sind der größte Posten (XL); ohne Inhalte sind die Bausteine leer.
9. **C1-Probe:** kein geeichter Test; die Anzeige muss das ehrlich sagen.
10. **Nebenbefund:** Der Atlas enthält britische Wörter in Beispielsätzen (z. B. „Can you switch the telly off?“, erster Eintrag in `src/content/atlas/atlas.json`); gehört in die US-Prüfung der Atlas-Spur, nicht in dieses Paket.

**Entscheidungen für Emrah** (Standard gilt, bis Emrah „anders“ sagt): (1) C1-Probe alle 8 Wochen, freiwillig – Standard ja. (2) Nachschub durch Claude (verbraucht dein Kontingent) – Standard an, höchstens ⅓ einer Runde. (3) Reihenfolge P2 (Umformung) und P3 (Fehler finden) zuerst – Standard ja. (4) Inhalte gepackt einbetten, damit die App unter 6 MB bleibt – Standard ja.

---

## 9 Quellen

- Cambridge English: C1 Advanced, Prüfungsformat. https://www.cambridgeenglish.org/exams-and-tests/qualifications/advanced/format/
- Cambridge English: C1 Advanced Reading and Use of English, Overview (Teile 1–4, Rechtschreibung, 3–6 Wörter, Schlüsselwort unverändert). https://cambridgeenglish.org/Images/167860-cambridge-english-c1-advanced-reading-overview.pdf
- ESL Lounge: C1 Advanced Key Word Transformations (6 Fragen, 12 Punkte). https://www.esl-lounge.com/student/exams/c1-advanced-exam-reading-use-of-english-guide-key-word-transformations.php
- Nesselhauf, N. (2003): The use of collocations by advanced learners of English and some implications for teaching. Applied Linguistics 24(2), 223–242. https://heibib.ub.uni-heidelberg.de/search/Record/1814339116
- Schmitt, N. & Zimmerman, C. B. (2002): Derivative word forms: What do learners know? TESOL Quarterly 36(2), 145–171. https://www.norbertschmitt.co.uk/articles
- Butler, A. C. & Roediger, H. L. (2008): Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing. Memory & Cognition 36(3), 604–616. https://pubmed.ncbi.nlm.nih.gov/18491500/
- Kornell, N., Hays, M. J. & Bjork, R. A. (2009): Unsuccessful retrieval attempts enhance subsequent learning. JEP: LMC. https://pubmed.ncbi.nlm.nih.gov/19586265/
- Butterfield, B. & Metcalfe, J. (2001): Errors committed with high confidence are hypercorrected. JEP: LMC 27(6), 1491–1494. Übersicht: https://en.wikipedia.org/wiki/Hypercorrection_(psychology)
- Laufer, B. & Girsai, N. (2008): Form-focused instruction in second language vocabulary learning: a case for contrastive analysis and translation. Applied Linguistics 29(4), 694–716. https://appliedlinguistics.ucsb.edu/sites/secure.lsit.ucsb.edu.germ.d7_al/files/sitefiles/events/event_22_1.pdf
- web.dev: Compression Streams are now supported on all browsers (Safari 16.4). https://web.dev/blog/compressionstreams
