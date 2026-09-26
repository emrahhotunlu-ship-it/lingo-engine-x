# Phase 5: Begleiter und Brücke. Verbindlicher Umsetzungsplan (Architekt)

Stand 26.09.2026. Der Plan ist vorgesehen für `docs/phase5-plan.md`. Er ist hier nur als Text zurückgegeben, im Repository wurde nichts geändert.
Vorrang bei Widersprüchen: `contract/*.d.ts` > CLAUDE.md (A6/A7) > `docs/auftrag.md` > dieser Plan.

**Gelesen:**
- CLAUDE.md vollständig
- auftrag.md Kap. 2–15, davon besonders 6.10–6.12, 8, 9, 10, 12, 15
- `docs/altapp-analyse.md` §4–5
- `docs/phase1-plan.md` (§2, §3, §5, §6, §8, §9)
- `contract/claude.d.ts`, `db.d.ts`, `sample.d.ts`, `permissions.d.ts`
- `docs/datenstruktur.json` (`app/chat`, `app/radar`, `daily`, `grammar`)
- `seed/sample-data.json` (`app/chat`, `preply/pp…`, `preply/pi…`)
- Code: `src/ai/*`, `src/prompts/*`, `src/data/{writer,live,paths,schemas}.ts`, `src/features/lookup/*`, `src/engine/wordTap.ts`, `src/domain/srs/newCard.ts`, `src/domain/progress/profilePatch.ts`, `src/features/vocab/persist.ts`, `src/app/{App,nav}.tsx`, `src/ui/Sheet.tsx`, `src/platform/{capabilities,storage}.ts`, `src/platform/dev/fakeSample.ts`

---

## 0. Ausgangslage und Abhängigkeiten

| Baustein | Ort | Nutzen für Phase 5 |
|---|---|---|
| KI-Tor, nur JSON (`askJson`) | `src/ai/gate.ts` | Warteschlange (höchstens 2), Drosselung, Fehlerklassen und der „dauert länger"-Hinweis werden weiterverwendet. **Es fehlt ein Text- und Streaming-Weg mit Gesprächsverlauf als Eingabe.** |
| Vorlagen-Typ `PromptTemplate` (`build(): string`) | `src/prompts/types.ts` | Für den Chat fehlt ein Typ, der eine Liste von Gesprächsschritten liefert. |
| Wort-Antippen mit `lk-ask` (Erklärung direkt im Fenster über `word-lookup@1`) | `src/features/lookup/LookupPopover.tsx:192–304` | Wird umgebaut: „Claude fragen" öffnet den Begleiter (E5-09). |
| `newVocabDoc`, `saveCardOp` | `src/domain/srs/newCard.ts` | Nimmt Karten aus dem Import an. `src` und `origin.kind` müssen dafür erweitert werden. |
| `profilePatch` mit `lxSeq` | `src/domain/progress/profilePatch.ts` | Vorbild, damit „Stunde gehalten" nie doppelt zählt. |
| `writer.transform`/`createIfMissing` | `src/data/writer.ts` | Einziger Schreibweg. |
| Schemas `chatSchema`, `preplySchema`, `radarSchema`, `poolSchema` | `src/data/schemas.ts:109–130, 326` | Lesen tolerant; es kommen nur neue Felder dazu. |
| Seed: `app/chat` (4 Nachrichten, ohne `lang`), `preply/pi1789668000000` (`tasks` als **Strings**), `preply/pp1789581600000` | `seed/sample-data.json:90, 8133, 8162` | Altformate, die gelesen werden müssen. |

**Abhängigkeiten von Phase 2–4.** Diese werden in Schritt 0 bestandsgeprüft, jeweils mit Ausweichlösung:
- **D1 Grammatik-Fehler:** Hat Phase 2 `src/domain/grammar/errors.ts` (Fehler anhängen, Deckel 10, Box 0) und eine Voreinstellung je Thema (p0) gebaut, werden beide genutzt. Sonst baut WP-B `src/domain/preply/grammarErrors.ts` mit genau den Regeln aus `altapp-analyse.md` §4.
- **D2 Modulliste:** Gibt es aus Phase 2/4 einen Modul-Einstieg (z. B. `src/app/modules.ts`), bekommt Preply dort einen Eintrag. Sonst gibt es eine Zeile „Preply-Brücke" auf „Dein Stand" (`OverviewScreen`).
- **D3 Text-Weg im KI-Tor:** Hat Phase 3 (Rollenspiel, `onText`) schon einen Streaming-Weg gebaut, übernimmt WP-A dessen Signatur und gleicht sie nur an §4 an.
- **D4 Bildschirme aus Phase 2–4:** Die Dateien `src/features/{course,grammar,drills,speak,business,read,listen,write,discover}/*Screen.tsx` bekommen je eine Zeile `useCompanionSee(...)` (WP-F).

---

## 1. Ziel und Umfang

**Ziel:**
- Emrah hat überall einen **Claude-Begleiter**: großes Overlay, am Handy ein Vollbild-Blatt. Die Antworten erscheinen, während sie geschrieben werden, in schlichtem Markdown mit antippbaren englischen Wörtern und mit Vorschlägen.
- Der Begleiter weiß, was gerade auf dem Bildschirm ist („sieht gerade: Grammatik · Passiv"). Mitten in einer Übung verrät er die Lösung nicht.
- Der Verlauf bleibt in `app/chat` (höchstens 40 Nachrichten).
- Im selben Overlay gibt es einen **Übersetzer** DE↔EN mit Alternativen und Register. Am Rechner öffnet ihn die Taste `/`.
- Die **Preply-Brücke** kann eine Stunde vorbereiten (`preply/pp<ms>`) und übernimmt Lehrer-Texte (`preply/pi<ms>`).
  - Die KI zerlegt den Lehrer-Text in Korrekturen, Übungen, Vokabeln und Hausaufgaben.
  - Geschrieben wird **erst nach Bestätigung** einzelner Einträge.
- „Stunde gehalten" zählt als Aktivität (`act.preply`, Minuten).
- Der Knopf „Claude fragen" im Wort-Antippen führt mit Wort und Satz in den Begleiter.

**Nicht in Phase 5:**

| Inhalt | Wann | Grund |
|---|---|---|
| Fehler-Radar-Ansicht, Wochenbericht, Einschätzung mit Preply-Belegen | Phase 6 | Kap. 13. Phase 5 schreibt nur `app/radar.events`. |
| Hausaufgaben als Pflicht oder Angebot auf „Heute" | Phase 6 (Tagesplan-Gewichtung) | Kap. 2.1: eine rote Linie |
| Bilder an Claude (Screenshot vom Lehrer-Chat) | nicht geplant | `images` nur mit `limits()`. Das wäre eine eigene Produktentscheidung. |
| `tools` im Chat | nicht geplant | Mehrere Runden kosten Zeit und Kontingent (`sample.d.ts`). Die Daten passen in den Prompt. |
| Mehrere Chat-Verläufe | nicht geplant | `app/chat` ist ein einziges Dokument (Anhang B). „Neues Gespräch" setzt nur eine Marke. |

---

## 2. Entscheidungsregister

| # | Frage | Entscheidung | Begründung |
|---|---|---|---|
| E5-01 | Modellstufe (`modelTier`) im Chat | `default`, `cache:false` | Erklärungen brauchen Tiefe. `cache:false` verlangt Kap. 6.12 und `sample.d.ts`. |
| E5-02 | Standing Instructions | Als **führender `user`-Schritt**. Dieser ist bei jedem Aufruf neu gebaut und enthält Lernstand und „sieht gerade". | `sample.d.ts`: Es gibt keine `system`-Rolle. |
| E5-03 | Neuversuch im Chat | **Nie automatisch.** A6.3 gilt nur für JSON mit zod. Bei Fehlern gibt es „Erneut senden" auf Knopfdruck. | `sample.d.ts`: „NEVER retry from a loop" |
| E5-04 | Sprachtreue im Chat | Die Antwort ist in der Oberflächensprache. Beispiele sind amerikanisches Englisch. Jede Nachricht bekommt `lang`. Nachrichten in anderer Sprache werden eingeklappt, nie gemischt. | Kap. 10, Kap. 15. Ein Freitext hat kein Schema, also sind Markierung und Einklappen der einzige saubere Weg. |
| E5-05 | Hilfe mitten in einer Übung | Vor dem Prüfen sieht Claude Aufgabe und Satz mit `___`, **nicht** die Lösung, und darf sie nicht nennen. Nach dem Prüfen sieht Claude Lösung und eigene Antwort. Wird der Begleiter vor dem Prüfen geöffnet, zählt das als Hilfe (`hintUsed`). Die offene Zeit zählt nicht zur Antwortzeit. | A7 „Keine Selbstbewertung": Die Note ergibt sich aus Richtigkeit, Zeit und Hilfe. So bleibt der aktive Abruf erhalten (Kap. 5). |
| E5-06 | Schließen des Overlays während einer Antwort | Die Antwort läuft weiter und wird gespeichert. Abbrechen nur mit „Stopp". | A6.2: Abbruch durch Nutzer oder Bildschirmwechsel. Der Begleiter ist kein Bildschirm, der Bildschirm dahinter bleibt. |
| E5-07 | Vorschläge | Feste, kontextabhängige Chips aus i18n. Das Modell liefert keine Vorschläge. | Kein Format, das man zerlegen muss, und kein Fehlerpfad. |
| E5-08 | Markdown | Eigener, toleranter Parser (rein) und ein Renderer mit React-Elementen. **Kein** `dangerouslySetInnerHTML`, keine Links als `<a>`. | Kein neuer Abhängigkeitsballast. Fremde Hosts sind gesperrt (Kap. 3.1). |
| E5-09 | „Claude fragen" im Wort-Antippen | `lk-ask` schließt das Nachschlagen und öffnet den Begleiter mit dem Chip „Zu: *wort* · Satz". Die Frage wird **sofort gesendet**: „Erkläre mir „{word}“ in diesem Satz …". Die Erklärung direkt im Fenster (`lk-sense` über `lk-ask`) entfällt. Das automatische Nachschlagen unbekannter Wörter bleibt. | Auftrag des Leads. Der Klick ist die ausdrückliche Handlung (`sample.d.ts`). Ersetzt Phase-1-E16. |
| E5-10 | Übersetzer-Stufe | `translate@1`, `quick`, `cache:{gcTime: 86_400_000}`, Eingabe höchstens 1.500 Zeichen | Kap. 10: „kleine Hilfen" laufen auf `quick`. Dieselbe Eingabe ergibt dieselbe Übersetzung. |
| E5-11 | Stunde vorbereiten | `preply-prep@1`, `default`, `cache:false`. Das Ergebnis wird sofort als `preply/pp<ms>` gespeichert. | Kap. 10: Texte laufen auf `default`. „Neu erstellen" muss wirklich neu sein. |
| E5-12 | Lehrer-Import | `preply-import@1`, `complex`, `cache:false`. Die Analyse wird **vor** der Übernahme als `preply/pi<ms>` mit `applied:false` gespeichert. | Kap. 10 verlangt `complex`. Die teure Analyse geht nicht verloren. `applied` gibt es schon im Altformat. |
| E5-13 | Übernahme | Einzeln abwählbar, alles schreibt idempotent (feste `t` = `piMs + i`, Kennungen `pi<ms>-t<i>`). Ein Teilfehler zeigt „Erneut übernehmen" (manuell). | Kap. 6.10 („nach Bestätigung"). `db.d.ts`: Schreibvorgänge dürfen doppelt ankommen. |
| E5-14 | Ziel der Übungen aus dem Import | `app/pool.items` im Format von `daily.grammarItems` (`type ∈ gap\|mc\|transform\|correct`), `src:'preply'`, `id` neu. Ist der Pool voll (90), wird **nicht verdrängt**, sondern gemeldet. | Das Pool-Format kennt Phase 2 schon. Unbenutzte Aufgaben gehen nicht verloren. |
| E5-15 | Korrekturen | `grammar/<topic>.errors` (Box 0, fällig +1 Tag, `src:'preply'`) **und** `app/radar.events` (`s:'g'`). Themen außerhalb der 16 (`vocab`/`other`) gehen nur ins Radar. | Kap. 6.10. `altapp-analyse` §4 („g = Grammatik/Preply"). |
| E5-16 | `pi.tasks` im Altformat | `tasks` bleibt `string[]` (lesbare Aufgaben). Die strukturierten Übungen stehen im **neuen** Feld `items`. | Der Seed zeigt `tasks` als Strings. So bleibt der Rückweg zur alten App bis Phase 7 stimmig. |
| E5-17 | „Stunde gehalten" | Bestätigungsblatt mit Tag (Heute/Gestern) und Minuten (25/50/60). Danach wird `pp.done` gesetzt, dann `profile.act[tag].preply +1` und `minutes[tag] += min` mit `lxSeq`-Schutz. Es gibt **kein** `xpDays`, **keine** Pflicht und **kein** Rückgängig. | Kap. 6.10 „zählt als Aktivität". A7.2: Nur die Pflicht zählt für die Serie. Zähler nie rückwärts (`db.d.ts`). |
| E5-18 | Kopieren | Zuerst `navigator.clipboard.writeText`. Scheitert es (Richtlinie im iframe), wird der Text in einem schreibgeschützten Feld markiert, mit dem Hinweis „Markiert – jetzt kopieren". | Weder `contract/` noch `permissions.d.ts` sichern das Kopieren im iframe zu. |
| E5-19 | Laufende Abos | `app/chat`: 1 Abo, nur solange der Begleiter offen ist. `preply`-Sammlung: 1 Abo, nur solange der Preply-Bildschirm offen ist. Höchstens 10 Abos zugleich. | `db.d.ts`: höchstens 64 Abos, einmal je Abfrage. |
| E5-20 | Nicht verfügbar (`sample` null, `not_granted` & Co.) | Der Begleiter-Knopf und die KI-Knöpfe in Preply werden ausgeblendet. Der Preply-Verlauf und „Stunde gehalten" bleiben. | Kap. 3.1, `sample.d.ts` („hide the feature") |
| E5-21 | Nutzer-„Erneut versuchen" bei Vorlagen mit Zwischenspeicher | Neues Feld `AiRequest.refresh?: boolean`. Das Tor sendet dann `cache:{gcTime, refresh:true}`. Das gilt auch rückwirkend für `word-lookup`/`card-examples`. | **Gefundener Fehler:** Eine schemawidrige Antwort war für `sample` erfolgreich und wird bis zu 24 h wiedergegeben. „Erneut versuchen" würde dann nie neu fragen. |
| E5-22 | Neue Datenfelder (vollständige Liste) | `app/chat.since`, `msgs[].{t,lang,ctx,stopped}`, `pp.{pv,heldDay,heldMin}`, `pi.{t,lang,pv,items,sel,res,hwDone}`, `words[].{pos,fromLesson}`, `pool.items[].id`, Karte `src:'preply'\|'translate'\|'claude'`, `origin.kind += 'preply'\|'translate'\|'companion'`. Sonst nichts. | Kap. 9 Regel 2. Jedes weitere Feld braucht einen eigenen Beschluss. |

**Offene Frage an Emrah** (höchstens eine; ohne Antwort gilt E5-17): „Soll ein Tag mit gehaltener Preply-Stunde auch dann für die Serie zählen, wenn das tägliche Wiederholen fehlt?" Vorschlag: nein, aber die Stunde erscheint auf „Heute" als Extra.

---

## 3. Architektur und Dateiplan

### 3.1 Schichten
Die Schichten aus Phase-1 §2.1 gelten unverändert. Neu:
- `src/domain/companion/**` und `src/domain/preply/**` sind rein: kein React, kein `ai`, keine `prompts`.
- `src/prompts/*` importiert nur `zod`, `domain/lang`, `prompts`.
- `src/features/companion/**` und `src/features/preply/**` dürfen alles außer `claude.use`.

### 3.2 Zielstruktur
N = neu, Ä = geändert, in Klammern das Paket.

```
src/
  ai/         gate.ts Ä (A: askText, refresh) · types.ts Ä (S0: TextRequest, TurnInput, refresh) · useAskText.ts N (A)
  prompts/    types.ts Ä (S0: ChatTemplate) · registry.ts Ä (A) · work.ts N (A: Berufskontext, Konstante)
              companionChat.ts N · translate.ts N · preplyPrep.ts N · preplyImport.ts N (A)
  domain/
    companion/ brief.ts N (Lernstand-Kurzfassung) · seeing.ts N (Kontext, Schwärzen) · chatDoc.ts N (anhängen, kürzen, Bytes, since)
               turns.ts N (Eingabe bauen, Budget) · suggest.ts N (Vorschlags-Schlüssel je Lage) (B)
    text/      markdown.ts N (toleranter Parser → AST) (B)
    preply/    planDoc.ts N · importDoc.ts N · apply.ts N (Übernahme-Planer, rein) · grammarErrors.ts N (nur falls D1 fehlt) · held.ts N (B)
    progress/  profilePatch.ts Ä (B: activityPatch)
    srs/       newCard.ts Ä (S0: src/origin-Unionen)
  data/       schemas.ts Ä (S0) · live.ts Ä (S0: watchDoc, watchCollection)
  engine/     wordTap.ts Ä (S0: WordTapArea += 'companion'|'translate'|'preply') · Markdown.tsx N (C)
  ui/         Sheet.tsx Ä (C: size 'panel'|'large', headerSlot) · Icon.tsx Ä (C: sparkle vorhanden?, send, copy, swap, arrowDown)
  features/
    companion/ store.ts N · CompanionOverlay.tsx N · ChatPane.tsx N · ChatMessage.tsx N · Composer.tsx N
               SeeingBar.tsx N · Suggestions.tsx N · useStickToBottom.ts N · useKeyboardInset.ts N · persistChat.ts N (C)
               seeing.ts N (S0: Store + Hook useCompanionSee, Schnittstelle fest)
               translate/TranslatePane.tsx N · translate/store.ts N · translate/history.ts N (D)
    preply/    PreplyScreen.tsx N · PrepForm.tsx N · PlanView.tsx N · ImportPane.tsx N · ImportReview.tsx N
               HistoryList.tsx N · HeldSheet.tsx N · importMachine.ts N (XState) · store.ts N · actions.ts N · CopyBox.tsx N (E)
    lookup/    LookupPopover.tsx Ä (F: lk-ask → Begleiter)
    vocab/     ExerciseView.tsx / exerciseMachine.ts Ä (F: useCompanionSee, hintUsed, Pausenzeit)
    today/     TodayScreen.tsx Ä bzw. domain/overview.ts Ä (F: Extra „Preply-Stunde")
    {course,grammar,drills,speak,business,read,listen,write,discover}/*Screen.tsx Ä (F: je 1 Zeile useCompanionSee)
  app/        App.tsx Ä (INT: Kopf-Knopf, Overlay, Route, `/`) · nav.ts Ä (S0: Route preply) · hotkeys.ts N (D: globales `/`)
  i18n/parts/ companion.{de,en}.ts N (C) · translate.{de,en}.ts N (D) · preply.{de,en}.ts N (E)
  platform/dev/ cannedReplies.ts Ä · fakeSample.ts Ä (G: Modus slow, Skript) · install.ts Ä (G)
scripts/      generate-seed.mjs Ä · check-platform.mjs Ä (G)
seed/         sample-data.json Ä (G)
tests/        unit/*, e2e/* (G und je Paket, §10)
docs/         datenmodell.md Ä (INT)
```

### 3.3 Laufzeit-Zustand

| Store/Maschine | Datei | Inhalt |
|---|---|---|
| `useSeeing` (zustand) | `features/companion/seeing.ts` | `Map<schlüssel, Seeing>` und die oberste Registrierung. Bildschirme melden sich per Hook an und ab. |
| `useCompanion` (zustand) | `features/companion/store.ts` | `open`, `tab: 'chat'\|'translate'`, `attach`, `msgs` (aus `app/chat`), `turn {status, text, errorKey, userMsg}`, `openedAt`, `openMsTotal`, `lastOpenAt`, `saveState: 'ok'\|'local'\|'invalid'` |
| `useTranslate` (zustand) | `features/companion/translate/store.ts` | Eingabe, Richtung, Register, Ergebnis und Phase. Verlauf lokal (≤ 20). |
| `importMachine` (XState 5) | `features/preply/importMachine.ts` | `editing → analyzing(invoke askJson) → review → applying(invoke apply) → applied \| partial`, dazu `STOP`, `RETRY`, `LATER` |
| `usePreply` (zustand) | `features/preply/store.ts` | Sammlung `preply` (live, solange der Bildschirm offen ist), gewählter Reiter, offenes Dokument |
| `useAiStatus`, `aiQueue` | bestehend | unverändert |

**Nicht als XState:** Ein Chat-Zug ist ein linearer Ablauf mit Stopp. Das zustand-Feld `turn.status` genügt. Kap. 3.2 verlangt XState für Übungsabläufe und das Rollenspiel. Die Import-Strecke hat mehrere Schritte und wird deshalb eine Maschine.

### 3.4 Schnittstellen aus Schritt 0 (fest)

```ts
// features/companion/seeing.ts
export type SeeingArea = 'today'|'overview'|'trainer'|'course'|'grammar'|'drills'|'speak'|'business'
  |'read'|'listen'|'write'|'discover'|'preply'|'settings';
export type Seeing = {
  area: SeeingArea;
  label: string;          // Oberflächensprache, ≤ 60 Zeichen, z. B. „Grammatik · Passiv"
  detail?: string;        // für Claude, ≤ 1.500 Zeichen (Aufgabe, Satz mit ___, Textausschnitt)
  phase?: 'question' | 'feedback' | 'idle';
  reveal?: string;        // ≤ 600 Zeichen: Lösung + eigene Antwort; wird NUR bei phase 'feedback' gesendet
};
/** In useEffect: meldet an, aktualisiert bei Änderung (Vergleich per JSON), meldet beim Aushängen ab. */
export function useCompanionSee(info: Seeing | null): void;
export function currentSeeing(): Seeing | null;

// features/companion/store.ts
export type Attach = { kind: 'word'; word: string; sentence: string; source: string | null };
export function openCompanion(o?: { tab?: 'chat' | 'translate'; attach?: Attach; send?: string; text?: string }): void;
export function closeCompanion(): void;
/** Offene Zeit gesamt (ms, steigt nur) – der Trainer zieht sie von der Antwortzeit ab. */
export function companionOpenMs(): number;
/** Wurde der Begleiter seit `sinceMs` (performance.now) geöffnet? → hintUsed. */
export function companionOpenedSince(sinceMs: number): boolean;
```

---

## 4. KI-Tor-Erweiterung (WP-A, `src/ai/gate.ts`)

```ts
// ai/types.ts (S0)
export type TurnInput = ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
export type TextRequest = {
  id: string; version: number;             // für Scope, Protokoll und Adapter-Kopfzeile
  tier: ModelTier; input: string | TurnInput; cache: CacheOpt;
  signal: AbortSignal; priority?: AiPriority;
  onPhase?: (p: AiPhase) => void;
  onText?: (u: { text: string; delta: string }) => void;
};
export type TextResult = { text: string; truncated: boolean; tierApplied: ModelTier };
// AiRequest<V,O> bekommt: refresh?: boolean  (E5-21)

// ai/gate.ts (A)
export async function askText(req: TextRequest): Promise<TextResult>;
```

**Regeln für `askText`:**
- Dieselben Stationen wie `askJson`: Verfügbarkeit, dann Drosselung, dann `aiQueue.acquire`, dann **ein** Aufruf `sample(input, {modelTier, cache, signal: eigenerCtl.signal, onText})`. Der eigene Controller ist über `linkAbort` an das Signal gekoppelt.
- `SLOW_AFTER_MS[tier]` erzeugt die Phase `slow`, bricht aber nie ab (A6.2).
- **Budget:** Die Summe der UTF-8-Bytes aller `content` muss ≤ `PROMPT_BUDGET_BYTES` (60.000) sein, sonst `too_large` und `logError`. Eine Turn-Liste muss mit `user` beginnen und enden und darf keinen leeren Inhalt haben. Sonst gilt `bug` ohne Aufruf.
- **Fehler** über `failureFromSample`, dabei bleibt `partial` erhalten. Die Oberfläche zeigt `e.text` bei `upstream_error` mit dem Vermerk „unterbrochen", bei `refused` wird es geleert.
- **Kein Neuversuch, in keinem Fall** (E5-03).
- `tierApplied = result.modelTierApplied`. `sample()` liefert das, `sample.json` nicht.
- **`refresh` in `askJson`:** Mit `req.refresh` wird `cache` zu `{gcTime: gc, refresh: true}`, wobei `gc` = `template.cache.gcTime` bzw. 300.000 bei `true`. Bei `false` bleibt `false`. Die Oberfläche setzt `refresh` nur beim Knopf „Erneut versuchen" nach `invalid`.
- **`useAskText`** (`src/ai/useAskText.ts`): Hook wie `useAsk`, mit `text`, `phase`, `errorKey`, `run(input)`, `stop()`. Der Begleiter nutzt ihn **nicht**: Sein Aufruf lebt im Store (E5-06). `useAskText` ist für spätere Einmal-Texte gedacht, Phase 5 braucht ihn nur in Tests.

---

## 5. Datenformen und Schreibwege

Alles geht über `src/data/writer.ts`. Es gibt kein `delete`, und `daily/*` sowie `feed/*` werden nie geschrieben.

### 5.1 Übersicht

| Dokument | Auslöser | Operation | Paket |
|---|---|---|---|
| `app/chat` | Antwort vollständig oder gestoppt mit Teiltext | `transform`: fehlt → `set({msgs})`; ungültig (`validateDoc` scheitert oder `msgs` kein Array) → **nichts**, `saveState:'invalid'`; sonst `update({msgs: appendChat(...)})` | C (Aufruf), B (Rechnung) |
| `app/chat.since` | Knopf „Neues Gespräch" | `transform` → `update({since: t})` (fehlt das Dokument: `set({msgs:[], since})`) | C |
| `preply/pp<ms>` | „Plan erstellen" erfolgreich | `createIfMissing` (bei `exists` einmal mit `ms+1`) | E |
| `preply/pp<ms>` (gehalten) | Bestätigen im HeldSheet | `transform`: `done === true` → null; sonst `update({done:true, doneT, heldDay, heldMin})` | E |
| `preply/pp<ms>` (ohne Plan) | „Stunde ohne Plan eintragen" | `createIfMissing` mit Mindestform und `done:true` | E |
| `app/profile` (Aktivität) | nur wenn der `pp`-Transform `'updated'`/`'created'` meldet | `transform` → `update(activityPatch(...))` mit `lxSeq` | E / B |
| `preply/pi<ms>` | Analyse erfolgreich | `createIfMissing` (`applied:false`) | E |
| `vocab/<slug>` | Übernahme, je gewähltes Wort | `transform(saveCardOp)` | E / B |
| `grammar/<topic>` | Übernahme, **ein** Schreibvorgang je Thema | `transform`: fehlt → `set(default(topic) + errors)`; sonst `update({errors})` | E / B |
| `app/radar` | Übernahme | `transform` → `update({events})` (fehlt: `set`) | E / B |
| `app/pool` | Übernahme | `transform` → `update({items})` (fehlt: `set({items, t})`) | E / B |
| `preply/pi<ms>` (übernommen) | nachdem **alle** Ziele geschrieben sind | `transform` → `update({applied:true, appliedT, sel, res})` | E |
| `preply/pi<ms>.hwDone` | Hausaufgabe abhaken | `update({hwDone: {[i]: dayKey}})`; der verschachtelte Merge ergänzt nur | E |

**Reihenfolge der Übernahme:** vocab → grammar → radar → pool → pi. Je Dokument gibt es genau einen Schreibvorgang. Die Warteschlange je Pfad sorgt für „einer zur Zeit".

### 5.2 `app/chat`

```json
{ "msgs": [
    { "role": "user", "content": "Erkläre mir „leverage“ in diesem Satz …", "t": 1790488800000, "lang": "de",
      "ctx": "Trainer · leverage" },
    { "role": "assistant", "content": "**leverage** heißt hier …", "t": 1790488815000, "lang": "de" },
    { "role": "assistant", "content": "…", "t": 1790488900000, "lang": "de", "stopped": true }
  ],
  "since": 1790488700000 }
```

`domain/companion/chatDoc.ts` (B):

```ts
export const CHAT_MAX = 40;                // Altgrenze (altapp-analyse §8.5)
export const CHAT_MAX_BYTES = 180_000;     // Puffer zu 256 KiB (db.d.ts)
export const USER_MAX = 2_000, ASSISTANT_MAX = 8_000;   // Zeichen je gespeicherter Nachricht
export type ChatMsg = { role: 'user'|'assistant'; content: string; t?: number; lang?: string; ctx?: string; stopped?: boolean };
export function readChat(doc: unknown): { msgs: ChatMsg[]; since: number; ok: boolean };   // Altnachrichten ohne t/lang erlaubt
export function appendChat(cur: readonly ChatMsg[], add: readonly ChatMsg[]): ChatMsg[];    // kürzen, dann die neuesten ≤ 40, dann Bytes ≤ MAX (älteste zuerst weg)
export function msgLang(m: ChatMsg): 'de'|'en'|'unknown';   // m.lang, sonst detectLang(stripQuoted(content ohne `…`, **…**))
```

- Die Assistenz-Sprache wird **nach** der Antwort bestimmt. Bei eindeutig anderer Sprache wird `lang` auf die erkannte Sprache gesetzt (E5-04).
- Nachrichten mit `t < since` stehen sichtbar über einer Trennlinie „Früher". Sie werden nicht an Claude gesendet.

### 5.3 `preply/pp<ms>` (Plan, Altformat plus neue Felder)

```json
{ "t": 1790488800000, "lang": "de", "pv": "preply-prep@1",
  "ctx": { "kind": "free|lesson|topic|import", "title": "…", "topic": "…" },
  "title": "…", "minutes": 50, "goal_en": "…", "goal_x": "…",
  "warmup": ["…"], "talk": ["…"], "say": ["…"], "watch": [{ "mistake": "…", "fix": "…", "note": "…" }],
  "message": "Hi! …", "done": false, "doneT": 0 }
```

- Nach „gehalten" kommen dazu: `done:true`, `doneT`, `heldDay:"2026-09-27"`, `heldMin:50`.
- Ohne Plan: `{t, lang, ctx:{kind:'held'}, title: i18n, minutes, warmup:[], talk:[], say:[], watch:[], message:'', done:true, doneT, heldDay, heldMin}`.

### 5.4 `preply/pi<ms>` (Import, Altformat plus neue Felder)

```json
{ "kind": "import", "t": 1790488800000, "lang": "de", "pv": "preply-import@1",
  "raw": "…≤ 12.000 Zeichen…", "title": "…", "summary": "…",
  "corrections": [{ "wrong": "It depends of the budget.", "right": "It depends on the budget.", "topic": "prepositions", "why": "…" }],
  "tasks": ["Fill the gap: It depends ___ the budget."],
  "items": [{ "type": "gap", "topic": "prepositions", "prompt": "It depends ___ the budget.", "answer": "on",
              "accepted": ["on"], "options": [], "hint_de": "", "explanation_de": "…", "explanation_en": "…" }],
  "words": [{ "en": "would rather", "de": "lieber wollen", "ex": "I'd rather start with a pilot.", "pos": "phrase", "fromLesson": true }],
  "homework": ["Five sentences with \"would rather\""],
  "applied": false, "appliedT": 0 }
```

- Nach der Übernahme kommen dazu: `applied:true`, `appliedT`, `sel:{c:[0], t:[0], w:[0]}`, `res:{c:1, t:1, w:1, skipped:0, poolFull:0, replaced:0}`.
- `tasks[i]` ist `items[i].prompt`. So sind Alt- und Neuformat gleich lesbar (E5-16).

### 5.5 Übernahme-Planer (`domain/preply/apply.ts`, rein, B)

```ts
export type ApplySel = { c: number[]; t: number[]; w: number[] };
export type ApplyPlan = {
  vocab: Array<{ path: string; made: { id: string; doc: Doc } }>;       // newVocabDoc(src:'preply', origin{kind:'preply', ref, title})
  grammar: Array<{ path: string; add: GrammarErr[] }>;                   // je Thema gebündelt
  radar: RadarEvent[]; pool: PoolItem[];
  skipped: Array<{ group: 'c'|'t'|'w'; i: number; reason: 'no_sentence'|'exists'|'bad_topic'|'invalid' }>;
};
export function planApply(pi: Doc, piId: string, sel: ApplySel, ctx: { now: number; today: string;
  vocabIds: ReadonlySet<string>; topicIds: ReadonlySet<string> }): ApplyPlan;

export function grammarErrorsOp(cur: Doc | undefined, topic: string, add: GrammarErr[], now: number, def: Doc)
  : { set: Doc } | { update: Doc } | null;   // Deckel 10: erst erledigte (done), dann älteste; doppelt (given|ans normalisiert) → weg
export function radarOp(cur: Doc | undefined, add: RadarEvent[]): { set: Doc } | { update: Doc } | null;   // ≤ 400, neueste bleiben, doppelt t|q → weg
export function poolOp(cur: Doc | undefined, add: PoolItem[], now: number)
  : { op: { set: Doc } | { update: Doc } | null; refused: number };        // kein Verdrängen (E5-14), doppelt nach id → weg
```

**Formen:**
- `GrammarErr = {q: wrong, given: wrong, ans: right, t: piMs + i, src: 'preply', box: 0, due: now + 86_400_000, done: false, last: 0}`
- `RadarEvent = {c: topic, s: 'g', t: piMs + i, q: wrong ≤ 160, g: wrong ≤ 100, a: right ≤ 100}`
- `PoolItem = items[i] + {id: 'pi<ms>-t<i>', src: 'preply'}`

**Regeln:**
- Ein Wort ohne gültige Klammer (`bracketExample` leer) wird `skipped: no_sentence` und in der Vorschau als nicht wählbar mit Grund gezeigt (Kap. 15: keine Karte ohne Ursprungssatz).
- Eine vorhandene Karte wird `exists`. `saveCardOp` ergänzt höchstens `ex`.
- Die feste `t` macht jeden Schritt wiederholbar, ohne dass etwas doppelt entsteht.

### 5.6 `activityPatch` (`domain/progress/profilePatch.ts`, B)

```ts
export function activityPatch(cur: Doc, a: { day: string; key: 'preply'; minutes: number },
  ctx: { deviceId: string | null; seq: number }): Doc | null;
// ungültiges Profil → null; lxSeq[gerät] ≥ seq → null;
// act[day][key] + 1, minutes[day] + clamp(minutes, 1, 120); kein days/xpDays/pflicht.
```

Die Oberfläche hält `seq` fest, bis der Schreibvorgang bestätigt ist. „Erneut speichern" nutzt dieselbe `seq`, also wird nie doppelt gezählt.

### 5.7 Browser-Speicher (nur Bequemlichkeit, `platform/storage.ts`)
- `lx:draft:chat`: Entwurf im Chat-Feld
- `lx:draft:preply-import`: eingefügter Lehrer-Text, gelöscht nach erfolgreicher Analyse
- `lx:translate-history`: letzte 20 Übersetzungen `{t, text, dir, reg, main}`
- `lx:companion-tab`: zuletzt offener Reiter

Jeder Zugriff geht über `local.*` (try/catch mit Diagnose).

### 5.8 Kapazität (A6.6)
- `app/chat` ≤ 180 KB, bleibt 1 Dokument.
- `preply/*` wächst um etwa 2 Dokumente je Woche (≈ 100 je Jahr).
- `app/radar` ≤ 400 Einträge, `app/pool` ≤ 90.
- Karten entstehen nur nach Bestätigung.
- Die Diagnose-Ansicht bekommt eine Zeile „Chat: n Nachrichten · x KB" und „Preply: n Dokumente" (INT).

### 5.9 Schema-Ergänzungen (S0, `src/data/schemas.ts`, alle `nullish`, nichts verschärft)
- `chatSchema`: `since: num`; die Nachricht zusätzlich `t: num, lang: str, ctx: str, stopped: bool`.
- `preplySchema`: `lang, pv: str`, `minutes, doneT, appliedT: num`, `heldDay: str`, `heldMin: num`, `corrections/words/items/watch: looseArr`, `tasks/homework/warmup/talk/say: z.array(z.unknown()).nullish()` (Strings oder Altformen), `hwDone: z.record(str, str-nullish)`, `sel, res, ctx: z.looseObject({}).nullish()`.
- `poolSchema.items[*]`: `id: str`.
- `vocabSchema`: unverändert. `src` und `origin.kind` sind schon `str`.

---

## 6. KI-Vorlagen (WP-A, `src/prompts/*`)

**Gemeinsam für alle Vorlagen:**
- Erste Zeile `[id@version]`.
- Anweisung auf Englisch. Erklärungen in `langName(uiLang)`.
- Amerikanisches Englisch. Britische Formen gelten als richtig und werden nur als US-Hinweis erwähnt (A7.3).
- Nutzertext immer mit `clip` (einzeilig) oder `block` (neu in `common.ts`: behält Zeilenumbrüche, entfernt die Begrenzer `<<<`/`>>>`, begrenzt die Länge).
- Jede JSON-Vorlage hat eine Beispielantwort, die ihr eigenes Schema besteht (Test).

### 6.1 `companion-chat@1` (ChatTemplate, `default`, `cache:false`)

```ts
// prompts/types.ts (S0)
export type ChatTemplate<V> = { id: string; version: number; tier: ModelTier; cache: false; buildTurns(vars: V): TurnInput };

export type CompanionVars = {
  uiLang: UiLang;
  learner: string;              // domain/companion/brief.ts, ≤ 2.500 Zeichen
  seeing: Seeing | null;        // bereits geschwärzt (domain/companion/seeing.ts)
  attach: Attach | null;
  history: TurnInput;           // seit `since`, ohne Einleitung
  message: string;              // ≤ 2.000 Zeichen
};
```

**Der führende `user`-Schritt** (fest, ≤ 6 KB) enthält:
- **Rolle:** „built-in English coach in Lingo-Engine X for a German-speaking professional (B2 → C1), work context: {WORK}"
- **Regeln:**
  - write explanations in {German|English}; examples and model sentences in American English, quoted or in **bold**;
  - accept British forms as correct, mention the US form only as a tip;
  - default length ≤ 180 words unless asked for more;
  - Markdown subset only (paragraphs, **bold**, *italic*, `code`, lists, `>` quotes, `###` headings), no tables, no links, no HTML;
  - do not claim to change the learner's data or schedule;
  - if unsure, say so.
- **Schutzregel (E5-05):** Nur bei `seeing.phase === 'question'`: „The learner is in the middle of this exercise and has NOT checked the answer yet. Never state or spell the solution; give a hint, explain the rule or give a different example instead."
- **Blöcke:**
  - „Learner profile:" (`learner`)
  - „Currently on screen:" (`label` + `detail` + bei `feedback` `reveal`)
  - „Question is about:" (`attach`)

**Budget-Funktion** `buildChatInput` (`domain/companion/turns.ts`):
- Einleitung, dann Verlauf (nur `t ≥ since`), dann neue Nachricht.
- Jede Verlaufsnachricht höchstens 3.000 Zeichen.
- Es werden die **ältesten** Verlaufsnachrichten verworfen, bis Summe ≤ 56.000 Bytes und ≤ 20 Nachrichten. Einleitung und neue Nachricht bleiben immer.
- Beginn und Ende sind garantiert `user`. Leere Inhalte fallen weg.

**Lernstand-Kurzfassung** `brief.ts`, aus `useLive`, ohne neues Abo:
- `app/assess.data` (level/cefr, focus.title, ≤ 3 blockers.title)
- 3 schwächste Grammatikthemen (`p`, Namen aus content/legacy in UI-Sprache)
- ≤ 5 offene Grammatikfehler (`given` → `ans`)
- ≤ 5 hartnäckige Wörter (`lapses ≥ 4`)
- Pflicht heute erledigt ja/nein

**Schwärzen** `seeing.ts`: `redact(s) = phase === 'feedback' ? s : {...s, reveal: undefined}`. Dazu kürzt es `detail` auf 1.500 Zeichen.

**Nachprüfung (keine Schleife):**
- `msgLang(reply)` ≠ uiLang bei eindeutiger Erkennung: gespeichert mit echtem `lang`, eingeklappt angezeigt, dazu der Knopf „In {Sprache} neu fragen" (ein neuer Aufruf auf Knopfdruck).
- `truncated`: Vermerk „Antwort gekürzt – frag gezielter nach".

### 6.2 `translate@1` (`quick`, `cache:{gcTime: 86_400_000}`)

- **Variablen:** `{text ≤ 1.500 (block), from: 'de'|'en', register: 'formal'|'neutral'|'casual', uiLang}`. `to` ist die jeweils andere Sprache.
- **Ausgabe:**

```ts
{ translation: string (1..2000),                 // in `to`, im gewählten Register
  register: 'formal'|'neutral'|'casual',
  alternatives: Array<{ text: string (1..2000); register: 'formal'|'neutral'|'casual'; note: string (≤120, uiLang) }> (2..3),
  notes: string[] (0..3, je ≤ 160, uiLang),    // Wortwahl, falsche Freunde, US/UK
  terms: Array<{ en: string (≤60); de: string (≤80) }> (0..5) }
```

- **Prüfung:**
  - `translation` und `alternatives[].text` ist eindeutig `to` (`!isWrongLang(x, to)`).
  - `note`/`notes` ist uiLang (`langOf`).
  - Mindestens eine Alternative hat ein anderes Register als die Hauptfassung.
- **Richtung:** `detectLang(text)` schlägt vor (`unknown` → DE→EN). Der Umschalter `tr-dir` überschreibt.

### 6.3 `preply-prep@1` (`default`, `cache:false`)

- **Variablen:** `{uiLang, minutes: 25|50|60, ctx: {kind, title?, topic?}, learner: string, errors: Array<{wrong, right, topic}> (≤ 8, aus grammar.errors offen + radar neueste), words: string[] (≤ 10, hartnäckig/neu), lastImport: {title, homework: string[]} | null, work: WORK}`.
- **Ausgabe** (= Altformat):
  - `{title ≤ 80 (uiLang), goal_en ≤ 200 (en), goal_x ≤ 200 (uiLang)`
  - `warmup: string[3..4] (en, ≤ 160)`
  - `talk: string[3..5] (en, ≤ 220, aus dem Arbeitsalltag)`
  - `say: string[4..6] (en, ≤ 160, Modellsätze C1)`
  - `watch: [{mistake (en), fix (en), note (uiLang ≤ 160)}] (2..4, NUR aus den übergebenen errors)`
  - `message: string (en, 60..700 Zeichen, freundliche Nachricht an den Lehrer mit Ziel und Fokus)}`
- **Prüfung:** Sprachprüfung je Feld. `watch[].mistake` muss (normalisiert) in `errors[].wrong` vorkommen, sonst Schemafehler, dann ein Neuversuch mit Fehlerbeschreibung (A6.3). **Ohne übergebene Fehler** ist `watch` leer erlaubt (`0..4`).

### 6.4 `preply-import@1` (`complex`, `cache:false`)

- **Variablen:** `{uiLang, raw ≤ 12.000 (block, Zeilen bleiben), topics: Array<{id, name}> (16 Themen + 'vocab' + 'other'), today}`.
- **Anweisung:**
  - „Extract ONLY what is in the text (chat, teacher corrections, homework; may be messy and mixed German/English)."
  - „Never invent corrections."
  - „For words: `ex` = the sentence from the text containing the word if there is one (`fromLesson: true`), otherwise one natural US example (`fromLesson: false`)."
- **Ausgabe:**

```ts
{ title: string (≤80, uiLang), summary: string (≤400, uiLang),
  corrections: Array<{ wrong ≤200 (en); right ≤200 (en); topic: enum(topicIds|'vocab'|'other'); why ≤200 (uiLang) }> (0..20),
  tasks: Array<{ type: 'gap'|'mc'|'transform'|'correct'; prompt ≤240 (en; gap enthält "___");
                 answer ≤120; accepted: string[] (0..5); options: string[] (mc: 3..4 inkl. answer, sonst []);
                 topic: enum; explanation_de ≤240; explanation_en ≤240 }> (0..10),
  words: Array<{ en ≤60; de ≤120; pos ≤20; ex ≤220 (en, enthält en); fromLesson: boolean }> (0..20),
  homework: string[] (0..8, je ≤240, uiLang; englische Zitate erlaubt) }
```

**Prüfung:**
- `wrong ≠ right`.
- `mc` enthält `answer` in `options`.
- `gap` enthält `___`.
- `explanation_de` ist Deutsch, `explanation_en` ist Englisch. Beide Sprachen sind Pflicht, weil der Pool beide Felder hat.
- `ex` enthält `en` (über `bracketExample` aus `newCard.ts`, die Vorlage bekommt den Prüfer als Funktion übergeben, damit `prompts` nicht aus `domain/srs` importiert). **Andernfalls** ist `ex` nur ein Hinweis, die Planung markiert `no_sentence`.

**Budget:** Anweisung ≤ 4 KB plus `raw` ≤ 36 KB (12.000 Zeichen × 3 B), zusammen < 60.000 B. Ist `raw` länger, gibt es vorher in der Oberfläche den Hinweis „Nur die ersten 12.000 Zeichen werden gelesen".

### 6.5 Feste Antworten (`src/platform/dev/cannedReplies.ts`, G)

| Vorlage | Antwort | Test-Marker |
|---|---|---|
| `companion-chat` | Deutsches Markdown mit „**leverage**" und einer Liste. Bei `zzlong` 3.000 Zeichen (Scroll-Test). Bei `zzen` eine englische Antwort (Sprachtreue). Enthält die Einleitung „has NOT checked", endet die Antwort mit `[no-solution]`, sonst mit `[solution-ok]` (E2E prüft das Schwärzen). | `zzlong`, `zzen` |
| `translate` | Hauptfassung und 2 Alternativen (formal/casual), 1 Hinweis | `zzsame` = alle Alternativen im selben Register → Schemafehler → Neuversuch |
| `preply-prep` | vollständiger Plan, `watch` aus den ersten übergebenen `errors` | – |
| `preply-import` | 2 Korrekturen (prepositions, other), 2 Aufgaben (gap, mc), 3 Wörter (1 ohne Satz → `no_sentence`, 1 vorhandenes → `exists`), 1 Hausaufgabe | `zzempty` = alles leer |

`fakeSample.ts` bekommt den Modus `slow` (40 Zeichen je 150 ms), gesteuert über `?fake=slowsample` bzw. `sampleDelayMs` aus dem Phase-1-Adapter. `check-platform.mjs` sperrt zusätzlich die Marker `zzlong`, `zzen`, `zzsame`, `zzempty` und `[no-solution]` im Build.

---

## 7. Lerndesign (für den learning-scientist)

1. **Begleiter in Übungen (E5-05).** Vor dem Prüfen gibt es Hinweise statt Lösung. Das Öffnen zählt als Hilfe, dadurch sinkt die automatische Note (A7) wie bei „Tipp". Nach dem Prüfen erklärt Claude mit echter Antwort und Lösung („Warum ist das falsch?").
2. **Vorschläge je Lage** (`domain/companion/suggest.ts`, jeweils Schlüssel):
   - Trainer, Frage: `sgHint` „Gib mir einen Tipp – ohne Lösung", `sgRule` „Erklär mir die Regel".
   - Trainer, Rückmeldung: `sgWhyWrong` „Warum war meine Antwort falsch?", `sgMoreExamples` „Drei weitere Beispiele", `sgConfusable` „Womit verwechsle ich das?".
   - Wort als Chip: `sgWordColloc` „Typische Verbindungen", `sgWordRegister` „Formell oder locker?", `sgWordQuiz` „Frag mich ab".
   - Allgemein: `sgEmail` „Hilf mir bei einer E-Mail", `sgPreply` „Was soll ich meinen Lehrer fragen?", `sgWeakest` „Übe mit mir mein schwächstes Thema".
   - Nach jeder Antwort genau 3 Folgechips: `sgSimpler`, `sgMoreExamples`, `sgQuizMe`.
3. **Generierungseffekt im Chat:** `sgQuizMe` bringt Claude dazu, *eine* Frage zu stellen und auf die Antwort zu warten. Das steht in den Anweisungen: „When asked to quiz, ask one question at a time and wait."
4. **Übersetzer:** Hauptfassung im gewählten Register und Alternativen mit Register-Chip. Die Hinweise erklären Wortwahl und falsche Freunde. Alle englischen Fassungen sind antippbar, speicherbar als Karte mit Ursprungssatz über den bestehenden Weg (`origin.kind:'translate'`, `src:'translate'`).
5. **Stunde vorbereiten:**
   - `watch` besteht **nur aus echten eigenen Fehlern** (Prüfung in §6.3).
   - Die Modellsätze liegen knapp über dem Niveau (i+1) und stammen aus dem Arbeitsalltag.
   - Die Nachricht an den Lehrer nennt Ziel und Fokus.
6. **Import:**
   - Korrekturen landen in der Fehler-Wiederholung (Box 0, nach 1 Tag fällig) und im Radar.
   - Wörter werden Karten mit Ursprungssatz aus der Stunde (`fromLesson` bevorzugt).
   - Übungen landen im Pool mit Erklärung DE/EN.
   - Hausaufgaben erscheinen als Liste; abgehakt ist Zustand, kein Knopf.
7. **Vier Pflichtfragen (Kap. 2.4) in der A7-Form:**
   - Chat und Übersetzer sind keine Übungen.
   - Preply-Plan: oben eine Zeile Ziel, Zweck hinter einem Info-Symbol.
   - Import-Vorschau: je Eintrag „was → wohin" als Status-Chip („→ Fehler-Wiederholung", „→ Karten", „→ Übungen"). Keine Erklärtexte.

---

## 8. Oberfläche und Interaktion

### 8.1 Begleiter-Overlay (`CompanionOverlay.tsx`, `Sheet size="large"`)

**Maße:**
- **Handy (< 768 px):** Vollbild-Blatt, oben `env(safe-area-inset-top)`, `aria-modal`, Hintergrund `inert`.
- **Desktop:** zentriertes Overlay `min(56rem, 92vw) × min(88vh, 60rem)`, Glas, Scrim. **Keine schmale Seitenleiste** (Kap. 15).

**Kopf:**
- Titel „Claude"
- Segmented „Fragen | Übersetzen" (`companion-tab-chat`/`-translate`)
- „Neues Gespräch" (`chat-new`, Symbol)
- ✕

**Darunter:**
- `SeeingBar` (`seeing`, `data-area`): „sieht gerade: {label}" in gedämpfter Schrift mit Kanalfarbe als Punkt. Ohne Kontext: „sieht gerade: Heute".
- Anhang-Chip (`chat-attach`) „Zu: **leverage** · „We can leverage …“" mit ✕ (`chat-attach-remove`).

**Verlauf** (`chat-log`, `role="log"`, `aria-live="off"` während des Streamens; bei Fertig eine `aria-live="polite"`-Meldung „Antwort fertig"):
- Nutzer rechts (Fläche `surface-strong`), Claude links ohne Blase (Text in voller Breite, `max-w-[68ch]`).
- `chat-msg[data-role][data-lang][data-state=streaming|done|stopped|error|foreign]`.
- Eine Nachricht in anderer Sprache erscheint eingeklappt: „Antwort auf Englisch – anzeigen", mit `Disclosure`.

**Streaming-Anzeige:**
- Bis zum ersten `onText` „Denkt nach …" (`ai-phase`, drei ruhige Punkte, bei reduzierter Bewegung statisch).
- Ab `slow`: „Dauert länger als üblich" mit `chat-stop`.
- Beim Streamen wird ein Stopp-Knopf anstelle von „Senden" gezeigt.

**Kein Scroll-Springen** (`useStickToBottom.ts`):
- `atBottom = scrollHeight − scrollTop − clientHeight ≤ 48`, gemessen bei `scroll` (passiv).
- Ein `ResizeObserver` beobachtet den Inhalt. Wächst er und war `atBottom`, dann `scrollTop = scrollHeight` (sofort, nicht weich). Sonst nichts, und die Pille `chat-jump` „Neue Antwort ↓" erscheint.
- Eigenes Senden setzt `atBottom = true` (ausdrückliche Handlung).
- `overflow-anchor: none` auf dem Log, damit der Browser nicht nachregelt.
- Die reine Funktion `nextScroll(prev, metrics)` ist unit-getestet.

**Eingabe** (`Composer.tsx`):
- `textarea` 16 px, wächst bis 6 Zeilen, `enterkeyhint="send"`.
- **Desktop:** Enter sendet, Umschalt+Enter macht einen Zeilenumbruch.
- **Touch:** Return macht einen Zeilenumbruch, gesendet wird mit dem Knopf (`chat-send`, `data-ai`, 44 px).
- Entwurf in `lx:draft:chat`.
- Senden ist gesperrt, solange eine Antwort läuft oder `useAiStatus.pausedUntil > now`. Dann erscheint `aiBusy` mit Uhrzeit.

**Weitere Regeln:**
- **Bildschirmtastatur iPhone** (`useKeyboardInset.ts`, H5): `visualViewport.resize/scroll` setzt `--lx-kb` und damit die Blatthöhe auf `visualViewport.height`. Die Eingabeleiste bleibt über der Tastatur. Ohne `visualViewport` wird nichts gesetzt.
- **Markdown** (`engine/Markdown.tsx` auf Basis von `domain/text/markdown.ts`):
  - Während des Streamens nur Text-Elemente, ohne Wortknöpfe.
  - Bei `done`: englische Stellen über `EnglishText`. In UI=de sind das `**…**`, `*…*`, `` `…` ``, `„…“`/`"…"`-Zitate und `>`-Zitate mit `detectLang ≠ 'de'`. In UI=en ist der ganze Text antippbar.
  - Unfertige Marker (`**bol`) erscheinen als Text.
  - Überschriften höchstens `h3` → `<p class="font-semibold">`, damit die Hierarchie ruhig bleibt.
- **Vorschläge** (`chat-suggestion`) als horizontale Chip-Zeile über der Eingabe, 44 px hoch, wischbar, kein Querscrollen der Seite.
- **Fehler:**
  - Inline unter der letzten Nachricht mit `aiMessageKey`-Text und `chat-retry` „Erneut senden" (ein Aufruf je Klick).
  - `refused`: Teiltext entfernen.
  - `upstream_error`: Teiltext bleibt mit „unterbrochen".
- **Speichern:**
  - Nach Erfolg wird geschrieben. Ist die Datenbank nicht da oder ungültig, erscheint die Zeile „Dieses Gespräch wird nicht gespeichert".
  - Ein Speicherfehler zeigt eine Toast-Meldung mit „Erneut speichern".
- **Nachschlagen im Begleiter:** Das Popover liegt über dem Overlay (z-index 50). Esc schließt zuerst das Popover, dann das Overlay. Der Fokus kehrt zum Wort bzw. zum Kopf-Knopf zurück.
- **Einstieg:**
  - Kopf-Knopf `open-companion` (Symbol ✦, Beschriftung „Claude fragen", `data-ai`) auf allen Bildschirmen außer `migration`/`nodb`. Er ist nur sichtbar bei `useAiAvailable()`.
  - Im Trainer ist er in der Trainerleiste (INT verdrahtet).

### 8.2 Übersetzer (`TranslatePane.tsx`)

**Aufbau:**
- Eingabe `tr-input` (Textarea, 1.500 Zeichen, Zähler)
- Richtung `tr-dir` („Deutsch → Englisch" ⇄), Register `tr-register` (Formell | Neutral | Locker, Standard Neutral)
- `tr-go` (Enter auf Desktop, `data-ai`)

**Ergebnis** `tr-result`:
- Hauptfassung `tr-main` (`lang` = Zielsprache, bei EN antippbar, 🔊 bei `ready`, `tr-copy`)
- Alternativen `tr-alt[data-register]`, je mit Register-Chip und Notiz
- Hinweise `tr-note`
- Begriffe als antippbare Paare

**Weitere Regeln:**
- Verlauf `tr-history`: die letzten 5 lokal, ein Tipp füllt die Eingabe wieder.
- **Taste `/`** (`app/hotkeys.ts`, global): kein Eingabefeld fokussiert, keine Zusatztaste, kein anderer Dialog außer dem Begleiter. Dann öffnen, Reiter Übersetzen, Fokus auf `tr-input`. Ist Text auf der Seite markiert (`getSelection`, ≤ 1.500), wird er übernommen, **aber nicht** automatisch gesendet.
- Im Trainer zählt `/` wie jedes Öffnen als Hilfe (E5-05).

### 8.3 Preply-Bildschirm (`PreplyScreen.tsx`, Route `{name:'preply'}`)

**Reiter** (`pp-tab-prep | pp-tab-import | pp-tab-history`). Beim Öffnen:
- Gibt es einen offenen Plan (`done !== true`, jüngster), steht er oben als Karte mit **einem** Primärknopf „Stunde gehalten" (`pp-held`).
- Sonst ist „Vorbereiten" aktiv.

**Vorbereiten** (`PrepForm`):
- Anlass-Chips `pp-ctx`: „Freies Gespräch", „Aktuelle Lektion: {title}" (falls Kurs), „Thema …" (Eingabe ≤ 120), „Nach letztem Import: {title}"
- Dauer `pp-minutes` 25/50/60
- `pp-create` („Plan erstellen", `data-ai`)
- Phasen: Skelett des Plans, „Denkt nach …", ab 45 s Stopp

**Plan** (`PlanView`, `pp-plan[data-id]`):

| Bereich | Kennung | Inhalt |
|---|---|---|
| Ziel | `pp-goal` | Oberflächensprache, englische Fassung darunter antippbar |
| Aufwärmen | `pp-warmup` | Liste |
| Sprechanlässe | `pp-talk` | Liste |
| Modellsätze | `pp-say` | antippbar, 🔊 |
| Fokus: deine Fehler | `pp-watch` | ~~mistake~~ → **fix**, note |
| Nachricht an den Lehrer | `pp-message` | `CopyBox`: Knopf `pp-copy`, danach 2 s Zustand `pp-copied` „Kopiert ✓"; Rückfall nach E5-18 |

- Unten „Stunde gehalten" (`pp-held`).
- Ist `pp.lang ≠ uiLang`, werden `goal_x`/`note` ausgeblendet, mit dem Hinweis „Hinweise nur auf {Sprache}" und „Neu erstellen".

**HeldSheet** (`pp-held-confirm`):
- „Wann?" Heute | Gestern, „Wie lange?" 25 | 50 | 60, dann „Eintragen".
- Danach ist die Karte Zustand `li[data-state=done]` „Gehalten · 27.09. · 50 Min." ohne bedienbares Kind (`pp-held-state`).
- „Stunde ohne Plan eintragen" gibt es als Textknopf im Verlauf.

**Übernehmen** (`ImportPane`/`ImportReview`, `importMachine`):
- `editing`: `pi-raw` (Textarea 16 px, Entwurf lokal), Zähler `pi-count` „8.412 / 12.000", `pi-analyze` („Analysieren", `data-ai`). Leer → gesperrt.
- `analyzing`: Skelett der vier Gruppen, „Denkt nach … das kann bis zu zwei Minuten dauern" (`complex`), ab 90 s „Dauert länger als üblich" und `ai-stop`. Stopp → zurück zu `editing`, der Text bleibt.
- `review` (`pi-review`): Zusammenfassung oben, darunter vier Gruppen:
  - `pi-item[data-group=c|t|w|h][data-state=selected|off|exists|invalid]` mit Kontrollkästchen (44 px).
  - Korrekturen: ~~wrong~~ → **right** · Thema-Chip · Warum (eingeklappt).
  - Übungen: `prompt` → `answer`.
  - Vokabeln: en – de · Ursprungssatz. `exists` erscheint als Zustand „schon in deinen Karten" ohne Kontrollkästchen. `invalid` erscheint als „kein Satz – nicht übernehmbar".
  - Hausaufgaben: nur Liste, keine Übernahme.
  - Fuß klebt unten: `pi-apply` „Übernehmen · {n}" (primär, `n` = gewählt) und `pi-later` „Später". Beim Rückweg bleibt `applied:false`, im Verlauf steht „Offen".
- `applying`: Knopf gesperrt, Fortschritt je Ziel.
- `applied` (`pi-applied`): „{n} übernommen: 3 → Fehler-Wiederholung · 4 → Karten · 2 → Übungen", dazu ggf. „2 nicht übernommen (Übungsspeicher voll)".
- `partial`: Liste der gescheiterten Ziele, `pi-retry-apply` (manuell, idempotent).

**Verlauf** (`pv-list`):
- Alle `preply/*` absteigend nach `t` (bzw. `pp<ms>`/`pi<ms>` aus der Kennung).
- `pv-item[data-kind=plan|import][data-state=done|open|applied|pending]`.
- Antippen öffnet die Ansicht nur zum Lesen: Import mit Hausaufgaben-Häkchen (`pi-hw`), offene Importe mit `review`.

**Keine konkurrierenden Primärknöpfe:** Je Reiter gibt es höchstens einen.

### 8.4 Anbindungen (WP-F)

**Nachschlagen** (`LookupPopover.tsx`):
- `lk-ask` ruft `closeLookup()` und dann `openCompanion({attach: {kind:'word', word: lemma||surface, sentence: req.text, source: req.source}, send: t('askWordAuto', {word})})`.
- Der Knopf erscheint auch, wenn `sense` schon da ist.
- `asked`/`useAsk(wordLookup)` für `lk-ask` entfällt, das automatische Nachschlagen bleibt.

**Trainer** (`ExerciseView.tsx`/`exerciseMachine.ts`):

```ts
useCompanionSee({ area: 'trainer', label: `${t('seeTrainer')} · ${exLabel}`, phase: checked ? 'feedback' : 'question',
  detail: `${taskLine}\n${sentenceWithBlank}`, reveal: checked ? `Solution: ${solution}. Learner: ${given}` : undefined });
```

- Antwortzeit: `ms − lookupOpenMs-Δ − companionOpenMs-Δ`.
- `hintUsed ||= companionOpenedSince(startedAt)`.

**Heute:** Ist `act[heute].preply ≥ 1`, erscheint im Extra-Bereich die Zeile „Preply-Stunde · {min} Min." (Zustand, kein Knopf). Das zählt **nicht** zu „x von y".

**Phase-2–4-Bildschirme:** je eine Zeile `useCompanionSee` mit Label „Grammatik · {Thema}", „Lesen · {Titel}", „Rollenspiel · {Szene}" usw. Detail ist die Aufgabe bzw. ein Textausschnitt ≤ 1.500 Zeichen. In Fragezuständen `phase:'question'` ohne `reveal`.

### 8.5 DOM-Vertrag (verbindlich für E2E)
- **Begleiter:** `open-companion`, `companion` (`role=dialog`), `companion-tab-chat`, `companion-tab-translate`, `seeing[data-area]`, `chat-attach`, `chat-attach-remove`, `chat-log`, `chat-msg[data-role][data-lang][data-state]`, `chat-input`, `chat-send`, `chat-stop`, `chat-retry`, `chat-suggestion`, `chat-new`, `chat-jump`, `chat-unsaved`, `ai-phase[data-ai-phase]`
- **Übersetzer:** `tr-input`, `tr-dir[data-dir]`, `tr-register`, `tr-go`, `tr-result`, `tr-main[lang]`, `tr-alt[data-register]`, `tr-note`, `tr-copy`, `tr-history`
- **Preply:** `[data-screen=preply]`, `pp-tab-*`, `pp-ctx`, `pp-minutes`, `pp-create`, `pp-plan`, `pp-goal`, `pp-warmup`, `pp-talk`, `pp-say`, `pp-watch`, `pp-message`, `pp-copy`, `pp-copied`, `pp-held`, `pp-held-confirm`, `pp-held-state`, `pi-raw`, `pi-count`, `pi-analyze`, `pi-review`, `pi-item`, `pi-apply`, `pi-later`, `pi-applied`, `pi-retry-apply`, `pi-hw`, `pv-list`, `pv-item`
- **Regeln:** Jeder Knopf, der Claude fragt, trägt `data-ai`. Erledigtes ist `[data-state=done]` ohne bedienbares Kind.

---

## 9. Texte (i18n, Auszug, DE | EN)
Neue Teile: `parts/companion.*`, `parts/translate.*`, `parts/preply.*`. Englisch in amerikanischer Schreibweise.

| Schlüssel | DE | EN |
|---|---|---|
| openCompanion | Claude fragen | Ask Claude |
| cmpTitle | Claude | Claude |
| cmpTabChat / cmpTabTranslate | Fragen / Übersetzen | Ask / Translate |
| cmpSeeing | sieht gerade: {label} | currently seeing: {label} |
| cmpAbout | Zu: {word} | About: {word} |
| cmpPlaceholder | Frag etwas zu Englisch … | Ask anything about English … |
| cmpSend / cmpStop | Senden / Stopp | Send / Stop |
| cmpThinking | Denkt nach … | Thinking … |
| cmpNew | Neues Gespräch | New conversation |
| cmpEarlier | Früher | Earlier |
| cmpJump | Neue Antwort ↓ | New reply ↓ |
| cmpForeign | Antwort auf {lang} – anzeigen | Reply in {lang} – show |
| cmpAskAgainLang | Auf {lang} neu fragen | Ask again in {lang} |
| cmpCut | Antwort gekürzt – frag gezielter nach. | Reply was cut short – ask something narrower. |
| cmpInterrupted | unterbrochen | interrupted |
| cmpUnsaved | Dieses Gespräch wird nicht gespeichert. | This conversation isn't being saved. |
| cmpResend | Erneut senden | Send again |
| askWordAuto | Erkläre mir „{word}“ in diesem Satz: Bedeutung, Gebrauch und zwei Beispiele. | Explain "{word}" in this sentence: meaning, usage, and two examples. |
| sgHint | Tipp – ohne Lösung | Hint – no answer |
| sgRule | Erklär mir die Regel | Explain the rule |
| sgWhyWrong | Warum war das falsch? | Why was that wrong? |
| sgMoreExamples | Drei weitere Beispiele | Three more examples |
| sgSimpler | Einfacher erklären | Explain it more simply |
| sgQuizMe | Frag mich ab | Quiz me |
| trFromTo | {from} → {to} | {from} → {to} |
| trRegFormal / Neutral / Casual | Formell / Neutral / Locker | Formal / Neutral / Casual |
| trGo | Übersetzen | Translate |
| trAlternatives | Alternativen | Alternatives |
| copy / copied / copyManual | Kopieren / Kopiert ✓ / Markiert – jetzt kopieren | Copy / Copied ✓ / Selected – copy it now |
| ppTitle | Preply | Preply |
| ppTabPrep / Import / History | Vorbereiten / Übernehmen / Verlauf | Prepare / Import / History |
| ppCreate | Plan erstellen | Create plan |
| ppGoal / ppWarmup / ppTalk / ppSay / ppWatch / ppMessage | Ziel / Aufwärmen / Sprechanlässe / Modellsätze / Fokus: deine Fehler / Nachricht an den Lehrer | Goal / Warm-up / Talking points / Model sentences / Focus: your mistakes / Message to your tutor |
| ppHeld | Stunde gehalten | Lesson done |
| ppHeldState | Gehalten · {date} · {min} Min. | Done · {date} · {min} min |
| ppHeldNoPlan | Stunde ohne Plan eintragen | Log a lesson without a plan |
| ppWhen / ppToday / ppYesterday / ppHowLong | Wann? / Heute / Gestern / Wie lange? | When? / Today / Yesterday / How long? |
| piPaste | Chat, Korrekturen, Hausaufgaben einfügen – gern unsortiert. | Paste chat, corrections, homework – messy is fine. |
| piAnalyze / piLong | Analysieren / Das kann bis zu zwei Minuten dauern. | Analyze / This can take up to two minutes. |
| piToErrors / piToCards / piToExercises | → Fehler-Wiederholung / → Karten / → Übungen | → Mistake review / → Cards / → Exercises |
| piExists / piNoSentence | schon in deinen Karten / kein Satz – nicht übernehmbar | already in your cards / no sentence – can't add |
| piApply / piLater | Übernehmen · {n} / Später | Add · {n} / Later |
| piApplied | {n} übernommen | {n} added |
| piPoolFull | {n} nicht übernommen – Übungsspeicher voll | {n} not added – exercise queue is full |
| piRetryApply | Erneut übernehmen | Try adding again |
| piNothing | Nichts zum Übernehmen gefunden. | Nothing to add was found. |
| tdExtraPreply | Preply-Stunde · {min} Min. | Preply lesson · {min} min |

---

## 10. Tests

### 10.1 Unit (Vitest, `TZ=Europe/Berlin`)

| Datei | Prüft |
|---|---|
| `aiText.test.ts` (A) | `askText`: Streaming-Phasen (`thinking`→`streaming`), `slow` nach `SLOW_AFTER_MS` ohne Abbruch, Stopp → `cancelled` ohne Phase `error`, `refused` ohne Teiltext, `upstream_error` mit Teiltext, **0 Neuversuche bei jedem Code**, Turn-Liste falsch → 0 Aufrufe, Budget > 60.000 → `too_large` ohne Aufruf, `rate_limited` → Pause 60 s und nächster Aufruf `busy` ohne `sample`; `askJson` mit `refresh` → `cache.refresh === true` |
| `prompts.test.ts` Ä (A) | 4 neue Vorlagen: eindeutige Kennung, Kopfzeile, Beispiel besteht das Schema, Sprachprüfung (DE/EN, falsch → Befund), `preply-prep.watch` nur aus Fehlern, `translate` Register-Vielfalt, `preply-import` mc/gap-Regeln, `block()` entfernt `<<<`/`>>>`, größter zulässiger Import < 60.000 B |
| `chatDoc.test.ts` (B) | Altnachrichten ohne `t`/`lang` lesbar; `appendChat` ≤ 40 und ≤ 180.000 B (Umlaute), älteste zuerst weg; kürzt auf 2.000/8.000; `since`; `msgLang` mit Zitaten |
| `turns.test.ts` (B) | beginnt und endet `user`, Einleitung bleibt immer, älteste Verlaufsnachrichten zuerst weg, ≤ 56.000 B, ≤ 20 Nachrichten, keine leeren Inhalte |
| `seeing.test.ts` (B) | `phase:'question'` → Eingabe enthält **nie** `reveal`/Lösung (auch nicht in `detail`); `feedback` enthält sie; Schutzregel nur bei `question` |
| `brief.test.ts` (B) | aus Seed ≤ 2.500 Zeichen, Themen in UI-Sprache, ohne `assess` kein Absturz |
| `markdown.test.ts` (B) | Absätze, Listen, **fett**, *kursiv*, `code`, `>`; unfertige Marker als Text; `<script>` bleibt Text; Links als Text; Präfix-Stabilität: Parsen jedes Präfixes wirft nie |
| `stickToBottom.test.ts` (C) | `nextScroll`: unten → folgen; hochgescrollt → Position gleich, `jump` an; eigenes Senden → folgen |
| `apply.test.ts` (B) | `planApply` auf Seed-`pi`: `no_sentence`, `exists`, Themen gebündelt; zweimal angewendet ändert nichts; Grammatik-Deckel 10 (erledigte zuerst weg); Radar ≤ 400; Pool 88 + 5 → 2 rein, 3 `refused`; unbekanntes Thema → nur Radar; `tasks` bleibt `string[]` |
| `held.test.ts` (B) | `activityPatch`: +1/+min, `lxSeq` verhindert Doppelzählung, kein `days`/`xpDays`/`pflicht`, ungültiges Profil → null; `pp` bereits `done` → kein Profil-Patch |
| `newCard.test.ts` Ä (B) | `src:'preply'\|'translate'`, `origin.kind` neu |
| `schemas.test.ts` Ä (S0) | Altformen (Seed-`pi` mit `tasks` als Strings, `app/chat` ohne `lang`) und Neuformen gültig; kein Feld verschärft |
| `importMachine.test.ts` (E) | Übergänge, Stopp → `editing` mit Text, Teilfehler → `partial` → `RETRY` → `applied` |

### 10.2 E2E (Playwright gegen `dist/index.html`, Laufzeit von außen)

| Datei | Inhalt | Matrix |
|---|---|---|
| `companion.spec.ts` | **C-01** Kopf-Knopf öffnet, `seeing` = „Heute", Esc schließt, Fokus zurück. **C-02** Senden → „Denkt nach …" → Streaming → `data-state=done`, genau 1 Aufruf `companion-chat`, `tier default`, `cache false`, Turn-Liste beginnt/endet `user`; `app/chat` + 2 Nachrichten mit `t`/`lang`. **C-03** Scroll: `?fake=slowsample` + `zzlong`, während des Streamens 300 px hoch → `scrollTop` bleibt ±1 px über 2 s, `chat-jump` sichtbar, Tipp → unten. **C-04** Trainer-Frage offen → Begleiter → Eingabe enthält die Schutzregel und nicht die Lösung (`sampleCalls[].input`), Antwort `[no-solution]`; nach dem Prüfen `reveal` enthalten; Übung danach `hintUsed` (Note ≤ 2 im Log). **C-05** Wort antippen → `lk-ask` → Begleiter mit `chat-attach`, genau 1 Aufruf sofort, Nachricht = `askWordAuto`. **C-06** `zzen` in DE → `data-state=foreign`, eingeklappt; Sprachtest besteht. **C-07** Stopp mitten im Streamen → `stopped`, gespeichert mit `stopped:true`, kein weiterer Aufruf. **C-08** „Neues Gespräch" → `since` gesetzt, nächster Aufruf ohne alte Nachrichten. **C-09** Schließen während des Streamens → Antwort kommt an und steht in `app/chat`. **C-10** Abos: offen +1, zu −1; nie > 10. | 1440 DE dunkel; C-02/03/05 zusätzlich 390 Touch; C-06 EN |
| `translate.spec.ts` | `/` auf Heute öffnet Übersetzer mit Fokus; `/` in einem Eingabefeld tippt ein `/`; „Wir müssen das Budget freigeben" → `tr-main[lang=en]`, 2 Alternativen mit anderem Register, Hinweis in DE; 1 Aufruf `translate`/quick/`gcTime`; zweites Mal gleich → Fakes zählen einen Cache-Aufruf; Wort in `tr-main` antippbar → speichern → `vocab/*` mit `src:'translate'`; `zzsame` → 2 Aufrufe (A6.3). | 1440 DE, 390 EN |
| `preply.spec.ts` | **P-01** Vorbereiten → Plan mit allen Bereichen, `watch` aus Seed-Fehlern, `pp<ms>` angelegt (1 × `set`), Kopieren → `pp-copied` (Zwischenablage erlaubt) bzw. Rückfall bei verweigerter Zwischenablage. **P-02** „Stunde gehalten" → Blatt → Eintragen → `pp.done`, `profile.act[heute].preply = 1`, `minutes +50`; erneutes Laden: Zustand ohne Knopf; Heute zeigt `tdExtraPreply`, Status „x von y" unverändert. **P-03** Import: Text einfügen → Analysieren → `pi<ms>` mit `applied:false` **vor** jeder Übernahme; Vorschau: `exists`/`invalid` nicht wählbar; 1 Wort abwählen → Übernehmen → genau die erwarteten Schreibvorgänge (`vocab` 1, `grammar/prepositions` 1, `app/radar` 1, `app/pool` 1, `pi` 1); zweimal Übernehmen (Doppelklick) → keine Doppel. **P-04** Teilfehler (Adapter lässt `app/pool` einmal scheitern) → `partial` → `pi-retry-apply` → `applied`, keine Doppel. **P-05** Verlauf zeigt Seed-`pp` (done) und Seed-`pi` (applied, `tasks` als Strings). **P-06** `sample` null → keine `data-ai`-Knöpfe, Verlauf und „Stunde gehalten" funktionieren. **P-07** Stopp während `analyzing` → Text bleibt, 0 Schreibvorgänge. | 1440 DE; P-02/03 390 Touch; P-05 EN |
| `ai-errors.spec.ts` Ä | Begleiter: `not_granted` → nach dem ersten Aufruf verschwinden `open-companion` und alle `data-ai`; `rate_limited` → `aiBusy`, Senden 60 s gesperrt, 0 automatische Aufrufe; `upstream_error` mit Teiltext → „unterbrochen" + `chat-retry` | 1440 |
| `screens-phase5.spec.ts` | 390/1440/2560 × dunkel/gedämpft/hell × DE/EN, Zustände: Begleiter leer, Begleiter mit Antwort, Übersetzer-Ergebnis, Preply-Plan, Import-Vorschau, Verlauf. Geprüft: `layoutProblems`, `languageProblems`, kein Querscrollen, kein `undefined`/`NaN`/`{0}`, Bildschirmfotos für den ux-reviewer. Desktop-Breite des Overlays ≥ 640 px (Kap. 15). | voll |
| `a11y-phase5.spec.ts` | axe `wcag2a/aa/21a/21aa` auf allen Zuständen, Touch-Ziele ≥ 44 px, Fokusfalle im Overlay, Esc-Reihenfolge Popover → Overlay, Beschriftung jedes Knopfs | 3 Modi × 390/1440 |
| `data-contract.spec.ts` Ä | erlaubte Pfade und Schlüssel je Pfad (§5.1), nie `delete`, `keys(vorher) ⊆ keys(nachher)`, `daily/*`/`feed/*` gleich dem Seed, `app/chat` ≤ 180 KB nach 60 Nachrichten; Abos ≤ 10 in jedem Zustand | 1440 |
| `language.spec.ts` Ä (Sprachtest über alle Datensätze) | jede Assistenz-Nachricht in `app/chat` hat einen Inhalt passend zu `lang` (sofern eindeutig); `pp.goal_x`/`watch.note` und `pi.summary`/`why` passen zu `doc.lang`; `pi.items.explanation_de`/`_en` in der richtigen Sprache | Node |
| `platform.spec.ts` Ä | keine Anfragen an fremde Hosts auch im Begleiter, `?fake=nosample` stürzt nicht ab, `check-platform` findet keine neuen Marker | 1440 |

### 10.3 Seed und Adapter (G)

**Seed** (`scripts/generate-seed.mjs`, deterministisch, Stichtag 20.09.2026):
- `app/chat` bekommt 2 neue Nachrichten mit `t`/`lang`.
- Neu dazu:
  - `preply/pp…` offen (`done:false`)
  - `preply/pi…` mit `applied:false` in der Neuform (2 Korrekturen, 2 `items`, 3 Wörter)
  - `grammar/prepositions.errors` mit 9 Einträgen (Deckel-Test)
  - `app/pool` mit 88 Einträgen

**Adapter:**
- `sampleScript` erlaubt Fehler je Vorlage (`code`) und Verzögerung.
- `memoryDb.failOnce(path)` für P-04.
- Die Zwischenablage wird über `context.grantPermissions(['clipboard-read','clipboard-write'])` gewährt, und ein zweiter Lauf verweigert sie per Stub.

### 10.4 iPhone-Prüfliste für Emrah (Drei-Satz-Bericht)
1. ✦ oben antippen, eine Frage senden, dann hochscrollen, während die Antwort läuft: Die Ansicht bleibt stehen.
2. Beim Tippen bleibt die Eingabezeile über der Tastatur.
3. In einer Übung ein Wort antippen und „Claude fragen" wählen: Der Begleiter öffnet mit dem Wort.
4. Preply → Vorbereiten → „Kopieren" und in WhatsApp oder Preply einfügen.
5. Einen Lehrer-Chat einfügen → Analysieren → ein Wort abwählen → Übernehmen.

---

## 11. Arbeitspakete (disjunkte Dateien)

**Schritt 0: Vertragsstand** (Lead allein, 1–2 h, ein Commit, `verify` grün, kein Verhalten neu)
1. Bestandsaufnahme D1–D4 (§0). Das Ergebnis kommt als Tabelle an den Planstart.
2. Typen: `ai/types.ts` (TurnInput, TextRequest, TextResult, `AiRequest.refresh`), `prompts/types.ts` (ChatTemplate).
3. `engine/wordTap.ts` (WordTapArea), `domain/srs/newCard.ts` (Unionen), `app/nav.ts` (Route `preply`).
4. `data/schemas.ts` (§5.9), `data/live.ts` (`watchDoc(db, path, cb)`, `watchCollection(db, name, cb)`, je 1 `onSnapshot` mit Prüfung und dem bestehenden Neuabo-Muster).
5. `features/companion/seeing.ts` (§3.4, fertig implementiert).
6. Leere i18n-Teile mit allen Schlüsseln aus §9 (DE/EN).
7. `ui/Sheet.tsx`: `size`-Prop und `headerSlot`, Standard unverändert.
8. Ausweichdateien für D1 als leere Signaturen (falls nötig).

| Paket | Dateien (nur diese) | Liefert an | Braucht |
|---|---|---|---|
| **A** KI-Tor und Vorlagen | `src/ai/gate.ts`, `src/ai/useAskText.ts`, `src/prompts/{common,registry,work,companionChat,translate,preplyPrep,preplyImport}.ts`, `tests/unit/{aiText,prompts}.test.ts` | `askText`, 4 Vorlagen, `block()` | S0 |
| **B** Domäne | `src/domain/companion/*`, `src/domain/text/markdown.ts`, `src/domain/preply/*`, `src/domain/progress/profilePatch.ts`, `tests/unit/{chatDoc,turns,seeing,brief,markdown,apply,held,newCard}.test.ts` | `appendChat`, `buildChatInput`, `redact`, `brief`, `suggest`, `parseMarkdown`, `planApply`, `*Op`, `activityPatch` | S0 |
| **C** Begleiter-Oberfläche | `src/features/companion/{store,CompanionOverlay,ChatPane,ChatMessage,Composer,SeeingBar,Suggestions,useStickToBottom,useKeyboardInset,persistChat}.ts(x)`, `src/engine/Markdown.tsx`, `src/ui/Icon.tsx`, `src/i18n/parts/companion.*`, `tests/unit/stickToBottom.test.ts` | `openCompanion`, `closeCompanion`, `companionOpenMs`, `companionOpenedSince`, `<CompanionOverlay/>` | A, B (gegen Typen ab S0 startbar) |
| **D** Übersetzer | `src/features/companion/translate/*`, `src/app/hotkeys.ts`, `src/i18n/parts/translate.*` | `<TranslatePane/>`, `installGlobalHotkeys()` | A, C (Tab-Slot) |
| **E** Preply | `src/features/preply/*`, `src/i18n/parts/preply.*`, `tests/unit/importMachine.test.ts` | `<PreplyScreen/>` | A, B |
| **F** Anbindungen | `src/features/lookup/LookupPopover.tsx`, `src/features/vocab/{ExerciseView.tsx,exerciseMachine.ts}`, `src/features/today/TodayScreen.tsx` bzw. `src/domain/overview.ts`, Phase-2–4-`*Screen.tsx` (je 1 Zeile) | Kontext und Hilfe-Zählung | C (Store-API aus S0) |
| **G** Testdaten, Adapter, E2E | `scripts/{generate-seed,check-platform}.mjs`, `seed/sample-data.json`, `src/platform/dev/{cannedReplies,fakeSample,install,memoryDb}.ts`, `tests/e2e/{companion,translate,preply,screens-phase5,a11y-phase5}.spec.ts`, Änderungen an `ai-errors`/`data-contract`/`language`/`platform.spec.ts`, `tests/e2e/fixtures.ts` | Suite gegen §8.5 | S0 (DOM-Vertrag) |
| **INT** (Lead) | `src/app/App.tsx` (Kopf-Knopf, Overlay, Route, `installGlobalHotkeys`, Trainerleiste), Modul-Einstieg (D2), Diagnose-Zeilen in `features/settings/SettingsSheet.tsx`, `docs/datenmodell.md`, CLAUDE.md A4 | grüner `verify` | alle |

**Reihenfolge:**
1. S0.
2. A, B und G (Seed/Adapter) parallel.
3. C, D und E parallel, sobald A/B-Signaturen stehen (sie bauen gegen S0-Typen).
4. F.
5. G bringt die E2E-Suite zusammen mit INT auf Grün.

Danach je eine Prüfrunde (learning-scientist für die 4 Vorlagen und §7, data-guard §5, ux-reviewer §8, platform-guard), eine gezielte Nachprüfung, dann entscheidet Emrah (A2). Zuerst auf das Test-Artefakt, dann auf die Produktivadresse (A7).

---

## 12. Risiken und Gegenmaßnahmen

| # | Risiko | Gegenmaßnahme |
|---|---|---|
| R1 | `app/chat` über 256 KiB (lange Antworten, Umlaute) | `appendChat` begrenzt auf 180.000 B und kürzt je Nachricht; Test mit 60 langen Nachrichten |
| R2 | Schemawidrige Antwort liegt im Zwischenspeicher, „Erneut versuchen" gibt sie bis zu 24 h wieder | E5-21 `refresh` bei Nutzer-Neuversuch; Import und Plan mit `cache:false`; Unit-Test |
| R3 | Begleiter verrät die Lösung | Schwärzen in `seeing.ts` (rein, getestet) plus Schutzregel im Prompt plus E2E C-04; Öffnen zählt als Hilfe |
| R4 | Scroll springt am iPhone (Tastatur, `overflow-anchor`) | `overflow-anchor:none`, `visualViewport`-Inset, reine Scroll-Logik; Safari prüft Emrah (§10.4, A7.4) |
| R5 | Zwischenablage im iframe gesperrt | Rückfall: markieren und Hinweis (E5-18); E2E beide Wege |
| R6 | `complex`-Import dauert bis zu 2 Minuten, Nutzer bricht ab | Hinweis vorab, `slow` ab 90 s, Stopp behält den Text, Entwurf lokal, Speichern erst bei Erfolg |
| R7 | KI erfindet Korrekturen oder übernimmt den Lehrer-Text falsch | Prompt „only from the text", Vorschau mit Einzelauswahl, nichts vor der Bestätigung; `watch` nur aus echten Fehlern (Schemaprüfung) |
| R8 | Prompt-Einschleusung über den eingefügten Text | keine `tools`, Ausgabe per zod, Schreiben erst nach Bestätigung, `block()` entfernt Begrenzer |
| R9 | Mischsprache im Chat | `lang` je Nachricht, Einklappen, Knopf „neu fragen"; Sprachtest über alle Datensätze |
| R10 | Deckel `grammar.errors` 10 verdrängt offene Fehler | erledigte zuerst; Anzahl „ersetzt" in `res.replaced` und in der Meldung |
| R11 | Pool voll | kein Verdrängen, klare Meldung (E5-14) |
| R12 | Doppelte Zählung „Stunde gehalten" (zwei Geräte, Neuversuch) | Profil nur nach `pp`-Transform `updated`; `lxSeq`; kein Rückgängig |
| R13 | Phase-2–4-Artefakte fehlen oder heißen anders | Bestandsaufnahme in Schritt 0, Ausweichlösungen D1/D2, Schnittstelle `useCompanionSee` einzeilig |
| R14 | Rückweg zur alten App bis Phase 7 | Altfelder und -formen bleiben (`tasks` Strings, `why`, `done/doneT`, `applied/appliedT`); nur neue Felder |
| R15 | Kontingent durch Chat-Flut | Senden gesperrt während einer Antwort, Warteschlange ≤ 2, lokale Grenze 20/min, `rate_limited` → 60 s Pause, nie automatisch |
| R16 | Verschachtelte Dialoge (Popover über Overlay), Fokus und `inert` | feste z-Reihenfolge, Esc-Reihenfolge, axe- und Tastatur-Test |
| R17 | Abo-Grenze 64 | Abos nur bei offenem Begleiter bzw. Bildschirm; Test ≤ 10 |

---

## 13. Prüfliste gegen Kapitel 3

| Punkt | Urteil | Fundstelle |
|---|---|---|
| Eine `dist/index.html` ≤ 16 MB, alles eingebettet | ✅ | keine neue Abhängigkeit, eigener Markdown-Parser (E5-08); `check-platform` (§10.2 platform, §6.5 Marker) |
| Kein Server, keine Schlüssel, kein `fetch` fremd | ✅ | KI nur über `sample`; keine Links als `<a>` im Chat (E5-08); Test `platform.spec` |
| Jeder Zugriff auf db/sample/downloads über `/src/platform`, kein `claude.use` außerhalb | ✅ | `askText` nutzt `getSample()` (§4); Schreiben über `getWriter` (§5.1); ESLint-Regel besteht |
| `claude.use` null → sofort rendern, später zuschalten, Hinweis | ✅ | E5-20; Begleiter-Knopf nur bei `useAiAvailable`; Preply ohne KI bedienbar (P-06) |
| `sample` gedächtnislos, ≤ 64 KiB | ✅ | E5-02, `buildChatInput` ≤ 56.000 B, Tor prüft ≤ 60.000 B (§4, §6.1, §6.4) |
| `rate_limited` zurückhalten; `not_granted` ausblenden; kein Timeout-Timer; Wiederholung nur nach A6.3 | ✅ | §4 (keine Wiederholung bei Text, `slow` ohne Abbruch), E5-03, E5-21, `ai-errors.spec` |
| `onSnapshot` einmal je Abfrage in `useEffect`, ≤ 64 | ✅ | E5-19, `watchDoc`/`watchCollection` (S0), C-10, `data-contract` ≤ 10 |
| Schreiben nur bei echter Änderung, eins je Dokument, nie aus Render/Snapshot/Timer, `update` nur auf Existierendes | ✅ | §5.1 nur auf Handlungen; `transform` mit `null` bei „nichts zu tun", Warteschlange je Pfad; `set` nur bei fehlendem Dokument |
| 256 KiB je Dokument, 5.000 gesamt | ✅ | §5.2 (180 KB), §5.8, Diagnose-Zeilen (INT) |
| Lernfortschritt nur in db; `localStorage` nur Bequemlichkeit, try/catch | ✅ | §5.7 über `local.*` |
| Entwicklungs-Adapter per Build-Flag ausgeschlossen, Test | ✅ | §6.5 neue Marker in `check-platform.mjs` |
| Keine leeren `catch`; Fehler ins Diagnose-Protokoll | ✅ | Tor/Writer protokollieren; jede neue Aktion `logError`/`logWarn` (Paket-Abnahme per ESLint) |
| Kein Prompt-Text in Oberflächen-Dateien; Vorlagen versioniert mit zod | ✅ | §6 (`src/prompts/*`); Auto-Frage `askWordAuto` ist Nutzertext aus i18n, kein Prompt; Test U-PROMPT-06 |
| Optimistisch mit Rückrollen; Skelette statt Spinner | ✅ | Chat-Nachricht erscheint sofort, bei Fehler Zustand `error` und „Erneut senden"; Plan/Import mit Skeletten (§8.3); „Denkt nach …" statt Kreisel |
| Stack Kap. 3.2 | ✅ | XState für den Import (§3.3), zustand-Stores, Framer Motion (Sheet), zod; keine neuen Bibliotheken |

**Widersprüche Auftrag ↔ Vertrag (es gilt der Vertrag):**
- Kap. 10 „Timeout" ↔ `sample.d.ts` („no timeout option … you should not build one"): A6.2, nur Hinweis `slow`.
- Kap. 10 „einmal neu angefragt" ↔ „NEVER retry from a loop": A6.3, nur JSON mit Schemafehler. Beim Chat (Text) gibt es **gar keinen** automatischen Neuversuch (E5-03).
- Kap. 6.12 „kennt den Bildschirm" ↔ keine `system`-Rolle im Vertrag: Kontext als führender `user`-Schritt (E5-02).
- Kap. 6.10 „Kopier-Knopf": Weder `contract/` noch `permissions.d.ts` sichern die Zwischenablage zu. Deshalb der Rückfall E5-18.
- Kap. 3.1 nennt `{text, truncated}`: Der Vertrag liefert zusätzlich `modelTierApplied`, `sample.json` liefert ihn nicht. `askText` gibt ihn weiter.

**Wichtige Dateien:**
- `/home/user/lingo-engine-x/src/ai/gate.ts`
- `/home/user/lingo-engine-x/src/ai/types.ts`
- `/home/user/lingo-engine-x/src/prompts/types.ts`
- `/home/user/lingo-engine-x/src/features/lookup/LookupPopover.tsx`
- `/home/user/lingo-engine-x/src/engine/wordTap.ts`
- `/home/user/lingo-engine-x/src/domain/srs/newCard.ts`
- `/home/user/lingo-engine-x/src/domain/progress/profilePatch.ts`
- `/home/user/lingo-engine-x/src/data/schemas.ts`
- `/home/user/lingo-engine-x/src/data/live.ts`
- `/home/user/lingo-engine-x/src/data/writer.ts`
- `/home/user/lingo-engine-x/src/ui/Sheet.tsx`
- `/home/user/lingo-engine-x/src/app/App.tsx`
- `/home/user/lingo-engine-x/src/app/nav.ts`
- `/home/user/lingo-engine-x/src/platform/dev/fakeSample.ts`
- `/home/user/lingo-engine-x/seed/sample-data.json`
- `/home/user/lingo-engine-x/docs/altapp-analyse.md`

**Hinweis an den Lead (außerhalb von Phase 5, aber dringend):** E5-21 behebt einen möglichen Fehler im bestehenden KI-Tor. Bei `word-lookup@1` und `card-examples@1` (`cache: {gcTime: 24 h}`) wird eine schemawidrige, aber für `sample` erfolgreiche Antwort samt Neuversuch bis zu 24 h wiedergegeben. „Erneut versuchen" kann dann nie gelingen. Es empfiehlt sich, das schon mit dem Rest von Phase 1 zu übernehmen.
