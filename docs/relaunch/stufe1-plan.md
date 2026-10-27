# Stufe 1 „Fundament“: Bauplan

Stand 27.10.2026. Verfasst von Tarek (Technik, Veto über Machbarkeit und Datensicherheit) und Nora (Design, Veto über Optik und Bedienung) für die Hauptsitzung. Grundlage: `docs/relaunch/konzept.md` Kap. 12–18, `docs/entscheidungen.md` (Einträge vom 27.10.2026, Fragen 1–9 und 15–19), die Vorschau `WBft3EEx7jYYv4QHdepuNm` v2 `1793137833-35a1` (Quelle `docs/relaunch/vorschau/src/`) und der Code auf `claude/umbau-fokus` (HEAD `0d13559`).

Dieser Plan ist der **einzige** Bauplan für Stufe 1. Neu geplant wird nur bei einem echten Blocker (CLAUDE.md A2).

---

## 0. Kurzfassung

- Stufe 1 ist größer als eine Lieferung. Der Schnitt erfolgt in **1a „Neues Aussehen, Rahmen, Daten“** und **1b „Schneller Start“**. Jede Hälfte bekommt einen eigenen Test-Link. Kein Thema fällt weg.
- Grund für den Schnitt (Abschnitt 8): Der Knopf unter 2 s lässt sich mit dem Mehr-Datei-Build allein **nicht** erreichen. Das Haupt-Skript wiegt auch im Mehr-Datei-Build 2,74 MB gepackt (Messbuild, Abschnitt 8.1). Dazu müssen die großen Inhalte aus dem Startpfad heraus und die Bereiche getrennt geladen werden. Das ist ein eigener, risikoreicher Umbau, der Rahmen und Design nicht aufhalten soll.
- **Live:** erst nach 1b und nach „Ja live nehmen“. Will Emrah das neue Aussehen früher haben, darf 1a allein live gehen. Das ist technisch abgesichert, denn 1a ist für sich vollständig und hat einen eigenen Rückweg.
- 11 Pakete (P0–P10), höchstens 3 gleichzeitig, jedes auf `claude/umbau-s1-<name>` im eigenen Worktree.

---

## 1. Ziel und Abnahme

### 1.1 In Emrahs Worten

> „Die App sieht neu aus, so wie in der Vorschau, am Handy wie am Laptop. Sie startet spürbar schneller: Ich sehe sofort, was heute dran ist, und der große Knopf ist da, bevor ich ungeduldig werde. Die Inhalte und das Lernen sind noch wie heute. Nichts ist verloren gegangen, meine Serie läuft weiter.“

Nach **1a** merkt Emrah: neues Aussehen, 5 Reiter, am Laptop eine Seitenleiste, die Rückmeldung in der Übung steht in einem ruhigen Band unten. Nach **1b** merkt er zusätzlich: Der Start ist deutlich schneller.

### 1.2 Messbare Abnahmekriterien

| Nr. | Kriterium | Wert | Wie geprüft |
|---|---|---|---|
| A1 | Startknopf sichtbar und bedienbar | **< 2,0 s** bei 4× CPU-Drosselung (Median aus 5 Läufen in einem Testlauf); Skelett **< 1,0 s** | `tests/e2e/perf.spec.ts` (neue Grenzen, P10) und Diagnose-Zeile „Knopf nach x,x s“ am iPhone (Emrah misst, Entscheidung 27.10.2026) |
| A2 | Kontrast | Fließtext ≥ 4,5:1, große Schrift und Bedienelemente ≥ 3:1, in Dunkel, Gedämpft und Hell, für beide Akzente (Iris, Bernstein) | `tests/unit/contrast.test.ts` (erweitert in P1) und axe in E2E |
| A3 | Kein Querscrollen | `scrollWidth ≤ clientWidth` bei 320, 390, 768, 1024, 1280, 1440, 1920 und 2560 px Breite, auf jedem Hauptbildschirm | neue `tests/e2e/breiten.spec.ts` (P2) |
| A4 | Leerer Rand bei 2560 × 1440 | höchstens ¼ der Breite ungenutzt (Konzept 13.2) | `breiten.spec.ts` (P2) |
| A5 | Alle Funktionen weiter erreichbar | Jeder heutige Bereich aus `src/areas/index.ts:16` und jeder Bildschirm aus `src/app/shell/tabs.ts:39–46` ist in höchstens zwei Klicks von einem der 5 Reiter oder der Seitenleiste erreichbar | neue `tests/e2e/erreichbar.spec.ts` (P2) mit einer Liste aller Ziele |
| A6 | Nur additive Daten | Keine Feldlöschung, keine Umbenennung, kein neuer Pflichtwert in einem bestehenden Dokument. Neu sind nur `fk`/`in` (und `ms` in `hist`), `app/today`, `app/profile.theme.a` und `app/profile.dk` | data-guard (G3) und Rückweg-Test (Abschnitt 4.6) |
| A7 | Rückweg auf v86 | v86 (`3377252:dist/index.html`) läuft mit einem Datenstand, den Stufe 1 geschrieben hat, ohne Fehler, ohne Datenverlust und ohne Serienbruch | `tests/e2e/rueckweg.spec.ts` (P0 legt an, P4/P6/P7 erweitern) |
| A8 | Rückmeldung passt auf den Bildschirm | Die längste vorhandene Rückmeldung passt auf 390 × 844 ohne Scrollen im Band; Band ≤ 45 % der Höhe | neue `tests/e2e/band.spec.ts` (P3) |
| A9 | Budget eingehalten | 1a: kein Stück wächst über den Ausgangswert (Sperrklinke). 1b: Einstieg ≤ 300 KB gepackt, je Bereich ≤ 150 KB, je `.bin` ≤ 500 KB, < 100 Dateien, CSS gesamt ≤ 30 KB gepackt | `scripts/check-budget.mjs` in `verify` (P0, Grenzen in P10) |
| A10 | Blockwechsel | < 300 ms von „Weiter“ bis zur nächsten Aufgabe (Konzept 14.2) | `perf.spec.ts` (P10) |
| A11 | Zahlen unverändert | Jede Zahl auf Heute, Wörter, Grammatik, Fortschritt ist vor und nach dem Umbau gleich | Golden-Test `tests/unit/metricsGolden.test.ts` (P5) |

---

## 2. Was sich NICHT ändert

- **Inhalte:** keine Aufgabe, kein Satz, keine Erklärung, kein Wörterbuch-Eintrag wird in Stufe 1 geändert. Inhaltsfixes laufen im Strang von James (Hintergrund-Agent der Hauptsitzung) und werden **nicht** dupliziert.
- **Lernlogik:** FSRS, Benotung (`src/domain/grade/`), Unterbrechungsgrenze `INTERRUPT_MS = 60_000` (`src/domain/grade/index.ts:199`, das Konzept nennt 45 s für Stufe 4; Stufe 1 ändert sie **nicht**), Warteschlangen, Quoten (`newQuotaLeft`, `src/features/vocab/hub/data.ts:42`).
- **Tagesplan:** `buildTodayPlan` (`src/features/today/store.ts:200`), `ensureDay` mit der Reihenfolge `app/profile.plan` → lokale Kopie → neu (`store.ts:304–330`). `app/today` ist ein **abgeleitetes Bild**, nie die Quelle des Plans (Konzept 16.1).
- **Serie:** Regel aus `src/domain/metrics/streak` und `app/profile.pflicht` bleiben unverändert. `app/today` schreibt keine Pflicht.
- **Keine stillen Verluste** (Konzept Kap. 15/15.1): Jede Funktion, die heute erreichbar ist, bleibt erreichbar (A5). Was im Rahmen den Platz wechselt, steht in der Tabelle in Abschnitt 6.5. Kein Bildschirm verschwindet.
- **Daten:** keine Löschung, keine Umbenennung. Alle Schreibvorgänge laufen über `src/data/writer.ts`.
- **Rückweg:** v86 `1793087421-695a` (live `JLL8…`) bleibt jederzeit als Rückweg nutzbar (A7). Der Rückweg wird einmal auf dem Test-Link geprobt (Abschnitt 9).
- **Test-IDs:** bestehende `data-testid` bleiben, auch `tab-apply` und `start` (`src/features/today/TodayScreen.tsx:247`). Neue Reiter bekommen zusätzliche IDs.

---

## 3. Arbeitspakete

### 3.1 Übersicht und Reihenfolge

| Welle | Paket | Zweig | Größe | Abhängig von | Prüfer |
|---|---|---|---|---|---|
| 1a-0 | **P0 S1-TOR**: Mehr-Datei als Standard, Budget-Tor, Rückweg-Test-Gerüst | `claude/umbau-s1-tor` | S | – | platform-guard, Tarek |
| 1a-1 | **P1 S1-TOK**: Tokens, Modi, Iris, Schrift | `claude/umbau-s1-tok` | L | P0 | Nora, ux-reviewer, data-guard (`theme.a`) |
| 1a-1 | **P4 S1-ZEIT**: `fk`/`ms`/`in` je Versuch | `claude/umbau-s1-zeit` | M | P0 | data-guard, Tarek, learning-scientist |
| 1a-1 | **P5 S1-ZAHL**: Kennzahlen-Schicht vollständig | `claude/umbau-s1-zahl` | M | P0 | Tarek, learning-scientist |
| 1a-2 | **P2 S1-SHELL**: Rahmen Handy/Rail/Laptop, 5 Reiter | `claude/umbau-s1-shell` | L | P1 | Nora, ux-reviewer |
| 1a-2 | **P3 S1-BAND**: Übungsrahmen mit Band | `claude/umbau-s1-band` | L | P1 | Nora, ux-reviewer, learning-scientist |
| 1a-3 | **P6 S1-START**: Startbild aus `app/today`, Boot ohne Warten | `claude/umbau-s1-start` | L | P2, P4, P5 | Tarek, data-guard, platform-guard |
| 1a-3 | **P7 S1-DIKTAT**: Laptop-Diktat-Probe | `claude/umbau-s1-diktat` | S–M | P3, P4 | Nora, data-guard |
| → | **Test-Link 1a** (G0–G4) | | | P0–P7 | |
| 1b-0 | **P8 S1-LADEN-0**: Ladeprobe (Messung, kein Umbau) | `claude/umbau-s1-ladeprobe` | S | Test-Link 1a | Tarek, platform-guard |
| 1b-1 | **P9 S1-INHALT** (9a Grammatik/Muster, 9b Atlas/Lexikon/C1/Drills): Inhalte als `.bin` nachladen | `claude/umbau-s1-inhalt-a`, `…-inhalt-b` | XL (2 × L) | P8 | Tarek, platform-guard, data-guard |
| 1b-1 | **P10 S1-SPLIT**: Bereiche, Slots, Shells und Texte getrennt laden | `claude/umbau-s1-split` | L | P8 | Tarek, platform-guard, Nora |
| → | **Test-Link 1b** (G0–G4), danach live nach „Ja live nehmen“ | | | P8–P10 | |

**Gleichzeitig höchstens 3.** Welle 1a-1 hat drei Pakete (P1, P4, P5). P9a und P9b laufen **nacheinander**, parallel zu P10. So sind es in 1b-1 höchstens zwei gleichzeitig.

### 3.2 Gemeinsame Dateien und Konflikte

| Datei | Besitzer | Wer sonst berührt sie | Regel |
|---|---|---|---|
| `src/data/schemas.ts` | **P4** (Welle 1a-1) | P1 (nur über `theme`, looseObject, kein Schemaeingriff nötig, siehe 6.1), P6, P7 | P6 und P7 (Welle 1a-3) setzen auf P4 auf. P1 ändert `schemas.ts` **nicht** |
| `src/data/paths.ts` (`APP_DOCS`, Z. 50) | P6 | – | – |
| `src/ui/exercise/ExerciseShell.tsx` | **P3** | P4 nur über die Übergabe `fk`/`in` am Rand, nicht im Shell-Code | P4 ändert nur `ExerciseView.tsx`, `GrammarItem.tsx`, `useC1Item.ts` und die Logik. Läuft P4 in Welle 1a-1 vor P3, gibt es keinen Konflikt |
| `src/features/vocab/ExerciseView.tsx` | P4 (Messwerte) | P3 (nur, falls das Band neue Props braucht) | P3 setzt auf P4 auf (Welle 1a-2 nach 1a-1) |
| `src/app/shell/Player.tsx` | **P3** (Balken, Menü „…“) | P2 nicht | P2 lässt `Player.tsx` aus |
| `src/app/shell/**` sonst, `src/app/shell/tabs.ts` | **P2** | P6 (Boot-Pfad), P10 (lazy) | Wellen nacheinander |
| `src/app/boot.ts`, `src/main.tsx` | **P6** | P10 | P10 nach P6 |
| `src/features/today/TodayScreen.tsx` | **P5** (Zahlen) | P2 (Rahmen, nur Hülle), P6 (Startbild) | P5 in 1a-1, P2 in 1a-2 nur Hülle, P6 in 1a-3 |
| `src/styles/**` | **P1** | P2 und P3 nur in eigenen, neuen Dateien `src/styles/parts/shell.css` und `band.css`, die P1 als Gerüst leer anlegt | keine Mischschichten (6.6) |
| `index.html` | P1 (Theme-Skript Z. 16–27) | P2 (Skelett `#lx-boot`), P6 | P1 → P2 → P6 nacheinander |
| `package.json`, `vite.config.ts`, `scripts/check-*.mjs` | **P0** | P10 (Budget-Endwerte) | – |
| `scripts/verify-fast-map.mjs` | jeder | – | Jedes Paket hängt **nur eigene Zeilen** an. Konflikte beim Zusammenführen löst die Hauptsitzung (reines Anhängen, trivial) |
| `src/i18n/parts/*` | jedes Paket eigene neue Teildatei (`shell.de.ts`, `band.de.ts`, `diktat.de.ts` …) | – | keine Änderung an fremden Teildateien |

### 3.3 Die Pakete im Einzelnen

---

#### P0 S1-TOR: Mehr-Datei als Standard, Budget-Tor, Rückweg-Gerüst · Größe S (~400 Zeilen)

**Ziel:** Entscheidung 1 (Mehr-Datei als Standard) technisch umsetzen und ein hartes Budget-Tor einbauen, bevor irgendetwas wächst.

**Ist:**
- `npm run build` erzeugt heute eine Datei (`package.json:11`), `build:multi` existiert (`package.json:13`), `vite.config.ts:23` schaltet über `MULTI`, `assetsInlineLimit` in Z. 37.
- `scripts/check-platform.mjs` kennt `WARN_BYTES` 6 MiB (Z. 19), ein Gesamtbudget (Z. 65/66) und `MULTI_WARN_TOTAL` (Z. 84), aber **kein Budget je Stück**.
- `tests/e2e/perf.spec.ts:282–284` prüft „dist/index.html < 6 MiB“, das passt nicht zum Mehr-Datei-Build.

**Pfade:** `package.json`, `vite.config.ts`, `scripts/check-platform.mjs`, neu `scripts/check-budget.mjs`, neu `scripts/budget.json`, `tests/e2e/perf.spec.ts` (nur Größentest Z. 282–284), `playwright.config.*` (Ziel `dist/`), neu `tests/e2e/rueckweg.spec.ts`, neu `tests/fixtures/v86.html` (wird im Test aus `git show 3377252:dist/index.html` erzeugt, nicht eingecheckt), `scripts/verify-fast-map.mjs`.

**Umfang:**
1. `build` → Mehr-Datei, `build:single` bleibt als Rückfall erhalten. `check:platform` prüft beides: höchstens 255 Dateien je Veröffentlichung (Artefakt-Grenze), < 100 Dateien als Ziel, gesamt ≤ 9 MB (Warnung, Tarek 3.3), jede Datei ≤ 15 MB, kein externer Host, kein Entwicklungs-Adapter.
2. Vite-Manifest (`build.manifest: true`). `check-budget.mjs` liest das Manifest, packt jedes Stück mit gzip und vergleicht es mit `scripts/budget.json`.
3. **Sperrklinke in 1a:** `budget.json` enthält die heutigen Werte als Obergrenze (Haupt-JS 2.744.021 B gzip, CSS 25 KB gzip, Lazy-Stücke wie gemessen) plus 2 % Spielraum. Ein Paket, das ein Stück wachsen lässt, fällt durch und muss den Zuwachs begründen. Erhöhen darf nur die Hauptsitzung mit einer Zeile Begründung in `budget.json`.
4. `verify` und `verify:fast` (`package.json:25/26`) rufen `check-budget.mjs` auf.
5. E2E laufen gegen den Mehr-Datei-Build. Der Größentest in perf.spec wird auf „Einstieg (Manifest-Eintrag `index.html`) im Budget“ umgestellt.
6. Rückweg-Gerüst: `rueckweg.spec.ts` lädt die v86-Datei mit dem Entwicklungs-Adapter von außen (wie heute `tests/.runtime/fake-claude.js`) und einen Seed mit allen neuen Feldern. Geprüft wird: Heute lädt, Wörter-Liste lädt, eine Übung lässt sich beenden, keine Meldung in der Diagnose. P4, P6 und P7 erweitern den Seed um ihre Felder.
7. Veröffentlichungsweg dokumentiert in `docs/relaunch/stufe1-plan.md` Abschnitt 9: Beim Veröffentlichen alle Dateien aus `dist/` über `files`, Dateien der Vorversion, die es nicht mehr gibt, mit `null` entfernen.

**Abnahme:** `npm run verify` grün im Mehr-Datei-Build; `check-budget` schlägt bei einem künstlich vergrößerten Stück an (Unit-Test des Skripts); `rueckweg.spec.ts` grün.

**Tests:** `tests/unit/checkBudget.test.ts` (neu), `rueckweg.spec.ts` (neu), `perf.spec.ts` angepasst.
**verify-fast-map:** `scripts/check-budget` und `scripts/budget.json` → `platform`, `perf`; `vite.config.ts` bleibt → `platform`/`perf`; neue Regel `tests/e2e/rueckweg` → sich selbst.
**Prüfer:** platform-guard, Tarek.

---

#### P1 S1-TOK: Tokens, Modi, Iris, Schrift · Größe L (~1.800 Zeilen)

**Ziel:** Die Farb- und Formsprache der Vorschau in die App übernehmen, ohne einen Bildschirm neu zu bauen.

**Ist:**
- `src/styles/index.css` hat die Modi als `:root[data-theme='dark'|'dim'|'light']` (Z. 40/93/146), die Paletten ocean/plum/graphite (Z. 203–259) und `@theme inline` (Z. 268). Insgesamt 174 Farbliterale, Glasflächen 9× in `index.css`.
- `src/styles/parts/`: 17 Dateien; Farbliterale in `dz.css` 16, in `dz2.css`, `r6a.css`, `r6b.css` je 1. Glas zusätzlich in `r6a` 2× und `dz2` 4×.
- Die Palette kommt aus `lx:palette` (`index.html:16–27`), Rückfall `sage`. `src/app/settings.ts:13` `PALETTES = ['sage','ocean','plum','graphite']`, `isPalette` mit Rückfall `'sage'` (Z. 22/43).
- In der Vorschau (`docs/relaunch/vorschau/src/style.css`) ist Dunkel bare `:root`, dazu `[data-mode="muted"]`, `[data-mode="light"]`, `[data-accent="amber"]`. Namen: `--bg, --bg-deep, --surface(-2/-3), --line(-2), --fg(-2/-3), --act, --act-fg, --act-text, --act-soft, --ok, --near, --bad, --ch-words/gram/listen/speak, --mark, --kb*, --scrim, --shadow, --r: 14px, --ease-spring, --ease-soft`.

**Entscheidungen (begründet):**
- **Attributnamen bleiben** `data-theme='dark'|'dim'|'light'`. Grund: Sie sind in E2E-Tests und im Theme-Skript verankert. Ein Umbenennen auf `data-mode` brächte nur Risiko. Die Vorschau-Werte werden auf diese Namen übertragen (`muted` → `dim`).
- **Neue Token-Namen aus der Vorschau** werden die Quelle. Die alten Namen `--lx-*` und `--color-*` bleiben als **Brücken-Aliase** in genau einer Datei `src/styles/bridge.css` (`--lx-surface: var(--surface)` usw.). So sehen alle bestehenden Bildschirme sofort neu aus, ohne dass sie angefasst werden. Die Brücke schrumpft mit jeder späteren Stufe und hat eine Zählung in `check:platform` (Warnung, kein Tor).
- **Akzent:** `data-accent="iris"` (Standard) und `"amber"`. Iris als `oklch(0.62 0.16 275)` laut Konzept Kap. 12. Die Vorschau nutzt `0.6`. Nora entscheidet sich für **0,62**, weil der Kontrasttest in Hell damit knapp sicherer besteht; P1 misst beide Werte und hält das Ergebnis im Test fest.
- **Speicher für den Akzent:** neues Feld `app/profile.theme.a` (`'iris'|'amber'`). `theme.p` (Palette) bleibt **unangetastet** stehen. Grund Rückweg: v86 liest `theme.p` und fällt bei Unbekanntem auf `sage` zurück (`settings.ts:22/43`), `theme.a` ignoriert v86, weil `theme` ein looseObject ist (`src/data/schemas.ts`, `profileSchema` ab Z. 122). Lokal zusätzlich `lx:accent` für das Theme-Skript vor dem ersten Bild.
- Die alten Paletten ocean/plum/graphite werden in den Einstellungen **nicht mehr angeboten**. Ihr Wert bleibt gespeichert. Wer `ocean` hatte, sieht Iris.
- **Dunkel ist Standard** (Entscheidung 27.10.2026), bei leerem Speicher. Wer heute bewusst Hell oder Gedämpft gewählt hat, behält es (`theme.m` bleibt).
- **Schrift:** Inter mit `font-variation-settings: 'opsz' 32` für Überschriften, wenn die eingebettete Datei die Achse hat. Falls nicht, bleibt es beim heutigen Schnitt (kein neuer Download, Budget).
- **Form:** ein Radius `--r: 14px`, 8-px-Raster, eine Schattenstufe `--shadow`, **keine Glasflächen** (`backdrop-filter` wird überall entfernt, 15 Stellen).
- Es entstehen **keine neuen part-Dateien** außer den leeren Gerüsten `parts/shell.css` und `parts/band.css` für P2/P3.

**Pfade:** `src/styles/index.css`, neu `src/styles/bridge.css`, `src/styles/parts/*.css` (nur Literale → Tokens, Glas raus), `index.html` (Theme-Skript Z. 16–27), `src/app/settings.ts`, die Darstellungs-Einstellung in `src/features/settings/` (Akzent statt Palette), neue Teildatei `src/i18n/parts/theme.de.ts`/`.en.ts`, `tests/unit/contrast.test.ts`.

**Abnahme:** Kontrast A2 für 3 Modi × 2 Akzente; keine `backdrop-filter`-Fundstelle in `src/styles`; keine Farbliterale außerhalb der Token-Blöcke (neuer Lint-Test `tests/unit/noColorLiterals.test.ts`); Screenshots aller Hauptbildschirme in 3 Modi ohne unlesbare Stelle (ux-reviewer).

**Tests:** `contrast.test.ts` (erweitert), `noColorLiterals.test.ts` (neu), `settings.spec.ts` (Akzent wählen, Neuladen, bleibt), `shellColors`/`uxRules` laufen mit.
**verify-fast-map:** `src/styles/` → bereits `shellColors`/`uxRules` + smoke; ergänzen um `contrast`, `noColorLiterals`. `src/app/settings` → `settings`.
**Prüfer:** Nora (Veto Optik), ux-reviewer (G2), data-guard (`theme.a`).

---

#### P4 S1-ZEIT: Zeit je Versuch (`fk`/`ms`/`in`) · Größe M (~900 Zeilen)

Daten siehe Abschnitt 4. Hier nur Umfang und Pfade.

**Ist:** Die Zeit bis zum ersten Tastendruck wird gemessen, aber nicht gespeichert: `shownAt` (`src/features/vocab/ExerciseView.tsx:208/233`), `measure()` (Z. 291–296, Pausen für Nachschlagen und Begleiter herausgerechnet, Hören ab Tonende), `firstKey` (Z. 303), `firstKeyAt` gesetzt in Z. 778/844/934, `wasInterrupted` (Z. 323). Dasselbe in `GrammarItem.tsx:257` und `src/features/c1x/useC1Item.ts:163`. `AnswerEvent` (`src/domain/srs/types.ts:214–262`) hat `ms`, `dev?: 't'|'k'`, `interrupted?`, aber **kein `fk` und kein `in`**. Der Log hat bereits `ms` (`src/domain/progress/logPatch.ts:230–235`), `hist` nicht (`src/domain/srs/applyReview.ts:258`).

**Umfang:**
1. `AnswerEvent.fk?: number` und `AnswerEvent.in?: 't'|'d'|'c'`.
2. Neue reine Erkennung `src/engine/inputKind.ts`: `t` = getippt (Tastendruck vor dem Text), `d` = Diktat (Text kommt als `insertText`/`insertReplacementText` mit mehreren Zeichen auf einmal oder über `compositionend` ohne vorherigen `keydown`), `c` = Auswahl (Antippen, Bausteine, Mehrfachwahl). Gemischt zählt das stärkste Signal; `d` nur, wenn mindestens die Hälfte des Antworttexts ohne Taste kam. Grund: iOS-Wortvorschläge erzeugen einzelne Mehrzeichen-Einfügungen, die allein kein Diktat sind (Risiko R2).
3. `histEntry` (`applyReview.ts:258`) hängt `fk`, `ms`, `in` an; gerundet auf 10 ms, gedeckelt bei 600.000 ms. Nichts sonst an `histEntry` ändert sich.
4. Log: `logEntry` (`logPatch.ts:230`) bekommt `fk` und `in`; `ms` bleibt mit gleicher Bedeutung. Ebenso Grammatik- und Chunk-Einträge, `repair/review.ts:25`, `nbdrill/shared.tsx:114`. c1x behält `tm` (`src/domain/metrics/tempo.ts`) und bekommt `fk`/`in` zusätzlich.
5. Übergabe der Messwerte aus `ExerciseView.tsx`, `GrammarItem.tsx`, `useC1Item.ts`.
6. **Keine** Auswertung in Stufe 1. Die Zahlen werden nur gesammelt (Konzept 3.3: „aufgezeichnet ab Stufe 1“). `INTERRUPT_MS` bleibt.

**Pfade:** `src/domain/srs/types.ts`, `src/domain/srs/applyReview.ts`, `src/domain/progress/logPatch.ts`, `src/data/schemas.ts` (nur optionale Felder), neu `src/engine/inputKind.ts`, `src/features/vocab/ExerciseView.tsx`, `src/features/grammar/GrammarItem.tsx`, `src/features/c1x/useC1Item.ts`, `src/features/repair/review.ts`, `src/features/nbdrill/shared.tsx`, Seed des Rückweg-Tests.

**Abnahme:** jede Antwortart schreibt `fk`/`ms`/`in`; Kartengröße bleibt unter `MAX_CARD_BYTES` (`applyReview.ts:28`); Log bleibt unter `LOG_DOC_MAX_BYTES` (`logPatch.ts`); Rückweg-Test grün; learning-scientist bestätigt „keine Lernlogik verändert“ (Diff in `src/domain/grade`, `srs/queue`, `metrics` leer).

**Tests:** `tests/unit/inputKind.test.ts` (neu, mit iOS-Vorschlag, Diktat, Einfügen, Antippen), `tests/unit/histTiming.test.ts` (neu, Rundung, Deckel, Altbestand ohne Felder, `slice(-12)` bewahrt alte Einträge), `tests/unit/logTiming.test.ts` (neu, Größe bei 300 Einträgen), `tests/e2e/zeit.spec.ts` (neu, eine Übung tippen, in `hist` und Log nachsehen).
**verify-fast-map:** `src/engine/inputKind` → `zeit` + TRAINER; `src/domain/srs/applyReview`, `src/domain/progress/logPatch` → `zeit` + TRAINER + rueckweg.
**Prüfer:** data-guard, Tarek, learning-scientist.

---

#### P5 S1-ZAHL: Kennzahlen-Schicht vollständig · Größe M (~800 Zeilen)

Siehe Abschnitt 5. Umfang: alle Selbstrechnungen in `src/domain/metrics/` verlegen, `metrics.todaySummary()` neu (Quelle für Heute **und** später `app/today`), ESLint-Sperre erweitern, Golden-Test vorher/nachher.

**Pfade:** `src/domain/metrics/*` (neu `today.ts`-Erweiterung, `ring.ts`), `src/features/today/TodayScreen.tsx` (nur Z. 364–368 ersetzen), `src/ui/DayRing.tsx` (nur `dutyFills` Z. 29–36 nach metrics), `src/features/vocab/hub/data.ts` (Z. 42 über metrics), `src/features/grammar/GrammarScreen.tsx` (Z. 105/308), `src/features/progress/PathTab.tsx` (Z. 57), `eslint.config.*` (Z. 130–141), `tests/unit/archGuards.test.ts`, neu `tests/unit/metricsGolden.test.ts`.

**Abnahme:** A11; keine Funktion aus `domain/plan`, `domain/srs/queue` oder `topicP` wird mehr direkt aus `src/features/**/*Screen.tsx`, `PathTab.tsx`, `DayRing.tsx` oder `hub/data.ts` aufgerufen (Lint). Die Logik-Aufrufe von `topicP` (Abschnitt 5.2) bleiben, weil sie Lernlogik sind, nicht Anzeige.

**Tests:** `metricsGolden.test.ts` (wird **als erster Schritt** auf dem alten Stand aufgenommen und eingecheckt, dann erst umgebaut), `archGuards.test.ts` erweitert, `today.spec`/Fortschritt-Specs laufen mit.
**verify-fast-map:** `src/domain/metrics/` → `metricsGolden` + TODAY + GRAMMAR + VOCAB.
**Prüfer:** Tarek, learning-scientist (Zahlen bedeuten dasselbe).

---

#### P2 S1-SHELL: Rahmen für Handy, Rail und Laptop · Größe L (~2.200 Zeilen)

Siehe Abschnitt 6.2–6.5.

**Pfade:** `src/app/shell/**` **außer `Player.tsx`**, `src/app/shell/tabs.ts`, die Registry, `src/areas/*` (nur Zuordnung zu Reitern, keine Inhalte), `index.html` (Skelett `#lx-boot`), `src/styles/parts/shell.css`, neue Teildatei `src/i18n/parts/shell.*.ts`.

**Abnahme:** A3, A4, A5; Navigation je Breitenstufe wie Tabelle 6.2; in Übungen keine Leiste; Zahnrad nur auf Fortschritt; ein Symbol „Fragen“ im Kopf; Screenshots gegen H1, H6, H12, H13, H14, H15, H16, L1, L4, L5, L7, L8, L10.

**Tests:** `tests/e2e/rahmen.spec.ts` (neu: 5 Reiter, Seitenleiste ab 1280, Rail 600–1279, Praxis aufklappbar, Fragen-Blatt), `breiten.spec.ts` (neu), `erreichbar.spec.ts` (neu), bestehende Specs mit `tab-read` (2 Fundstellen) und `tab-apply` (1) auf den neuen Weg umstellen (Praxis → Lesen).
**verify-fast-map:** `src/app/shell/` → `rahmen`, `breiten`, `erreichbar` + smoke; `src/areas/` → `erreichbar` + smoke.
**Prüfer:** Nora (Veto), ux-reviewer.

---

#### P3 S1-BAND: Übungsrahmen mit Band · Größe L (~1.900 Zeilen)

Siehe Abschnitt 6.4.

**Pfade:** `src/ui/exercise/**` (vor allem `ExerciseShell.tsx`, 450 Zeilen), `src/ui/ActionBar.tsx` (109 Zeilen), `src/app/shell/Player.tsx` (Balken mit Abschnitten, Menü „…“), `src/styles/parts/band.css`, neu `src/i18n/parts/band.*.ts`, neu `scripts/audit-why-length.mjs`.

**Abnahme:** A8; ≤ 2 Nebenknöpfe; Hinweis-Runde einzeilig und ohne Rot; „Lösung gezeigt“ neutral; Zustand immer mit Symbol und Wort; Mehr-Blatt bis 85 %; Laptop-Knopfzeile T/W/⏎ und Kontextspalte; alle 17 Nutzer von `ExerciseShell` (Liste in 6.4) zeigen das Band, ohne dass ihr Inhalt umgebaut wird.

**Tests:** `tests/e2e/band.spec.ts` (neu: längste Rückmeldung auf 390 × 844, zusätzlich 390 × 700 als vorläufige Probe, bis Emrah am iPhone misst; Band scrollt nicht, verschwindet nicht von selbst; „…“-Menü enthält „Pause, später weiter“), `resultCard`, `trainerFeedback`, `grammarPatterns` laufen mit, `tests/unit/autoAdvance.test.ts` unverändert grün (`src/ui/exercise/autoAdvance.ts:20`).
**verify-fast-map:** `src/ui/exercise/` → bestehend `resultCard`/`trainerFeedback`/`grammarPatterns`, ergänzen um `band`; `src/app/shell/Player` → `band` + TRAINER.
**Prüfer:** Nora (Veto), ux-reviewer, learning-scientist (die vier Fragen stehen weiter an fester Stelle).

---

#### P6 S1-START: Startbild aus `app/today`, Boot ohne Warten · Größe L (~1.600 Zeilen)

Siehe Abschnitte 4.3 und 8.

**Ist:** `src/app/boot.ts:125`: `if (db === 'pending' || status !== 'ready' || !c1xReady) return 'loading';` Der ganze Bildschirm wartet auf alle Live-Abos (`src/data/live.ts:23` `LIVE_DOCS`) und den c1x-Vorlauf (`src/main.tsx:17` `startC1xPreload()`). `performance.mark('lx:status')` in `TodayScreen.tsx:324`. `PERF_NAMES = ['lx:boot','lx:live','lx:status','lx:card']` (`src/features/settings/perfMarks.ts:6`), eine Zeile „Knopf nach“ gibt es nicht.

**Umfang:**
1. Dokument `app/today` (Abschnitt 4.3) in `APP_DOCS` (`src/data/paths.ts:50`), Schema, Schreiben über `writer.ts`.
2. Boot holt zuerst `app/today` mit einem einzelnen `get` und zeichnet daraus Startbild und Knopf. Die großen Abos laufen danach weiter.
3. Kein globales `'loading'` mehr: `boot.ts:125` wird in „Rahmen bereit“ und „Bereich bereit“ getrennt. Jeder Bereich zeigt sein eigenes Skelett, bis seine Daten da sind. c1x lädt nach dem ersten Bild.
4. **Wartender Start:** Tippt Emrah den Knopf, bevor der Plan vollständig berechnet ist, öffnet sich sofort der Übungsrahmen mit Skelett und die erste Aufgabe startet automatisch. Der iPhone-Fokus muss im selben Tipp gesetzt werden (heute gelöst über `useStartUnit` synchron, `TodayScreen.tsx:151–159`). Das unsichtbare Eingabefeld wird im Tipp fokussiert und hält den Fokus, bis die Aufgabe steht.
5. Stimmt `app/today` nicht mit dem frisch berechneten Plan überein (z. B. anderer Tag oder anderes Gerät war schneller), gewinnt der berechnete Plan, das Bild wechselt ohne Springen (gleiche Höhe) und `app/today` wird aktualisiert.
6. Marken `lx:skeleton`, `lx:button`, `lx:first-task` und eine Diagnose-Zeile in den Einstellungen: „Knopf nach 1,4 s · erste Aufgabe nach 2,1 s“ (letzte 5 Starts aus `localStorage` `lx:perf`, nur Bequemlichkeit).

**Pfade:** `src/app/boot.ts`, `src/main.tsx`, `src/data/paths.ts`, `src/data/schemas.ts` (neues Schema), neu `src/data/todayDoc.ts`, `src/features/today/*` (Startbild), `src/features/settings/perfMarks.ts`, `SettingsSheet.tsx` (Diagnose-Zeile, Z. 233), Bereichs-Skelette.

**Abnahme:** Startbild erscheint aus `app/today`, bevor `lx:live` fällt (E2E mit absichtlich verzögerten Abos im Entwicklungs-Adapter); Knopf vor `lx:live` bedienbar; wartender Start öffnet die erste Aufgabe mit Tastatur am iPhone-Profil (WebKit-Projekt in Playwright); Diagnose-Zeile vorhanden; `app/today` wird nur geschrieben, wenn sich etwas geändert hat; Tageswechsel um 04:00 schreibt einen neuen Tag per `transform`.

**Tests:** `tests/unit/todayDoc.test.ts` (Ableitung, ≤ 2 KiB, ungültig → neu, Tageswechsel), `tests/e2e/start.spec.ts` (neu: verzögerte Abos, wartender Start, Fokus), `perf.spec.ts` (Marken), `rueckweg.spec.ts` (Seed mit `app/today`).
**verify-fast-map:** `src/app/boot`, `src/main` → `start`, `perf` + smoke; `src/data/todayDoc` → `start` + TODAY + rueckweg.
**Prüfer:** Tarek, data-guard, platform-guard (ein Abo je Abfrage, Vertrag `db.d.ts`).

---

#### P7 S1-DIKTAT: Laptop-Diktat-Probe · Größe S–M (~600 Zeilen)

Siehe Abschnitt 7.

**Pfade:** neu `src/features/settings/DictationProbe.tsx`, `src/features/settings/*` (Einstieg in der Diagnose), `src/data/schemas.ts` (`profile.dk`, optional), Hinweiszeile in der Übung (über das Band aus P3), `src/app/resume.ts` (nur Aufruf von `saveResume`, Z. 76), neu `src/i18n/parts/diktat.*.ts`.

**Abnahme:** Probe nur ab 1024 px mit Tastatur sichtbar (`useSplitLayout`, `src/platform/input.ts:41`); Ergebnis in `app/profile.dk`; Hinweiszeile tauscht nach Erfolg; beide Zeilen nie gleichzeitig; „Am Handy sprechen“ legt die Runde zurück wie „Pause, später weiter“.

**Tests:** `tests/unit/dictationProbe.test.ts` (Wortübereinstimmung, Sprache, ohne Taste), `tests/e2e/diktat.spec.ts` (Diktat simuliert über `insertText` ohne `keydown`).
**verify-fast-map:** `src/features/settings/DictationProbe` → `diktat` + `settings`.
**Prüfer:** Nora, data-guard.

---

#### P8 S1-LADEN-0: Ladeprobe · Größe S (~300 Zeilen, kein Produktcode)

**Ziel:** Vor dem großen Umbau in 1b einmal messen, was er bringt, und Safari mit nachgeladenen Stücken in claude.ai prüfen (Risiko R1).

**Umfang:** Probe-Build, in dem der Einstieg nur Rahmen + Heute + `app/today` enthält und alles andere als dynamischer Import hängt (ohne Umbau der Inhalte, mit einem Wegwerf-Zweig). Messung mit perf.spec (4×). Veröffentlichung auf dem Test-Link `AXHkh6…` als eigene Version; Emrah öffnet am iPhone Heute und danach den Reiter Wörter und schickt ein Foto der Diagnose-Zeile. Danach Test-Link zurück auf Test-Link 1a.

**Abnahme:** Messwert und iPhone-Ergebnis stehen in `docs/umbau/stand.md`. Bringt der Probe-Build den Knopf nicht unter 2,5 s, wird P9/P10 vor dem Start mit Tarek neu geschnitten (einzige erlaubte Neuplanung, weil echter Befund).

**Prüfer:** Tarek, platform-guard.

---

#### P9 S1-INHALT: Inhalte als `.bin` nachladen · Größe XL, geschnitten in 9a und 9b (je L, ~1.500 Zeilen)

**Ist:** Die größten statischen Inhalte werden direkt importiert und landen im Haupt-Skript:

| Datei | Größe | importiert in |
|---|---|---|
| `src/content/atlas/atlas.json` | 1,42 MB | `src/domain/atlas/atlas.ts` |
| `grammar/tasks-v2.json` | 1,32 MB | `src/domain/grammar/tasks.ts`, `raw.ts` |
| `grammar/pattern-map.json` | 0,63 MB | `src/domain/grammar/patternTypes.ts`, `patterns.ts`, `rules.ts` |
| `c1/order.json` | 0,39 MB | `src/domain/drills/orderPool.ts` |
| `pron/us-ipa.json` | 0,33 MB | `src/domain/lexicon/pron.ts` |
| `legacy/dict.json` | 0,29 MB | `src/domain/lexicon/dict.ts`, `src/domain/content.ts` |
| `c1/pack.json` | 0,28 MB | `src/domain/c1pack/pack.ts`, `packFields.ts` |
| `c1/toolkit.json` | 0,25 MB | `src/domain/c1pack/*` |
| `c1x/src/gate/k1.json` | 0,18 MB | c1x (schon heute als `.bin`, 13 Dateien je ≤ 41 KB) |

**Umfang:** Jede dieser Quellen bekommt eine asynchrone Ladefunktion (`await loadGrammarTasks()`), die eine `.bin`-Datei (Muster wie c1x, ≤ 500 KB je Datei) holt, prüft (zod) und im Speicher hält. Aufrufer werden auf „bereit / lädt / Fehler“ umgestellt; jeder Bereich zeigt ein Skelett und bei Fehler „Erneut laden“ (Knopf, keine Schleife, A6 CLAUDE.md). Synchrone Aufrufer in reiner Logik bekommen die Daten als Parameter statt über einen Import.
- **9a:** Grammatik (`tasks`, `raw`, `patternTypes`, `patterns`, `rules`), Muster.
- **9b:** Atlas, Lexikon (`unitKnown`, `pron`, `dict`), `content.ts`, C1-Pack, `orderPool`.

**Abnahme:** keine JSON über 50 KB mehr im Einstieg (Manifest-Prüfung); jeder Bereich funktioniert bei verzögertem und bei fehlgeschlagenem Laden; Zahlen unverändert (Golden-Test aus P5).
**Tests:** je Quelle ein Unit-Test für Laden/Prüfen/Fehler; `tests/e2e/nachladen.spec.ts` (neu: verzögerte `.bin`, fehlende `.bin` → „Erneut laden“).
**verify-fast-map:** `src/domain/grammar/` → GRAMMAR + `nachladen`; `src/domain/atlas/`, `src/domain/lexicon/`, `src/domain/c1pack/`, `src/domain/drills/` → VOCAB/C1X + `nachladen`.
**Prüfer:** Tarek, platform-guard, data-guard (nur gelesen, keine Daten, trotzdem Pflicht: Schemas).

---

#### P10 S1-SPLIT: Bereiche, Slots, Shells und Texte getrennt laden · Größe L (~1.400 Zeilen)

**Ist:**
- `src/areas/index.ts:16` lädt alle Bereiche (`system, heute, lernen, anwenden, wortschatz, readArea, sprechen, profil, training`) sofort.
- `src/app/registerAll.ts:3` lädt alle 14 Slot-Dateien sofort (`import.meta.glob(..., { eager: true })`).
- `src/i18n/index.ts` lädt `{ de, en }` synchron, zusammen ~435 KB Quelltext in 81 Teildateien.
- framer-motion steckt im Startpfad, `startC1xPreload()` in `src/main.tsx:17`.

**Umfang:**
1. Bereiche und Routen per `React.lazy`/dynamischem Import; nur Heute und der Rahmen bleiben im Einstieg.
2. Slots nicht mehr eager außer denen von Heute; die übrigen registrieren sich beim Laden ihres Bereichs.
3. `ShellPhone`, `ShellRail`, `ShellDesk` getrennt nachladen (Konzept 13.3); im Einstieg nur die Hülle der aktuellen Breite.
4. Texte: ein kleines Start-Wörterbuch (Heute, Rahmen, Fehlermeldungen) im Einstieg, der Rest je Sprache als eigenes Stück. Nur die aktive Sprache wird geladen.
5. framer-motion aus dem Startbild (CSS-Übergänge im Startbild, Motion lädt mit dem ersten Bereich).
6. c1x-Vorlauf nach dem ersten Bild (`requestIdleCallback` mit Rückfall).
7. perf.spec mit den neuen Grenzen (A1, A10); Budget-Tor auf die Endwerte (A9).

**Abnahme:** A1, A9, A10 grün; Wechsel in jeden Reiter < 300 ms nach dem ersten Laden, beim allerersten Öffnen mit Skelett.
**Tests:** `perf.spec.ts` (neue Grenzen), `tests/e2e/lazy.spec.ts` (neu: jeder Reiter lädt, Sprachwechsel lädt die andere Sprache), smoke.
**verify-fast-map:** `src/areas/`, `src/app/registerAll`, `src/i18n/index` → `lazy`, `perf` + smoke.
**Prüfer:** Tarek, platform-guard, Nora (Skelette sehen ruhig aus).

---

## 4. Daten (Tarek)

### 4.1 Grenzen aus dem Vertrag

`contract/db.d.ts`: 256 KiB je Dokument (Z. 76, 418), 5.000 Dokumente (Z. 419), 64 Abos je Ansicht (Z. 81, 388), `limit` 1–1000 (Z. 376), Pfad ≤ 1000 Byte und ≤ 16 Segmente (Z. 149). Stufe 1 legt **genau ein** neues Dokument an (`app/today`) und **kein** neues Abo (P6 holt es per `get`, das bestehende Abo auf `app/*` bleibt).

### 4.2 Zeit je Versuch

| Ort | Feld | Typ | Bedeutung |
|---|---|---|---|
| `vocab/<id>.hist[]` | `fk` | Zahl, ms, gerundet auf 10, ≤ 600.000 | Zeit vom Zeigen der Aufgabe (Hören: ab Tonende) bis zum ersten Tastendruck oder ersten Antippen; Pausen für Nachschlagen und Begleiter herausgerechnet (gleiche Regel wie `measure()`, `ExerciseView.tsx:291–296`) |
| `vocab/<id>.hist[]` | `ms` | dito | Zeit bis Senden; gleiche Bedeutung wie `ms` im Log (`logPatch.ts:230–235`) |
| `vocab/<id>.hist[]` | `in` | `'t'|'d'|'c'` | getippt, diktiert, ausgewählt |
| Log-Einträge (`logPatch.ts`, Vokabel, Chunk, Grammatik, Reparatur, NB-Drill, c1x) | `fk`, `in` | wie oben | `ms` gibt es bereits |

- **Größe:** ~25 Byte je Versuch. `hist` hat höchstens 12 Einträge (`HIST_MAX`, `applyReview.ts:27`), also ≤ 300 Byte je Karte zusätzlich; Kartengrenze `MAX_CARD_BYTES = 64 KiB` (Z. 28). Log: 300 Einträge (`LOG_ENTRIES_MAX`, `logPatch.ts:12`) × ~20 Byte = ~6 KB bei `LOG_DOC_MAX_BYTES = 240 KiB`. Unkritisch.
- **Schema:** `cardPatchSchema.hist` ist `z.array(z.looseObject({ t: z.number(), g: z.number().optional() })).max(HIST_MAX)` (`applyReview.ts:53/86/310`). `fk`/`ms`/`in` werden als `.optional()` ergänzt (zod 4, CLAUDE.md A6 Nr. 16). Im Log (`schemas.ts`, `logSchema` ab Z. 444) ebenso optional. Kein bestehendes Feld wird Pflicht.
- **Schreibweg:** ausschließlich über `writer.ts` wie heute (`persist.ts:140` `pushEntry(logEntry(a), a.day)`, Karten über `applyReview`). Kein neuer Schreibpfad.
- **known-Einträge** (`src/domain/srs/vocabList.ts:165/179`, `{t, m:'known', g:3}`) bekommen keine Zeitfelder.

### 4.3 `app/today`

```
app/today = {
  v: 1,                      // Form-Version
  d: "2026-10-28",           // Lerntag (Wechsel 04:00)
  th: { k, id, nm: {de, en} },// Thema des Tages (Art, Kennung, Name zweisprachig)
  b: { b1…b6: { st, n, of } },// Blöcke: Status, erledigt, von
  rest: 12,                  // Minuten Pflicht übrig (aus metrics.todaySummary)
  ring: 0.42,                // Füllung des Tagesrings (aus metrics, ≤ 0,95 wie DayRing)
  go: { k, id },             // Ziel des Startknopfs
  at: 1793140000000          // zuletzt geschrieben
  // bt: reserviert für Stufe 4 (Blockzeiten), in Stufe 1 nicht geschrieben
}
```

- **Abgeleitet und ersetzbar:** Quelle bleibt `app/profile.plan` und `app/profile.pflicht`. `app/today` ist ein Abbild für den schnellen Start. Bei ungültigem Inhalt wird es per `transform` neu geschrieben (Eintrag in `REPLACEABLE`, `writer.ts:85`, neben `app/lookup`).
- **Größe:** ≤ 2 KiB (Test).
- **Schreiben:** nur wenn sich der Inhalt geändert hat (Vergleich ohne `at`), über `writer.update`; Tageswechsel über `writer.transform`.
- **Schema:** `looseObject`, alle Felder außer `v` und `d` optional.
- **Rückweg:** v86 kennt `app/today` nicht und liest es nie (nicht in `APP_DOCS` von v86, `paths.ts:50`). Unschädlich.

### 4.4 Weitere neue Felder

- `app/profile.theme.a`: `'iris'|'amber'` (P1). `theme` ist im `profileSchema` ein `looseObject` (`schemas.ts` ab Z. 122), v86 übergeht es.
- `app/profile.dk`: `{ v: 1, mac?: { ok, t, sig }, win?: { ok, t, sig } }`, < 200 Byte (P7). `profileSchema` ist `looseObject`, v86 übergeht es. `sig` ist ein kurzer Kennwert des Browsers (Betriebssystem und Browsername aus `navigator.userAgentData` oder `userAgent`, keine Gerätekennung), damit ein Erfolg am Mac nicht für Windows gilt.

### 4.5 Was data-guard prüft (G3)

1. Jedes neue Feld ist optional; kein bestehendes Feld ändert Typ oder Bedeutung (Diff von `schemas.ts`).
2. Alle Schreibvorgänge laufen über `writer.ts` (Lint-Regel besteht).
3. `app/today` ≤ 2 KiB, in `APP_DOCS`, kein eigenes Abo, wird nur bei Änderung geschrieben (Unit-Test zählt Schreibvorgänge bei 10 Neuzeichnungen = 0).
4. Karten- und Loggrößen mit dem Großdatensatz (Seed × 10) unter den Grenzen.
5. Dokumentenzahl: +1.
6. Seed (`seed/sample-data.json`) bleibt unverändert; neue Felder nur im Rückweg-Seed `tests/fixtures/s1-seed.json` (erfunden).
7. Rückweg-Test grün.

### 4.6 Rückweg-Test

- **Unit:** `tests/unit/rueckwegSchema.test.ts` liest einen Datenstand mit allen neuen Feldern mit den Schemas von v86 (aus `git show 3377252:src/data/schemas.ts` und `3377252:src/domain/srs/applyReview.ts` in ein Testverzeichnis geholt) und prüft: alles gültig, `fk`/`ms`/`in` überleben einen Review durch v86 (v86 hängt per `[...hist, histEntry(...)].slice(-HIST_MAX)` an, `applyReview.ts:328/365/400`, alte Einträge bleiben als Objekte unverändert).
- **E2E:** `rueckweg.spec.ts` (P0) startet die v86-Datei gegen den Seed, macht eine Wörter-Übung, prüft Serie und Heute.
- **Probe auf dem Test-Link** (einmal in 1a, Abschnitt 9): Test-Link mit 1a-Stand üben lassen, dann v86 als Einzeldatei auf denselben Test-Link veröffentlichen (mit `null` für alle Mehr-Datei-Dateien), öffnen, prüfen, wieder 1a veröffentlichen.

---

## 5. Kennzahlen-Schicht

### 5.1 Wo sie liegt

`src/domain/metrics/` mit 16 Modulen (index, today, vocab, grammar, streak, cardStatus, definitions, effect, goals, groups, pattern, round, tempo, tests, c1, wordKern; zusammen 2.003 Zeilen). Geschützt durch ESLint (`eslint.config` Z. 130–141: `buildTrainCards`, `computeStreak` nur über metrics) und `tests/unit/archGuards.test.ts` (Z. 20–36).

### 5.2 Wer heute noch selbst rechnet

| Fundstelle | Was | Umstellung in P5 |
|---|---|---|
| `src/features/today/TodayScreen.tsx:364–368` | `minLeft` über `minutesLeft(unitRows(...))` bzw. `rows.filter…reduce` und `dutyMinutes(plan)` | ersetzt durch `metrics.todaySummary().rest`; heute gibt es parallel `metrics/today.ts:104 dayLeft`, also zwei Wege. Der Golden-Test zeigt, ob beide gleich rechnen. Weichen sie ab, gilt der Wert, den der Bildschirm **heute anzeigt** (keine Zahlenänderung), und `dayLeft` wird angeglichen |
| `src/ui/DayRing.tsx:29–36` | `dutyFills` (Füllung ≤ 0,95) | nach `metrics/ring.ts`, DayRing bekommt nur noch die Zahl |
| `src/features/vocab/hub/data.ts:42` | `newQuotaLeft` aus `domain/srs/queue` | über `metrics.vocab` |
| `src/features/grammar/GrammarScreen.tsx:105` (Anzeige 308) | `topicP` | über `metrics.grammar.topicShown()` |
| `src/features/progress/PathTab.tsx:57` | `topicP` | dito |
| `GrammarItem.tsx:157–158`, `c1x/useC1Item.ts:107`, `c1x/resolve.ts:36`, `drills/session.ts:224`, `grammar/generate.ts:84` | `topicP` in Lernlogik | **bleiben**, denn das ist Lernlogik, keine Anzeige (Lernlogik ist in Stufe 1 tabu) |

Dazu der Befund von Kai: vier widersprüchliche Zahlen auf Fortschritt (`docs/relaunch/recherche/kai-ist-bewertung.md:241–246`). P5 klärt in einer Liste, welche Zahl woher kommt. Behoben wird der Widerspruch **nicht** in Stufe 1, denn das wäre eine Zahlenänderung. Die Liste geht an Stufe 2 (Fortschritt neu).

### 5.3 Umstellung ohne Zahlenänderung

1. **Zuerst** `metricsGolden.test.ts` auf dem unveränderten Stand aufnehmen: Seed, Großdatensatz und 30 simulierte Tage (fester Stichtag, `TZ=Europe/Berlin`). Festgehalten werden alle angezeigten Zahlen (Heute: Rest, Ring, Blockzähler; Wörter: fällig, neu übrig, Stufen; Grammatik: Themenstand; Fortschritt: alle Kacheln).
2. Golden-Datei einchecken (eigener erster Commit im Paket).
3. Umbau. Der Golden-Test muss unverändert grün bleiben. Eine Abweichung ist ein Fehler, keine Anpassung.
4. ESLint-Sperre erweitern: `minutesLeft`, `dutyMinutes`, `dutyFills`, `newQuotaLeft`, `topicP` dürfen aus `src/features/**/*Screen.tsx`, `src/features/progress/**`, `src/features/vocab/hub/**` und `src/ui/**` nicht importiert werden.

### 5.4 Budget-Tor

- **Was:** gepackte Größe (gzip) jedes Stücks laut Vite-Manifest, Zahl der Dateien, Gesamtgröße.
- **Wo:** `scripts/check-budget.mjs` mit `scripts/budget.json`, aufgerufen in `verify` und `verify:fast` (P0).
- **Grenzen 1a (Sperrklinke):** heutige Werte + 2 %. **Grenzen 1b (Ziel, Konzept 14.2):** Einstieg ≤ 300 KB, je Bereich ≤ 150 KB, je `.bin` ≤ 500 KB, CSS ≤ 30 KB, < 100 Dateien; Warnung ab 9 MB gesamt.
- **Prüfung des Tors selbst:** Unit-Test mit einem künstlichen Manifest (zu groß → Fehlercode 1, passend → 0).
- **Laufzeit-Seite:** Diagnose-Zeile „Knopf nach x,x s“ (P6). perf.spec misst auf dem Rechner, Emrah am iPhone.

---

## 6. Design (Nora)

### 6.1 Token-Übernahme

| Vorschau (`style.css`) | App (`src/styles/index.css`) | Bemerkung |
|---|---|---|
| bare `:root` (Dunkel) | `:root[data-theme='dark']` und Standard | Dunkel ist Standard (Entscheidung 27.10.2026) |
| `[data-mode="muted"]` | `:root[data-theme='dim']` | Name bleibt `dim` |
| `[data-mode="light"]` | `:root[data-theme='light']` | |
| `--act` `oklch(0.6 0.16 275)` | `--act` `oklch(0.62 0.16 275)` | Iris; Wert laut Konzept Kap. 12, im Kontrasttest belegt |
| `[data-accent="amber"]` | `:root[data-accent='amber']` | zweiter Akzent |
| `--bg, --bg-deep, --surface(-2/-3), --line(-2), --fg(-2/-3), --act-fg, --act-text, --act-soft, --ok, --near, --bad, --ch-words/gram/listen/speak, --mark, --kb*, --scrim, --shadow, --r, --ease-spring, --ease-soft` | gleiche Namen | neue Quelle |
| – | `--lx-*`, `--color-*` | Brücke in `bridge.css` auf die neuen Namen |
| Tailwind `@theme inline` (`index.css:268`) | zeigt auf die neuen Namen | Klassen wie `bg-surface` bleiben gültig |

Zustandsfarben immer mit Symbol und Wort (`--ok` ✓ „Richtig“, `--near` ≈ „Fast“, `--bad` ✗ „Noch nicht“); „Lösung gezeigt“ ist neutral (`--fg-2`), nie rot.

### 6.2 Rahmen und Breitenstufen (Konzept 13.2)

| Breite | Navigation | Bühne | Kontext | Hülle |
|---|---|---|---|---|
| ≤ 599 px | 5 Reiter unten | volle Breite, 16 px Rand | Band unten | `ShellPhone` |
| 600–1023 px | Rail links (4,75 em, Vorschau `style.css:465`) | ≤ 720 px | Blatt | `ShellRail` |
| 1024–1279 px | Rail | 600–680 px | Spalte 320 px | `ShellRail` |
| ≥ 1280 px | Seitenleiste 232 px (14,5 em, `style.css:464`) | 640–720 px | Spalte 360–420 px | `ShellDesk` |
| ≥ 1920 px | Seitenleiste | ≤ 800 px | ≤ 440 px | `ShellDesk` |

- Grundschrift 16 px, **18 px ab 1920**, **20 px ab 2400**; alle Maße in rem, damit alles mitwächst.
- Heute begrenzt `src/app/shell/Shell.tsx:124` mit `max-w-[76rem] px-4 sm:px-6 lg:px-10`. Das wird durch das Raster aus Navigation, Bühne und Kontextspalte ersetzt.
- In 1a liegen die drei Hüllen noch im Einstieg; getrennt geladen werden sie in P10.

### 6.3 Reiter und Laptop-Seitenleiste (Konzept 13.1, 13.3)

- **5 Reiter:** Heute · Wörter · Grammatik · Praxis · Fortschritt.
- Heute gibt es 6 Reiter (`src/app/shell/tabs.ts:39–46`: today, vocab, learn, apply, read, progress). Zuordnung: today → Heute, vocab → Wörter, learn → Grammatik, apply + read + Sprechen → **Praxis** (Test-ID `tab-apply` bleibt, Beschriftung „Praxis“), progress → Fortschritt. Lesen ist unter Praxis erreichbar (Kachel und am Laptop als aufklappbarer Eintrag).
- **Kopf:** ein Symbol „Fragen“ (öffnet das Blatt Fragen, Vorschau H15). Zahnrad **nur** auf Fortschritt.
- **Laptop-Seitenleiste:** Heute, Wörter, Grammatik, Praxis (aufklappbar: Sprechen, Hören, Lesen), Fortschritt; unten Claude, Übersetzer, Einstellungen. Kontextspalte rechts (Claude, Wort-Details, Erklärungen).
- **In Übungen keine Leiste** (Handy: nur Schließen und Balken oben, Rest hinter „…“).

### 6.4 Übungsrahmen mit Band (Konzept 12.1)

- **Balken** oben mit Abschnitten (einer je Block), im `Player.tsx`.
- **Band** unten nach dem Prüfen, drei Zeilen: (1) Zustand mit Symbol und Wort, (2) „Was ist richtig“, (3) „Warum“ (≤ 120 Zeichen Ziel). Höhe ≤ 45 %, scrollt nicht, verschwindet nicht von selbst; Einblenden 220 ms (Vorschau `style.css:275`).
- **≤ 2 Nebenknöpfe** im Band (z. B. „Mehr“ und „Claude fragen“), der Hauptknopf „Weiter“.
- **Mehr-Blatt** bis 85 % Höhe (Eselsbrücke, Satzübersetzung, ausführliche Erklärung), Blätter ~500 ms mit Bounce 0,1.
- **Hinweis-Runde** einzeilig, ohne Rot (Vorschau `hintband`, `style.css:293`).
- **Handy oben:** nur Schließen und Balken; alles andere hinter „…“ (dort auch „Pause, später weiter“, Entscheidung 27.10.2026).
- **Laptop:** Knopfzeile mit Tastenhinweisen T (Tipp), W (Wort nachschlagen), ⏎ (Weiter); Kontextspalte statt Mehr-Blatt.
- **Warum-Länge:** Heute erlaubt `src/domain/explain/types.ts` 140 Zeichen (`WhyRule.de/en`). Stufe 1 ändert keine Inhalte. Deshalb bleibt die Grenze 140, das Band ist für 140 Zeichen gebaut, und `scripts/audit-why-length.mjs` listet alle Texte über 120 Zeichen für James' Inhaltsstrang (kein Kürzen in Stufe 1).
- **Eingabe-Attribute vereinheitlicht** wie in `src/ui/exercise/SentenceInput.tsx:13` (`lang:'en'`, `autoCapitalize:'off'`, `autoCorrect:'off'`, `autoComplete:'off'`, `spellCheck:false`, `enterKeyHint:'go'`), auch für `src/engine/HiddenInput.tsx:140`.
- **Einbau an einer Stelle:** `src/ui/exercise/ExerciseShell.tsx` ist das eine Gerüst (Slot-Reihenfolge Kommentar Z. 27–31). Es wird genutzt von 17 Dateien: `patterns/FreeItem`, `vocab/anki/FlipCard`, `vocab/ExerciseView`, `IntroCard`, `WerkstattCard`, `pressure/PressureScreen`, `grammar/focus/FocusItem`, `GrammarItem`, `apply/ListenQuestion`, `ComboSentence`, `repair/FkItem`, `RepairItem`, `c1x/ResultCard`, `useC1Item`, `C1Item`, `nbdrill/NbDrillScreen`, `drills/DrillItems`. Damit bekommen alle Übungen das Band, ohne dass ihr Inhalt neu gebaut wird.
- Die vier Fragen (Kap. 2 Nr. 4) bleiben an fester Stelle: Was tun = Aufgabenzeile, Wozu = Zeile unter dem Balken bzw. „…“ → „Warum diese Aufgabe“, Was hatte ich/was ist richtig = Band Zeile 1–2, Warum = Band Zeile 3, auch bei richtiger Antwort.

### 6.5 Bestehende Bildschirme in den Rahmen

Nichts wird inhaltlich neu gebaut. Jeder Bildschirm bekommt nur die neue Hülle und die neuen Tokens.

| Heute | Neu |
|---|---|
| Reiter Heute | Reiter Heute, Startbild aus `app/today` (P6) |
| Reiter Wörter | Reiter Wörter |
| Reiter Lernen (Grammatik, Kurs) | Reiter Grammatik |
| Reiter Anwenden | Praxis (oben) |
| Reiter Lesen | Praxis → Lesen |
| Sprechen (Bereich `sprechen`) | Praxis → Sprechen |
| Reiter Fortschritt | Fortschritt, mit Zahnrad → Einstellungen |
| Claude, Übersetzer (heute über Kopf bzw. Blätter) | Handy: Blatt „Fragen“ im Kopf; Laptop: Seitenleiste unten und Kontextspalte |
| Einstellungen (Zahnrad im Kopf) | Zahnrad auf Fortschritt, Laptop: Seitenleiste unten |

### 6.6 Verbotene Muster

- Glasflächen (`backdrop-filter`), mehrere Schattenstufen, mehrere Radien.
- Farbliterale außerhalb der Token-Blöcke.
- **Mischschichten:** keine neuen Regeln in den 17 alten part-Dateien, die die neuen Tokens überstimmen. Die alten Dateien fallen „mit ihren Bildschirmen“ weg (Konzept Kap. 12), in Stufe 1 werden sie nur auf Tokens umgestellt.
- Zustand nur über Farbe; Rot für „Lösung gezeigt“ oder für Hinweise.
- Mehr als ein Hauptknopf je Bildschirm; konkurrierende Karten auf Heute.
- Leiste in Übungen; Zahnrad außerhalb von Fortschritt.
- Querscrollen; feste Pixelbreiten über 390 px auf dem Handy.
- Ziele unter 44 pt.
- Bewegung ohne `prefers-reduced-motion`-Rückfall.

### 6.7 Vergleichsliste für den ux-reviewer (G2)

Screenshots bei 390 × 844 und 1440 × 900, in Dunkel, Gedämpft und Hell, gegen die Vorschau `WBft3EEx7jYYv4QHdepuNm` v2 (Quelle `docs/relaunch/vorschau/src/screens.js` bzw. `desk.js`):

| App-Bildschirm | Vorschau Handy | Vorschau Laptop | Achten auf |
|---|---|---|---|
| Heute | H1 (`screens.js:180`) | L1 (`desk.js:137`) | ein Knopf, Ring, Blöcke, Pflicht/Extra getrennt |
| Wörter-Übung | H2 (256), H3 Blockwechsel (282) | L2 (166) | Band, Balken, „…“ |
| Grammatik-Übung | H4 (342), H5 Erklärung (411) | L3 (230) | Band, Mehr-Blatt bzw. Kontextspalte |
| Reiter Grammatik | H6 (469) | L4 (239) | Rahmen, Abstände |
| Reiter Wörter | H12 (892) | L5 (288) | Rahmen |
| Reiter Praxis | H13 (921) | Seitenleiste aufgeklappt | Lesen und Sprechen erreichbar |
| Reiter Fortschritt | H14 (985) | L8 (369) | Zahnrad nur hier |
| Blatt Fragen | H15 (1013) | L7 Claude in der Kontextspalte (346) | |
| Ausfälle, Fehlerzustände | H16 (1042) | – | ruhig, mit „Erneut versuchen“ |
| Breitenproben | – | L10 (424) | 1024, 1280, 1920, 2560 |

**Nicht** Teil des Vergleichs in Stufe 1 (die Inhalte kommen in späteren Stufen): H7–H11, H17–H37, L6, L9, L11–L17 (Liste `docs/relaunch/vorschau/bauliste.md`). Abweichungen dort sind kein Befund.

Bewertet wird Rahmen, Farben, Abstände, Schrift und Band, **nicht** der Inhalt der Bildschirme.

---

## 7. Laptop-Diktat-Probe (Konzept 6.1, Kai-N N4)

### 7.1 Ablauf in der App

- Ort: Einstellungen → Diagnose → „Diktat am Laptop prüfen“. Nur sichtbar ab 1024 px und mit Tastatur.
- Die App zeigt einen Zielsatz, z. B. „I'll send you the revised quote by Friday.“, und ein Eingabefeld mit den Attributen aus 6.4.
- **Erfolg:** ≥ 70 % Wortübereinstimmung mit dem Zielsatz, der Text ist Englisch (Wörter im Wörterbuch) und kam ohne Tastendruck (`in = 'd'`, Erkennung aus P4).
- **Ergebnis** in `app/profile.dk.<mac|win> = { ok, t, sig }`.
- **Hinweiszeile in Übungen** (Laptop): Ohne Erfolg steht „Am Laptop tippst du deine Antworten. Gesprochen wird am Handy.“ Nach Erfolg steht stattdessen „Mac: Diktier- oder Globus-Taste zweimal drücken · Windows: Win + H“. Beide stehen nie gleichzeitig da.
- **„Am Handy sprechen“**: Nebenknopf beim Pflicht-Sprechschritt (`ch:say`, `src/domain/learn/types.ts:13`). Er wirkt wie „Pause, später weiter“: Die Runde wird über `saveResume` (`src/app/resume.ts:76`) gesichert und erscheint am Handy auf Heute als „Runde fortsetzen“.
- `in` wird **immer** ehrlich aufgezeichnet. Ob getippte oder diktierte Antworten am Laptop für F1 (Sprechen) zählen, entscheidet Stufe 4: Dann zählt `in:'d'` mit `dev:'k'` nur bei `dk.<os>.ok`. In Stufe 1 zählt nichts davon für F1.

### 7.2 Emrahs Klickschritte (nach Test-Link 1a)

**Mac (Safari oder Chrome):**
1. Am Mac den Test-Link in claude.ai öffnen.
2. Unten links auf „Fortschritt“, dann oben rechts auf das Zahnrad.
3. „Diagnose“ antippen, dann „Diktat am Laptop prüfen“.
4. In das Feld klicken. Die Diktier-Taste (Mikrofon, F5) oder zweimal die Globus-/fn-Taste drücken.
5. Erscheint „Diktat ist ausgeschaltet“: Systemeinstellungen → Tastatur → Diktat einschalten, Sprache „English (US)“ hinzufügen. Danach Schritt 4 wiederholen.
6. Den Satz auf dem Bildschirm vorlesen, dann noch einmal die Taste drücken.

**Windows (Edge oder Chrome):**
1. Am Laptop den Test-Link in claude.ai öffnen.
2. Wie oben bis zum Feld.
3. Windows-Taste + H drücken. Erscheint ein Hinweis zur Sprache: Einstellungen → Zeit und Sprache → Sprache → „English (United States)“ hinzufügen.
4. Den Satz vorlesen.

### 7.3 Erfolg und Misserfolg

- **Erfolg:** Die App zeigt „✓ Diktat funktioniert“ und die Hinweiszeile in den Übungen wechselt. Emrah schickt ein Foto des Ergebnisses.
- **Misserfolg** (kein Text, deutscher Text, falsche Wörter oder Text, der als getippt erkannt wird): Die App zeigt „Diktat hat nicht geklappt“ und den Grund in der Diagnose (z. B. „Text kam mit Tastendrücken“, „Text nicht Englisch“). Die alte Zeile bleibt. Emrah schickt ein Foto. Es gibt **einen** zweiten Versuch auf Emrahs Wunsch, danach keine Schleife; der Befund geht an Tarek (Risiko R2).

---

## 8. Tempo

### 8.1 Ausgangslage

- perf.spec erlaubt heute `CPU_LIMIT_MS = {1:2500, 4:14000}` bzw. `{1:4000, 4:18000}` (`tests/e2e/perf.spec.ts:103`, geprüft Z. 127). Der Knopf kommt bei 4× nach ~4–5,5 s (Masterplan 9,5, Stand 27.10.2026). Die Einzeldatei hat 5,96 von 6 MiB.
- **Messbuild Mehr-Datei** (`LX_BUILD=multi`, im Scratchpad gebaut, Code unverändert): Haupt-JS `index-*.js` 5.642.288 B roh, **2.744.021 B gzip**; CSS 129 KB roh, 25 KB gzip; Inter-woff2 73 KB; nur drei kleine Lazy-Stücke (FilmPlayer 10,6 KB, WordSky 8,2 KB, particles 2,7 KB) und 13 c1x-`.bin` je ≤ 41 KB.
- Der Einstieg ist damit **~9× größer** als das Ziel von 300 KB.
- **Ursachen:** Alle Bereiche und Slots werden sofort geladen (`src/areas/index.ts:16`, `src/app/registerAll.ts:3`); alle großen Inhalte stecken im Haupt-Skript (Tabelle in P9); beide Sprachen werden synchron geladen (`src/i18n/index.ts`); der Bildschirm wartet auf alle Abos und c1x (`src/app/boot.ts:125`, `src/main.tsx:17`); Heute rechnet über alle Karten (Tarek 3.1).

### 8.2 Beitrag der einzelnen Schritte (Schätzung, belegt erst durch P8)

| Schritt | Paket | erwarteter Gewinn bei 4× |
|---|---|---|
| Mehr-Datei (kein base64, paralleles Laden, Zwischenspeicher) | P0 | 15–30 % |
| Startbild aus `app/today`, kein Warten auf alle Abos und c1x | P6 | 0,8–1,5 s |
| Inhalte als `.bin` | P9 | größter Anteil am Parsen: ~4,7 MB JSON fallen aus dem Einstieg |
| Bereiche, Slots, Shells, Texte getrennt | P10 | Einstieg auf ≤ 300 KB |

Nach 1a ist der Start spürbar schneller (P0, P6), das Ziel < 2 s erreicht erst 1b. Das wird Emrah beim Test-Link 1a so gesagt.

### 8.3 Messung

- **Rechner:** `perf.spec.ts`, 4× CPU-Drosselung, Median aus 5 Läufen in einem Testlauf, perf läuft zuletzt und allein (Arbeitsweise G4). Marken `lx:skeleton`, `lx:button`, `lx:first-task` (P6).
- **iPhone:** Diagnose-Zeile „Knopf nach x,x s · erste Aufgabe nach x,x s“ in den Einstellungen (P6). Emrah schickt nach Test-Link 1a und 1b je ein Foto (Entscheidung 27.10.2026: Höhe und Startzeit misst Emrah nach Stufe 1 am iPhone).

---

## 9. Prüftore G0–G4 (Arbeitsweise `docs/umbau/arbeitsweise.md:38–42`)

| Tor | Wann | Was konkret | Wer |
|---|---|---|---|
| **G0** | je Paket vor dem Zusammenführen | `npm run verify:fast` (mit den Einträgen aus `verify-fast-map.mjs`), `typecheck`, `lint`, `check-budget`, `check:platform` | Paket-Agent, Hauptsitzung prüft das Protokoll |
| **G1** | je Test-Link | english-teacher liest nur die **neuen** englischen Oberflächentexte (Teildateien `shell`, `band`, `theme`, `diktat`, ~60 Schlüssel) und den Diktat-Zielsatz; learning-scientist bestätigt, dass `src/domain/grade`, `srs/queue`, `plan` und die Quoten unverändert sind und die vier Fragen an fester Stelle stehen | english-teacher, learning-scientist |
| **G2** | je Test-Link | ux-reviewer (Opus) mit der Vergleichsliste 6.7, 390/1440, drei Modi, beide Akzente auf Heute; Noras Veto | ux-reviewer, Nora |
| **G3** | je Test-Link | data-guard (Liste 4.5, betrifft P1, P4, P6, P7, P9); `check:platform`; platform-guard (Mehr-Datei, Budget, keine externen Anfragen, jeder `claude.use`-Aufruf nach `contract/`, kein Entwicklungs-Adapter, < 255 Dateien) | data-guard, platform-guard |
| **G4** | einmal je Test-Link | volles `npm run verify` (~53 Min.), perf zuletzt und allein; Pflichtfeld `nicht_gelaufen` im Bericht | qa-runner |

**Test-Link:** `AXHkh6…` (zuletzt v73 `1793078154-eb7e`) mit Emrahs Datenkopie, Fähigkeiten `db`, `sample`, `downloads`. Vor dem Veröffentlichen die aktuelle Version lesen und notieren. Veröffentlicht werden alle Dateien aus `dist/` über `files`, Dateien der Vorversion, die es nicht mehr gibt, werden mit `null` entfernt.

**Rückweg-Probe (einmal, nach G4 von 1a):** v86 als Einzeldatei auf den Test-Link, öffnen (Heute, Wörter, eine Übung), Version notieren, dann wieder 1a. Ergebnis in `docs/umbau/stand.md`.

**Live (`JLL8…`):** nur nach Emrahs ausdrücklichem „Ja live nehmen“. Vorher die Live-Version lesen (heute v86 `1793087421-695a`) und als Rückweg notieren. Nie über die laufende App veröffentlichen, um etwas zu zeigen.

**Bericht an Emrah je Test-Link** (CLAUDE.md A2): was geändert ist (in Alltagssprache), wie er es am Handy testet (genaue Klicks), woran er erkennt, dass es stimmt, und was er schicken soll, wenn nicht. Für 1a zusätzlich: Diagnose-Foto „Knopf nach“, Laptop-Diktat-Probe (7.2), Höhe des Bands am iPhone (Foto einer langen Rückmeldung).

**Vor Stufe 1 anzupassen (Hauptsitzung):** CLAUDE.md A1 („Standard eine HTML-Datei“) und A3 Nr. 2 („Genau eine Datei `dist/index.html`“) widersprechen Entscheidung 1 (Mehr-Datei als Standard). Vorschlag: „`dist/` mit `index.html` und den Stücken, `build:single` als Rückfall.“ Ebenso A8 (`npm run build` → genau eine Datei).

---

## 10. Risiken und Gegenmaßnahmen

| Nr. | Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|---|
| R1 | Safari am iPhone lädt nachgeladene Stücke in claude.ai nicht zuverlässig (belegt sind Module und fetch, aber nicht diese Dateianordnung, `docs/umbau/mehr-datei.md:3, 81`) | 1b startet nicht | P8 prüft genau das am iPhone, bevor P9/P10 beginnen; `build:single` bleibt als Rückfall |
| R2 | iOS-Wortvorschläge oder Einfügen erzeugen ein falsches `in = 'd'` | falsche Daten für Stufe 4 | Hälfte-Regel in `inputKind.ts`; Tests mit Vorschlag/Einfügen; Stufe 1 wertet `in` nicht aus |
| R3 | Fokus geht beim wartenden Start am iPhone verloren | Tastatur kommt nicht, Emrah muss nochmal tippen | Fokus im selben Tipp auf ein bestehendes Feld (Muster `useStartUnit`, `TodayScreen.tsx:151–159`); WebKit-E2E; Emrah prüft am iPhone |
| R4 | Messrauschen in perf.spec | wackelnde Tests | Median aus 5, perf allein und zuletzt; Grenzen mit Abstand |
| R5 | viele E2E-Selektoren hängen am alten Rahmen | viele rote Tests in P2 | Test-IDs bleiben; neue IDs zusätzlich; nur 2 Specs mit `tab-read` und 1 mit `tab-apply` |
| R6 | 1b ist größer als geschätzt | Verzögerung | Schnitt 9a/9b; 1a kann allein live gehen |
| R7 | Brücken-Aliase lassen alte Bildschirme „halb neu“ aussehen | Optik uneinheitlich | Noras G2-Prüfung mit 6.7; was nicht passt, wird in P1 auf Tokens umgestellt, nicht mit neuen Regeln überstimmt |
| R8 | Dateizahl je Veröffentlichung (255) | Veröffentlichung scheitert | `check:platform` prüft < 100 als Ziel und < 255 als Tor |
| R9 | v86 stolpert über neue Felder oder unbekannte Palette | Rückweg kaputt | nur optionale Felder in looseObjects; `theme.p` unangetastet; Rückweg-Test Unit + E2E + Probe |
| R10 | Zahlen ändern sich unbemerkt beim Verlegen in metrics | Widersprüche (Kap. 15) | Golden-Test vor dem Umbau |
| R11 | `app/today` zeigt einen veralteten Stand (anderes Gerät) | falscher Knopf für einen Augenblick | berechneter Plan gewinnt, Bild wechselt ohne Springen; Datum im Dokument |
| R12 | Konflikte zwischen parallelen Paketen | Mehrarbeit beim Zusammenführen | Besitztabelle 3.2; `verify-fast-map.mjs` nur anhängen |
| R13 | Diktat am Laptop funktioniert in claude.ai gar nicht (z. B. Windows-Diktat in Edge) | Hinweiszeile bleibt | Ehrliche Zeile bleibt, kein Fehler; Befund an Tarek; das ist ein erwartetes, gültiges Ergebnis der Probe |

---

## 11. Offene Fragen

**Echte Blocker: keine.**

Was nur Emrah tun kann (Startzeit und Bandhöhe am iPhone messen, Laptop-Diktat-Probe, Safari-Probe in P8), ist im Ablauf eingeplant und hält den Bau nicht auf.

Selbst entschieden (mit Begründung oben): Schnitt 1a/1b (Abschnitt 0, 8); Attributnamen `data-theme` bleiben (P1); Iris 0,62 (6.1); Akzent in `theme.a`, Palette bleibt gespeichert (P1, 4.4); Warum-Grenze bleibt in Stufe 1 bei 140 (6.4); `INTERRUPT_MS` bleibt 60 s (2); Lesen unter Praxis mit `tab-apply` (6.3); Widerspruch der Fortschritt-Zahlen wird in Stufe 1 nur dokumentiert, nicht behoben (5.2); `app/today` ohne eigenes Abo (4.3).

Die Hauptsitzung passt vor Paketstart CLAUDE.md A1/A3/A8 an Entscheidung 1 an (Abschnitt 9).

---

## 12. Größe

| Teil | Pakete | Zeilen (Code + Tests, geschätzt) | Agenten-Arbeitstage |
|---|---|---|---|
| 1a | P0–P7 | ~10.200 | 4–5 (plus ein G4-Lauf ~53 Min.) |
| 1b | P8–P10 | ~4.700 | 3–4 (plus ein G4-Lauf) |
| **Gesamt** | 11 Pakete (P9 in 9a/9b) | **~15.000** | **7–9** |
