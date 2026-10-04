# Neubau der Oberfläche: technische Architektur des App-Rahmens

**Stand:** 27.09.2026. **Rolle:** Architektur (nur Entwurf, noch kein Code).
**Auftrag:** Emrah will die komplette App in 12 Stunden neu: „aufgeräumt, aber featurestark“. Dazu gehören eine klare User Journey, ein Anki-Modus, keine Abstürze, kein Neustart mitten in der Übung und nichts, was ruckelt.
**Grundlage:**
- Optik: `docs/prototyp/v1.html`.
- Journeys, Blätter und Budget: `docs/konzept/ux-architektur.md`.
- **Überholt:** Die Streichliste in `docs/produktkonzept.md` §5 gilt nicht mehr. Alle Funktionen bleiben, es kommen welche dazu.

**Was bleibt:** `src/data`, `src/domain`, `src/ai`, `src/prompts` und `src/platform` bleiben. Änderungen dort sind nur **additiv** erlaubt und nur in dem Paket, das in §5 dafür genannt ist.
**Was neu wird:** App-Rahmen, Navigation, Hubs und Seiten.
**Was wiederverwendet wird:** die Übungskomponenten in `src/features/*` und `src/engine/*`.

---

## 1. Ist-Stand in 15 Zeilen

1. **Routing:**
   - `src/app/nav.ts` ist ein Zustand-Store ohne History-API (wegen des iframes).
   - `Route` ist eine **geschlossene Union mit 31 Namen**, `stack` hält bis zu 20 Herkunftsbildschirme.
   - `go()` leert den Stapel bei jeder Reiter-Wurzel. Übung → Übung ersetzt den Eintrag, `back()` führt zur Herkunft.
2. **Bildschirmwahl:**
   - `src/app/App.tsx` (321 Zeilen) wählt per `screen === '…' && <X/>` aus **27 fest importierten Bildschirmen**.
   - `key={screen}` baut bei jedem Wechsel den ganzen Bildschirm neu auf. Nichts bleibt im Speicher, der Bildlauf wird nur für 8 Listen gemerkt.
3. **Harte Kodierung:** Reiter (`TAB_ROOTS`), Reiter-Zugehörigkeit (`tabOf`), Übungs-Menge (`EXERCISES`) und gemerkte Listen (`SCROLL_KEEP`) sind fest in `nav.ts` verdrahtet. Ein neuer Bereich muss `nav.ts`, `App.tsx`, die i18n-Wurzeln und einen Hub zugleich ändern.
4. **Zustand:** Es gibt je Übung einen eigenen Zustand-Store (`vocab/session.ts`, `grammar/session.ts`, `drills/session.ts`, `course/lessonRun.ts`, XState-Maschinen in read/listen/write/speak).
   - Die Sitzungen leben **nur im Speicher**. Nur das Rollenspiel (`speak/resume.ts`) und Entwürfe (`input/draft.ts`) überleben ein Neuladen.
   - Ohne aktive Sitzung springt z. B. der Trainer per Effekt sofort zurück (`if (!active) back()`).
5. **Blätter:** Jede Art hat ihren eigenen Schalter:
   - Einstellungen: `app/sheets.ts`
   - Begleiter/Übersetzer: `companion/store.open`
   - Nachschlagen: `LookupLayer`
   - Wortblatt und Hinzufügen: lokaler Zustand in `VocabScreen`
   - `inert` wird in `App.tsx` von Hand aus zwei Flags zusammengesetzt.
6. **Module:** Nur Lesen/Hören/Schreiben/Entdecken sind als Daten registriert (`app/modules.ts`). Alles andere steht als Zeile in `LearnHub`, `SpeakHub` und `TodayScreen`.
7. **Verschachtelung:** „Üben“ (`LearnHub`) sammelt elf Ziele, „Sprechen“ hat einen Umschalter mit drei Bereichen und darunter „Training“. Einstellungen hängen am Reiter „Stand“, der Wortschatz ist eine Zeile unter „Üben“. Ein Anki-Ort fehlt ganz.
8. **Kopf:** Es gibt keinen globalen Kopf.
   - Jede Seite rendert selbst `TabTitle`/`ScreenHeader` mit `TitleActions` (Übersetzen, Claude, Zahnrad).
   - Jede Übung rendert selbst `ExerciseTop` → `ui/ExerciseBar`. Das ist die **einzige** gemeinsame Engstelle aller elf Übungsbildschirme.
9. **Stabilität:**
   - Es gibt **keine Fehlergrenze**. Ein Renderfehler irgendwo ergibt einen weißen Bildschirm.
   - Shared-Element-Flüge (`layoutId`) laufen in Listen, z. B. Wortliste, Entdecken und TilePicker.
10. **Tests:**
    - Die E2E-Tests steuern über `data-screen="<route>"`, `tab-<id>`, `learn-hub`/`hub-*`, `speak-seg-*` und die Helfer `openOverview`, `openSettings` und `openSpeak` in `tests/e2e/fixtures.ts`.
    - 35 von 43 Specs nutzen diese Navigations-Stellen direkt. Über die Helfer-Dateien (`learnHelpers`, `trainerHelpers`, `inputHelpers`, `progressHelpers`) hängen fast alle daran.

---

## 2. Neuer Rahmen

### 2.1 Leitentscheidungen
1. **`nav.ts` bleibt der Einstieg und seine API bleibt gleich.** Die 54 importierenden Dateien bleiben unverändert: `useNav`, `go`, `back`, `leaveBack`, `Route`, `isExercise`, `tabOf` und `savedScroll`. Innen arbeitet `nav.ts` mit Reiter-Stapeln und einer Übungsebene.
2. **Bereiche melden sich selbst an.** Je Bereich gibt es genau eine Datei `src/areas/<bereich>.tsx` mit Routen, Bildschirmen, Hub-Abschnitten, Einstiegen, Blättern, Einstellungs-Abschnitten und Fortsetz-Verträgen. Kein Paket bearbeitet eine fremde Datei.
3. **Reiter sind Daten.** Die Reiter stehen in `src/app/shell/tabs.ts`, Hub-Inhalte hängen an **Plätzen**, nicht an Reitern. Ob es vier oder fünf Reiter gibt, entscheidet eine Zeile.
4. **Drei Ebenen:**
   - Reiter-Seiten mit Kopf und Reiterleiste
   - Übungsebene, also der Player (Vollbild, eine Leiste)
   - Blätter (von unten)
5. **Jede Route ist JSON.** Damit sind Deep-Links, Fortsetzen und Tests ein und derselbe Mechanismus.
6. **Stabilität ist Rahmenpflicht.** Fehlergrenzen, Fortsetzen und das Leistungsbudget liegen im Rahmen, nicht in jeder Übung neu.

### 2.2 Dateien des Rahmens (alle gehören WP0)

```
src/main.tsx                 createRoot(..., { onCaughtError, onUncaughtError }) → logError
src/app/App.tsx              schlank: useBoot() + <Shell/> (Boot-Logik nach boot.ts)
src/app/boot.ts              bisheriges useBoot/useEnsureDay unverändert verschoben
src/app/nav.ts               Router-Store (API-kompatibel, s. 2.3)
src/app/router/types.ts      interface RouteParams {} + Route/RouteName (Deklarations-Zusammenführung)
src/app/router/deeplink.ts   routeToString/parseRoute (reine Funktionen, zod je Bildschirm)
src/app/registry.ts          defineArea, screenOf, sectionsFor, entriesFor, sheetOf, resumables
src/app/resume.ts            Fortsetz-Speicher (lx:resume:*), Zeitgeber, pagehide-Flush
src/app/sheets.ts            useSheets/openSheet/closeSheet (+ Altschnittstelle openSettings)
src/app/shell/tabs.ts        TABS (Daten) + Platz → Reiter
src/app/shell/Shell.tsx      Aufbau: TopBar · Ebenen · TabBar · SheetHost · Toaster
src/app/shell/TopBar.tsx     Profil+Serie links bzw. „‹ Herkunft“; Übersetzen + Claude rechts
src/app/shell/TabBar.tsx     aus TABS; Abzeichen je Reiter aus dem Register
src/app/shell/Layers.tsx     Reiter-Wurzeln in <Activity>, Seitenstapel, Übungsebene
src/app/shell/Player.tsx     Übungsebene: Fehlergrenze, Überspringen, Fortsetzen, ensure()
src/app/shell/Boundary.tsx   ScreenBoundary, StepBoundary, CrashProbe
src/app/shell/Hub.tsx        <HubSections places=…/>, <EntryList place=… group=…/>
src/app/shell/ResumeRow.tsx  „Weiter, wo du warst“ (Hub-Abschnitt je Herkunftsplatz)
src/areas/index.ts           AREAS = [system, heute, lernen, wortschatz, lesen, sprechen, profil]
src/areas/*.tsx              je Bereich eine Datei (WP0 legt alle an, s. §5)
src/i18n/parts/nb*.{de,en}.ts  je Bereich ein leerer Teil, in de.ts/en.ts schon eingebunden
```

Zentral geändert, weil **alle** Übungen und Seiten daran hängen:
- `ui/ExerciseBar.tsx` und `features/learn/ui.tsx` (`ExerciseTop`, `ScreenHeader`) lesen den Player-Kontext.
- `features/system/Chrome.tsx` (`TabTitle`, `TitleActions`): Titel ohne Symbole, denn die Symbole sitzen jetzt im Kopf.
- `features/settings/SettingsSheet.tsx` rendert zusätzlich die registrierten Einstellungs-Abschnitte.

### 2.3 Router: Reiter-Stapel, Übungsebene, Herkunft

```ts
type NavState = {
  tab: TabId;                              // aktiver Reiter
  stacks: Record<TabId, Route[]>;          // je Reiter: [Wurzel, Seite, Seite …]
  overlay: { route: Route; origin: TabId } | null;   // Übungsebene (Player)
  route: Route;                            // abgeleitet: overlay?.route ?? top(stacks[tab])  (alt-kompatibel)
  stack: readonly Route[];                 // abgeleitet: Herkunftskette (alt-kompatibel, SummaryActions)
  go(r: Route): void; back(): void; replace(r: Route): void; switchTab(t: TabId): void;
};
```

| Ziel von `go(r)` | Wirkung |
|---|---|
| Reiter-Wurzel (`kind:'tab'`) | Wechselt den Reiter und ersetzt die Wurzelparameter, z. B. `speak.seg`. Ist der Reiter schon aktiv, geht es zurück auf die Wurzel. |
| Seite (`kind:'page'`) | Legt die Seite **auf den Stapel des aktiven Reiters**. Die Herkunft bleibt damit immer der Ort, von dem man kam, auch bei Zielen „fremder“ Bereiche. Ist `r` gleich dem Eintrag darunter, wirkt es wie `back()`. |
| Übung (`kind:'exercise'`) | Öffnet `overlay` mit `origin = tab`. Übung → Übung **ersetzt** den Eintrag, denn eine beendete Übung ist nie ein Rückweg. |

- **`back()`:** Eine offene Übungsebene schließt, die Herkunft steht unverändert darunter (Bildlauf und Zustand bleiben). Sonst wird der Stapel des Reiters um eine Seite kürzer, auf der Wurzel passiert nichts.
- **`leaveBack()`** bleibt wie heute.
- **Zurück-Beschriftung:** Seiten zeigen im Kopf „‹ Titel der Herkunft“ (`ScreenDef.title`).
- **Deep-Links zu jeder Übung:**
  - `routeToString({name:'trainer', round:'extra', mode:'flip', deck:'job'})` ergibt `trainer?round=extra&mode=flip&deck=job`. `parseRoute` prüft mit dem zod-Schema `ScreenDef.params`.
  - Verwendet wird das für:
    - das Fortsetzen (§3.2),
    - `progress/actionRoute.ts`,
    - Vorschläge von Claude,
    - Tests: `#go=<route>` wird **einmal beim Start gelesen, nie geschrieben**, deshalb gibt es keinen History-Eintrag im iframe.
- **Übungen ohne Sitzung:** Braucht eine Übung eine im Klick gebaute Sitzung (Trainer, Grammatik, Diktat …), meldet sie `ScreenDef.ensure(route)` an.
  - Der Player ruft `ensure` vor dem ersten Zeichnen auf: Sitzung aktiv? Sonst aus dem Fortsetz-Speicher herstellen, sonst neu starten.
  - Gibt `ensure` `false` zurück, folgt ein ruhiger Hinweis und die Rückkehr zur Herkunft, nie ein Aufblitzen.
  - Der heutige Effekt `if (!active) back()` entfällt dadurch.
- **iPhone-Tastatur:** Sitzungen werden weiter **synchron im Klick** gebaut (`startSession` + `api.focusNow()` + `go`). `go` bleibt synchron.

### 2.4 Reiterleiste als Daten

```ts
// src/app/shell/tabs.ts – einzige Stelle, an der Reiter festgelegt werden
export const TABS: TabDef[] = [
  { id: 'today', label: 'nbShTabToday', icon: 'sun',    root: { name: 'today' },   places: ['today', 'learn'], badge: 'openDuties' },
  { id: 'vocab', label: 'nbShTabVocab', icon: 'cards',  root: { name: 'vocab' },   places: ['vocab'] },
  { id: 'read',  label: 'nbShTabRead',  icon: 'book',   root: { name: 'library' }, places: ['read'] },
  { id: 'speak', label: 'nbShTabSpeak', icon: 'chat',   root: { name: 'speak' },   places: ['speak', 'write'] },
  // Fünfter Reiter „Üben“ = diese Zeile einkommentieren und 'learn' oben bei „today“ streichen:
  // { id: 'learn', label: 'nbShTabLearn', icon: 'layers', root: { name: 'learn' }, places: ['learn'] },
];
```

- **Plätze:** `today`, `learn`, `vocab`, `read`, `speak`, `write` und `profile`. Bereiche hängen ihre Hub-Abschnitte und Einstiege an Plätze. Die Reiter-Wurzel rendert eigene Inhalte und dazu `<HubSections places={placesOf(tab)}/>`.
  - **Vier Reiter:** Kurs und Grammatik (Platz `learn`) stehen unter der Tageskarte auf Heute.
  - **Fünf Reiter:** Kurs und Grammatik stehen auf „Üben“.
- **Test-IDs:** Sie bleiben `tab-<id>`. Tab-IDs dürfen nicht mit den inneren Reitern von „Dein Stand“ kollidieren (`judge`, `errors`, `path`, `history`).
- **Tippen auf den aktiven Reiter** führt zur Wurzel und nach oben.

### 2.5 Kopf (wie Prototyp v1)
- **Reiter-Wurzel:**
  - Links steht der Profil-Knopf (Initiale + „Serie 12“ aus `domain/streak.computeStreak`), er öffnet das Blatt `profile`.
  - Rechts stehen **Übersetzen** und **Claude**. Sie öffnen `openCompanion({tab})` und sind ohne KI unsichtbar wie heute.
  - Darunter steht der große Titel, gerendert von der Seite selbst über `TabTitle`, jetzt ohne Symbole.
- **Seite:** Links steht „‹ Herkunft“, rechts wieder Übersetzen und Claude.
- **Übung:** Es gibt keinen Kopf, nur die Übungsleiste: ✕ · Balken „12 / 40“ · Übersetzen · Claude. Das Zahnrad wandert ins Profil-Blatt.
- **System-Bildschirme** (Laden, keine Datenbank, Umstellung): Rechts oben stehen weiter Einstellungen mit Diagnose und Sicherung (`system-actions`).

### 2.6 Globale Blätter

```ts
type SheetId = 'claude' | 'profile' | 'settings' | 'word' | 'add' | `x:${string}`;
openSheet(id, params?)   // legt auf einen Stapel (max. 2: z. B. profile → settings)
closeSheet()             // oberstes schließen; Esc/Wischen/Scrim wie ui/Sheet
```

| Blatt | Inhalt | Besitzer |
|---|---|---|
| `claude` | Umschalter **Übersetzen · Fragen**. Jedes englische Wort ist antippbar, dazu „+ Wortschatz“ (über `vocab/list/actions.addWord` bzw. `lookup/store.saveLookupCard`). Der Kontext ist die aktuelle Karte oder der aktuelle Satz (`companion/seeing.ts`). | P6. Heute ist es `CompanionLayer`, der Host umhüllt es. |
| `profile` | Serie, Urteil in einem Satz, Wochenbericht, Tests, „Ganzer Stand ›“ (Seite `overview`), „Einstellungen ›“ und Links anderer Bereiche (Platz `profile`) | P6 |
| `settings` | Das bisherige `SettingsSheet` plus registrierte Abschnitte (z. B. „Wiederholen: Standard-Modus“ von P3) | P6, WP0 hängt die Abschnitte ein |
| `word` | Das bisherige `WordSheet` für jedes Wort, von überall (Popover „Mehr ›“) | P3 |
| `add` | Das bisherige `AddWordSheet` (Wortschatz „+“, Claude-Blatt) | P3 |

- **Hintergrund:** `SheetHost` setzt ihn `inert`, sobald irgendein Blatt offen ist. Das gilt für den Blatt-Stapel und übergangsweise auch für `companion.open`.
- **Fokus:** Wie heute kehrt der Fokus zum auslösenden Element zurück.
- **Wort-Popover:** `features/lookup/LookupPopover` bleibt eine eigene, leichte Ebene. Das volle Blatt ist `word`.

### 2.7 Übungs-Player
- **Übungsebene:** Jede Route mit `kind:'exercise'` läuft in `<Player>`. Darunter bleibt der Herkunftsreiter in `<Activity mode="hidden">` erhalten, die Rückkehr kostet deshalb 0 ms und der Bildlauf bleibt.
- **Leiste:** Die Übungsleiste bleibt `ExerciseTop` → `ExerciseBar`. Neu kommt der Player-Kontext hinzu:
  - Das Wort unter dem Balken zeigt „Tageseinheit · Abschnitt 2 von 4“, wenn die Übung aus der Tageskarte kommt (P1 liefert es über `registry.playerNote`), sonst „Pflicht“ bzw. „Extra“ wie heute.
  - ✕ fragt nie nach. Die Sitzung ist gesichert (§3.2), ein kurzer Toast „Gespeichert. Du kannst jederzeit weitermachen.“ bestätigt das.
- **Tageseinheit:**
  - Sie läuft als Kette im Player: Die Zusammenfassung jeder Pflichtübung bietet „Weiter: nächster Abschnitt“. Das ist das heutige `SummaryActions` → `startDuty`, als Übung → Übung ersetzt es den Eintrag.
  - Dazwischen steht eine Zwischenkarte (P1), am Ende der Fertig-Bildschirm. ✕ führt immer zur Herkunft (Heute).
- **Überspringen:** Eine Übung meldet mit `usePlayerSkip(fn)` an, wie sie **ohne Bewertung** zur nächsten Aufgabe geht. Das nutzt die Fehlergrenze (§3.1).

### 2.8 Bereichs-Registrierung (eine Datei je Bereich)

```ts
// src/areas/wortschatz.tsx – Besitz: Paket P3
import { defineArea } from '../app/registry';
declare module '../app/router/types' {
  interface RouteParams {
    vocab: {};                                           // Reiter-Wurzel
    vocabList: { filter?: string };
    deck: { id: string };
    trainer: { round: 'pflicht' | 'extra'; mode?: 'type' | 'flip'; deck?: string };
  }
}
export const wortschatz = defineArea({
  id: 'wortschatz',
  screens: {
    vocab:     { kind: 'tab',      component: VocabHub,      title: 'nbWsTitle', keepScroll: true },
    vocabList: { kind: 'page',     component: VocabScreen,   title: 'nbWsAll',   keepScroll: true },
    deck:      { kind: 'page',     component: DeckScreen,    params: z.object({ id: z.string() }) },
    trainer:   { kind: 'exercise', component: TrainerScreen, ensure: ensureTrainer,
                 params: z.object({ round: z.enum(['pflicht','extra']), mode: z.enum(['type','flip']).optional(), deck: z.string().optional() }) },
  },
  sections: [{ id: 'ws-due', place: 'vocab', order: 10, component: DueCard }],
  entries:  [{ id: 'hub-vocab', place: 'learn', group: 'words', label: 'lhVocab', icon: 'cards', route: { name: 'vocab' } }],
  sheets:   [{ id: 'word', component: WordSheetHost }, { id: 'add', component: AddWordSheet }],
  settings: [{ id: 'ws-review', order: 20, component: ReviewModeSection }],
  resumables: [trainerResume],                           // §3.2
  badge: { tab: 'vocab', use: useDueCount },             // optional
  boot: () => installFlushOnHide(),                      // einmalige Installation (heute in App.tsx)
});
```

- **Routen-Typen** entstehen per Deklarations-Zusammenführung, es gibt deshalb **keine gemeinsame Routen-Datei**. `Route` bleibt eine Union mit Namens-Diskriminator, `go({name:'lesson', id})` bleibt typgeprüft.
- **Einstiege (`entries`)** sind Zeilen mit `route` oder mit `start(api)` für den synchronen Start samt Tastatur. `testId` ist gleich `id`: Die heutigen IDs `hub-course`, `hub-grammar`, `hub-vocab`, `hub-drill-*` und `training-*` **bleiben**. So kann jeder Bereich Zeilen in fremde Hubs legen, z. B. P4 „Schreiben“ auf den Platz `write` unter Sprechen.
- **i18n:**
  - WP0 legt die Teile `nbSh`, `nbHeute`, `nbLernen`, `nbWs`, `nbLesen`, `nbSprechen` und `nbProfil` (`*.de.ts`/`*.en.ts`) leer an und bindet sie in `de.ts` und `en.ts` ein.
  - Pakete tragen **nur** Schlüssel mit ihrem Präfix in ihren eigenen Teil ein.
  - Ein neuer Unit-Test (`i18nParts.test.ts`, WP0) verbietet doppelte Schlüssel zwischen Teilen, denn Spreads überschreiben still.
- **`data-screen`** trägt nur die sichtbare Ebene. Verborgene `<Activity>`-Ebenen tragen `data-screen-kept`, sonst würde der Test-Helfer `screen()` im Strict Mode zwei Treffer finden.

---

## 3. Stabilität

### 3.1 Fehlergrenzen (drei Ebenen)
1. **Wurzel** (`main.tsx`): `createRoot(root, { onCaughtError, onUncaughtError, onRecoverableError })` → `logError('react', …)`. Dazu kommt eine letzte Grenze um `<Shell>` mit „Neu laden“ und „Diagnose / Sicherung“.
2. **Seite/Übung** (`ScreenBoundary` im Outlet und im Player, `key` = Route als Text):
   - **Seite:** „Hier ist etwas schiefgelaufen.“ mit [Seite neu aufbauen] und [Zu Heute].
   - **Übung:** „Dein Stand ist gespeichert.“ mit [Diese Aufgabe überspringen]. Das ruft `usePlayerSkip`, der Boundary-`key` zählt hoch. Ohne angemeldetes Überspringen gibt es [Übung beenden], dann zurück zur Herkunft mit behaltenem Fortsetzstand.
3. **Schritt** (`StepBoundary resetKey={step}`): Die Pakete legen sie in ihren Übungen um die aktuelle Aufgabe, z. B. im Trainer um `ExerciseView`, `IntroCard` und `RepairItem`. Ein Fehler in einer Karte kostet dann nur diese Karte.
- **Protokoll:** Jeder gefangene Fehler geht an `logError('ui:<route>', err, componentStack)` und ist in der Diagnose sichtbar.
- **Grenzen der Fehlergrenzen:** Asynchrone Fehler fangen sie nicht, die laufen wie heute über `initDiagnostics`.
- **Testbarkeit ohne Test-Code im Build:** `CrashProbe` in jeder `ScreenBoundary` wirft genau einmal, wenn `localStorage['lx:crash-once'] === <routeName>`, und löscht den Schlüssel. E2E setzt ihn über `boot({ localStorage })`. Ein Adapter oder Hook im Build ist nicht nötig.

### 3.2 Fortsetzen nach Neuladen

```ts
type Resumable<S> = {
  id: string;                  // 'trainer', 'grammarSession', 'lesson', 'roleplay', 'read' …
  version: number;             // Schema der Momentaufnahme; anders → verwerfen
  origin: Place;               // wo die Zeile „Weiter, wo du warst“ erscheint
  snapshot(): S | null;        // reiner Lesezugriff auf den Sitzungs-Store (JSON, ≤ 50 KB)
  subscribe(cb: () => void): () => void;   // meist useX.subscribe
  restore(s: S): boolean;      // SYNCHRON (Klick-Handler, iPhone-Tastatur); schreibt nie in db
  route(s: S): Route;          // Ziel beim Fortsetzen
  label(s: S, t: T): string;   // „Stapel ‚Beruf‘ · Karte 23 von 40“
};
```

- **Speicher:** `app/resume.ts` schreibt über `platform/storage.local`:
  - Schlüssel `lx:resume:<id>` mit Hülle `{v, id, day, savedAt, tabId, route, data}`,
  - 300 ms nach jeder Änderung und sofort bei `visibilitychange:hidden`/`pagehide`.
  - Das ist reine Bequemlichkeit (Kap. 3.1). **Antworten gehen wie bisher sofort in die db** (`writer.transform`, Sammel-Warteschlange `progress/persist.ts`).
- **Regeln:**
  - Fremder Lerntag (Wechsel um 04:00), falsche `version` oder `restore() === false` → verwerfen.
  - Das Fortsetzen legt nur Karten und Aufgaben neu an, **nie** Antworten.
  - Beim Fortsetzen zählen nur die **neuen** aktiven Minuten. `activeMs` startet bei 0, die angezeigte Zusammenfassung behält die alten Ergebnisse. So zählt `recordRoundEnd` nichts doppelt.
  - ✕ behält die Momentaufnahme, das reguläre Ende löscht sie.
- **Nach dem Neuladen:**
  - Ist die jüngste Momentaufnahme **frisch** (< 30 Min., gleicher Lerntag), öffnet der Rahmen die Übung direkt an derselben Stelle. Die Tastatur öffnet sich am iPhone erst beim ersten Tippen in die Lücke.
  - Sonst steht auf dem Herkunftsplatz die Zeile „↻ Weiter, wo du warst: …“. Ein Tipp stellt synchron her und fokussiert.
- **Zwei Tabs:** Die Karten bleiben durch `transform` und `last`-Prüfung geschützt (`stale_answer`). Trägt die Momentaufnahme eine andere `tabId`, erscheint „In einem anderen Fenster geöffnet – hier weitermachen?“.

| Übung | Momentaufnahme (Mindestinhalt) | Paket |
|---|---|---|
| Trainer (Tippen und Aufdecken) | round, mode, deck, queue (Schlüssel), pos, shown, answered, results (≤ 100), repairs (IDs), repairPos, target, doneBefore | P3 |
| Grammatik-Runde, Kurzübungen | mode/kind, Aufgaben-IDs, pos, Ergebnisse | P2 |
| Lektion | vorhandenes `lessonRun.ts` (Schritt, Antworten) in die Hülle | P2 |
| Wochen-Check | Aufgaben, pos, Ergebnisse | P1 |
| Wortschatztest | Stand der Maschine | P6 |
| Rollenspiel | vorhandenes `speak/resume.ts` in die Hülle | P5 |
| Sag es, Tonlagen, Flüssigkeit, Mail, Pitch | Entwurf + Schritt (Entwürfe gibt es schon teilweise) | P5 |
| Lesen, Hören, Schreiben, Entdecken | Einheit, Schritt, Leseposition, Entwurf | P4 |

### 3.3 Bewegung und Listen
- **Keine `layout`/`layoutId` in Listen.** WP0 ergänzt eine ESLint-Regel `no-restricted-syntax` für die JSX-Attribute `layout` und `layoutId`.
  - Ausnahmen gelten nur für `ui/Segmented`, `ui/Switch`, `ui/Sheet`, `engine/Tiles` und genau **einen** Flug „Tageskarte → Übung“ (P1).
  - Die heutigen Listen-Flüge (Wortzeile → Wortblatt, Entdecken, TilePicker) entfernen die Besitzer-Pakete. Bis dahin stehen sie als befristete Ausnahme in der Regel, der Integrator streicht die Ausnahmen am Schluss.
- **Übergänge:**
  - Reiterwechsel: nur Überblendung, 150 ms.
  - Seite: von rechts, 220 ms.
  - Übung und Blatt: von unten.
  - Kartenwechsel: ≤ 180 ms.
  - Nie `AnimatePresence mode="wait"` um ganze Bildschirme, wie heute schon.
- **Lange Listen** (Wortschatz 1.500, Verlauf, Bibliothek): 50 Zeilen, dann „Mehr zeigen“, dazu `content-visibility:auto` je Zeile. Es gibt keine Virtualisierungs-Bibliothek.
- **Reiter-Wurzeln bleiben in `<Activity>`** (React 19.3, vorhanden).
  - In verborgenen Bäumen laufen keine Effekte, ihre Abos werden abgebaut.
  - Unterseiten tiefer im Stapel werden abgebaut, ihr Bildlauf bleibt gemerkt.
  - Notbremse: `KEEP_ALIVE=false` in `tabs.ts`.

### 3.4 Leistungsbudget (verbindlich; 4-fache CPU-Drossel, 390 px, Großdatensatz aus `perf.spec.ts`)

| Messpunkt | Ziel | Messung |
|---|---|---|
| Kaltstart → Heute-Statuszeile (`lx:status`) | < 1,5 s (Gerät < 1 s; Kap. 14: < 2 s) | `perf.spec.ts` (vorhanden) |
| Tipp auf Reiter → neues Bild | < 100 ms | Marke `lx:nav` → `requestAnimationFrame`, neu in `rahmen.spec.ts` |
| „Weiter“/Bewertung → nächste Karte | < 50 ms Skriptzeit | Marke `lx:card` (P3) |
| Tippen in die Lücke | keine Long Task > 100 ms (20 Anschläge) | `perf.spec.ts` (vorhanden) |
| Blatt öffnen | erste Bewegung < 100 ms | `rahmen.spec.ts` |
| Wortliste mit 1.500 Karten | erste Zeilen < 300 ms, höchstens 60 Zeilen im DOM | `wortschatz.spec.ts` |
| `dist/index.html` | ≤ 3,2 MB (heute 3,04 MB) | `check:platform`: Warnung ab 3,2 MB, Fehler ab 4 MB |
| Selektoren | Hubs abonnieren nie ganze Sammlungen im Render, nur abgeleitete Zahlen (`useLive` mit Selektor + `useShallow`) | Durchsicht im kombinierten Prüfer |

---

## 4. Anki-Modus technisch

> **Neue Produktentscheidung (in A7 nachtragen):** Die Regel „Keine Selbstbewertung“ gilt weiter für den **Tippen-Modus**. Der **Aufdecken-Modus** hat vier Knöpfe mit dem Vorschlag der App, wie im Prototyp v1, den Emrah gutgeheißen hat.

### 4.1 Ablauf: derselbe Trainer, anderer Modus
- `startSession(round, { deck, size, only, mode: 'type' | 'flip' | 'auto' })` in `features/vocab/session.ts` bleibt **eine** Sitzung mit derselben Warteschlange (`buildQueue`), denselben Zählern und demselben Protokoll. Neu ist nur das Feld `mode`.
- In `exerciseFor()` gilt: Ist `pickMode(card, mode) === 'flip'`, baut die Sitzung eine Übung `ex:'flip'` statt `chooseExercise`.
  - `auto` (Standard der Pflicht) wählt je Karte. Die Regel legt learning-scientist fest (Entwurf: Stufe ≤ 2 tippen, sonst aufdecken). Die Regel steht an **einer** Stelle, in `domain/srs/flip.ts`.
- **Wer zählt was:**
  - Pflicht-Wiederholung (`ctx:'rev'`) zählt auch im Aufdecken-Modus zur Pflicht.
  - Freie Stapel laufen als `ctx:'xtra'` wie die heutige freie Runde.
  - Je Karte und Tag zählt die erste Bewertung (`exclude` wie heute).
- **Bildschirm:** `TrainerScreen` zeigt bei `exercise.ex === 'flip'` die neue `features/vocab/anki/FlipCard.tsx`.
  - Vorderseite: Englisch, Ursprungssatz, ▶.
  - Tippen irgendwo oder Leertaste deckt auf.
  - Rückseite: Bedeutung, Wortart, Beispiele. Jedes Wort ist antippbar.
  - Darunter `GradeButtons`: Nochmal · Schwer · Gut · Leicht, jeweils mit Intervall. Der Vorschlag ist hervorgehoben.
  - Wischen (`engine/swipe.ts`): links = Nochmal, rechts = Vorschlag.
  - Tasten: 1–4.

### 4.2 Übungsart `flip` in der Domäne (additiv, Besitz P3, data-guard prüft)
- **`types.ts`:** `ExerciseId` bekommt `'flip'`, `InputKind` bekommt `'flip'`.
- **`modes.ts`:** Neuer Katalog-Eintrag `{ ex:'flip', stage:0, level:2, mode:'recog', input:'flip' }`.
  - `supports(…, 'flip')` gibt **immer `false`** zurück. So wählt die automatische Auswahl `flip` nie, auch nicht über die Nachbarstufen-Suche (Stufe 0).
  - **Pflicht:** Ohne den Eintrag fiele `exerciseDef('flip')` still auf `mc_en` zurück.
- **`applyReview.ts`:** Für `ex==='flip'` gilt `stage = grade === 1 ? max(1, s − 1) : s`.
  - Begründung: Die Stufenleiter misst **abgerufene Produktion**. Selbstbewertung darf eine Karte nicht von Stufe 2 auf 4 heben, wie es `nextStage` mit Level 2 und „Leicht“ täte.
  - Alles andere läuft über den unveränderten Schreibpfad:
    - `fsrs` zusätzlich,
    - `S`/`D`/`due`/`state`/`reps`/`lapses` gespiegelt,
    - `modes.recog` und `xs.flip` gezählt,
    - `hist[].x = 'flip'`.
  - Die Pfade sind `reviewWrite` → `writer.transform`, A6.14.
- **Wendungen:** `chunkMode('flip') === null`, also nur `xs`, wie bei den Auswahlarten.

### 4.3 Vorschlag und Intervalle
- **Zeitstempel:** Beim Aufdecken wird **`t = nextT()` reserviert**. Die Vorschau und die spätere Antwort nutzen dasselbe `t`.
  - Grund: Mit `enable_fuzz` hängt das Intervall vom Zeitpunkt ab. Ohne gemeinsames `t` könnte „3 Tage“ angezeigt und „4 Tage“ gespeichert werden.
  - Die Vorschau rechnet `previewIntervals(card.fsrs, t)` (gibt es schon in `scheduler.ts`), vier `scheduler.next`-Aufrufe unter 1 ms.
- **Beschriftung:** `formatInterval(ms, lang)` in `domain/srs/flip.ts` liefert „1 Min.“, „10 Min.“, „3 Tage“, „2 Mon.“ bzw. „1 min“, „3 days“.
- **Vorschlag:** `flipSuggest({ revealMs, kind })`. Aus der Denkzeit bis zum Aufdecken ergibt sich:
  - ≤ 3 s → Leicht,
  - ≤ 10 s → Gut,
  - darüber Schwer.
  - Wendungen bekommen × 1,5. „Nochmal“ wird nie vorgeschlagen.
  - Die Schwellen legt learning-scientist fest, sie stehen als Konstanten neben `grade.ts`.
- **Speichern:** `commitAnswer({ grade, given:'', ms: revealMs, ok: grade > 1 })`. Die Karte wird sofort gespeichert, Protokoll und Zähler laufen über die Sammel-Warteschlange wie heute. Kein Rückgängig im 12-Stunden-Umfang, das geht in den Backlog.

### 4.4 Stapel = gespeicherte Filter
- **Eingebaute Stapel** werden nicht gespeichert und kommen aus `domain/srs/vocabList.ts`:
  - `all` (alle fälligen), `hard`, `job` und `phrases`,
  - dazu Quellen-Stapel aus `card.src`: Übersetzer, Nachschlagen, Preply, Lektion, KI.
- **Eigene Stapel:** Sie liegen in **einem** neuen Dokument `app/decks`. Es gibt also keinen wachsenden Datenstrom und kein Dokument je Stapel (A6.6).

```ts
app/decks = { v: 1, decks: Record<id, { name: string; order: number; created: string;
  mode?: 'type' | 'flip'; size?: number; hidden?: boolean;
  filter: { kinds?: ('vocab'|'chunk')[]; src?: string[]; stage?: { min?: number; max?: number };
            due?: boolean; hard?: boolean; query?: string; ids?: string[] /* ≤ 500 */ } }>,
  builtin?: Record<string, { mode?: 'type' | 'flip'; size?: number }> }   // gemerkter Modus je eingebautem Stapel
```

- **Obergrenzen:** 40 Stapel, 500 IDs je Stapel. Das Dokument bleibt so unter 64 KiB, weit unter 256 KiB.
- **Schreiben:** nur per `writer.transform` (frischer Stand).
- **Zugehörigkeit:** Die Karten selbst bekommen **kein** neues Feld. Die Zugehörigkeit ergibt sich allein aus `matchDeck(card, filter)` in `domain/srs/decks.ts` (rein, getestet).
- **Lesen:** mit `useDocWatch('app/decks')` nur im Wortschatz-Bereich, keine neue globale Live-Abfrage.
- **Registrierung:** additiv in `data/paths.ts` (APP_DOCS) und `data/schemas.ts` (tolerant, `loose`), dazu `docs/datenmodell.md`, Seed-Beispiel und Export. Alles in P3, data-guard prüft einmal.

---

## 5. Parallelisierung

### 5.1 Arbeitspaket 0: Rahmen (zuerst, ein Helfer)

| Teil | Inhalt | Dauer | Fertig, wenn |
|---|---|---|---|
| **WP0a Verträge + Umverdrahtung** (blockiert alle) | `router/types.ts`, `registry.ts`, `nav.ts` intern auf Reiter-Stapel und Übungsebene (API gleich), `deeplink.ts`, `sheets.ts` (Blatt-Stapel, Altschnittstelle). **Alle** `src/areas/*.tsx` mit den **heutigen** Bildschirmen unter den **heutigen** Routennamen (Zuordnung im Anhang), `areas/index.ts`, `tabs.ts` (4 Reiter wie v1), einfache Shell (Kopf, Reiterleiste, Ebenen), leere i18n-Teile, `Resumable`-Typ + Speicher-API (zunächst ohne Wiederherstellen), Test-Helfer in `fixtures.ts`, Navigation der betroffenen Specs und Helfer angepasst (§5.5) | **2 h** | typecheck, lint, unit und **volle E2E grün**; `main` getaggt `nb-wp0a` |
| **WP0b Rahmen fertig** (parallel zu P1–P6, nur WP0-Dateien) | TopBar nach v1, Profil-Knopf mit Serie, Blatt-Host mit Profil-Gerüst, Player-Kontext in `ExerciseBar`/`ExerciseTop`, `ScreenBoundary`/`StepBoundary`/`CrashProbe`, Fortsetzen (Laden, Zeile, Frische-Regel), `<Activity>`, ESLint-Regel Layout, Messmarken `lx:nav`, `tests/e2e/rahmen.spec.ts` | **1,5 h** | eigene Specs grün, volle E2E grün; zusammengeführt **vor** dem ersten Paket; die Pakete nehmen es einmal per Rebase auf |

Realistisch sind **3,5 h für WP0 insgesamt, davon 2 h blockierend.** Ohne die Aufteilung würde WP0 die Pakete 3,5 h aufhalten.

### 5.2 Bereichs-Pakete und Datei-Hoheit

„Besitz“ heißt: Nur dieses Paket legt die Datei an oder ändert sie. `src/areas/<datei>` und `src/i18n/parts/<teil>.*` gehören immer dem Paket der Zeile.

| Paket | Umfang | Besitz (anlegen/ändern) | Eigene E2E |
|---|---|---|---|
| **P1 Heute & Tageseinheit** | Heute-Wurzel nach v1 (Datum, Tageskarte mit Abschnitten, ein Knopf, Fertig-Zustand + **ein** Vorschlag), Tageseinheit im Player (Zwischenkarte, „Abschnitt n von m“, Fertig-Bildschirm, ✕ → Heute), Wochen-Check-Zeile, Reiter-Abzeichen, Fortsetzen des Wochen-Checks | `features/today/**`, `features/check/**`, `features/learn/flow.ts`, `features/learn/time.ts`, `areas/heute.tsx`, i18n `nbHeute` | `heute.spec.ts`; zu pflegen: `today`, `today-duties`, `weighting` |
| **P2 Kurs, Grammatik & Training** | Hub „Üben“ (Platz `learn`): Kurs, Lektion, Grammatik, Wissen, Kurzübungen (Diktat, Lückenjagd, Satzbau, Sprint), Reparatur-Sätze, Deutsch-Fallen, C1-Werkzeugkasten; Fortsetzen für Lektion, Grammatik und Kurzübungen; Schritt-Grenzen | `features/course/**`, `features/grammar/**`, `features/drills/**`, `features/repair/**`, `features/patterns/**`, `features/learn/LearnHub.tsx`, `areas/lernen.tsx`, i18n `nbLernen` | `lernen.spec.ts`; zu pflegen: `course`, `courseExtend`, `grammar`, `drills`, `hint`, `repair`, `patterns` |
| **P3 Wortschatz & Anki** | Reiter Wortschatz (Alle fälligen, Stapel, Zuletzt hinzugefügt, Suche, +), Stapel-Seite, Wortliste (50er-Seiten, ohne `layoutId`), Anki-Modus (§4), Wort- und Hinzufügen-Blatt global, Einstellungs-Abschnitt „Wiederholen“, Fortsetzen des Trainers | `features/vocab/**`, `features/lookup/**`, **additiv** `domain/srs/{types,modes,applyReview,grade}.ts`, **neu** `domain/srs/{flip,decks}.ts`, **additiv** `data/{paths,schemas}.ts` (`app/decks`), `docs/datenmodell.md`, `scripts/generate-seed.mjs` + `seed/sample-data.json`, `areas/wortschatz.tsx`, i18n `nbWs` | `wortschatz.spec.ts`, `anki.spec.ts`; zu pflegen: `trainer`, `trainerFeedback`, `trainerModes`, `trainerReview`, `gestures` |
| **P4 Lesen & Hören** | Reiter Lesen (`library`: Heute neu, Artikel, Hörtexte, Entdecken, eigene Texte, Verlauf) als eine Bibliothek, ein Leser (Hören mit Audio-Leiste), „+ Wortschatz“ am Wort, Schreib-Einheiten als Einstieg auf Platz `write`, Fortsetzen mit Leseposition | `features/input/**`, `features/read/**`, `features/listen/**`, `features/discover/**`, `features/write/**`, `app/modules.ts` (geht auf in `areas/lesen.tsx`), i18n `nbLesen` | `lesen.spec.ts`; zu pflegen: `read`, `listen`, `write`, `discover`, `input-platform` |
| **P5 Sprechen & Schreiben** | Reiter Sprechen mit Umschalter **Gespräche · Schreiben · Preply** + Training: Rollenspiel, Business (Mail, Playbook, Pitch), Sag es, Tonlagen, Flüssigkeit, Termin, Preply; Fortsetzen (Rollenspiel, Entwürfe) | `features/speak/**`, `features/business/**`, `features/preply/**`, `features/say/**`, `features/tones/**`, `features/fluency/**`, `features/meeting/**`, `areas/sprechen.tsx`, i18n `nbSprechen` | `sprechen.spec.ts`; zu pflegen: `speak`, `business`, `preply`, `say`, `fluencyMeeting`, `voice` |
| **P6 Profil, Stand & Claude** | Profil-Blatt (Serie, Urteil, Wochenbericht, Tests, Einstellungen, fremde Links), Seite „Dein Stand“ (`overview`), Wortschatztest, Einstellungen (entschlackt, Gruppen Lernen · Aussehen & Ton · Daten), Claude-Blatt (Übersetzen · Fragen, „+ Wortschatz“ je Wort), „Was ist neu“, Nachtrag-Hinweis | `features/progress/**`, `features/vtest/**`, `features/settings/**` (außer der WP0-Einhängestelle), `features/companion/**`, `features/system/WhatsNew.tsx`, `whatsNew.ts`, `features/migration/LateRescueCard.tsx`, `areas/profil.tsx`, i18n `nbProfil` | `profil.spec.ts`; zu pflegen: `progress`, `vtest`, `settings`, `companion`, `translate`, `stand-gaps`, `phase5-a11y` |

### 5.3 Gemeinsame Dateien

- **Eingefroren** (niemand ändert sie während der Parallelphase; nötige Änderungen gehen als Wunsch an den Integrator):
  - `src/data/**`, `src/ai/**`, `src/prompts/**`, `src/platform/**`
  - `src/domain/**`, außer P3 wie oben
  - `features/progress/persist.ts` (die eine Sammel-Warteschlange; P6 besitzt `progress/` sonst)
  - `features/learn/{ui.tsx,inputs.ts,RetryHint.tsx}`, `features/system/Chrome.tsx`, `ui/**`, `engine/**`
  - `src/app/**`, `src/areas/index.ts`, `src/i18n/{de,en,index}.ts`
  - `tests/e2e/fixtures.ts`, `playwright.config.ts`, `eslint.config.js`, `vite*.ts`, `package.json`
- **API-stabil** (der Besitzer darf innen ändern, Signaturen nur erweitern):
  - `vocab/session.ts` (P3, genutzt von `learn/flow`, `today`)
  - `today/store.ts` und `today/state.ts` (P1, genutzt von 11 Bereichen)
  - `lookup/store.ts` und `vocab/list/actions.ts` (P3, genutzt vom Claude-Blatt)
  - `companion/store.openCompanion` (P6, genutzt vom Kopf)
- **Test-Helfer:** Jedes Paket legt eigene Helfer in `tests/e2e/<bereich>Helpers.ts` an. `fixtures.ts` gehört WP0.
- **Neue Abhängigkeiten:** keine. Alles Nötige ist da: React 19.3 mit `Activity`, framer-motion, zustand, xstate, ts-fsrs, zod.

### 5.4 Reihenfolge des Zusammenführens

1. **WP0a** → `main`. Die Pakete zweigen ab.
2. **WP0b** → `main`. Die Pakete rebasen einmal, konfliktfrei, weil sie keine WP0-Dateien ändern.
3. **P3 Wortschatz & Anki:** Es ist das einzige Paket mit Daten- und Domänen-Änderung, data-guard prüft es sofort. Die anderen profitieren von `app/decks` und `flip`.
4. **P6 Profil & Claude:** Es enthält Blätter und Einstellungen, die alle nutzen.
5. **P1 Heute:** Es setzt die Abschnitte der anderen zusammen, die Tageseinheit nutzt den Aufdecken-Modus aus P3.
6. **P2**, dann **P4**, dann **P5.** Sie sind unabhängig voneinander, die Reihenfolge ergibt sich aus der Fertigstellung.
7. **Integration:**
   - Listen-Ausnahmen der Layout-Regel streichen.
   - `acceptance.spec`, `screens.spec`, `a11y.spec`, `platform.spec` und `perf.spec` auf den Endstand bringen.
   - `npm run verify` einmal voll laufen lassen.
   - **Ein** kombinierter Prüfer (Daten + Plattform + UX + Lernwissenschaft, A7 „Kontingent sparen“), höchstens 2 Behebungsversuche je Ursache (A2).
   - Test-Artefakt, **nicht** `JLL8…` ohne Emrahs ausdrückliches OK.

Je Zusammenführen laufen typecheck, lint, alle Unit-Tests und **nur** die E2E-Specs des Pakets plus `rahmen.spec.ts`, das sind etwa 10 Minuten. Die volle E2E-Suite läuft nur nach WP0a, nach WP0b und am Schluss.

### 5.5 E2E je Paket und anzupassende bestehende Specs

- **Neu (je Paket eine Datei):**
  - `rahmen.spec.ts` (WP0), `heute.spec.ts`, `lernen.spec.ts`, `wortschatz.spec.ts`, `anki.spec.ts`, `lesen.spec.ts`, `sprechen.spec.ts`, `profil.spec.ts`
  - Jede Datei deckt mindestens ab:
    - Einstieg ≤ 3 Tipps vom Start,
    - Rückkehr zur Herkunft,
    - Neuladen mitten in der Übung setzt exakt fort,
    - `lx:crash-once` zeigt „Diese Aufgabe überspringen“ und die App läuft weiter,
    - beide Sprachen, 390 px.
- **Neue Helfer in `fixtures.ts` (WP0):**
  - `openTab(page, id)`
  - `openEntry(page, testId)`: Probiert Reiter aus `tabbar` der Reihe nach durch, bis der Einstieg sichtbar ist. Das funktioniert unabhängig davon, ob es 4 oder 5 Reiter gibt.
  - `openProfile(page)`
  - `openOverview`: jetzt Profil → „Ganzer Stand“
  - `openSettings`: jetzt Profil → Einstellungen
  - `openSpeak`: Segment `scenes` heißt jetzt Gespräche
  - `bootAt(page, route)`: über `#go=`

**Bestehende Specs, die WP0a an die neue Navigation anpasst**, alles andere bleibt unverändert:

| Art der Anpassung | Specs |
|---|---|
| Nur über geänderte Helfer, kein Spec-Code (`openOverview`, `openSettings`, `openSpeak`) | `a11y`, `migration`, `platform`, `settings`, `gestures`, `haptics`, `vtest`, `business`, `fluencyMeeting`, `phase5-a11y`, `patterns`, `progress` (+ `progressHelpers.ts`) |
| `tab-learn` + `learn-hub` + `hub-*` → `openEntry(page, 'hub-…')` | `aiCanned`, `c1tones`, `companion`, `course`, `courseExtend`, `drills`, `grammar`, `hint`, `stand-gaps`, `trainerModes`, `weighting` (+ `learnHelpers.ts`, `trainerHelpers.ts`, `inputHelpers.ts`) |
| `tab-overview` als Reiter → `openOverview` | `acceptance` (Reiter-Schleife aus `TABS`), `today`, `progress`, `stand-gaps` |
| `more-practice`, `td-extra-preply`, `open-history` (Einstieg wandert) | `today`, `trainer`, `preply`, `write` (+ `inputHelpers.ts`) |
| Reiterleiste und Abzeichen (Anzahl, Einzeiligkeit) | `screens` („Reiterleiste 390 px“), `today-duties` (`tab-badge`) |
| `tab-speak`, Segment-IDs | `speak`, `repair`, `voice`, `companion` |
| Listen-Flüge fallen weg (§3.3) | `transitions`: „Kurszeile → Lektion“ und „Wortzeile → Wortblatt“ werden gestrichen; „Tageskarte → Übung“ und „reduzierte Bewegung“ bleiben |
| Kein Spec-Code zu ändern (nur `data-screen` und Routennamen, die bleiben; die genutzten Helfer passt WP0a zentral an) | `say`, `trainer*` (außer oben), `trainerFeedback`, `trainerReview`, `read`, `listen`, `discover`, `input-platform`, `translate`, `perf`, `voice` (Rest) |

`screens.spec.ts` und `acceptance.spec.ts` bekommen am Schluss die Bildschirm-Liste aus dem Register (`AREAS`). Damit fehlt künftig kein neuer Bildschirm im Rundgang.

### 5.6 Zeitplan (12 h)

| Stunde | Was |
|---|---|
| 0:00–2:00 | WP0a (1 Helfer). Parallel: learning-scientist beantwortet die drei Anki-Fragen (§6, R6), damit P3 ohne Wartezeit startet. |
| 2:00–7:30 | P1–P6 parallel in eigenen Worktrees (`nb/p1-heute` …), 2:00–3:30 zusätzlich WP0b, Rebase um 3:30 |
| 7:30–10:00 | Zusammenführen in der Reihenfolge von §5.4, je ca. 20 Min. |
| 10:00–11:30 | volle Suite, kombinierter Prüfer, Behebungen (höchstens 2 Versuche je Ursache) |
| 11:30–12:00 | Test-Artefakt veröffentlichen, Bericht an Emrah (3 Sätze), Freigabe für `JLL8…` erfragen |

---

## 6. Risiken und wie man sie klein hält

| # | Risiko | Gegenmittel |
|---|---|---|
| R1 | WP0 überzieht, alle warten | WP0a auf das Nötigste schneiden: Verträge, Umverdrahtung unter den alten Routennamen, grüne Tests. Die Optik steckt in WP0b und läuft parallel. Harte Zeitbox 2 h. Ein unfertiger Teil wandert nach WP0b. |
| R2 | Konflikte in gemeinsamen Dateien | Datei-Hoheit laut §5.2/5.3. Bereichsdateien, i18n-Teile und Helfer-Dateien legt WP0 **vorab** an. Deklarations-Zusammenführung statt zentraler Routen-Union. Ein Unit-Test verbietet doppelte i18n-Schlüssel. |
| R3 | E2E rot durch die neue Navigation (35 Specs direkt, fast alle über Helfer) | WP0a passt die Specs zentral über Helfer an. Test-IDs der Einstiege bleiben. `openEntry` ist unabhängig von der Reiter-Zahl. `data-screen` nur auf der sichtbaren Ebene. |
| R4 | Die volle E2E-Suite ist zu langsam für viele Läufe | Die volle Suite läuft nur 3× (nach WP0a, nach WP0b, am Schluss), sonst nur die Paket-Specs. Kein Lauf ohne Änderung (A2). |
| R5 | Fortsetzen erzeugt Doppelzählung oder alten Stand | Momentaufnahme nur lokal, versioniert, nur der eigene Lerntag. `restore` schreibt nie in die db, `activeMs` beginnt beim Fortsetzen bei 0. Antworten sind über `t` und `last` idempotent. Unit-Tests je `Resumable` (Momentaufnahme → Wiederherstellung → gleiche Position). |
| R6 | Anki verfälscht Stufen oder FSRS | `flip` ist fest im Katalog und nie automatisch wählbar, die Stufenregel ist gesondert. Dasselbe `t` für Vorschau und Speichern. data-guard prüft P3 zuerst. Die drei offenen Fragen (Modus-Regel für `auto`, Schwellen des Vorschlags, Stufenregel) entscheidet learning-scientist **vor** dem Paketstart. |
| R7 | `<Activity>` verhält sich in Safari oder mit Abos unerwartet | Schalter `KEEP_ALIVE` in `tabs.ts`. Verborgene Bäume bauen ihre Effekte ab (Abo-Grenze 64 bleibt). Rückfall: Abbauen und den Bildlauf merken wie heute. |
| R8 | iPhone-Eigenheiten, die Chromium nicht zeigt (Tastatur im selben Handler, `visualViewport`, Wischen am Rand) | Sitzungen weiter synchron im Klick starten, `go` bleibt synchron. Kein automatisches Fokussieren nach dem Neuladen. Handy-Prüfliste für Emrah am Ende (A7: Safari prüft Emrah). |
| R9 | Umfang wächst („mehr Funktionen“) | Jedes Paket hat die feste Umfangs-Zeile aus §5.2. Neue Ideen gehen nach `docs/backlog.md`. Was nicht grün ist, wandert ins nächste Paket, die Zeit wird nicht verlängert (A7). |
| R10 | Doppelte Inhalte auf einem Bildschirm (Kap. 15), weil fremde Abschnitte auf Heute landen | Jeder Einstieg hat genau einen Platz. `acceptance.spec` („ohne Wiederholungen“) läuft über alle Reiter aus `TABS`. |
| R11 | Das Bundle wächst, der Start wird langsamer | Budget in `check:platform` (≥ 3,2 MB Warnung). Keine neuen Pakete. Heute rendert zuerst, die anderen Reiter erst beim ersten Besuch. |
| R12 | Veröffentlichung über die laufende App (Kap. 15) | Nur Test-Artefakt, `JLL8…` nur mit Emrahs „Ja, veröffentlichen“. Rückweg: die zuletzt produktive Version `1790541376-265e`. |

---

## Anhang: Heutige Routen → Bereich und Ebene (WP0a überträgt sie unverändert)

| Route | Ebene | Bereich/Paket |
|---|---|---|
| `today` | tab | heute (P1) |
| `check` | exercise | heute (P1) |
| `learn`, `course`, `grammar`, `wissen`, `patterns` | page | lernen (P2) |
| `lesson`, `grammarSession`, `drill` | exercise | lernen (P2) |
| `vocab` | tab (neu: Wortschatz-Hub; die heutige Liste wird `vocabList`) | wortschatz (P3) |
| `trainer` | exercise | wortschatz (P3) |
| `library` (neu), `discover`, `history` | tab / page / page | lesen (P4) |
| `read`, `listen`, `write`, `discoverItem` | exercise | lesen (P4) |
| `speak` | tab | sprechen (P5) |
| `meeting`, `playbook` | page | sprechen (P5) |
| `roleplay`, `mail`, `pitch`, `say`, `fluency`, `tones` | exercise | sprechen (P5) |
| `overview` | page (war Reiter; jetzt aus dem Profil-Blatt) | profil (P6) |
| `vtest` | exercise | profil (P6) |
| Laden, keine db, offline, Umstellung | Systemzustand (keine Route) | system (WP0) |

In WP0a ist `library` zunächst ein Verweis auf den heutigen Lern-Hub-Abschnitt „Lesen, Hören, Schreiben“. `vocab` zeigt zunächst die heutige Liste. P3 und P4 ersetzen das.
