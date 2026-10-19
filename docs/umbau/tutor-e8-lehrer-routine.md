# E8 „Der KI-Lehrer im Hintergrund“: Entwurf als Ergänzung zu tutor-engine-v3

> Status: Entwurf Opus (20.10.2026), Ergänzung zu `tutor-engine-v3.md` (E8). Emrah hat entschieden: Routine nur **zweimal pro Woche** (nicht täglich). Einrichtung der Routine erst mit dem Engine-Link; Einhaltung: eigener Trigger, zuerst Test-Link-URL, nie direkt live.

Ich habe nur gelesen und nichts geändert. Grundlage waren `/home/user/lingo-engine-x/docs/umbau/tutor-engine-v3.md` (Dateiname laut Kopf `tutor-engine-v2.md`), `ki-tutor.md`, `lesen-routine.md`, `lesen-routine-kurse.md`, `aktivierung.md`, `docs/entscheidungen.md`, `contract/db.d.ts`, `src/modules/read/domain/routine.ts`, `src/data/paths.ts`, `src/domain/grammar/slotPlan.ts` und `tasks.ts`.

## Fünf Punkte, die der Entwurf vorab festhalten muss

1. **E8 lockert v3 §1 bewusst.** Dort steht: „Claude … wählt nie die nächste Aufgabe.“ E8 wählt auch keine Aufgabe. Es ändert nur gedeckelte Eingaben der festen Funktionen (`slotPlan`, `nextTasks`), und zwar nur in dem Moment, in dem der Tagesplan eingefroren wird. Das braucht einen Eintrag in `docs/entscheidungen.md` und Emrahs Ja.
2. **Name `tutor/…`, nicht `app/teacher`.** Die Sammlung `teacher/` gibt es schon für das Lehrer-Feedback aus R5 „Dein Lehrer“ (`src/data/paths.ts:107`). Ein zweites „Lehrer“ würde verwechselt.
3. **Datenlücken.** Den Übersetzer-Verlauf gibt es nur auf dem Gerät (`src/features/companion/translate/history.ts`, 20 Einträge in `localStorage`). Die Routine kann ihn also nicht sehen. Abbrüche werden heute nicht eigens protokolliert. Der Chat liegt in `app/chat` und ist lesbar.
4. **Die Routine braucht einen Auszug, den die App schreibt.** Ob eine geplante Routine Skripte ausführen oder Sammlungen auflisten kann, ist nicht belegt; `ArtifactData` ist nur mit `get`/`set` und Löschen genutzt. Rund 400 Karten und 56 Tage Log einzeln abzurufen geht nicht. Deshalb schreibt die App eine kompakte Zusammenfassung `tutor/in`. Vorher klärt ein kurzer Test, was die Routine kann (siehe 6).
5. **Plattformregeln.** `ArtifactData` steht nicht in `contract/`. Die Vertragsregeln gelten für die App: Sie liest nur mit `db.get`. Die Routine läuft außerhalb der App, nach dem Vorbild der Lese-Routine. Einen Zeitgeber in der App gibt es dafür nicht.

---

## (1) Datenfluss und Orte

| Dokument | Schreibt | Liest | Inhalt | Größe |
|---|---|---|---|---|
| `tutor/in` | App, am Rundenende über `writer.transform`, nur wenn sich der Hash geändert hat | Routine | Auszug: Lernermodell und Belege der letzten 28 Tage | ≤ 120 KiB (Wächter vor dem Schreiben, kürzt nach Vorrang) |
| `tutor/fb` | App (Objekt-Map je Tag, deterministische Schlüssel) | Routine, App | angewandter Plan je Tag, Gruppe (A/B), verworfene Plan-Teile mit Grund, Zustand der Annahmen, Bitte um Neuplanung `req` | ≤ 40 KiB, Ring 120 Tage |
| `tutor/p-<JJJJ-MM-TT>` | **nur die Routine**, ein ganzes `set` | App | Lehrplan-Vorschlag | Ziel ≤ 32 KiB, hart 200 KiB |

**Datenregeln** (A6 und `aktivierung.md` Regeln 2–9):
- `tutor` kommt in `COLLECTIONS` und **in `LAZY_COLLECTIONS`**. Sonst würde der Start bis zu etwa 2 MB mitladen.
- `ROUTINE_ONLY_RE` in `/home/user/lingo-engine-x/src/data/paths.ts:158` wird um `tutor/p-\d{4}-\d{2}-\d{2}` erweitert. Damit verweigert `writer.ts:131` jeden Schreibversuch der App.
- Die App löscht nie etwas. Die Routine räumt nur ihre eigenen `p-*` auf, die älter als 21 Tage sind.
- Dokumente insgesamt: höchstens 21 `p-*` plus `in` plus `fb`, also +23. Die Sicherung nimmt `in` und `fb` mit, `p-*` nur der letzten 14 Tage. Das ist dasselbe Muster wie bei `read/r-*`.

**Lesen in der App:**
- Wann: beim Einfrieren des Tagesplans und beim Öffnen von Fortschritt.
- Was: `tutor/p-<heute>`, dann den Vortag, dann den Tag davor. Das sind drei `get`, kein `onSnapshot`.
- Genommen wird der jüngste gültige Plan mit `day ≤ heute ≤ until`, wobei `until ≤ day+3`, und `in.day ≥ heute−4`.
- Jedes Teil wird einzeln geprüft wie in `checkRoutineItem`. Fehlerhaftes wird ausgeblendet, kommt ins Protokoll (`tutor:plan item_hidden`) und als Grund nach `tutor/fb.rej`.
- Fehlt ein gültiger Plan oder ist er veraltet, gilt `hints = null`. Das Ergebnis ist dann **byte-gleich mit heute**; ein Test sichert das ab.
- Kein Neuwürfeln: Der Plan wirkt nur beim Einfrieren. Kommt er mitten am Tag an, ändert er die Pflicht nicht. `tutor/fb.days[tag] = {p, arm}` macht den Tag nachvollziehbar.

**Zeitpunkt:** täglich 01:30 UTC, also 02:30 Uhr im Winter und 03:30 Uhr im Sommer. Das liegt immer vor dem Tageswechsel der App um 04:00 Uhr, der Plan steht also beim ersten Öffnen bereit. `day` ist das Berliner Kalenderdatum.

### Schema-Skizze (`src/domain/tutor/routinePlan.ts`, rein)

```ts
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Id  = z.string().regex(/^[a-z0-9][a-z0-9.+:_\-]{1,60}$/);
// Beleg = prüfbarer Verweis auf vorhandene Daten: Log-Eintrag e:<Tag>:<t>, Aktivierung a:<id>, Fehlersatz r:<id>, Chat c:<t>
const EvId = z.string().regex(/^(e:\d{4}-\d{2}-\d{2}:\d{10,14}|a:[\w.\-]{1,40}|r:[\w.\-]{1,40}|c:\d{10,14})$/);
const Bi = (max: number) => z.object({ de: clipped(4, max), en: clipped(4, max) }); // isWrongLang → Teil weg

export const TutorPlanDoc = z.looseObject({
  v: z.literal(1), by: z.literal('routine'), day: Day, until: Day,
  in: z.object({ day: Day, h: z.string().max(16) }),
  focus: z.array(z.unknown()).max(3), hyps: z.array(z.unknown()).max(5),
  weights: z.unknown(), explain: z.array(z.unknown()).max(8),
  wins: z.array(z.unknown()).max(3), msg: z.unknown(),
  items: z.array(z.unknown()).max(12), read: z.array(z.unknown()).max(3),
  self: z.unknown().optional(),                       // nur Diagnose
});
// Einzelteile, je für sich geprüft (ein schlechtes Teil reißt die anderen nicht mit):
const Focus = z.object({ kind: z.enum(['pat','use','word','chunk']), id: Id, w: z.number().min(1).max(2),
  why: Bi(200), ev: z.array(EvId).min(2).max(4) });
const Hyp = z.object({ id: Id, from: Id, to: Id, cause: z.enum(['confuse','prep','colloc','order','form']),
  ev: z.array(EvId).min(3).max(6), why: Bi(200), probe: z.boolean() });
const Weights = z.object({
  focusSlot: Id.nullable(),                                         // 1 von 6 Plätzen, nur wenn kein eigener Wochenfokus (wf)
  dueBoost: z.record(Id, z.number().min(0.5).max(2)),               // ≤ 6, nur Reihenfolge bei gleichem Zustand
  formBias: z.record(Id, z.union([z.literal(-1), z.literal(0), z.literal(1)])), // ≤ 6, Startwert für shift
  newOrder: z.array(Id).max(10),                                    // Reihenfolge innerhalb des festen Kontingents
  actOrder: z.array(Id).max(8),                                     // Vorrang innerhalb ACT_DAY_UNITS = 4
  extraOrder: z.array(z.enum(['read','course','speak','clinic','translate'])).max(5) });
const Explain = z.object({ pat: Id, style: z.enum(['contrast','timeline','l1-mirror','business-example','rule-first','example-first']), why: Bi(160) });
const Win = z.object({ metric: z.enum(['patAcc','freeUse','cardStage','hypResolved']), id: Id,
  from: Day, to: Day, text: Bi(160) });                             // Text ohne Ziffern; {a}/{b} füllt die App selbst
const Msg = Bi(280);                                                // ohne Ziffern
const Item = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('gram'), task: ItemRaw, self: z.object({ solved: z.string(), also: z.array(z.string()).max(4) }) }),
  z.object({ kind: z.literal('sent'), card: Id, en: clipped(20,200), de: clipped(20,240), sit: z.string().max(20) }) ]);
const ReadRec = z.object({ kind: z.enum(['course','topic']), id: Id, why: Bi(160) });
```

---

## (2) Inhalt des Lehrplans und wo er wirkt

| Teil | Wirkung in der App | Feste Grenze, die bleibt |
|---|---|---|
| `focus` + `weights.focusSlot` | Platz `focus` in `slotPlan` (`slotPlan.ts:143`), aber nur, wenn `i.focus` (Emrahs `wf`) leer ist | Kapitel-Plätze, Einführungstag und Samstags-Mix bleiben unberührt; `u.v=1`, `u.rv` |
| `dueBoost` | Rangfolge innerhalb `dueList` bei gleichem Zustand, beim Einfrieren | FSRS- und BKT-Fälligkeit unverändert |
| `formBias` | Startwert für `shift` (−1/0/+1) | Nach 5 Antworten gilt die Sitzung aus v3, Rang 5/6 |
| `newOrder` | welche neuen Wörter und Wendungen **innerhalb** des Kontingents 0/2/5/10 zuerst kommen | Tagesbremse, Mix 1:1, höchstens 2 lange Wendungen, kein Satz = zurückstellen |
| `actOrder` | Vorrang bei A1–A4 | Barcroft (nie unter Stufe 3), 4 Satz-Einheiten, Aufholmodus |
| `hyps` | ab S4: Kandidaten neben `diagnose@2`; ab S5: Prüfaufgaben `probe` | `open` nur nach den eigenen Schwellen der App (3 Belege an 2 Tagen) |
| `explain` | wählt einen **festen** Baustein in `composeFeedback` | höchstens 3 Erklärzeilen, Kontrast nur mit Beleg |
| `wins` | Fortschritt: „vor drei Wochen {a}, jetzt {b}“; **die App rechnet die Zahlen** | zeigen die Zahlen keine Verbesserung, bleibt das Teil aus |
| `msg` | eine Zeile auf der Abschlusskarte und unter Fortschritt › „Dein Lehrer“, mit `AiMark` | nie als eigene Karte auf Heute (Kap. 2 Nr. 1) |
| `items` | Quarantäne (siehe 3), danach Vorrat mit `src:'routine'` | wie T-R8: nie BKT oder `pats`, höchstens 2 von 6 nur auf `aiOk`-Plätzen |
| `read` | Reihenfolge der Kurs- und Leseangebote (Katalog k1–k8, `TOPIC_KEYS`) | Lesen bleibt immer Extra |

---

## (3) Leitplanken für Sicherheit und Qualität

1. **Kein Lernwert.** Die Anweisung erlaubt nur `set` auf `tutor/p-<heute>` und Löschen der eigenen alten `p-*`. Technisch durchsetzen lässt sich das **nicht**: Der Eigentümer erfüllt jede Regel (`db.d.ts:45-46`). Abgesichert wird es durch die Antwortliste der Routine, eine Prüfung der ersten Läufe durch die Hauptsitzung und die Sicherung. Das muss Emrah wissen.
2. **IDs nur aus der Eingabe.** Die App prüft Muster-IDs gegen den Inhaltskatalog, Karten- und Wendungs-IDs gegen `vocab/` und `chunk/`, Kurse gegen den Katalog. Unbekannte IDs fallen weg; ein Neuversuch gibt es nicht.
3. **Belege werden in den Daten nachgeprüft**, nicht nur dem Auszug geglaubt:
   - `e:<Tag>:<t>` muss als Eintrag in `log/<Tag>` existieren.
   - Er muss zur Aussage passen, zum Beispiel `pat === hyp.from` und `ok === false`, getippt, nicht als Auswahl.
   - Eine Annahme mit weniger als 3 gültigen Belegen fällt weg.
4. **Keine erfundenen Zahlen.** `msg` und `wins.text` dürfen keine Ziffern enthalten (Regex-Prüfung). Die Zahlen setzt die App selbst ein.
5. **Inhalte in Quarantäne.**
   - In der Routine: Die Routine löst jede Aufgabe ohne Lösung ein zweites Mal (`self.solved`/`also`).
   - In der App: `acceptGrammarItem` und `lintTask` ohne `sample`-Aufruf.
   - **Die ersten 4 Wochen werden Vorschläge nur gesammelt, nicht gezeigt.** Der `english-teacher` prüft eine Stichprobe von 30.
   - Freigabe (Merker `items: on` in `tutor/fb`, gesetzt durch die Hauptsitzung) nur bei höchstens 2 harten Fehlern. Danach monatliche Stichprobe wie bei den Kursen.
6. **„Auch richtig“ zuerst.** Die Anweisung übernimmt Regel 4.1 aus v3: „had“ statt „used to“ ist **kein Fehler**, sondern nur ein `note` bzw. ein `explain`-Hinweis. Ein `hyp` dazu wird verworfen, weil `cause` bei einem `note`-Eintrag in `l1.json` nicht erlaubt ist.
7. **Wirkung messen.**
   - Jede 4. ISO-Woche ist Vergleichswoche (`arm = hash(isoWeek+'e8') % 4 === 0`): Die Gewichte gelten dann nicht, die Botschaft schon.
   - Messwerte der App:
     - Anteil der Tage, an denen die Quote neu gestellter Grammatikaufgaben im Band 75–85 % liegt
     - Fehlerquote der Fokusmuster 14 Tage vorher und nachher
     - Tage bis `resolved`
     - Wiederholungslast: Fällige, Lapse-Quote nach der Definition M4 und Minuten
     - Erfüllung der Pflicht
     - Anteil verworfener Plan-Teile (Ziel < 10 %)
   - Bei einem einzigen Lerner ist das nur ein plausibler Hinweis, kein Beweis. Nach 8 Wochen entscheidet Emrah.
   - **Notbremse:** Steigt die Lapse-Quote in An-Wochen mehr als 20 % über die Vergleichswochen, ignoriert die App `dueBoost` und `newOrder` von selbst und meldet das in der Diagnose.

---

## (4) Datenschutz, Kosten und Abbruch

**Was die Routine liest:** nur `tutor/in`, `tutor/fb` und die eigenen `tutor/p-<gestern>`/`p-<vorgestern>`. Keine Rohsammlungen.

**Inhalt von `tutor/in`** (nach Vorrang gekürzt):
- Muster-Statistik aus dem Lernermodell (S2): etwa 10 KB
- schwache und zähe Karten und Wendungen: höchstens 120, etwa 18 KB
- getippte Fehler der letzten 28 Tage mit Ursache, `vs` und Beleg-ID: höchstens 250, etwa 40 KB
- „Auch richtig“, `fitAlt` und Einsprüche: etwa 10 KB
- Aktivierungen aus `act/`: etwa 12 KB
- Tempo-Mediane: 2 KB
- letzte Chat-Fragen aus `app/chat`: höchstens 30 × 200 Zeichen
- Lese- und Kursstand
- Übersetzer-Eingaben **nur mit Schalter, Standard aus**

Alle Daten bleiben in Emrahs eigener Artefakt-Datenbank und laufen nur in seinem Konto.

**Kontingent:** Die Routine verbraucht dasselbe Abo; es gibt frühere Warnungen „Wochenlimit knapp“ (`entscheidungen.md:364`) und „Kontingent sparen“ (27.09.).
- Schätzung je voller Lauf: etwa 35k Token Eingabe, 20–40k Denken, 6–10k Ausgabe, zusammen **etwa 70–90k**.
- **Sparregel:** Die Routine liest zuerst nur `tutor/fb`, etwa 3k. Gibt es weniger als 15 neue bewertete Antworten seit dem letzten Plan, keine Bitte `req` und ist der letzte Plan jünger als 3 Tage, endet der Lauf mit „unverändert“.
- Erwartung: 4–6 volle Läufe je Woche.
- Ausgleich: Ist ein frischer Plan da, entfällt die automatische Wochen-Diagnose E4 (`diagnose@2`, complex) in der App.

**Erneut auslösen:**
- Die App kann keine Routine starten. Sie setzt `tutor/fb.req`: entweder über einen Knopf „Lehrer soll neu schauen“ (höchstens einmal am Tag) oder automatisch, wenn heute mehr als 80 Antworten oder 2 Extra-Runden zusammenkamen. Das hebt nur die Sparregel auf.
- Am selben Tag: Emrah sagt in claude.ai Bescheid, die Hauptsitzung löst `fire_trigger` aus.
- Eine zweite Mittags-Auslösung wäre möglich, kostet aber jeden Tag etwa 3k; ich empfehle sie nicht als Standard.

**Abbruch:**
- Es gibt genau ein `set` am Ende. Bricht der Lauf vorher ab, wird nichts geschrieben, und der alte Plan gilt bis `until`, danach läuft alles lokal.
- Lehnt `set` mit `invalid_argument` ab (Größe), kürzt die Routine einmal (`items` und `explain` weg). Sonst gibt es keinen Neuversuch; der nächste Versuch ist die nächste Nacht.

---

## (5) Prompt-Rahmen der Routine

Die Anweisung kommt nach `/home/user/lingo-engine-x/docs/umbau/tutor-routine.md` zwischen `ANWEISUNG-BEGINN` und `ANWEISUNG-ENDE`; das Beispiel wird vom Test geprüft.

- **Rolle:** erfahrene C1-Lehrkraft für deutschsprachige Berufstätige; US-Englisch, britische Formen gelten als richtig; „Urteile NUR aus den Belegen in `tutor/in`. Jede ID und jeder Beleg muss dort wörtlich vorkommen. Erfinde keine Zahlen.“
- **Schritte:**
  1. Datum in Europe/Berlin.
  2. `tutor/fb` lesen und die Sparregel anwenden.
  3. `tutor/in` und `p-<gestern>` lesen, außerdem `fb.rej`: die abgelehnten Teile, aus denen die Routine lernt.
  4. Analyse mit vollem Denkaufwand: Muster, Ursachen, Wendungen, Tempo, Einsprüche.
  5. Zuerst „Auch richtig“ ausschließen, sonst keine Annahme.
  6. Plan zusammenstellen und an die Grenzen aus (2) halten.
  7. Inhaltsvorschläge machen und jeden ein zweites Mal ohne Lösung lösen.
  8. **Selbstkontrolle**: IDs ⊂ Eingabe, Belege ⊂ Eingabe, mindestens 3 Belege je Annahme, keine Ziffern in `msg`/`wins`, `de` deutsch und `en` englisch, `until ≤ day+3`, Größe ≤ 32 KB, gültiges JSON.
  9. Ein `set` auf `tutor/p-<heute>`.
  10. Eigene `p-*` löschen, die älter als 21 Tage sind.
  11. Antwort: Liste der geschriebenen und gelöschten Dokumente, sonst nichts.

**Beispiel für Emrahs Fälle** (IDs `ut.used-to`, `cp.subject`, `psp.since-for` sind echt; Wendungs- und Karten-IDs sowie Beleg-Zeitstempel sind nur zur Veranschaulichung):

```json
{
  "v": 1, "by": "routine", "day": "2026-10-20", "until": "2026-10-22",
  "in": { "day": "2026-10-19", "h": "9f3a1c07" },
  "focus": [
    { "kind": "pat", "id": "cp.subject", "w": 1.5,
      "why": { "de": "Bei Satzanfängen mit -ing ist das Subjekt im Hauptsatz oft nicht die Person, die handelt.",
               "en": "When you open with an -ing clause, the main subject is often not the person doing the action." },
      "ev": ["e:2026-10-14:1792000123456", "e:2026-10-17:1792260011223", "e:2026-10-18:1792349876543"] },
    { "kind": "chunk", "id": "ch-push-back-on", "w": 1.3,
      "why": { "de": "Die Wendung kennst du beim Lesen, beim freien Schreiben fehlt meist das on.",
               "en": "You recognize this phrase, but in free writing the on is usually missing." },
      "ev": ["a:act-2026-10-12-ch-push-back-on", "e:2026-10-16:1792170044556"] }
  ],
  "hyps": [
    { "id": "h-cp-subject", "from": "cp.subject", "to": "cp.ing", "cause": "confuse", "probe": true,
      "ev": ["e:2026-10-14:1792000123456", "e:2026-10-17:1792260011223", "e:2026-10-18:1792349876543"],
      "why": { "de": "Kann es sein, dass du den -ing-Teil bildest, ohne zu prüfen, wer im Hauptsatz handelt?",
               "en": "Could it be that you build the -ing part without checking who acts in the main clause?" } }
  ],
  "weights": { "focusSlot": "cp.subject", "dueBoost": { "cp.subject": 1.5, "ut.used-to": 1.2 },
    "formBias": { "cp.subject": -1 }, "newOrder": ["ch-push-back-on"], "actOrder": ["ch-push-back-on"],
    "extraOrder": ["course", "read", "clinic"] },
  "explain": [
    { "pat": "ut.used-to", "style": "contrast",
      "why": { "de": "Dein had ist richtig. Used to betont nur stärker, dass es heute anders ist.",
               "en": "Your had is correct. Used to just stresses more clearly that things are different now." } },
    { "pat": "cp.subject", "style": "business-example",
      "why": { "de": "Bei dir wirken Beispiele aus Kundenterminen besser als die abstrakte Regel.",
               "en": "Examples from client meetings work better for you than the abstract rule." } }
  ],
  "wins": [
    { "metric": "patAcc", "id": "psp.since-for", "from": "2026-09-28", "to": "2026-10-18",
      "text": { "de": "Seit und for: vor drei Wochen {a}, jetzt {b}.", "en": "Since and for: three weeks ago {a}, now {b}." } }
  ],
  "msg": { "de": "Starke Woche. Morgen schauen wir genauer, wer im Satz handelt. Bei used to bist du schon richtig, es geht nur um Feinheit.",
           "en": "Strong week. Tomorrow we look closely at who acts in the sentence. With used to you are already right, it is only about nuance." },
  "items": [
    { "kind": "gram", "task": { "pat": "cp.subject", "type": "find",
        "prompt": "Reviewing the contract, a mistake in the pricing table was found.",
        "answer": "Reviewing the contract, we found a mistake in the pricing table.", "accepted": [],
        "why": { "ok": { "de": "Wer prüft? Wir, also muss we das Subjekt sein.", "en": "Who reviews? We do, so we must be the subject." }, "wrong": [] } },
      "self": { "solved": "Reviewing the contract, we found a mistake in the pricing table.", "also": ["Reviewing the contract, I found a mistake in the pricing table."] } },
    { "kind": "sent", "card": "ch-push-back-on", "sit": "meeting",
      "en": "Our CFO pushed back on the timeline because the budget was still open.",
      "de": "Unser CFO hat sich gegen den Zeitplan gesträubt, weil das Budget noch offen war." }
  ],
  "read": [ { "kind": "course", "id": "k5", "why": { "de": "Lektion sechs passt zu deinem Rollout-Wortschatz.", "en": "Lesson six fits your rollout vocabulary." } } ],
  "self": { "checked": true, "dropped": ["had statt used to: kein Fehler, nur Hinweis"] }
}
```

Hinweis zum Beispiel: Das `also` mit „I found“ wäre nach der Regel für `solve-check` ein Grund, die Aufgabe zu verwerfen, es sei denn, es steht in `accepted`. Der Test soll genau das zeigen: Die App blendet dieses Teil aus, der Rest bleibt.

---

## (6) Einbettung in die Scheiben, Tests, Aufwand, Einrichtung

**Scheiben:**
- **E8-0, nach S2:** `src/domain/tutor/digest.ts` (rein, Größenwächter), `src/domain/tutor/routinePlan.ts` (`parseTutorPlan`), `src/features/tutor/digestWrite.ts` (Rundenende, `writer.transform`, nur bei neuem Hash), dazu `tutorSchema` in `src/data/schemas.ts` sowie `COLLECTIONS`, `LAZY_COLLECTIONS` und `ROUTINE_ONLY_RE` in `src/data/paths.ts`. Etwa 2 AP.
- **E8-1, in S3, Aufgabenwahl:** `src/domain/tutor/applyPlan.ts` macht aus dem Plan `hints`. `SlotInput.teacher?` in `slotPlan.ts` (focusSlot und dueBoost), `shift`-Startwert in `policy.ts`, `newOrder`/`actOrder` im Wortplan, `tutor/fb.days` beim Einfrieren. Etwa 2 AP.
- **E8-2, in S4, Nachschub:** `hyps` neben `diagnose@2` (E4 entfällt bei frischem Plan); `src/features/tutor/teacherStore.ts` (Zustand) und `TeacherCard.tsx` (Fortschritt, Skelett, `AiMark`, „Melden“); `wins` und `msg`; Quarantäne für `items`. Etwa 2,5 AP.
- **E8-3, in S5:** Prüfaufgaben für `probe` und die A/B-Auswertung in der Diagnose. Etwa 1,5 AP.
- **Anweisung und Beispiel:** `docs/umbau/tutor-routine.md` plus Test. Etwa 1 AP.
- **Summe: etwa 9 AP.**

**Ohne Plan:** Alles läuft wie heute, mit `hints = null`. Pflicht, Serie und Urteil sind davon nie abhängig (T-R7).

**Tests:**
- Unit `tests/unit/tutor/routinePlan.test.ts`:
  - Prüfung je Teil
  - unbekannte ID und unbekannter Beleg fallen weg
  - Ziffern in `msg`
  - `until > day+3`
  - veralteter Plan ergibt `null`
  - falsche Sprache
- Unit `routineDoc.test.ts`: das Beispiel aus der md-Datei gegen den echten Parser, nach dem Vorbild von `tests/unit/read/routine.test.ts`.
- Unit `digest.test.ts`: Größe ≤ 120 KiB bei Höchstwerten, Kürzung nach Vorrang, kein Schreiben ohne Änderung, Monat und Tag nach `dayKey` um 03:59 und 04:00.
- Unit `applyPlan.test.ts`:
  - ohne Plan gleich wie heute (Snapshot-Test)
  - Grenzen
  - Emrahs `wf` hat Vorrang
  - Einführungstag und Samstag unberührt
  - Plan mitten am Tag ändert den eingefrorenen Plan nicht
  - Vergleichswoche
- Simulation `tests/tutor/sim.test.ts` mit einem feindlichen Plan (extreme Gewichte, erfundene IDs): Die Invarianten aus v3 §7 bleiben grün, also Pflichtlänge, höchstens 1 Stufenwechsel je 5 Antworten, Barcroft und Tagesbremse.
- Datentests nach Regel 9: zwei Geräte schreiben `fb`, Wiederholung ohne Doppelung, `isReadOnlyPath('tutor/p-…')`, Sicherung enthält `tutor/in` und `fb`.
- E2E (Testlaufzeit, Seed mit `tutor/p-2026-09-20`):
  - Fortschritt zeigt den Block mit `AiMark`
  - ein schlechtes Teil ist ausgeblendet und steht im Protokoll
  - `?fake=nosample` und ein fehlender Plan ändern nichts an der Pflicht
  - DE und EN wechseln ohne Neuladen
- Widerspruchstest: Das Fokusmuster hat in Liste, Hub und Übung dieselbe Warum-Zeile.

**Was die Hauptsitzung bei der Einrichtung selbst tun muss:**
1. **Emrahs Zustimmung einholen:** Es ist eine neue Routine mit laufenden Kosten (Vorbild `entscheidungen.md:463`), dazu die Entscheidung zur Lockerung von v3 §1.
2. **Kurzer Test (etwa 0,5 AP):** Eine Probe-Routine einmal von Hand auslösen. Prüfen, ob `ArtifactData` ein Dokument von etwa 100 KB lesen kann, ob Skripte gehen und ob Sammlungen aufgelistet werden können. Ergebnis in `stand.md`.
3. **Eigenen Trigger anlegen,** nicht an `trig_01LxTDBs97GGemopdDnxgyXP` anhängen: getrennte Ausfälle, eigenes Modell und eigener Denkaufwand. Name „Englisch – Lehrer-Plan (nachts)“, täglich 01:30 UTC, stärkstes Modell, Werkzeug nur `ArtifactData`, **zuerst mit der URL des Test-Links `AXHkh6…`**, nie direkt live (A7).
4. Den Anweisungstext aus `tutor-routine.md` einfügen, einmal `fire_trigger` auslösen und in der App Fortschritt › „Dein Lehrer“ prüfen. Die Trigger-ID in CLAUDE.md A4 und `stand.md` eintragen.
5. **Rückweg:** Trigger pausieren. Vorhandene `tutor/p-*` stören nichts, ältere App-Versionen kennen den Pfad nicht.

---

## Prüfliste gegen Kapitel 3

| Punkt | | Fundstelle |
|---|---|---|
| Eine Datei ≤ 16 MB, alles eingebettet | ✅ | nur Code; keine Inhalte im Build |
| Kein Server, kein `fetch` | ✅ | Routine außerhalb der App; App nur `db.get` |
| Zugriff nur über `/src/platform` und `/src/data` | ✅ | Lesen über `src/data`, Schreiben über `writer.transform` |
| `claude.use` darf `null` liefern | ✅ | ohne Datenbank oder Plan `hints = null` |
| `sample` ohne Gedächtnis, ≤ 64 KiB | ✅ | E8 nutzt `sample` nicht; E4 entfällt eher |
| Fehlercodes, kein Zeitgeber | ✅ | kein Timer in der App; die Routine läuft außerhalb |
| `onSnapshot` einmal je Abfrage, ≤ 64 | ✅ | keine neuen Abos, 3 `get` |
| Schreiben nur bei Änderung, eins je Dokument, `update` nur vorhanden | ✅ | `in` mit Hash am Rundenende, `fb` als Objekt-Map, `p-*` schreibgeschützt |
| Dokumentgrenzen | ✅ | +23 Dokumente, alle ≤ 200 KiB mit Wächter; `tutor` träge geladen |
| Lernfortschritt nur in `db` | ✅ | keine Lernwerte in `tutor/*`; Übersetzer-Auszug nur mit Schalter |
| Entwicklungs-Adapter ausgeschlossen | ✅ | Seed-Plan nur in `seed/` und im Testadapter |
| Keine leeren `catch` | ✅ | `tutor:plan item_hidden` ins Protokoll |
| Kein Prompt-Text in der Oberfläche | ✅ | Anweisung in `docs/umbau/tutor-routine.md`, kein App-Prompt |
| Optimistisch mit Rückrollen, Skelette | ✅ | Skelett in `TeacherCard`; keine optimistischen Lernbuchungen |
| Stack | ✅ | zod, Zustand (`teacherStore`), keine neue Bibliothek |

**Größte Risiken:**
- **Kontingent:** Gegenmittel sind die Sparregel und dass E4 entfällt.
- **Routine schreibt falsche Dokumente:** Gegenmittel sind Anweisung, Prüfung der Läufe und Sicherung; technisch sperren lässt es sich nicht.
- **Scheinbare Wirkung bei einem einzigen Lerner:** Gegenmittel sind die Vergleichswochen und dass Emrah entscheidet.
- **Vorschläge mit Fehlern:** Gegenmittel ist die Quarantäne mit Stichprobe des Englischlehrers.
