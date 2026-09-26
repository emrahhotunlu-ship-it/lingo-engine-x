# Phase 3 – Sprechen: verbindlicher Umsetzungsplan (Architekt)

Stand: 26.09.2026. Vorrang bei Widersprüchen: `contract/*.d.ts` > CLAUDE.md (A6/A7) > `docs/auftrag.md` > dieser Plan. Der Lead legt ihn als `docs/phase3-plan.md` ab. Ich habe nichts im Repository geändert.

---

## 0. Ausgangslage, Vorbedingungen, Befunde am Bestand

### 0.1 Was es schon gibt und genutzt wird
| Baustein | Datei | Nutzung in Phase 3 |
|---|---|---|
| KI-Tor, nur JSON (`askJson`), Warteschlange mit 2 Plätzen, `user` vor `background`, Pause nach `rate_limited`, Hinweis „dauert länger“ | `src/ai/gate.ts`, `queue.ts`, `status.ts`, `errors.ts`, `scope.ts`, `useAsk.ts` | unverändert, dazu kommt ein **Streaming-Weg** (§6.1) |
| Vorlagen-Typ, `clip`, `langOf`, Kopfzeile `[id@v]` | `src/prompts/types.ts`, `common.ts`, `registry.ts` | wird um `ChatTemplate` erweitert |
| Sprachausgabe (Stücke ≤ 150 Zeichen, 60 ms nach `cancel`, Wecker, `unlockSpeech`) | `src/platform/speech.ts` | kommt dazu: `listVoices()` und Stimmenwahl |
| Wort-Antippen | `src/engine/EnglishText.tsx`, `wordTap.ts` | Bereich `WordTapArea` wird um `'speak'` und `'business'` erweitert |
| Schreibpfad (`transform`/`createIfMissing`/`update`, kein Löschen, `daily`/`feed` gesperrt) | `src/data/writer.ts` | einziger Schreibweg |
| Sammel-Puffer für Profil und Log mit `lxSeq` | `src/features/vocab/persist.ts` | wird **gemeinsam** genutzt (§3.6) |
| Schemas `chunkSchema`, `sceneSchema` (sehr knapp) | `src/data/schemas.ts:211, 325` | werden erweitert (§3.1) |
| Szenen der alten App | `src/content/legacy/scenes.json` (4 Szenen) | Bibliothek, die Datenbank gewinnt |
| Kanalfarben `--lx-ch-speak`, `--lx-ch-business` | `src/styles/index.css:65f.` | Symbole und Kanten |

### 0.2 Vorbedingungen (Blocker, nicht still überspringen)
- **V1 – Rest von Phase 1 ist gemergt.** Im Repository fehlen noch:
  - `src/engine/tiles/*` (Bausteine; der E-Mail-Refiner braucht sie nach Kap. 4.2),
  - `buildChunkCards` / `src/domain/srs/chunkCards.ts` (ohne sie werden mitgenommene Wendungen nie abgefragt),
  - die i18n-Aufteilung in `src/i18n/parts/*` (heute gibt es nur `ai.*`),
  - `ui/Popover.tsx` und die Laufzeit-Abos auf `chunk`.

  Phase 3 beginnt erst, wenn diese Teile auf `main` liegen.
- **V2 – Phase 2 liefert die Navigation zu den Modulen und das Kanalregister.** Die Annahmen:
  - ein Bereich „Üben“ oder ein Einstiegspunkt,
  - Plan-Kanäle mit `executable`,
  - ein Pflichtkanal aus dem Tagesmix.

  Heißen die Namen dort anders, gleicht Schritt 0 nur die Namen an. Die Logik dieses Plans bleibt.

### 0.3 Befunde am Bestand, die dieser Plan behebt
| # | Befund | Fundstelle | Maßnahme |
|---|---|---|---|
| B1 | Das KI-Tor kennt nur `sample.json`. Die Figur muss aber als Text über `onText` streamen und braucht eine Liste von Gesprächszügen. | `src/ai/gate.ts:95` | neu `src/ai/stream.ts` (§6.1) |
| B2 | **Die Warteschlange kann hungern.** Laufen zwei `complex`-Analysen, wartet die nächste Antwort der Figur bis zu 2 Min. Die Priorität ordnet nur Wartende, sie verdrängt nichts. | `src/ai/queue.ts` | Analysen laufen **nacheinander** über eine eigene Spur. So bleibt immer ein Platz für die Figur frei (§6.3). |
| B3 | Jeder Log-Eintrag mit `ctx:'rev'` und `id` zählt als Vokabel. Ein Sprech-Eintrag würde „Wiederholen“ verfälschen. | `src/features/vocab/session.ts:118` | Die Bedingung wird auf `e.k === 'v'` verschärft (wie `buildPlan.ts:68`). Sprech- und Business-Einträge tragen **nie** `ctx:'rev'`. |
| B4 | Die Ursprungssätze der Wendungen im Testdatensatz sind unsinnig, z. B. `"We need to I take your point, but …."`. So prüft kein Test echte Ursprungssätze (Kap. 15). | `seed/sample-data.json:1664` | Der Seed-Generator erzeugt stimmige `utterance`/`upgraded` (§9.4). |
| B5 | Der nachgebildete `sample` kann keine Fehler je Vorlage auslösen. Den Fall „Analyse fällt aus, Gespräch läuft weiter“ kann man so nicht testen. | `src/platform/dev/fakeSample.ts:73` | Steuerung `sampleFail: {[templateId]: code}` (§9.5) |
| B6 | Der Zähler `lxSeq` hängt an `nextT()` aus `vocab/persist.ts`. Ein zweiter, eigener Zähler eines anderen Moduls würde Profil-Schreibvorgänge still verwerfen (`lxSeq ≥ seq`). | `persist.ts:46, 126` | Sprechen und Business schreiben Profil und Log **nur** über denselben Puffer (§3.6). |

### 0.4 Entscheidungsregister
| # | Frage | Entscheidung | Begründung |
|---|---|---|---|
| D1 | Stufe (`modelTier`) der Figur | **`quick`**, als Konstante `FIGURE_TIER` in `roleplayTurn.ts`. Das weicht von Kap. 10 (`default`) ab. learning-scientist bestätigt einmal. Emrah wird im Phasenbericht informiert. | `sample.d.ts`: `quick` ist für „conversational replies where snappiness matters“; `default` denkt vor der ersten Silbe 5–60 s nach, und das zerstört den Gesprächsfluss am Handy (Kap. 4, Kap. 14). Gleiches Muster wie bei `produce-check` (Phase 1, E17). |
| D2 | Stufe der Analyse | `complex` (Kap. 10), Priorität `background`, **höchstens eine Analyse gleichzeitig** | Auftrag wörtlich; B2 |
| D3 | Wann werden Gesprächsverläufe gespeichert? | **Nur am Gesprächsende**, verdichtet in `talk/<JJJJ-MM>`. Während des Gesprächs liegt eine Kopie zum Fortsetzen in `localStorage` (Bequemlichkeit). | Die alte App speichert keine Verläufe; für Phase 6 werden aber „Rollenspiel-Analysen“ als Rohbelege gebraucht (Kap. 5). Ein Dokument je Gespräch wäre ein wachsender Strom (A6.6). |
| D4 | Wann zählt Sprechen als Pflicht (`ch:speak`)? | beendetes Gespräch mit **≥ 4 eigenen Zügen**, Log-Eintrag `type:'speak'` mit `n ≥ 4` | eindeutig, aus `log/<tag>` ableitbar (Kap. 2.2) |
| D5 | Spracheingabe | nur, wenn die Web-Speech-Schnittstelle existiert, die Permissions-Policy nicht dagegen spricht und kein früherer Start in diesem Browser mit `not-allowed`/`service-not-allowed`/`audio-capture` gescheitert ist. Scheitert ein Start, wird der Knopf **sofort und dauerhaft** ausgeblendet (`lx:stt-blocked`). Das Ergebnis landet immer im Textfeld, nie wird automatisch gesendet. | Kap. 6.5, A7.4. `contract/` hat keine Mikrofon-Fähigkeit, im eingebetteten iframe ist das Mikrofon also ungewiss. |
| D6 | Wendungen „mitnehmen“ | neues `chunk/c-<slug>` im alten Format plus `def`, `whyLang`, `origin`, `src.kind`. Gibt es die Wendung schon: **kein Schreiben**, Zustand „schon in deinen Wendungen“; ausgeblendet → „Wieder aufnehmen“ (`update({hidden:false})`). `also[]` wird nie geschrieben. | Kap. 9 nur ergänzen; die Bedeutung von `also` ist nicht belegt (A6.16). |
| D7 | Fehler aus dem Sprechen im Fehler-Radar | `app/radar.events` bekommt Einträge, **nur** mit Kategorie aus den 16 Grammatikthemen, Quelle `s:'k'` (Sprechen) bzw. `s:'b'` (Business), am Gesprächsende, gedeckelt auf 400. `grammar/<topic>` wird **nicht** geändert. | Belege für Phase 6, ohne Eingriff in das gedämpfte BKT (Kap. 5) |
| D8 | Emrahs Trainer-Regeln auf Sprechen und Business | Oben steht der Status (Szene, Zug n, Ziel-Chip). „Wozu“ steht nur hinter dem Info-Symbol. Die Analyse zeigt Korrektheit und Aufwertung sofort, „Warum landet das besser“ als **eine** Zeile (≤ 160 Zeichen). Beispiele (aufgewertete Fassung, Wendungen) statt Erklärabsätzen. Jedes englische Wort ist antippbar. Es gibt keine Selbstbewertung. | A7, 18:15 Uhr + „Vollausbau“ |
| D9 | Phrasen-Baukasten ohne KI | Entscheidungsbäume als **Inhalt** (`src/content/business/playbooks.json`, zweisprachig, jede Wendung mit Beispielsatz). KI nur optional: „auf meine Lage anpassen“. | funktioniert ohne `sample` (Kap. 3.1), kein Prompt-Text in der Oberfläche |
| D10 | Figur und Sprachausgabe | Die Antwort wird **nach** dem Streamen vorgelesen, nicht Stück für Stück. Automatisches Vorlesen ist abschaltbar (`lx:speak-autoplay`, Standard an). `unlockSpeech()` läuft synchron im Klick „Gespräch starten“. | gegen abgehackte Ausgabe am iPhone (Kap. 15) |

---

## 1. Ziel und Umfang

**Ziel (Kap. 6.5, 6.6, 13):** Emrah führt Business-Gespräche aus seiner Berufswelt gegen eine KI-Figur, die nie korrigiert. Ein Analysepanel zeigt je Zug drei Schichten und stört den Gesprächsfluss nie. Gute Wendungen nimmt er mit einem Tipp als Karten mit eigenem Satz und aufgewerteter Fassung in den Chunk-Trainer mit. Nach jedem Gespräch kommt ein Abschlussbericht. Dazu kommt die Business-Suite: E-Mail-Refiner mit Bausteinen, Verhandlungs- und Phrasen-Baukasten, Präsentations-Coach. Sprachausgabe mit Stimmenwahl und, wo möglich, Spracheingabe runden die Phase ab.

**In Phase 3:**
1. **Sprechen-Übersicht:**
   - Szenen aus `scenes.json` und `scene/*` (Datenbank gewinnt) plus KI-neue Szenen, optional mit Wunsch, Grammatik-Fokus und Wörtern (Kap. 2.5).
   - Je Szene: Einweisung (Lage, Ziel, Gegenüber, hilfreiche Wendungen, Vorlesen).
2. **Rollenspiel:**
   - Chat mit Streaming und Stopp-Knopf, Composer mit Mikrofon (nur wenn verfügbar).
   - Hilfreiche Wendungen als Chips: ein Tipp fügt sie ein.
   - Analysepanel mit drei Schichten und „Mitnehmen“.
   - Fortsetzen nach einem Neuladen.
3. **Abschlussbericht:** fester Teil ohne KI plus KI-Bericht; wird gespeichert und fließt in Log, Profil, Radar und Pflicht.
4. **Business-Suite:** E-Mail-Refiner, Baukasten (4 Bäume + Kurzdrill), Präsentations-Coach (Sprechfassung, Üben, Rückmeldung mit Abdeckung).
5. **Einstellungen:** Stimme (Liste mit Probehören), Tempo 0,8–1,1 (`app/profile.voice`/`rate`), „Antworten im Rollenspiel vorlesen“.
6. **Heute:**
   - Kanal `speak` wird ausführbar (Pflicht oder Angebot nach dem Register aus Phase 2), `biz` wird Angebot.
   - Die Tagesbilanz nennt Gespräche und Business-Einheiten, ohne die Trefferquote zu verfälschen.

**Nicht in Phase 3:**
| Inhalt | Wann | Grund |
|---|---|---|
| Kanalgewichtung, KI-Einschätzung aus `talk/*` | 6 | Kap. 13 |
| BKT-Änderung durch Sprechfehler | 6 | D7 |
| Claude-Chat / „im Chat weiterfragen“ aus der Analyse | 5 | Kap. 13 |
| Aussprachebewertung (Audio an `sample`) | – | `sample` nimmt nur Text und Bilder (`sample.d.ts`) |
| Verdichten alter `talk`-Monate über die Kappung hinaus | 7 | eigener Beschluss mit data-guard |

---

## 2. Architektur und Dateiplan

Neu: N · geändert: Ä. In Klammern das Arbeitspaket (§10).

```
src/
  ai/         stream.ts N (A) · useStream.ts N (A) · types.ts Ä (S0: StreamRequest/StreamResult)
  prompts/    types.ts Ä (S0: ChatTemplate) · threeLayers.ts N (A) · roleplayTurn.ts N (A)
              turnAnalysis.ts N (A) · roleplayReport.ts N (A) · sceneGen.ts N (A)
              mailRefine.ts N (E1) · phraseAdapt.ts N (E1) · pitchScript.ts N (E1) · pitchFeedback.ts N (E1)
              registry.ts Ä (INT)
  platform/   stt.ts N (D) · speech.ts Ä (D: listVoices, previewVoice) · storage.ts – 
              dev/cannedSpeak.ts N (A) · dev/cannedBiz.ts N (E1) · dev/fakeStt.ts N (D)
              dev/fakeSample.ts Ä (F: Fehler je Vorlage) · dev/fakeRuntime.ts Ä (F) · dev/cannedReplies.ts Ä (INT)
  data/       schemas.ts Ä (S0) · paths.ts Ä (S0: talk, biz) · watch.ts N (B: ein Abo auf eine Sammlung, ansichtsgebunden)
  domain/
    speak/    types.ts N (S0) · library.ts N (B) · transcript.ts N (B) · talkDoc.ts N (B)
              reportStats.ts N (B) · duty.ts N (B) · sceneDoc.ts N (B)
    chunks/   newChunk.ts N (B)
    progress/ profilePatch.ts Ä (S0) · logPatch.ts Ä (S0) · radarPatch.ts N (B)
    business/ types.ts N (S0) · playbook.ts N (E1) · drill.ts N (E1) · mailCompose.ts N (E1)
              bizDoc.ts N (E1) · coverage.ts N (E1)
    plan/     deriveToday/channels Ä (INT, Dateien aus Phase 1/2)
    srs/      newCard.ts Ä (S0: CardOrigin.kind + 'scene'|'biz') · chunkCards.ts Ä (INT: topicKey für src.kind)
  content/    business/playbooks.json N (E1)
  engine/     wordTap.ts Ä (S0: Area) · MicButton.tsx N (D) · SpeakButton.tsx N (D)
  features/
    speak/    SpeakHub.tsx · SceneCard.tsx · SceneBriefing.tsx · SceneCreateSheet.tsx
              RoleplayScreen.tsx · ChatLog.tsx · Composer.tsx · AnalysisCard.tsx · AnalysisPanel.tsx
              TakeChunkButton.tsx · ReportScreen.tsx · roleplayMachine.ts · analysisLane.ts
              persist.ts · resume.ts · useSceneLibrary.ts                      N (C)
    business/ BusinessHub.tsx · MailRefiner.tsx · mailMachine.ts · PlaybookScreen.tsx
              PlaybookDrill.tsx · PitchCoach.tsx · pitchMachine.ts · persist.ts  N (E2)
    settings/ VoiceSection.tsx N (D) · SettingsSheet.tsx Ä (D, eine Einfügestelle)
    vocab/    persist.ts Ä (S0: recordActivity) · session.ts Ä (S0: B3)
    today/    * Ä (INT: Kanalzeilen, Bilanz)
  app/        nav.ts Ä (S0) · App.tsx Ä (INT)
  i18n/       parts/speak.{de,en}.ts N (C) · parts/biz.{de,en}.ts N (E2) · parts/voice.{de,en}.ts N (D) · de.ts/en.ts Ä (S0)
scripts/      generate-seed.mjs Ä (F) · check-platform.mjs – 
seed/         sample-data.json Ä (F)
tests/        unit/* (je Paket) · e2e/speak.spec.ts, business.spec.ts, voice.spec.ts N (F)
docs/         phase3-plan.md N (S0) · datenmodell.md Ä (INT)
eslint.config.js Ä (S0: prompts dürfen domain/answer/spelling und domain/text importieren)
```

**Schichtregeln** (bestehend aus Phase-1-Plan §2.1, eine Ausnahme neu):
- `src/prompts/**` darf zusätzlich `domain/answer/spelling` (britische Form ≠ Fehler) und `domain/text/*` (Enthaltensein einer Wendung) importieren. Beides ist reine Logik ohne Oberfläche.
- `features/business` darf `features/speak/{AnalysisCard,TakeChunkButton}` importieren (features → features ist erlaubt).

### 2.1 Laufzeit-Zustand
| Store / Maschine | Datei | Inhalt |
|---|---|---|
| `roleplayMachine` (XState v5) | `features/speak/roleplayMachine.ts` | Ablauf eines Gesprächs (§5.2) |
| `analysisLane` | `features/speak/analysisLane.ts` | FIFO, **eine** Analyse gleichzeitig, Abbruch beim Aushängen |
| `useSceneLibrary` (zustand) | `features/speak/useSceneLibrary.ts` | zusammengeführte Szenen; Abo nur, solange Sprechen offen ist |
| `mailMachine`, `pitchMachine` (XState) | `features/business/*` | Eingabe → KI → Auswahl/Üben → Ergebnis |
| `useSpeech` Ä | `platform/speech.ts` | zusätzlich `voices: VoiceInfo[]` |
| `useStt` | `platform/stt.ts` | `status: 'unknown'\|'available'\|'blocked'\|'unsupported'`, `listening`, `interim` |

**Abos:** Bis zu 10 von 64:
- Phase 1: 8 Abos plus `day`;
- neu: `scene` (nur während Sprechen offen ist, `useEffect` mit leerer Abhängigkeitsliste über `data/watch.ts`).

`talk/*` und `biz/*` werden **nur per `get()`** gelesen (Verlauf und Bericht), nie abonniert.

---

## 3. Datenformen und Schreibwege

Alle Schreibvorgänge gehen über `src/data/writer.ts`. Auslöser ist immer eine Handlung von Emrah, nie Render, Snapshot oder Timer. Je Dokument gibt es eine Warteschlange, `delete` gibt es nicht.

### 3.1 Schema-Ergänzungen (S0, `src/data/schemas.ts`, alle `nullish`, nichts verschärft)
- `sceneSchema` → `looseObject`:
  - `{ id, title, title_de, situation, situation_de, goal, goal_de, persona: looseObject({name, role, org, traits}).nullish(), stake, objection, opening, useful: array(looseObject({en, de})).nullish(), level, ts, done: loose, band: loose, runs: num, lastRun: num, src: str, pv: str }`
- `chunkSchema` bekommt zusätzlich:
  - `def: str, whyLang: str, origin: looseObject({v,kind,ref,title,t}).nullish(), seen: loose, hidden: bool`
  - `src` bleibt die Union aus String und Objekt.
- **Neu** `talkSchema` (`talk/<JJJJ-MM>`):
  - `looseObject({ v: num, month: str, runs: array(looseObject({ id: str, t: num, day: str, scene: str, title: str, turns: num, ms: num, goal: str, clean: num, errs: record(num).nullish(), taken: strArr, lines: looseArr, report: looseObject({}).nullish(), lang: str, tier: str })).nullish() })`
- **Neu** `bizSchema` (`biz/<JJJJ-MM>`):
  - `looseObject({ v: num, month: str, items: array(looseObject({ id: str, t: num, day: str, kind: str })).nullish() })`
- `paths.ts`: `COLLECTIONS.talk`, `COLLECTIONS.biz`. `snapshot.ts` nimmt beide automatisch in Sicherung und Export auf (`COLLECTION_NAMES`). Sie sind **nicht** schreibgeschützt.

### 3.2 Übersicht der Schreibwege
| Dokument | Auslöser | Operation | Paket |
|---|---|---|---|
| `chunk/c-<slug>` | Knopf „Mitnehmen“ | `transform`: fehlt → `set(newChunk)`; vorhanden und `hidden` → nichts (die Oberfläche bietet „Wieder aufnehmen“ an); sonst nichts | B (Rechnung), C/E2 (Aufruf) |
| `chunk/<id>.hidden=false` | „Wieder aufnehmen“ | `update({hidden:false})` | C |
| `scene/sc-ai<ms36>` | „Szene erstellen“ erfolgreich | `createIfMissing(doc)` | C |
| `scene/<id>` (Lauf-Vermerk) | Gesprächsende | `transform`: fehlt (Szene nur aus `scenes.json`) → `set({...legacy, ts, done:true, runs:1, lastRun})`; vorhanden → `update({runs:n+1, lastRun, ...(done ist fehlend oder false ? {done:true} : {})})`. Ein vorhandenes `done` anderen Typs bleibt stehen. | B/C |
| `talk/<JJJJ-MM>` | Gesprächsende; „Bericht neu erstellen“ | `transform`: fehlt → `set({v:1, month, runs:[run]})`; sonst `update({runs: compactRuns(upsert(runs, run))})`, idempotent über `run.id` | B/C |
| `log/<tag>` | Gesprächs- bzw. Business-Ende | über den gemeinsamen Puffer (`recordActivity`) | S0/C/E2 |
| `app/profile` | wie oben | über den gemeinsamen Puffer (`recordRoundEnd` mit `act:'speak'\|'biz'`) | S0/C/E2 |
| `app/radar` | Gesprächsende, Pitch-Rückmeldung | `transform`: fehlt → `set({events})`; sonst `update({events: merged.slice(-400)})` | B |
| `biz/<JJJJ-MM>` | Mail fertig, Pitch-Rückmeldung, Drill beendet | `transform`, wie `talk`, idempotent über `item.id` | E1/E2 |
| `app/profile.voice`, `.rate` | Einstellungen | `patch` optimistisch mit Rückrollen (Muster `app/actions.ts`) | D |

### 3.3 Neue Wendung (`src/domain/chunks/newChunk.ts`)
```ts
export type ChunkSource =
  | { kind: 'scene'; scene: string; sceneTitle: string; utterance: string; upgraded: string; turn: number }
  | { kind: 'mail' | 'pitch' | 'biz'; ref: string; title: string; utterance: string; upgraded: string };
export type NewChunkInput = {
  en: string; de: string; def: string;
  kind: 'collocation' | 'frame' | 'phrase'; register: 'formal' | 'neutral' | 'informal';
  why: string; whyLang: 'de' | 'en'; level?: string | null;
  src: ChunkSource; nowMs: number;
};
export function chunkId(en: string): string | null;          // 'c-' + slug(en ohne „…“/Satzzeichen), ≤ 60 Zeichen, Pfadgrammatik
/** null, wenn en nicht (normalisiert, Wortgrenzen) in src.upgraded vorkommt, en > 8 Wörter oder de/def leer. */
export function newChunkDoc(i: NewChunkInput): { id: string; doc: Record<string, unknown> } | null;
export function takeChunkOp(cur: Doc | undefined, made: { doc: Doc }): { set: Doc } | null;  // nie update
```
Das erzeugte Dokument ist das alte Format plus Ergänzungen:
```json
{ "id": "c-push-back-the-go-live", "en": "push back the go-live", "de": "den Go-live verschieben",
  "def": "to move the launch to a later date", "kind": "collocation", "register": "neutral",
  "why": "Klingt nach Planung statt nach Versäumnis.", "whyLang": "de",
  "src": { "kind": "scene", "scene": "sc-vida", "sceneTitle": "Holding the Q2 e-invoicing deadline",
           "utterance": "We must delay the start.", "upgraded": "If we push back the go-live, the exposure is yours, not ours.",
           "turn": 3, "ts": 1790488800000 },
  "level": "C1", "created": 1790488800000, "also": [],
  "state": "new", "S": 0, "D": 5, "due": 0, "last": 0, "reps": 0, "lapses": 0, "stage": 0, "modes": {},
  "origin": { "v": 1, "kind": "scene", "ref": "scene/sc-vida", "title": "Holding the Q2 e-invoicing deadline", "t": 1790488800000 } }
```
- Bei Business-Wendungen gilt: `src.kind` = `'mail'|'pitch'|'biz'`, `src.ref` z. B. `playbook/decline#n3`, und es gibt kein `scene`.
- `chunkCards.ts` (INT) nimmt als `topicKey` `src.scene ?? src.ref`.
- Den Kontext liefert wie bisher `src.upgraded` (Phase-1-Plan §4.1). Deshalb ist die Prüfung „`en` ⊂ `upgraded`“ Pflicht, im Schema **und** in `newChunkDoc`.

### 3.4 Gesprächs-Datensatz (`src/domain/speak/talkDoc.ts`)
```ts
export type TalkLine = { u: string; up: string; v: 'clean' | 'minor' | 'errors' | 'na'; c: string[] }; // u/up ≤ 200 Zeichen
export type TalkRun = { id: string; t: number; day: string; scene: string; title: string; src: 'legacy' | 'db' | 'ai';
  turns: number; ms: number; end: 'user' | 'goal'; goal: 'reached' | 'partly' | 'missed' | null;
  clean: number; errs: Record<string, number>; taken: string[]; lines: TalkLine[];   // ≤ 16 Zeilen
  report: StoredReport | null; lang: 'de' | 'en'; tier: string; v: 1 };
export const TALK_DOC_MAX_BYTES = 200 * 1024;
export function monthOf(day: string): string;                                  // '2026-09'
export function upsertRun(cur: Doc | undefined, run: TalkRun): { set: Doc } | { update: Doc };
/** Solange > 200 KiB: `lines` des ältesten Laufs mit Zeilen entfernen, dann `report.focus/strengths` des ältesten. */
export function compactRuns(runs: readonly unknown[]): unknown[];
```
Geschätzte Größe:
- typischer Lauf etwa 5 KiB, schlimmster Fall etwa 11 KiB;
- 30 Gespräche im Monat sind etwa 150 KiB.

Ein Test beweist, dass ein Monatsdokument ≤ 200 KiB bleibt, auch bei 100 Läufen im schlimmsten Fall.

### 3.5 Business-Datensatz (`src/domain/business/bizDoc.ts`)
```ts
export type BizItem =
  | { id; t; day; kind: 'mail'; recipient; intent; orig: string /*≤3000*/; final: string /*≤3000*/; picks: Array<[seg: number, opt: number]>; changes: number; taken: string[]; lang }
  | { id; t; day; kind: 'pitch'; points: string[]; attempt: string /*≤2000*/; verdict; covered: number; total: number; lang; summary: string }
  | { id; t; day; kind: 'play'; playbook: string; drill: { n: number; right: number } };
```
- Gleiche Kappung wie bei `talk`: 200 KiB. Beim Verdichten werden zuerst `orig`/`final`/`attempt` der ältesten Einträge geleert, die Kennzahlen bleiben.

### 3.6 Log und Profil (gemeinsamer Puffer, S0)
- `src/domain/progress/profilePatch.ts`:
  - `RoundEnd.act: 'review' | 'cards' | 'speak' | 'biz'`;
  - neues Feld `countAs?: number`, das zusätzlich `days[day]` und `answers` erhöht. Beim Sprechen ist das die Zahl eigener Züge, bei Business 1.
  - `ROUND_BONUS.speak = n => Math.min(150, 10 * n)`, `ROUND_BONUS.biz = () => 15`.
  - `ema`/`n` bleiben unberührt. `minutes` und `act[day].speak` bzw. `act[day].biz` werden erhöht. Bei Abbruch unter 4 Zügen: `speak~` (Konvention der alten App).
- `src/domain/progress/logPatch.ts`: neuer Typ `ActivityLogEntry`:
  ```json
  { "t": 1790489400000, "ok": true, "lang": "de", "type": "speak", "id": "sc-vida", "m": "speak",
    "q": "Holding the Q2 e-invoicing deadline", "n": 6, "ms": 720000, "ctx": "spk" }
  ```
  - Business: `type:'biz'`, `m:'biz-mail'|'biz-pitch'|'biz-play'`, `ctx:'biz'`.
  - **Nie** `k:'v'`, **nie** `ctx:'rev'|'xtra'` (B3).
- `src/features/vocab/persist.ts` (S0): `recordActivity(e: ActivityLogEntry & {day})` hängt an denselben Puffer an und schreibt sofort (`flush`).
  - Profil, Log, `lxSeq` und `nextT` bleiben **eine** Quelle (B6).
  - Die Tageszuordnung richtet sich nach dem Lerntag des **Gesprächsbeginns** (wie Phase-1-Plan E10).

### 3.7 Pflicht und Tagesbilanz (INT, Dateien aus Phase 1/2)
- `domain/speak/duty.ts`: `speakDutyDone(entries) = entries.some(e => e.type==='speak' && num(e.n) >= 4)`. `deriveToday` bindet das für `ch:speak` ein.
- Tagesbilanz:
  - `balance.answers`/`correct` zählen nur Übungseinträge (`k:'v'`, `type:'chunk'`, Grammatiktypen).
  - Neu `balance.talks` und `balance.biz`, Anzeige: „1 Gespräch · 2 Business-Einheiten“.
- Selbstheilung von `pflicht[heute]` wie in Phase 1: `ensureDay` leitet ab und setzt nur.

### 3.8 Lesen und Zusammenführen der Szenen (`src/domain/speak/library.ts`)
```ts
export type SceneView = { id; src: 'legacy' | 'db' | 'ai'; title: string; situation: string; goal: string;   // in UI-Sprache (Fallback EN)
  persona; stake; objection; opening; useful: {en; de}[]; level; runs: number; lastRun: number | null; valid: boolean; raw: Doc };
export function mergeScenes(legacy: readonly Doc[], db: ReadonlyMap<string, Doc>, invalid: ReadonlySet<string>, lang: Lang): SceneView[];
```
- Die Datenbank gewinnt je `id`.
- Ungültige `scene/*` erscheinen **nicht** und werden gemeldet.
- Eine Szene ohne `opening` oder `persona` ist `valid:false` und nicht startbar.
- Sortierung: nie gespielt zuerst, dann nach `lastRun` aufsteigend.

### 3.9 Kapazität
Neue Dokumente:
- `talk`: 12 pro Jahr;
- `biz`: 12 pro Jahr;
- `scene/sc-ai*`: je Handlung 1. Ab 150 KI-Szenen erscheint ein Hinweis, das Erstellen bleibt möglich;
- `chunk/*`: je Handlung 1.

Kein Dokument entsteht ohne Handlung. Die Diagnose zeigt die Größe von `talk/<Monat>` und `app/radar`, Warnung ab 200 KiB.

---

## 4. Lerndesign

### 4.1 Vier Pflichtfragen an fester Stelle
| Frage | Rollenspiel | Refiner | Coach | Baukasten-Drill |
|---|---|---|---|---|
| Was soll ich tun? | Statuszeile: „Antworte Reinhard Vogt · Ziel: Q2 halten“ | „Wähle je Satz eine Fassung“ | „Sprich die Folie in 60 s“ | „Welche Antwort passt?“ |
| Wozu? | Info-Symbol: Output unter Druck, Wendungen im Einsatz | Info: Register und Prägnanz | Info: freies Sprechen mit Struktur | Info: Abruf unter Entscheidung |
| Was hatte ich, was ist richtig? | Analyse, Schicht 1: eigener Satz mit Wort-für-Wort-Vergleich → richtige Form | Original ↔ gewählte Fassung | Abdeckung + Schicht 1 | Wahl ↔ richtige Wendung |
| Warum? | Schicht 2 (Aufwertung mit Begründung je Änderung) + Schicht 3 (eine Zeile „landet besser, weil …“) | Begründung je Änderung | Schicht 2 + 3 | Beispielsatz + Hinweis `note` |

Die Begründung kommt **auch bei sauberem Satz**: `lands` ist im Schema Pflicht.

### 4.2 Lernprinzipien
- **Output unter Druck:** Die Figur widerspricht nach `stake`/`objection` und fragt nach, wenn eine Antwort vage bleibt.
- **Generierung:** Emrah formuliert selbst; Wendungen werden nur eingefügt, wenn er einen Chip antippt, und zählen dann nicht als eigener Beleg (`usedChip` im Zug, im Bericht getrennt ausgewiesen).
- **Chunks statt Einzelwörter:** Die Analyse schlägt je Zug höchstens 3 Wendungen vor, jede steckt im aufgewerteten Satz. Mitnehmen führt in FSRS.
- **Kombinierte Aufgaben:** `scene-gen` übernimmt Grammatik-Fokus (schwächstes Thema aus `grammar/*` nach `p`) und bis zu 8 Wörter (fällige Karten). Die Analyse markiert, wenn Emrah eines dieser Wörter richtig nutzt (`targets[]`).
- **i+1:** Die Figur spricht C1-nah, die Szenenstufe ist `B2+`/`C1`.
- **Wiederholung:** Mitgenommene Wendungen erscheinen am nächsten Lerntag im Wiederholen, über das Kontingent für neue Karten.
- **Kein Punktestand:** Der Bericht urteilt in Worten (Ziel erreicht/teilweise/verfehlt, Stärken, Fokus). Eine Zahl gibt es nur als Tatsache („4 von 6 Sätzen sauber“).

### 4.3 Automatische Einstufung (Emrahs Regel)
- Es gibt keine Selbstbewertung.
- Im Baukasten-Drill (Auswahl) entscheidet die Wahl, die Note spielt keine Rolle; es entsteht nur `biz.play.drill`.
- Karten, die nach dem Mitnehmen im Chunk-Trainer landen, stuft die Phase-1-Logik ein.

---

## 5. Bildschirme und Interaktion

### 5.1 Sprechen-Übersicht (`SpeakHub`, `data-screen="speak"`)
- Kopf: „Sprechen“ und die Statuszeile „Heute: Pflicht offen · Gespräch mit ≥ 4 Zügen“ bzw. „Heute erledigt“ (Zustand, kein Knopf).
- Szenenkarten (Glas):
  - Titel in der UI-Sprache, Gegenüber (Rolle, Organisation), Stufe, „noch nie“ bzw. „zuletzt vor 3 Tagen“;
  - Kante in Kanalfarbe Sprechen;
  - Tipp öffnet die Einweisung (gemeinsames Layout-Element Karte → Blatt).
- Knopf „Neue Szene“ (`data-ai`, nur bei KI): Blatt mit Wunschfeld (≤ 200 Zeichen), Schaltern „Grammatik-Fokus einbauen“ und „Meine fälligen Wörter einbauen“ sowie „Erstellen“. Während der Anfrage: Lade-Skelett der Karte, „Denkt nach …“, Stopp.
- Ohne KI: Die Szenen sind lesbar, dazu der Hinweis „Gespräche brauchen Claude. In dieser Ansicht ist Claude nicht verfügbar.“ Kein Start-Knopf.

### 5.2 Einweisung und Rollenspiel (`SceneBriefing`, `RoleplayScreen`)
**Einweisung (Blatt):**
- Lage, Ziel, Gegenüber mit Eigenschaften;
- „Hilfreiche Wendungen“ (englisch antippbar, 🔊 je Wendung);
- großer Knopf „Gespräch starten“, der synchron `unlockSpeech()` aufruft.

**Rollenspiel-Layout:**
- **Desktop (≥ 1024 px):** zwei Spalten. Links der Chat (max. 44rem), rechts das Analysepanel (sticky, eigene Bildlaufleiste).
- **Handy:** eine Spalte.
  - Unter jedem eigenen Satz ein Analyse-Chip mit Status-Punkt (grün sauber · gold Kleinigkeit · rot Fehler · grau „analysiert …“).
  - Ein Tipp klappt die `AnalysisCard` inline auf. Nichts öffnet sich von selbst, nichts springt.
  - Knopf „Alle Analysen“ öffnet ein Blatt.

**Kopfbereich (Status statt Text):** Szene · „Zug 3“ · Ziel-Chip (ⓘ zeigt Ziel und Zweck) · Knopf „Beenden“.

**Chatverlauf (`ChatLog`):**
- Die Figur links (Name, Rolle); ihr Text ist `EnglishText` (`area:'speak'`) und hat 🔊.
- Eigene Sätze rechts.
- Die Eröffnung (`opening`) ist der erste Zug der Figur und wird vorgelesen, wenn automatisches Vorlesen an ist.
- Streaming: „Denkt nach …“ bis zum ersten `onText`, dann läuft der Text ein. Ab `slow` erscheint „Dauert länger als üblich“ mit Stopp.
- **Scrollen:** Nur wenn der Nutzer am unteren Rand ist (≤ 48 px), folgt die Ansicht neuem Text. Sonst erscheint die Pille „Neue Antwort ↓“ (Kap. 15).

**Eingabezeile (`Composer`):**
- mehrzeiliges Feld (≤ 600 Zeichen), unten fest mit `env(safe-area-inset-bottom)` und `visualViewport`-Ausgleich (H5);
- Enter sendet am Desktop, Umschalt+Enter macht eine neue Zeile; am Handy gibt es den Knopf „Senden“ (≥ 44 px);
- `MicButton` nur bei `useStt().status === 'available'`;
- Wendungs-Chips (aus `useful`) über dem Feld, waagrecht wischbar; ein Tipp fügt an der Einfügemarke ein;
- Der Entwurf wird in `localStorage` gespeichert (`lx:draft:speak:<sceneId>`, nach 500 ms Ruhe).
- Senden ist gesperrt, solange die Figur schreibt.

**Maschine `roleplayMachine`:**
```
briefing → opening → composing ⇄ sending{thinking|streaming|slow} → composing
                          │            └─ error → composing (Text zurück ins Feld, „Erneut senden“)
                          │            └─ blocked (unavailable) → Hinweis, Gespräch beendbar
          composing → ending{waitAnalyses} → reporting{thinking|…} → report → saved
```
- Analysen laufen **außerhalb** der Hauptzustände über `analysisLane`. Die Ergebnisse stehen in `context.analyses[turnIdx]` (`pending|done|failed|skipped`). Ein Fehler ändert nie den Hauptzustand.
- `ending.waitAnalyses` zeigt „2 Analysen laufen noch“ und den Knopf „Bericht jetzt“. Offene Analysen werden dann abgebrochen und als „nicht analysiert“ geführt.
- Stopp während `sending` → `cancelled`: Der eigene Satz geht zurück ins Feld, der Zug verfällt.
- Bildschirmwechsel bricht alles ab (`useAiScope`). Die Kopie zum Fortsetzen bleibt.

**Fortsetzen (`resume.ts`):**
- `lx:roleplay:<sceneId>` = `{v:1, turns, analyses (nur done), startedAt, day}`, ≤ 40 KB, jeder Zugriff in try/catch.
- Beim Öffnen einer Szene mit Kopie vom heutigen Lerntag: Karte „Gespräch fortsetzen“ / „Neu beginnen“.
- Nach dem Speichern des Berichts wird die Kopie gelöscht.

### 5.3 Analysekarte (`AnalysisCard`, auch im Coach genutzt)
1. **Korrektheit:**
   - Status-Chip („Sauber“ / „Kleinigkeiten“ / „Fehler“);
   - je Fehler eine Zeile `wrong → right` mit Wort-für-Wort-Vergleich (`answerDiff`), Kategorie-Chip und `why` (≤ 1 Satz);
   - Britische Formen erscheinen als blauer Hinweis „US: …“, nie als Fehler (A7.3).
2. **C1-Fassung:**
   - `upgraded` als `EnglishText` mit 🔊;
   - Änderungen als markierte Stellen; ein Tipp zeigt `why` je Änderung.
3. **Landet besser, weil …:** eine Zeile `lands`.

**Wendungen:** bis zu 3 Chips mit `TakeChunkButton`:
- Zustände `idle` → „Mitnehmen“, dann `saving` und `taken` („In deinen Wendungen ✓“, **kein** Knopf mehr, Kap. 2.2);
- `exists` → Zustand „Schon in deinen Wendungen“;
- `hidden` → Knopf „Wieder aufnehmen“;
- Fehler → Rückrollen und Hinweis „Nicht gespeichert – erneut versuchen“.

**Nicht-englischer Satz (`english:false`):** Chip „Auf Englisch“ und `upgraded` als Vorschlag, keine Fehlerliste.

### 5.4 Abschlussbericht (`ReportScreen`)
**Fester Teil (sofort, ohne KI, `reportStats.ts`):**
- Züge, Minuten, saubere Sätze („4 von 6“), häufigste Fehlerkategorien, mitgenommene Wendungen;
- Wörter aus dem Fokus richtig benutzt (`targets`);
- Wendungs-Chips, die per Tipp eingefügt wurden, sind getrennt ausgewiesen.

**KI-Teil (`roleplay-report@1`):**
- Ziel-Status mit einem Satz;
- Zusammenfassung (≤ 3 Sätze);
- 2 Stärken, jeweils mit Zitat des eigenen Satzes;
- 1–3 Fokuspunkte („Du sagtest … → so klingt es auf C1 …“), mit Knopf „Üben“ zur passenden Grammatik aus Phase 2; ohne Ziel ist es ein Chip ohne Knopf;
- bis zu 3 „Beste Wendungen“ mit Mitnehmen.

**Aktionen:** „Nochmal spielen“ · „Andere Szene“ · „Zu Heute“.

**Verhalten:**
- Gespeichert wird **beim Anzeigen des festen Teils** (Handlung „Beenden“). Der KI-Bericht wird nachgetragen (`upsertRun`).
- Schlägt der KI-Bericht fehl: fester Teil plus „Erneut versuchen“; das Gespräch zählt trotzdem.
- **Sprachtreue:** Beim Öffnen eines alten Berichts in der anderen Oberflächensprache erscheint nur der feste Teil plus „Bericht auf {Sprache} erstellen“. Nie gemischt.

### 5.5 Business-Suite (`BusinessHub`, `data-screen="business"`)
Drei Karten in Kanalfarbe Business. Ohne KI sind Refiner und Coach mit Hinweis ausgegraut, der Baukasten bleibt voll nutzbar.

**E-Mail-Refiner (`mailMachine`: input → refining → choosing → done):**
- **Eingabe:**
  - Textfeld (≤ 2.500 Zeichen, Entwurf in `localStorage`);
  - Empfänger (Kunde/Vorgesetzte/Partner/Team) und Absicht (informieren/bitten/absagen/nachfassen/eskalieren) als `Segmented`.
- **Wählen:**
  - Die Mail erscheint als Folge von Satz-Bausteinen. Unter jedem schwachen Satz liegen 2–3 Fassungen als Bausteine mit Register-Chip.
  - Ein Tipp (oder Ziehen, Pfeiltasten, Ziffern) lässt den Baustein an die Stelle gleiten; die anderen weichen animiert aus (`engine/tiles`, Kap. 4.2).
  - „Original behalten“ ist immer eine Option. Unter dem gewählten Satz steht die Begründung.
- **Ergebnis:**
  - fertige Mail (EnglishText), „Kopieren“ (`navigator.clipboard.writeText` in try/catch; sonst ist der Text markiert, mit Hinweis „Zum Kopieren gedrückt halten“);
  - Zahl der Änderungen, Wörter vorher/nachher;
  - Wendungen der gewählten Fassungen mit „Mitnehmen“;
  - gespeichert in `biz/<Monat>`, `recordActivity(biz-mail)`.

**Baukasten (`PlaybookScreen`, `PlaybookDrill`):**
- 4 Bäume: *Meeting steuern*, *Diplomatisch ablehnen*, *Zustimmen mit Bedingung*, *Einwände behandeln*.
- Ablauf: Frage zur Lage → 2–4 Optionen → … → Blatt mit 3–5 Wendungen (EnglishText, 🔊, Register, `note`, Beispielsatz, Mitnehmen).
- Brotkrumen-Pfad oben; zurück per Esc bzw. Wischen.
- Optional „Auf meine Lage anpassen“ (`phrase-adapt@1`, `data-ai`).
- **Drill:** 6 Situationen je Baum aus dem Inhalt, Auswahl aus 3 Wendungen (Choices, Ziffern 1–3). Danach richtig/falsch mit Beispielsatz und `note`, am Ende „5 von 6“. Gespeichert als `biz.play`.

**Präsentations-Coach (`pitchMachine`: input → scripting → rehearse → feedbacking → result):**
- **Eingabe:** Folieninhalt (≤ 1.500 Zeichen), Publikum, Dauer 1–5 Min.
- **Sprechfassung:**
  - Sätze als Karten, je Satz 🔊 und Shadowing-Modus („vorlesen – selbst nachsprechen – weiter“);
  - Überleitungen hervorgehoben;
  - Kernwendungen mit Mitnehmen.
- **Üben:** eigene Fassung per Tippen oder Mikrofon (`MicButton`, falls verfügbar).
- **Rückmeldung:**
  - Abdeckung der Folienpunkte („5 von 6 Punkten“, fehlende als Chips);
  - `AnalysisCard` (drei Schichten);
  - `recordActivity(biz-pitch)`; Radar mit `s:'b'`.

### 5.6 Einstellungen (`VoiceSection`)
- **Stimme:** Liste der englischen Stimmen (en-US zuerst, Name und Region) mit „Probehören“ (`previewVoice`); Auswahl → `app/profile.voice`.
- **Tempo:** Schieber 0,8–1,1 in 0,05-Schritten → `app/profile.rate`, gespeichert beim Loslassen, nicht beim Ziehen.
- **„Antworten im Rollenspiel vorlesen“:** Schalter (`lx:speak-autoplay`).
- Bei `novoice`/`unsupported` steht dort ein ruhiger Hinweis.

### 5.7 DOM-Vertrag (für alle Pakete und die E2E-Suite verbindlich)
| Bereich | Testkennungen |
|---|---|
| Sprechen-Übersicht | `speak-hub`, `speak-status` (`data-done`), `scene-card` (`data-scene`, `data-src`), `scene-create`, `scene-create-submit`, `speak-noai` |
| Einweisung | `briefing`, `briefing-start`, `useful-phrase` |
| Rollenspiel | `roleplay` (`data-state`), `rp-turn` (`data-role=persona\|me`, `data-idx`), `rp-thinking`, `rp-slow`, `rp-stop`, `rp-retry`, `rp-newer`, `composer-input`, `composer-send`, `mic` (existiert **nur**, wenn verfügbar), `chip-useful`, `rp-end`, `rp-resume`, `rp-restart` |
| Analyse | `an-chip` (`data-idx`, `data-state=pending\|clean\|minor\|errors\|failed\|skipped`), `analysis` (`data-idx`), `an-error`, `an-upgraded`, `an-change`, `an-lands`, `take-chunk` (`data-state=idle\|saving\|taken\|exists\|hidden\|error`; bei `taken`/`exists` **kein** `button`) |
| Bericht | `report`, `report-stats`, `report-ai` (`data-state`), `report-retry`, `report-again`, `report-other`, `report-home` |
| Business | `biz-hub`, `mail-input`, `mail-recipient`, `mail-intent`, `mail-refine`, `mail-seg` (`data-status`), `tile` / `tile-slot` (Engine), `mail-final`, `mail-copy`, `pb-card` (`data-id`), `pb-option`, `pb-phrase`, `pb-adapt`, `drill-q`, `drill-result`, `pitch-input`, `pitch-script`, `pitch-line`, `pitch-attempt`, `pitch-feedback`, `pitch-coverage` (`data-covered`, `data-total`) |
| Stimme | `voice-select`, `voice-preview`, `voice-rate`, `voice-autoplay` |

Jeder Knopf, der Claude fragt, trägt `data-ai`. Vor der Analyse steht keine Lösung im DOM.

---

## 6. KI-Schicht und Vorlagen

### 6.1 Streaming-Weg (`src/ai/stream.ts`, Paket A)
```ts
// prompts/types.ts (S0)
export type ChatTemplate<V> = {
  id: string; version: number; tier: ModelTier; cache: false;
  build(vars: V): Claude.sample.SampleMessage[];     // beginnt und endet mit 'user'; 1. Zug beginnt mit `[id@v]`
  /** Bereinigt Teil- und Endtext (Namenspräfix, Anführungszeichen, Regieanweisungen); '' = leer. Rein und idempotent. */
  clean(text: string): string;
};
// ai/types.ts (S0)
export type StreamRequest<V> = { template: ChatTemplate<V>; vars: V; signal: AbortSignal; priority?: AiPriority;
  onPhase?: (p: AiPhase) => void; onText?: (cleaned: string) => void };
export type StreamResult = { text: string; truncated: boolean; tierApplied: ModelTier };
// ai/stream.ts
export async function askStream<V>(req: StreamRequest<V>): Promise<StreamResult>;
```
- Gleiche Kette wie `askJson`: Verfügbarkeit → Budget → Drosselung → `aiQueue.acquire` → `sample(turns, {modelTier, cache:false, signal: eigener Controller, onText})`.
- Das Budget ist die Summe der UTF-8-Bytes aller `content`, ≤ 60.000.
- **Kein** Neuversuch, kein Timer-Abbruch, nur `SLOW_AFTER_MS`.
- `tierApplied` = `modelTierApplied` (hier liefert der Vertrag den Wert). Weicht er ab, wird er protokolliert.
- `truncated` → Zug mit Hinweis „gekürzt“.
- Ergibt `clean(text)` einen leeren Text → `failure('empty')`.
- Fehler: `failureFromSample`. `e.text` (bereinigt) bleibt als unterbrochener Zug sichtbar, wird aber **nicht** in den Verlauf für den nächsten Aufruf übernommen.
- `useStream(template)`: Hook wie `useAsk`, mit `text`, `phase`, `error`, `run`, `stop`.

### 6.2 Vorlagen
| Vorlage | Stufe | Cache | Variablen (gekürzt mit `clip`) | Ausgabe |
|---|---|---|---|---|
| `roleplay-turn@1` (Chat) | **quick** (D1) | false | Szene (en-Felder), Gegenüber, `stake`, `objection`, `ctx` (≤ 300), Fokuswörter; Verlauf ≤ 16 Züge, eigener Zug ≤ 600 | Text: nur die Figur, amerikanisches Englisch, 1–4 Sätze (≤ 80 Wörter), keine Korrektur, kein Kommentar zur Sprache, keine Regieanweisung, kein Namenspräfix, kein Markdown; deutsche Eingabe → die Figur bittet höflich um Englisch |
| `turn-analysis@1` | complex | true | Ziel, Rolle, letzte Zeile der Figur (≤ 400), bis zu 2 frühere Wechsel (≤ 1.200), eigener Satz (≤ 600), Fokuswörter, `uiLang` | siehe unten |
| `roleplay-report@1` | default | true | Szene, eigene Züge (je ≤ 300, ≤ 16), Zeilen der Figur (je ≤ 200), Kurzbefund je Zug (`v`, `c`), mitgenommene `en`, `uiLang` | `{goal:{state, why}, summary, strengths[2]{quote, why}, focus[1..3]{title, said, better, why, cat}, phrases[≤3]{en, de, def, ex}}` |
| `scene-gen@1` | default | false | `ctx`, Stufe, Wunsch (≤ 200), Grammatik-Fokus (Titel), Wörter (≤ 8), vorhandene Titel (≤ 30) | Szenenobjekt im alten Format, `useful` 4–6 |
| `mail-refine@1` | default | true | Mail (≤ 2.500), Empfänger, Absicht, `uiLang` | `{subject: {orig, options[≤3]{text, why}} \| null, segments[≤25]{orig, status: ok\|stiff\|unclear\|wrong, options[0..3]{text, register, why, phrase}}, tone}` |
| `phrase-adapt@1` | quick | false | Baum-Knoten (Frage, vorhandene Wendungen), Lage (≤ 300), `uiLang` | `{phrases[3]{en, de, ex, why}}` |
| `pitch-script@1` | default | true | Folie (≤ 1.500), Publikum, Minuten, `uiLang` | `{points[≤8], script[≤20]{en, signpost: bool}, keyPhrases[≤5]{en, de, def, ex}, seconds}` |
| `pitch-feedback@1` | default | true | Punkte, Modellfassung (≤ 3.000), eigener Versuch (≤ 2.000), `uiLang` | `{coverage[]{point, covered, note}}` ∪ drei Schichten |

**Gemeinsame drei Schichten (`src/prompts/threeLayers.ts`):**
```json
{ "verdict": "minor", "english": true,
  "errors": [{ "wrong": "we must delay", "right": "we need to push back", "cat": "modals-deduction", "why": "…" }],
  "upgraded": "If we push back the go-live, the exposure is yours, not ours.",
  "changes": [{ "from": "must delay the start", "to": "push back the go-live", "why": "…" }],
  "lands": "…",
  "chunks": [{ "en": "push back the go-live", "de": "den Go-live verschieben", "def": "to move the launch to a later date",
               "kind": "collocation", "register": "neutral", "why": "…" }],
  "targets": ["exposure"] }
```
**zod-Verfeinerungen** (jede ist ein eigener Unit-Test):
1. `english` wahr: `verdict==='clean'` ⇔ `errors.length===0`. `english` falsch: `errors=[]`, `verdict:'errors'`.
2. `errors[].wrong` kommt normalisiert (Kleinschreibung, Leerraum, typografische Zeichen) im eigenen Satz vor.
3. `cat` ∈ 16 Grammatik-IDs ∪ `{vocab, collocation, register, word-order, spelling, other}`.
4. Kein Fehler, bei dem `toUS(wrong) === right` gilt. Britisch ist kein Fehler (A7.3, `domain/answer/spelling`).
5. `chunks[].en`: 1–8 Wörter, kommt (Tokenvergleich, „…“ entfernt) in `upgraded` vor, höchstens 3.
6. Englisch-Felder (`upgraded`, `right`, `to`, `chunks.en`, `chunks.def`) sind nicht deutsch (`isWrongLang(…,'en')`). Erklär-Felder (`why`, `lands`, `chunks.why`) sind in `uiLang` (`langOf`).
7. Längen: `lands` 1–160, `why` ≤ 200, `upgraded` ≤ 400.
8. `targets` ⊆ übergebene Fokuswörter.

**Weitere Verfeinerungen:**
- `mail-refine`: Die verbundenen `orig` ergeben den Eingabetext (Tokenvergleich). `status:'ok'` ⇒ `options` darf leer sein, sonst 2–3 Optionen. `phrase` ⊂ `text`.
- `roleplay-report`: `quote`/`said` kommen in eigenen Zügen vor, `phrases.ex` enthält `en`.
- `scene-gen`: `*_de` deutsch, übrige Texte englisch, `opening` 1–3 Sätze, `persona.name` nicht leer; keine Firmennamen außer denen aus `ctx` (Prompt-Regel).
- `pitch-*`: `keyPhrases.ex` ⊃ `en`, `coverage.point` ∈ `points`.

**Regeln in jedem Prompt:**
- US-Englisch ist Standard, britische Formen sind korrekt (dann Hinweis);
- Erklärsprache nach `uiLang`;
- „Reply with only one JSON object“ plus ein Beispiel, das selbst das Schema besteht (Test);
- keine erfundenen Fakten über Emrahs Firma.

### 6.3 Analysespur (`features/speak/analysisLane.ts`)
- Warteschlange je Gespräch (FIFO), **höchstens 1 aktiv**, `priority:'background'`, Signal vom Bildschirm.
- Ein Satz unter 2 Wörtern wird übersprungen (`skipped`, Chip „zu kurz“).
- Fehler setzt `failed` mit Knopf „Analyse erneut“ (manuell, neue Anfrage).
- `rate_limited` pausiert das Tor 60 s für **alle** Aufrufe (bestehend). Die Figur zeigt dann „Kurz Pause – gleich weiter“ mit dem Zeitpunkt aus `pausedUntil`. Es gibt keinen Automatismus (Vertrag: „let the VIEWER retry“).
- **Der Gesprächsfluss hängt nie an der Spur.**

### 6.4 Nachgebildete Antworten (`cannedSpeak.ts`, `cannedBiz.ts`)
- Realistische, deterministische Antworten je Vorlage, erkannt an den Datenzeilen.
- Sonderwörter wie in Phase 1:
  - `zzqx` → erste Antwort verletzt das Schema;
  - `zzjson` → kein JSON;
  - `zzde` im Satz → `english:false`;
  - `zzslow` → Verzögerung für den Langsam-Hinweis.

---

## 7. Plattform: Sprachausgabe und Spracheingabe

**`speech.ts` (Paket D), nur Ergänzungen:**
- `export type VoiceInfo = {name, lang, local: boolean, us: boolean}`;
- `useSpeech.voices`, befüllt in `refreshVoices`;
- `previewVoice(name)` spricht „This is how I sound.“ mit genau dieser Stimme (nutzt `speak` mit Stimmen-Überschreibung, ohne `prefs` zu ändern).

Die bestehenden Regeln bleiben: Stücke ≤ 150 Zeichen, 60 ms, Wecker, `unlockSpeech`. `stopSpeech()` läuft beim Verlassen jedes Sprechen-/Business-Bildschirms.

**`stt.ts` (Paket D, neu, einziger Zugriff auf `SpeechRecognition`):**
```ts
export type SttStatus = 'unknown' | 'available' | 'blocked' | 'unsupported';
export function initStt(): void;           // Erkennung ohne Mikrofonzugriff: API vorhanden, featurePolicy/permissionsPolicy erlaubt 'microphone' (falls abfragbar), kein 'lx:stt-blocked'
export function listen(opts: { lang: 'en-US'; onInterim(t: string): void; signal: AbortSignal }): Promise<{ text: string } | { error: 'blocked' | 'no-speech' | 'aborted' | 'failed' }>;
```
- `not-allowed`, `service-not-allowed`, `audio-capture` oder ein Wurf bei `start()` → `blocked`, `localStorage` `lx:stt-blocked = <ms>` (try/catch), Knopf verschwindet sofort.
- `no-speech` → ruhiger Hinweis. Alles wird über `logWarn` protokolliert.
- Zustände des Mikrofons: `idle` → `listening` (pulsierender Ring, bei reduzierter Bewegung statisch) → Text im Feld.
- **Grenze:** In Chromium (Cloud) ist die Schnittstelle vorhanden, startet aber nicht verlässlich. Deshalb testet E2E beide Wege mit `fakeStt` (verfügbar/gesperrt). Das echte Verhalten im claude.ai-iframe am iPhone prüft Emrah (§9.7).

---

## 8. Texte (i18n)

**Aufbau:** Neue Teile `speak`, `biz`, `voice` (`src/i18n/parts/*.{de,en}.ts`), eingebunden in `de.ts`/`en.ts` (S0). EN in amerikanischer Schreibweise, Mehrzahl `_one`/`_other`.

Auswahl der Schlüssel, DE | EN:

| Schlüssel | DE | EN |
|---|---|---|
| `spTitle` | Sprechen | Speaking |
| `spStatusOpen` | Heute offen · ein Gespräch mit mindestens 4 Zügen | Open today · one conversation with at least 4 turns |
| `spStatusDone` | Sprechen ist für heute erledigt | Speaking is done for today |
| `spNeverPlayed` / `spLastPlayed_one/_other` | Noch nie gespielt / Zuletzt vor {n} Tag(en) | Never played / Last played {n} day(s) ago |
| `spCreate` · `spCreateWish` · `spCreateFocus` · `spCreateWords` | Neue Szene · Was möchtest du üben? (optional) · Grammatik-Fokus einbauen · Meine fälligen Wörter einbauen | New scene · What would you like to practice? (optional) · Include my grammar focus · Include my due words |
| `spNoAi` | Gespräche brauchen Claude. In dieser Ansicht ist Claude nicht verfügbar. | Conversations need Claude. Claude isn't available in this view. |
| `spStart` · `spUseful` | Gespräch starten · Hilfreiche Wendungen | Start conversation · Useful phrases |
| `spTask` | Antworte {name} · Ziel: {goal} | Reply to {name} · Goal: {goal} |
| `spPurpose` | Du sprichst unter Druck und setzt Wendungen im echten Einsatz ein. | You speak under pressure and use phrases for real. |
| `spTurn` | Zug {n} | Turn {n} |
| `spThinking` · `spSlow` · `spStop` | Denkt nach … · Dauert länger als üblich · Stopp | Thinking… · Taking longer than usual · Stop |
| `spNewer` · `spSend` · `spPlaceholder` | Neue Antwort · Senden · Deine Antwort auf Englisch | New reply · Send · Your reply in English |
| `spRetry` · `spInterrupted` · `spPaused` | Erneut senden · Unterbrochen · Kurze Pause – ab {time} geht es weiter | Send again · Interrupted · Short pause – you can continue at {time} |
| `spEnd` · `spResume` · `spRestart` | Beenden · Gespräch fortsetzen · Neu beginnen | End · Resume conversation · Start over |
| `anClean` · `anMinor` · `anErrors` · `anPending` · `anFailed` · `anSkipped` | Sauber · Kleinigkeiten · Fehler · Analysiert … · Analyse fehlgeschlagen · Zu kurz für eine Analyse | Clean · Minor issues · Errors · Analyzing… · Analysis failed · Too short to analyze |
| `anC1` · `anLands` · `anNotEnglish` · `anUsHint` | C1-Fassung · Landet besser, weil … · So auf Englisch · US-Form: {us} | C1 version · Lands better because… · In English · US form: {us} |
| `takeIdle` · `takeTaken` · `takeExists` · `takeRestore` · `takeError` | Mitnehmen · In deinen Wendungen ✓ · Schon in deinen Wendungen · Wieder aufnehmen · Nicht gespeichert – erneut versuchen | Save phrase · In your phrases ✓ · Already in your phrases · Restore · Not saved – try again |
| `repTitle` · `repStats` | Abschlussbericht · {turns} Züge · {min} Min. · {clean} von {total} Sätzen sauber | Wrap-up · {turns} turns · {min} min · {clean} of {total} sentences clean |
| `repGoalReached/Partly/Missed` | Ziel erreicht / Teilweise erreicht / Noch nicht erreicht | Goal reached / Partly reached / Not reached yet |
| `repWaiting_one/_other` · `repNow` · `repRegen` | {n} Analyse läuft noch / {n} Analysen laufen noch · Bericht jetzt · Bericht auf {lang} erstellen | {n} analysis still running / {n} analyses still running · Report now · Create report in {lang} |
| `bizTitle` · `bizMail` · `bizPlay` · `bizPitch` | Business · E-Mail-Refiner · Phrasen-Baukasten · Präsentations-Coach | Business · Email Refiner · Phrase Builder · Presentation Coach |
| `mailTask` · `mailKeep` · `mailCopy` · `mailCopied` · `mailCopyManual` | Wähle je Satz eine Fassung · Original behalten · Kopieren · Kopiert ✓ · Zum Kopieren gedrückt halten | Pick one version per sentence · Keep original · Copy · Copied ✓ · Press and hold to copy |
| `pbAdapt` · `drillTask` · `drillResult` | Auf meine Lage anpassen · Welche Antwort passt? · {right} von {n} | Adapt to my situation · Which reply fits? · {right} of {n} |
| `pitchTask` · `pitchCoverage` · `pitchShadow` | Sprich die Folie in {min} Min. · {covered} von {total} Punkten · Nachsprechen | Present the slide in {min} min · {covered} of {total} points · Shadowing |
| `voiceTitle` · `voicePreview` · `voiceRate` · `voiceAutoplay` · `voiceNone` | Stimme · Probehören · Tempo · Antworten im Rollenspiel vorlesen · Keine englische Stimme gefunden | Voice · Preview · Speed · Read replies aloud in role-play · No English voice found |
| `micStart` · `micListening` · `micNoSpeech` | Sprechen · Hört zu … · Nichts gehört – noch einmal? | Speak · Listening… · Didn't catch that – try again? |

---

## 9. Tests

### 9.1 Unit-Tests (Vitest, `TZ=Europe/Berlin`)
| Datei | Prüft |
|---|---|
| `tests/unit/aiStream.test.ts` (A) | Streaming mit bereinigtem `onText`; Budget > 60.000 → kein Aufruf; Stopp in der Warteschlange → 0 Aufrufe; `rate_limited` → Pause und kein Neuversuch; `truncated`; leerer Text nach `clean` → `empty`; `e.text` wird nicht in den Verlauf übernommen; `modelTierApplied` wird protokolliert |
| `tests/unit/promptsSpeak.test.ts` (A) | alle 4 Vorlagen: Kopfzeile, Beispiel besteht das Schema, Verfeinerungen 1–8 je positiv und negativ, Sprachtreue DE/EN; Zugliste beginnt und endet mit `user`, 1. Zug beginnt mit `[roleplay-turn@1]`; 40 Züge werden auf ≤ 16 gekürzt; kein Prompt über 60 KB; „never correct“ steht in den Regeln |
| `tests/unit/promptsBiz.test.ts` (E1) | dasselbe für die 4 Business-Vorlagen; Satzabdeckung im Refiner; `phrase` ⊂ `text` |
| `tests/unit/analysisLane.test.ts` (C) | höchstens 1 aktiv, FIFO; Fehler einer Analyse blockiert weder die nächste noch die Figur; Abbruch beim Aushängen |
| `tests/unit/roleplayMachine.test.ts` (C) | Pfade: Eröffnung → 3 Züge → Beenden → Bericht; Figur-Fehler → Text zurück ins Feld; Stopp; `unavailable` → `blocked`; Analyse-Fehler ändert den Hauptzustand nie; `waitAnalyses` → „Bericht jetzt“ bricht offene Analysen ab |
| `tests/unit/newChunk.test.ts` (B) | `chunkId` gültig nach der Pfadgrammatik; `en` ⊄ `upgraded` → `null`; vorhanden → nie schreiben; `hidden` → kein `set`; das Dokument besteht `chunkSchema`; alte Felder vorhanden; `chunkCards` erzeugt Kontext aus `upgraded` |
| `tests/unit/talkDoc.test.ts` (B) | `upsertRun` idempotent (gleiche `id` zweimal ⇒ ein Lauf); 100 Läufe im schlimmsten Fall ≤ 200 KiB; Verdichtung entfernt zuerst `lines` des ältesten Laufs; Monatsschlüssel am Lerntag (03:59 → Vortag; Monatswechsel) |
| `tests/unit/speakProgress.test.ts` (B/S0) | `profilePatch` mit `act:'speak'`: `days` und `xpDays` steigen, `act.speak`, `speak~` bei < 4 Zügen, `lxSeq` idempotent; Log-Eintrag ohne `k`/`ctx:'rev'`; Zähler „Wiederholen“ (B3) unverändert mit Sprech-Einträgen; `speakDutyDone`; `deriveToday` mit `ch:speak` in allen Zuständen (Widerspruchstest) |
| `tests/unit/radarPatch.test.ts` (B) | nur Grammatik-Kategorien, Quelle `k`/`b`, Kappung 400, fehlendes Dokument → `set` |
| `tests/unit/sceneLibrary.test.ts` (B) | Datenbank gewinnt; ungültig wird ausgelassen; ohne `opening` nicht startbar; Sprache DE/EN mit Rückfall; `sceneDoc`-Vermerk: `done` wird nur bei fehlend/false gesetzt, ein vorhandener Zahlwert bleibt |
| `tests/unit/playbooks.test.ts` (E1) | jeder Blattknoten hat 3–5 Wendungen; jedes `ex` enthält `en`; DE/EN vollständig; keine britischen Schreibweisen (`toUS` identisch); keine Zyklen, alle Knoten erreichbar; Drill hat ≥ 6 Fragen je Baum |
| `tests/unit/mailCompose.test.ts` (E1) | Zusammensetzen aus der Auswahl, Zahl der Änderungen, Wörter vorher/nachher, `bizDoc`-Verdichtung |
| `tests/unit/stt.test.ts`, `speech.test.ts` Ä (D) | Erkennung (keine API → `unsupported`; Policy sperrt → `blocked`); `not-allowed` → `blocked` plus gemerkt; `localStorage` wirft → kein Absturz; `listVoices` en-US zuerst; `previewVoice` ändert `prefs` nicht |
| `tests/unit/i18n.test.ts` Ä | neue Teile: gleiche Schlüssel und Platzhalter, EN ohne Umlaute |
| `tests/unit/langSweep.test.ts` Ä (F) | **Sprachtest über alle Datensätze:** `talk.runs[].report` in `lang`, `chunk.why` passt zu `whyLang`, `scene` `*_de` deutsch und sonst englisch, `biz`-Texte |
| `tests/unit/schemas.test.ts` Ä | `talk`, `biz`, erweiterte `scene`/`chunk`: alte Formen aus dem Seed bleiben gültig |

### 9.2 E2E (Playwright gegen `dist/index.html`, Laufzeit von außen eingespielt)
Jede Datei läuft auf 390 / 1440 / 2560 px, in drei Modi, auf DE und EN, ohne JS-Fehler, ohne `undefined`/`NaN`/`{0}`, ohne Querscrollen, mit axe.

- **`speak.spec.ts`:**
  1. Übersicht zeigt 4 Szenen aus `scenes.json` und dem Seed plus die KI-Szene aus dem Seed.
  2. Einweisung → Start → Eröffnung sichtbar → 4 Züge senden → Chips werden der Reihe nach `clean`/`minor`/`errors`.
  3. Analyse aufklappen: drei Schichten, antippbare Wörter öffnen die Nachschlage-Ansicht.
  4. „Mitnehmen“ → `take-chunk[data-state=taken]` hat **keinen** Knopf; der Adapter-Datenbestand enthält `chunk/c-…` mit `src.upgraded` ⊃ `en`.
  5. Beenden → Bericht mit festem und KI-Teil. `talk/<Monat>`, `log/<tag>` (`type:'speak'`, `n:4`) und `act.speak` sind geschrieben. Heute: Kanal Sprechen erledigt (Zustand).
  6. `sampleFail['turn-analysis']='upstream_error'`: Das Gespräch läuft weiter, die Chips zeigen `failed`, „Analyse erneut“ funktioniert.
  7. `sampleMode='not_granted'` → Hinweis `speak-noai`, kein Start-Knopf.
  8. `sampleDelayMs` → `rp-slow` mit Stopp → Text zurück im Feld.
  9. Neu laden mitten im Gespräch → „Fortsetzen“ stellt die Züge wieder her.
  10. Scrollen: hochgescrollt + neue Antwort → keine Bewegung, Pille `rp-newer`.
  11. „Neue Szene“ → Karte `data-src="ai"` erscheint, `scene/sc-ai…` existiert.
- **`business.spec.ts`:**
  - Refiner: Eingabe → Segmente → Bausteine per Tipp und per Tastatur (Ziffern) → Ergebnis, Kopieren (Rückfall ohne Zwischenablage) → `biz/<Monat>`.
  - Baukasten ohne `sample` komplett bis zu den Wendungen plus Drill 6 Fragen.
  - Coach: Folie → Sprechfassung → Versuch → Abdeckung und drei Schichten.
- **`voice.spec.ts`:**
  - Einstellungen: Stimmenliste (nachgebildete Sprachausgabe), Probehören ruft `speak` mit der gewählten Stimme, Tempo → `app/profile.rate`.
  - `fakeStt` verfügbar → Mikrofon da, Ergebnis im Feld, **nicht** gesendet.
  - `fakeStt` sperrt beim Start → Knopf verschwindet, nach dem Neuladen weiterhin fehlt.
  - `fakeStt` fehlt → kein `mic`.
- **`platform.spec.ts` Ä:** keine Anfragen an fremde Hosts auf den neuen Bildschirmen; ohne `db` klarer Hinweis.
- **Widerspruchstest Heute Ä:** Pflicht mit `ch:speak` in den Zuständen offen / 3 Züge (offen) / 4 Züge (erledigt): Statuszeile, Zähler, Häkchen und Klickziel stimmen überein.

### 9.3 Zeitpunkte
Die Tests laufen an mehreren Tagen und nicht nur „heute“ (Kap. 15):
- Stichtag, 03:59, 04:01;
- Monatswechsel 30.09. → 01.10. (neues `talk`-Dokument, Gespräch über den Monatswechsel zählt zum Starttag).

### 9.4 Seed (F, deterministisch, Stichtag 20.09.2026)
- Die 4 vorhandenen Chunks bekommen stimmige `utterance`/`upgraded` (B4).
- Dazu kommen 3 Chunks mit `src.kind` (`mail`, `biz`) und einer mit `hidden:true`.
- `scene/sc-ai…`: eine KI-Szene mit allen Feldern.
- `talk/2026-09` mit 3 Läufen (einer ohne Bericht, einer mit EN-Bericht), `biz/2026-09` mit je einem Eintrag, `app/radar` mit 2 `s:'k'`-Einträgen.
- Log-Einträge `type:'speak'` an 3 Tagen, `act.speak` passend.
- Ein ungültiges `scene/sc-broken` (fehlendes `persona`) prüft, dass es ausgelassen wird.

### 9.5 Adapter (F, nur `src/platform/dev`)
- `FakeOptions.sampleFail?: Record<string, SampleErrorCode>` und `control.setSampleFail(id, code|null)`.
- `fakeStt` mit `mode: 'ok'|'blocked'|'absent'` sowie `control.sttSay(text)`.
- Die nachgebildete Sprachausgabe liefert mehrere Stimmen (en-US, en-GB, de-DE).
- `check:platform` sucht zusätzlich nach `fakeStt`, `cannedSpeak` und `cannedBiz` im Build.

### 9.6 Prüfer
- learning-scientist: alle 8 Vorlagen, Rollenspiel, Refiner, Drill, Coach, **D1** (einmal).
- data-guard: §3, Seed, Verdichtung, `radar`.
- ux-reviewer: alle neuen Bildschirme.
- platform-guard: vor der Auslieferung.

Je eine Runde plus eine gezielte Nachprüfung (A2).

### 9.7 Prüfliste für Emrah am iPhone (für den Bericht)
1. Gespräch starten: Hörst du die Eröffnung vollständig und ohne Abbruch?
2. Siehst du ein Mikrofon-Symbol? Wenn ja: Funktioniert es? Wenn nein, ist das richtig (dann erlaubt claude.ai es nicht).
3. Tastatur offen: Bleibt das Eingabefeld sichtbar?
4. Den Refiner-Text kopieren und in eine Mail einfügen.

---

## 10. Arbeitspakete (Dateien disjunkt) und Reihenfolge

| Paket | Dateien (alleiniger Eigentümer) | Liefert an | Dauer |
|---|---|---|---|
| **S0 – Lead, allein, ein Commit** | `schemas.ts`, `paths.ts`, `prompts/types.ts`, `ai/types.ts`, `domain/speak/types.ts`, `domain/business/types.ts`, `app/nav.ts` (Routen `speak`, `roleplay{sceneId}`, `business`, `mail`, `playbook{id}`, `pitch`), `engine/wordTap.ts` (Area), `srs/newCard.ts` (Origin-Arten), `progress/profilePatch.ts`, `progress/logPatch.ts`, `features/vocab/persist.ts` (`recordActivity`), `features/vocab/session.ts` (B3), `i18n/de.ts`/`en.ts` (Einbindung leerer Teile), `eslint.config.js`, `docs/phase3-plan.md` | Typen und DOM-Vertrag an alle | 2–3 h |
| **A – KI Sprechen** | `ai/stream.ts`, `ai/useStream.ts`, `prompts/{threeLayers,roleplayTurn,turnAnalysis,roleplayReport,sceneGen}.ts`, `platform/dev/cannedSpeak.ts`, Tests A | `askStream`, Vorlagen → C | 4 h |
| **B – Domäne Sprechen und Daten** | `domain/speak/{library,transcript,talkDoc,reportStats,duty,sceneDoc}.ts`, `domain/chunks/newChunk.ts`, `domain/progress/radarPatch.ts`, `data/watch.ts`, Tests B | reine Funktionen → C, E2, INT | 4 h |
| **D – Stimme** | `platform/stt.ts`, `platform/speech.ts`, `platform/dev/fakeStt.ts`, `engine/{MicButton,SpeakButton}.tsx`, `features/settings/VoiceSection.tsx`, `SettingsSheet.tsx` (eine Einfügestelle), `i18n/parts/voice.*`, Tests D | Knöpfe → C, E2 | 3 h |
| **E1 – Business Inhalt, Domäne, Prompts** | `content/business/playbooks.json`, `domain/business/{playbook,drill,mailCompose,bizDoc,coverage}.ts`, `prompts/{mailRefine,phraseAdapt,pitchScript,pitchFeedback}.ts`, `platform/dev/cannedBiz.ts`, Tests E1 | → E2 | 5 h |
| **C – Rollenspiel-Oberfläche** | `features/speak/**`, `i18n/parts/speak.*`, Tests C | **früh zuerst:** `AnalysisCard` und `TakeChunkButton` (Schnittstelle in S0) → E2 | 6–8 h |
| **E2 – Business-Oberfläche** | `features/business/**`, `i18n/parts/biz.*` | → INT | 5–6 h |
| **F – Testdaten, Adapter, E2E** | `scripts/generate-seed.mjs`, `seed/sample-data.json`, `platform/dev/{fakeSample,fakeRuntime}.ts`, `tests/e2e/{speak,business,voice}.spec.ts`, `tests/unit/langSweep.test.ts`, `tests/e2e/support/*` | → alle | 4–5 h |
| **INT – Lead** | `app/App.tsx`, `prompts/registry.ts`, `platform/dev/cannedReplies.ts`/`install.ts` (Anmeldung), `features/today/*` und `domain/plan/*` (`ch:speak`, `biz`, Bilanz), `srs/chunkCards.ts` (`topicKey`), `docs/datenmodell.md`, CLAUDE.md A4 | Auslieferung | 3–4 h |

**Schnittstellen, in S0 festgelegt:**
- `AnalysisView` (Domänentyp aus den drei Schichten, ohne Abhängigkeit von zod);
- `TakeChunkButton` mit Props `{input: NewChunkInput; area}`;
- `SceneView`, `TalkRun`, `BizItem`, `ActivityLogEntry`;
- `askStream`, `useStt`.

**Reihenfolge** (nach jedem Schritt laufen `typecheck`, `lint` und die Unit-Tests des Pakets):
1. S0. Danach sind alle bestehenden Tests grün, und B3 ist mit Test abgesichert.
2. **Parallel:** A, B, D, E1, F (Seed und Adapter). F schreibt die E2E-Tests gegen den DOM-Vertrag; sie dürfen bis INT rot sein, werden aber nie ausgeliefert.
3. C, zuerst `AnalysisCard`/`TakeChunkButton`, danach parallel E2.
4. INT: Verdrahtung, `npm run verify`.
5. Prüfer (§9.6), Korrekturen, gezielte Nachprüfung.
6. Test-Artefakt (Kopie), danach Produktivadresse nach A7 „Ab jetzt gilt“.

Ein Commit „Phase 3: Sprechen“, `dist/index.html` auf `main`.

---

## 11. Risiken und Gegenmaßnahmen
| Risiko | Gegenmaßnahme |
|---|---|
| Die Figur antwortet mit `quick` zu flach, oder die Analyse mit `complex` braucht Minuten | Die Stufe ist eine Konstante (D1). Die Analyse ist entkoppelt und nicht blockierend (§6.3). Emrah prüft am Gerät; ein Wechsel ist eine Zeile plus Test. |
| Abo-Kontingent: je Zug läuft eine `complex`-Analyse | Kein Aufruf ohne Handlung; Sätze < 2 Wörter werden nicht analysiert; `cache:true` für Analysen; bei `rate_limited` Pause statt Wiederholung; Figur-Zugliste ≤ 16 Züge |
| `rate_limited` durch die Analyse stoppt auch die Figur | vertragsgemäß (Zurückhalten). Sichtbare Pause mit Zeitpunkt, manuelles Weiter, Verlauf bleibt. |
| Spracheingabe im iframe gesperrt | D5: Knopf nur bei Verfügbarkeit, nach dem ersten Scheitern dauerhaft weg; Tippen ist der Hauptweg |
| Sprachausgabe am iPhone abgehackt oder stumm | vorhandene Regeln aus `speech.ts`, `unlockSpeech` im Start-Klick, Vorlesen erst nach vollständigem Text, `stopSpeech` beim Verlassen |
| Monatsdokument wächst über 256 KiB | Kappung 200 KiB mit Verdichtung, getestet mit 100 Läufen; Diagnose warnt |
| Mischsprache in gespeicherten Berichten und Wendungen | `langOf`-Verfeinerungen, `whyLang`/`lang` gespeichert, Anzeige nur bei passender Sprache, sonst neu erzeugen; Sprachtest über alle Datensätze |
| KI-Wendung steht nicht im Ursprungssatz (Karte ohne Kontext) | Schema-Verfeinerung 5 plus `newChunkDoc` → `null`; ohne Kontext kein Knopf |
| Sprech-Einträge verfälschen Zähler und Trefferquote | B3, eigene `type`/`ctx`, `balance` nur aus Übungseinträgen, Widerspruchstests |
| Phase 1 oder 2 nicht fertig (Bausteine, Chunk-Trainer, Navigation) | V1/V2 als harte Vorbedingung; S0 gleicht nur Namen an; ohne Bausteine wird der Refiner nicht gebaut und nicht ausgeliefert, Befund an Emrah |
| Zwei Geräte beenden gleichzeitig ein Gespräch | `upsertRun` über `run.id`, `transform` je Pfad, `lxSeq` gegen Doppelzählung; `radar`: „der letzte Schreiber gewinnt“ ist bekannt und akzeptiert, wie in der alten App |
| Rückweg zur alten App | Nur neue Felder und Sammlungen (`talk`, `biz`); alte Felder unverändert; `scene.done` nur als boolescher Wert; `chunk` im alten Format lesbar |
| Zwischenablage im iframe gesperrt | try/catch, Rückfall „markiert, gedrückt halten“, `logWarn` |

---

## 12. Prüfliste gegen Kapitel 3
| Punkt | ✅/❌ | Fundstelle |
|---|---|---|
| Eine selbstständige `dist/index.html` ≤ 16 MB, alles eingebettet | ✅ | keine neuen Bestände außer `playbooks.json` (wenige KB), `check:platform` bleibt; §2 |
| Kein Server, kein Backend, keine Schlüssel, kein `fetch` zu fremden Hosts | ✅ | KI nur über `askJson`/`askStream`; Links nur `target=_blank`; E2E `platform.spec.ts` §9.2 |
| Jeder Zugriff auf `db`/`sample`/`downloads` über `/src/platform`; nur dort `claude.use` | ✅ | `getSample()` in `ai/stream.ts`; `SpeechRecognition` nur in `platform/stt.ts`; ESLint-Regel bleibt; §6.1, §7 |
| `claude.use` kann `null` liefern: sofort rendern, später zuschalten, Hinweis | ✅ | `useAiAvailable()`; `speak-noai`; Baukasten ohne KI voll nutzbar; §5.1, §5.5 |
| `sample` gedächtnislos, ≤ 64 KiB Eingabe | ✅ | jede Vorlage bringt Szene, Regeln und Format mit; Zugliste gekürzt; Budget 60.000; §6.2, Tests §9.1 |
| Fehlercodes: `rate_limited` zurückhalten, nie Schleife; `not_granted` → ausblenden; kein Timeout-Timer; Wiederholung nur nach A6.3 | ✅ | `failureFromSample`, `pauseAi`, `SLOW_AFTER_MS` nur als Hinweis; Streaming ohne Neuversuch; „Erneut senden“ nur manuell; §6.1, §6.3 |
| `onSnapshot` einmal je Abfrage in `useEffect`, nie im Render; ≤ 64 Abos | ✅ | `data/watch.ts` für `scene`, sonst `get()`; ≈ 10 Abos; §2.1 |
| Schreiben nur bei echter Änderung, eins je Dokument zur Zeit, nicht aus Render, Snapshot oder Timer; `update` nur auf existierende Dokumente | ✅ | `writer.transform`/`createIfMissing`; Auslöser nur Handlungen; Entwurf nur in `localStorage`; §3.2 |
| 256 KiB je Dokument, 5.000 Dokumente – wachsende Ströme zusammenfassen | ✅ | `talk`/`biz` als Monatsdokumente mit 200-KiB-Verdichtung, `radar` ≤ 400, Log ≤ 300; §3.4, §3.5, §3.9 |
| Lernfortschritt nur in `db`; `localStorage` nur Bequemlichkeit, in try/catch | ✅ | Entwurf, Fortsetzen, `stt-blocked`, Vorlesen-Schalter über `platform/storage.ts`; Chunks, Berichte und Zähler in `db`; §5.2, §7 |
| Entwicklungs-Adapter per Build-Flag ausgeschlossen, durch Test abgesichert | ✅ | neue Dev-Dateien nur unter `src/platform/dev`; `check:platform` erweitert; §9.5 |
| Keine leeren `catch`-Blöcke; jeder Fehler im Diagnose-Protokoll | ✅ | `logError`/`logWarn` in allen neuen Pfaden (Zwischenablage, STT, Sprachausgabe, Schreiben) |
| Kein Prompt-Text in Oberflächendateien; versionierte Vorlagen mit zod | ✅ | 8 Vorlagen in `/src/prompts`; Baukasten ist Inhalt, kein Prompt; Test U-PROMPT-06 bleibt |
| Optimistische Updates mit Rückrollen; Lade-Skelette statt Spinner | ✅ | `TakeChunkButton` (idle → saving → taken, Rückrollen), Stimme/Tempo über `app/actions`; Skelette für Szenenkarte und Bericht; „Denkt nach …“ als Text, kein Spinner |
| Stack aus Kap. 3.2 | ✅ | XState für Rollenspiel, Refiner und Coach; zustand für Stores; Framer Motion für Bausteine und Übergänge; zod; keine neue Abhängigkeit |

**Hinweis Vertrag gegen Auftrag:**
- Kap. 10 verlangt einen „Timeout“ und „einmal neu anfragen“. Es gilt `sample.d.ts` in der Auslegung von A6.2 und A6.3: kein Timer, ein Neuversuch nur bei Schemafehler, beim Streaming der Figur gar keiner.
- D1 (Figur `quick`) ist kein Vertragskonflikt, sondern eine begründete Abweichung vom Wortlaut von Kap. 10 nach der Stufenbeschreibung in `sample.d.ts`. Sie muss von learning-scientist bestätigt und Emrah gemeldet werden.

---

**Relevante Dateien (absolut):**
- /home/user/lingo-engine-x/CLAUDE.md
- /home/user/lingo-engine-x/docs/auftrag.md
- /home/user/lingo-engine-x/docs/altapp-analyse.md
- /home/user/lingo-engine-x/docs/phase1-plan.md
- /home/user/lingo-engine-x/contract/sample.d.ts
- /home/user/lingo-engine-x/contract/db.d.ts
- /home/user/lingo-engine-x/contract/claude.d.ts
- /home/user/lingo-engine-x/contract/permissions.d.ts
- /home/user/lingo-engine-x/src/ai/gate.ts
- /home/user/lingo-engine-x/src/ai/queue.ts
- /home/user/lingo-engine-x/src/ai/errors.ts
- /home/user/lingo-engine-x/src/prompts/types.ts
- /home/user/lingo-engine-x/src/platform/speech.ts
- /home/user/lingo-engine-x/src/platform/dev/fakeSample.ts
- /home/user/lingo-engine-x/src/data/schemas.ts
- /home/user/lingo-engine-x/src/data/paths.ts
- /home/user/lingo-engine-x/src/data/writer.ts
- /home/user/lingo-engine-x/src/features/vocab/persist.ts
- /home/user/lingo-engine-x/src/features/vocab/session.ts (Zeile 118, B3)
- /home/user/lingo-engine-x/src/domain/progress/profilePatch.ts
- /home/user/lingo-engine-x/src/domain/progress/logPatch.ts
- /home/user/lingo-engine-x/src/content/legacy/scenes.json
- /home/user/lingo-engine-x/seed/sample-data.json (Zeile 1653 ff., B4)
