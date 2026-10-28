# Prüfung Tarek (Technik, Daten) – P6 S1-START

Stand 28.10.2026. Geprüft: Branch `claude/umbau-s1-start` (`0699f30`, Basis `e0ba6c0`). Maßstab: `docs/relaunch/stufe1-plan.md` P6 (Z. 248–276), §4.1–4.6 (Z. 396–468), A7 (Z. 36), `contract/db.d.ts` Z. 279–286 und Grenzen. Eine Prüfung, nur gelesen; die gzip-Zahlen stammen aus dem Paket-Bericht. (Datei von der Hauptsitzung aus dem Prüfbericht angelegt, da der Prüfer nur Leserechte hatte.)

## Prüfpunkte

| Nr. | Punkt | Urteil | Fundstelle |
|---|---|---|---|
| 1 | Schreiben nur `transform`/`replace`, Vergleich ohne `at` in `compute`, nie `update` | ✅ | `src/data/todayDoc.ts:115`, `src/data/writer.ts:85` (`REPLACEABLE`), `:173–178` |
| 1 | Anlässe nur `ensureDay` und Nutzeraktionen | ✅ mit Einschränkung (S1) | `store.ts:312`/`:366`, `unit/run.ts:274`, `c1/chapterRun.ts:171`, `today/startDoc.ts:133–139`; Einschränkung `startDoc.ts:108–122` |
| 2 | Nur `APP_DOCS`, nicht `LIVE_DOCS`, ein `get` vor `startLive` | ✅ | `paths.ts:77`, `live.ts:23` unverändert, `boot.ts:41–42`, `todayDoc.ts:133`, Test `todayDoc.test.ts:235–250` |
| 3 | Fehlend, veraltet oder ungültig → Skelett | ✅ | `todayDoc.ts:92–103`, `:149–157`; `HomeSkeleton.tsx:35`, `TodayScreen.tsx:274`; E2E `start.spec.ts:60–74` |
| 3 | Widerspruch Startbild ↔ berechneter Plan (Kap. 15) | ✅ mit Restrisiko (S2) | `app/today` speist den Plan nie; `startRun.ts:32–39`, `:61–72`; `TodayScreen.tsx:401–417`. Gleichheitstest fehlt |
| 4 | Rückweg v86 | ✅ | `tests/fixtures/s1-seed.json:17–30`, `rueckwegSchema.test.ts:56–95`, `rueckweg.spec.ts:43`, `:163–164` |
| 5 | Kein leeres `catch`, Fehler protokolliert | ✅ | `todayDoc.ts:112`, `:143`, `startDoc.ts:97`, `startPerf.ts:21/35/47`; Altlast `index.html:61` (H7) |
| 6 | Budget | ❌ (M1) | siehe unten |

## Muss (Veto)

**M1 – Budget-Tor rot, CSS-Zuwachs nicht vorab genannt.**
- `html` hat Basis 2000 B bei leerem `zuwachs`, gemessen sind 2385 B. Damit ist `check-budget` und somit `verify` rot (G0).
- CSS +219 B ohne Eintrag für P6. Grün bleibt das nur, weil der ungenutzte Spielraum von P1–P3 mitzählt. Nach der Sperrklinken-Regel (`stufe1-plan.md:119`) braucht das einen Eintrag.

Zur Ursache: Inhaltlich ist der Zuwachs gerechtfertigt. `#lx-boot` muss der P2-Hülle und L1 gleichen, sonst springt das Bild (U2). Ein Teil lässt sich aber vermeiden.

Vorschlag:
1. Die sechs Inline-Stile der Navigations-Platzhalter (`index.html:71`) durch die Klasse `lx-nav-sk` in `shell.css` ersetzen.
2. Die lange `lg:`-Klassenliste der Tageskarte als benannte Regel an `.lx-today-card` hängen, gemeinsam für `DayCard.tsx` und `index.html`.
3. Optional, nur mit Noras Zustimmung: Beschriftungen der Navigation als Skelett-Balken.
4. Neu messen.
5. Was dann noch über der Grenze liegt, mit Freigabe eintragen (Format `check-budget.mjs:81`).
6. CSS ebenso eintragen.

Den Einstieg (+3919 von zugesagten 8000 B) bewerte ich als ✅.

## Soll

**S1 – Einmaliges Warten auf `log/<Tag>` läuft im Snapshot-Stapel (`startDoc.ts:108–122`).**
Inhaltlich ist das ein aufgeschobener `ensureDay`-Anlass und vom Vertrag gedeckt, deshalb kein Veto. Zwei Mängel:
- Jedes `ensureDay` legt einen weiteren Wartenden an.
- Es gibt keinen Test für einen fremden Snapshot, während ein Wartender aktiv ist.

Vorschlag:
- höchstens ein Wartender je Lerntag oder `whenDayLoaded(day)`,
- die Ausnahme in §4.3 dokumentieren,
- Test: drei `ensureDay` vor dem Laden ergeben genau 1 Schreibvorgang, danach ergeben fremde Snapshots 0 Schreibvorgänge.

**S2 – Gleichheitstest Startbild ↔ echte Karte fehlt (Kap. 2 Nr. 2).**
`DayCard.tsx:130–193` und `TodayScreen.tsx:142–150`, `:318–335` sind getrennte Zeichenwege. Beim alten Plan unterscheiden sich die Zeilennamen: `dutyLabel` gegen `legacyRows`.

Vorschlag: ein Unit-Test mit `renderToStaticMarkup` für vier Fälle (Einheit, Kapitel-Thema, neues Thema, alter Plan). Er vergleicht Restminuten, „x von N“, Titel, Knopf und Zeilennamen. Bei Abweichung wird eine gemeinsame Namensfunktion genutzt.

**S3 – Plan §4.3 an die echte Form anpassen.**
Die Blöcke tragen zusätzlich `k`, `bl`, `m`, `f` und `id`, das Thema trägt `ch`.

**S4 – Das WebKit-Abnahmekriterium ist hier nicht erfüllbar.**
In der Umgebung gibt es nur Chromium.

Vorschlag:
- den Fokus-Test zusätzlich mit `isMobile`/`hasTouch` laufen lassen,
- einen Handy-Schritt im Test-Link-Text aufnehmen,
- den Befund in `stand.md` vermerken.

**S5 – Rundenende schreibt den optimistischen Stand.**
`startDoc.ts:133–139` schreibt, bevor gespeichert ist. Vorschlag: bei `usePending.getState().failed` mit `'skipped'` aussteigen.

## Hinweise

- **H1:** Beim ersten Öffnen eines Tages erscheint das Skelett, das Startbild erst ab dem zweiten Öffnen. Das im Test-Link-Text erklären.
- **H2:** `ensureDay` bei stehendem Plan kostet bei jedem Sichtbarwerden ein `get`, aber 0 Schreibvorgänge. Zulässig.
- **H3:** „Erneut versuchen“ lädt die Seite neu (`HomeSkeleton.tsx:48`). Einmal am iPhone im claude.ai-Rahmen prüfen.
- **H4:** `replace` entfernt unbekannte Felder. Ein künftiges `bt` (Stufe 4) muss deshalb ableitbar bleiben.
- **H5:** Wird am selben Tag erst v86 und dann wieder Stufe 1 benutzt, zeigt das Startbild kurz den älteren Stand. Der berechnete Plan gewinnt.
- **H6:** v86 zählt und sichert `app/today` nicht. Das ist unschädlich.
- **H7:** Altlast `index.html:61`: Der `catch` enthält nur einen Kommentar.
- **H8:** `ring` wird geschrieben, aber nicht gelesen. Laut §4.3 ist das so vorgesehen.

**Veto: ja**, nur wegen M1 (Budget-Tor rot). Es entfällt, sobald `check-budget` grün ist. S1–S5 blockieren nicht.
