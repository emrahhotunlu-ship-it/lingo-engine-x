// Zuordnung „geänderte Datei → E2E-Specs“ für den schnellen Lauf (`npm run verify:fast`, scripts/verify-fast.mjs).
//
// So wird gelesen (für jede Datei zählen ALLE passenden Regeln, nicht nur die erste):
//  - `prefix`: Pfad beginnt damit (relativ zum Repo, mit `/`).
//  - `specs`: Dateinamen unter tests/e2e/ (ohne Ordner).
//  - `smoke: true`: zusätzlich die feste Rauch-Auswahl (SMOKE), weil die Datei überall wirkt (Plattform, Daten, Hülle, Texte, Stil).
// Eine Datei unter src/, die KEINE Regel trifft, bekommt die Rauch-Auswahl (im Zweifel lieber prüfen).
// Geänderte Specs laufen selbst; geänderte Test-Helfer (tests/e2e/*.ts ohne .spec) lösen alle Specs aus, die sie importieren.
// Unit-Tests brauchen keine Tabelle: `vitest related` findet sie über die Importe.
//
// Pflege: Neue Spec → bei ihrem Bereich eintragen. Die Tabelle ist bewusst grob; der Gesamtlauf `npm run verify`
// vor jedem Test-Link fängt alles, was sie nicht trifft (docs/umbau/arbeitsweise.md §10).

/** Feste Rauch-Auswahl: Heute, Wörter-Trainer, Grammatik-Runde, Plattform, Abnahme (zusammen ca. 1 Min. mit 4 Prozessen). */
export const SMOKE = ['today.spec.ts', 'trainer.spec.ts', 'alsoRight.spec.ts', 'platform.spec.ts', 'acceptance.spec.ts'];

const TODAY = ['today.spec.ts', 'heute.spec.ts', 'today-duties.spec.ts', 'heuteAbschluss.spec.ts', 'heuteWiedereinstieg.spec.ts', 'statusConsistency.spec.ts', 'planWeek.spec.ts'];
const TRAINER = ['trainer.spec.ts', 'trainerModes.spec.ts', 'trainerReview.spec.ts', 'trainerFeedback.spec.ts', 'wortKern.spec.ts', 'gapCue.spec.ts', 'tilesFix.spec.ts', 'statusConsistency.spec.ts'];
const VOCAB = ['wortschatz.spec.ts', 'anki.spec.ts', 'ankiUndo.spec.ts', 'wortWerkstatt.spec.ts', 'wordSky.spec.ts'];
const GRAMMAR = ['grammar.spec.ts', 'grammarSlots.spec.ts', 'alsoRight.spec.ts', 'lernen.spec.ts'];
const C1X = ['c1xErr.spec.ts', 'c1xFrame.spec.ts', 'c1xKwt.spec.ts', 'c1xOclMcc.spec.ts', 'c1xTempo.spec.ts', 'c1xWf.spec.ts'];

/** @type {Array<{ prefix: string, specs: string[], smoke?: boolean }>} */
export const RULES = [
  // Überall wirksam: Rauch-Auswahl (+ Gezieltes).
  { prefix: 'src/platform/', specs: ['platform.spec.ts', 'migration.spec.ts'], smoke: true },
  { prefix: 'src/data/', specs: ['platform.spec.ts', 'capacity.spec.ts'], smoke: true },
  { prefix: 'src/app/', specs: ['rahmen.spec.ts', 'settings.spec.ts'], smoke: true },
  { prefix: 'src/ui/chat/', specs: ['companion.spec.ts', 'speak.spec.ts'] },
  { prefix: 'src/ui/', specs: ['uxRules.spec.ts', 'shellColors.spec.ts'], smoke: true },
  // UX-Audit U3: Bauplan der Ergebnis-Karte (drei Blöcke, ohne Scrollen, Wort ≤ 2×), Abschlussmomente, drei Modi.
  { prefix: 'src/ui/exercise/', specs: ['resultCard.spec.ts', 'trainerFeedback.spec.ts', 'grammarPatterns.spec.ts'] },
  { prefix: 'src/ui/SessionEnd.tsx', specs: ['resultCard.spec.ts', 'chapterRun.spec.ts', 'grammar.spec.ts'] },
  { prefix: 'src/ui/DoneMark.tsx', specs: ['resultCard.spec.ts'] },
  { prefix: 'src/i18n/', specs: ['settings.spec.ts'], smoke: true },
  { prefix: 'src/styles/', specs: ['shellColors.spec.ts', 'uxRules.spec.ts'], smoke: true },
  { prefix: 'src/engine/', specs: ['transitions.spec.ts', 'gestures.spec.ts', 'haptics.spec.ts', ...TRAINER] },
  { prefix: 'src/main.tsx', specs: ['platform.spec.ts'], smoke: true },
  { prefix: 'src/ai/', specs: ['aiCanned.spec.ts', 'gate.spec.ts'], smoke: true },
  { prefix: 'src/prompts/', specs: ['aiCanned.spec.ts', 'judgeUi.spec.ts', 'tutorExplain.spec.ts'] },
  { prefix: 'src/content/', specs: ['cardQuality.spec.ts', 'auditAufgaben.spec.ts', 'c1pack.spec.ts'] },
  { prefix: 'index.html', specs: ['platform.spec.ts'], smoke: true },
  { prefix: 'vite.config.ts', specs: ['platform.spec.ts', 'perf.spec.ts'], smoke: true },
  { prefix: 'package.json', specs: [], smoke: true },
  { prefix: 'seed/', specs: ['migration.spec.ts'], smoke: true },
  // Bau- und Veröffentlichungs-Tor (Stufe 1, P0 S1-TOR): Grenzen, Plattform-Prüfung, Budget, Rückweg auf v86.
  { prefix: 'scripts/limits', specs: ['platform.spec.ts', 'perf.spec.ts'] },
  { prefix: 'scripts/check-platform', specs: ['platform.spec.ts'] },
  { prefix: 'scripts/check-budget', specs: ['platform.spec.ts', 'perf.spec.ts'] },
  { prefix: 'scripts/budget.json', specs: ['perf.spec.ts'] },
  { prefix: 'scripts/v86-checkout', specs: ['rueckweg.spec.ts'] },
  { prefix: 'tests/fixtures/s1-seed.json', specs: ['rueckweg.spec.ts'] },
  { prefix: 'src/platform/dev/', specs: ['rueckweg.spec.ts'] },

  // Bereiche (Hülle).
  { prefix: 'src/areas/heute.tsx', specs: TODAY },
  { prefix: 'src/areas/wortschatz.tsx', specs: VOCAB },
  { prefix: 'src/areas/lernen.tsx', specs: GRAMMAR },
  { prefix: 'src/areas/anwenden.tsx', specs: ['training.spec.ts', 'writingStudio.spec.ts', 'sentenceClinic.spec.ts'] },
  { prefix: 'src/areas/sprechen.tsx', specs: ['sprechen.spec.ts', 'speak.spec.ts'] },
  { prefix: 'src/areas/profil.tsx', specs: ['profil.spec.ts'] },
  { prefix: 'src/areas/training.tsx', specs: ['training.spec.ts'] },
  { prefix: 'src/areas/system.tsx', specs: ['settings.spec.ts'] },
  { prefix: 'src/areas/', specs: ['rahmen.spec.ts'] },

  // Bildschirme und ihre Logik.
  { prefix: 'src/features/today/', specs: TODAY },
  { prefix: 'src/domain/plan/', specs: [...TODAY, 'perf.spec.ts'] },
  { prefix: 'src/domain/unit/', specs: [...TODAY, 'fk.spec.ts'] },
  { prefix: 'src/domain/streak.ts', specs: ['today.spec.ts', 'heute.spec.ts'] },
  { prefix: 'src/domain/date.ts', specs: ['today.spec.ts', 'heute.spec.ts'] },
  { prefix: 'src/features/unit/', specs: ['fk.spec.ts', 'heute.spec.ts', 'resultCard.spec.ts'] },
  { prefix: 'src/features/vocab/', specs: [...TRAINER, ...VOCAB] },
  { prefix: 'src/domain/srs/', specs: [...TRAINER, 'rueckstand.spec.ts'] },
  { prefix: 'src/domain/vocab/', specs: [...TRAINER, ...VOCAB] },
  { prefix: 'src/features/grammar/', specs: GRAMMAR },
  { prefix: 'src/domain/grammar/', specs: GRAMMAR },
  { prefix: 'src/features/learn/', specs: ['lernen.spec.ts', 'hint.spec.ts', 'hilfen.spec.ts'] },
  { prefix: 'src/domain/learn/', specs: ['lernen.spec.ts', 'hint.spec.ts', 'hilfen.spec.ts'] },
  { prefix: 'src/features/c1x/', specs: C1X },
  { prefix: 'src/domain/c1x/', specs: C1X },
  { prefix: 'src/features/c1/', specs: ['c1pack.spec.ts', 'c1Check.spec.ts'] },
  { prefix: 'src/domain/c1/', specs: ['c1pack.spec.ts', 'c1Check.spec.ts'] },
  { prefix: 'src/domain/c1pack/', specs: ['c1pack.spec.ts'] },
  { prefix: 'src/features/check/', specs: ['c1Check.spec.ts'] },
  { prefix: 'src/domain/check/', specs: ['c1Check.spec.ts'] },
  { prefix: 'src/features/companion/', specs: ['companion.spec.ts', 'companionBars.spec.ts', 'companionWindow.spec.ts', 'translate.spec.ts'] },
  { prefix: 'src/domain/companion/', specs: ['companion.spec.ts', 'companionWindow.spec.ts'] },
  { prefix: 'src/features/speak/', specs: ['speak.spec.ts', 'sprechen.spec.ts', 'voice.spec.ts', 'retrySay.spec.ts', 'repair.spec.ts'] },
  { prefix: 'src/domain/speak/', specs: ['speak.spec.ts', 'sprechen.spec.ts', 'voice.spec.ts'] },
  { prefix: 'src/features/drills/', specs: ['drills.spec.ts', 'formatRound.spec.ts'] },
  { prefix: 'src/domain/drills/', specs: ['drills.spec.ts', 'formatRound.spec.ts'] },
  { prefix: 'src/features/nbdrill/', specs: ['training.spec.ts'] },
  { prefix: 'src/features/pressure/', specs: ['training.spec.ts'] },
  { prefix: 'src/domain/nbdrill/', specs: ['training.spec.ts'] },
  { prefix: 'src/features/apply/', specs: ['training.spec.ts', 'aktivierung2.spec.ts', 'writingStudio.spec.ts', 'sentenceClinic.spec.ts', 'c1xTempo.spec.ts'] },
  { prefix: 'src/domain/apply/', specs: ['aktivierung2.spec.ts', 'writingStudio.spec.ts', 'sentenceClinic.spec.ts'] },
  { prefix: 'src/domain/activation/', specs: ['aktivierung2.spec.ts', 'sentenceBank.spec.ts'] },
  { prefix: 'src/features/progress/', specs: ['progress.spec.ts', 'wochenrueckblick.spec.ts', 'wayToC1.spec.ts', 'stand-gaps.spec.ts'] },
  { prefix: 'src/domain/progress/', specs: ['progress.spec.ts', 'wochenrueckblick.spec.ts'] },
  { prefix: 'src/domain/week/', specs: ['wochenrueckblick.spec.ts', 'planWeek.spec.ts'] },
  { prefix: 'src/domain/assessment/', specs: ['progress.spec.ts', 'placement.spec.ts'] },
  { prefix: 'src/domain/atlas/', specs: ['programMap.spec.ts', 'wayToC1.spec.ts'] },
  { prefix: 'src/domain/course/', specs: ['chapterRun.spec.ts', 'programMap.spec.ts'] },
  { prefix: 'src/features/settings/', specs: ['settings.spec.ts', 'einstellungen-ueberall.spec.ts', 'diagnose.spec.ts', 'profil.spec.ts'] },
  { prefix: 'src/features/system/', specs: ['settings.spec.ts', 'rahmen.spec.ts'] },
  { prefix: 'src/features/migration/', specs: ['migration.spec.ts', 'platform.spec.ts'] },
  { prefix: 'src/domain/migration/', specs: ['migration.spec.ts', 'platform.spec.ts'] },
  { prefix: 'src/modules/read/', specs: ['lesen.spec.ts', 'lesenKurse.spec.ts', 'lesenReader.spec.ts'] },
  { prefix: 'src/features/tutor/', specs: ['tutorExplain.spec.ts', 'tutorPolicy.spec.ts', 'wordTutor.spec.ts', 'judgeUi.spec.ts', 'miniLesson.spec.ts'] },
  { prefix: 'src/domain/tutor/', specs: ['tutorExplain.spec.ts', 'tutorPolicy.spec.ts', 'wordTutor.spec.ts', 'judgeUi.spec.ts', 'miniLesson.spec.ts', 'colCharge.spec.ts'] },
  { prefix: 'src/domain/answer/', specs: ['judgeUi.spec.ts', 'alsoRight.spec.ts', 'trainerFeedback.spec.ts'] },
  { prefix: 'src/domain/grade/', specs: ['judgeUi.spec.ts', 'trainerFeedback.spec.ts'] },
  { prefix: 'src/features/patterns/', specs: ['patterns.spec.ts', 'grammarPatterns.spec.ts'] },
  { prefix: 'src/domain/patterns/', specs: ['patterns.spec.ts', 'grammarPatterns.spec.ts'] },
  { prefix: 'src/features/repair/', specs: ['repair.spec.ts', 'fk.spec.ts'] },
  { prefix: 'src/domain/repair/', specs: ['repair.spec.ts', 'fk.spec.ts'] },
  { prefix: 'src/features/teacher/', specs: ['teacherFeedback.spec.ts'] },
  { prefix: 'src/domain/teacher/', specs: ['teacherFeedback.spec.ts'] },
  { prefix: 'src/features/vtest/', specs: ['vtest.spec.ts'] },
  { prefix: 'src/domain/vtest/', specs: ['vtest.spec.ts'] },
  { prefix: 'src/features/levels/', specs: ['r6aFx.spec.ts', 'fxMoments.spec.ts', 'fxStage1.spec.ts'] },
  { prefix: 'src/domain/levels/', specs: ['r6aFx.spec.ts', 'fxMoments.spec.ts'] },
  { prefix: 'src/domain/moments/', specs: ['r6aFx.spec.ts', 'fxMoments.spec.ts'] },
  { prefix: 'src/features/capacity/', specs: ['capacity.spec.ts'] },
  { prefix: 'src/domain/capacity/', specs: ['capacity.spec.ts'] },
  { prefix: 'src/features/lookup/', specs: ['senseFit.spec.ts', 'phraseTap.spec.ts'] },
  { prefix: 'src/domain/lookup/', specs: ['senseFit.spec.ts', 'phraseTap.spec.ts'] },
  { prefix: 'src/domain/lexicon/', specs: ['senseFit.spec.ts', 'phraseTap.spec.ts', 'cardQuality.spec.ts'] },
  { prefix: 'src/domain/chunks/', specs: ['phraseTap.spec.ts', 'wlTiles.spec.ts'] },
  { prefix: 'src/domain/studytime.ts', specs: ['studyTime.spec.ts'] },
  { prefix: 'src/domain/metrics/', specs: ['diagnose.spec.ts', 'progress.spec.ts'] },
  { prefix: 'src/domain/radar/', specs: ['progress.spec.ts'] },
  // P5 S1-ZAHL: Kennzahlen speisen Heute, Grammatik und Wörter (Unit: metricsGolden findet `vitest related` über die Importe).
  { prefix: 'src/domain/metrics/', specs: [...TODAY, ...GRAMMAR, ...VOCAB] },
  // P4 S1-ZEIT: Zeit je Versuch (fk/ms/in) in hist und Tagesprotokoll.
  { prefix: 'src/engine/inputKind', specs: ['zeit.spec.ts'] },
  { prefix: 'src/domain/srs/applyReview', specs: ['zeit.spec.ts', 'rueckweg.spec.ts'] },
  { prefix: 'src/domain/progress/logPatch', specs: ['zeit.spec.ts', ...TRAINER, 'rueckweg.spec.ts'] },
  { prefix: 'src/features/grammar/GrammarItem', specs: ['zeit.spec.ts'] },
  { prefix: 'src/features/vocab/ExerciseView', specs: ['zeit.spec.ts'] },
  { prefix: 'tests/e2e/zeit', specs: ['zeit.spec.ts'] },
  // Relaunch P1 S1-TOK: Tokens und Akzent (Einstellungen, M21), OKLCH-Umrechnung für Lichtfeld und Wörterhimmel, Theme-Skript im Start-Bild.
  { prefix: 'src/styles/', specs: ['stand-gaps.spec.ts', 'settings.spec.ts'] },
  { prefix: 'src/features/settings/AccentSection', specs: ['stand-gaps.spec.ts'] },
  { prefix: 'src/engine/fx/rgb', specs: ['wordSky.spec.ts', 'fxStage1.spec.ts'] },
  { prefix: 'index.html', specs: ['settings.spec.ts', 'rueckweg.spec.ts'] },
  { prefix: 'src/engine/fx/AmbientLight', specs: ['r6aFx.spec.ts'] },
  // Relaunch P3 S1-BAND: Übungsrahmen mit Band, Menü „…“, Tastatur (⏎, T, W, 1–4, Esc, ?).
  { prefix: 'src/ui/exercise/', specs: ['band.spec.ts', 'tastatur.spec.ts'] },
  { prefix: 'src/app/shell/Player', specs: ['band.spec.ts', 'tastatur.spec.ts', ...TRAINER] },
  { prefix: 'src/styles/parts/band', specs: ['band.spec.ts', 'resultCard.spec.ts'] },
  { prefix: 'tests/e2e/band', specs: ['band.spec.ts'] },
  { prefix: 'tests/e2e/tastatur', specs: ['tastatur.spec.ts'] },
  { prefix: 'src/features/system/Chrome', specs: ['uebungRahmen.spec.ts', 'rahmen.spec.ts'] },
  { prefix: 'tests/e2e/uebungRahmen', specs: ['uebungRahmen.spec.ts'] },
  // Relaunch P2 S1-SHELL: Rahmen (5 Reiter, Schiene/Seitenleiste, Kontextspalte, „Fragen“), Breiten-Stufen, Erreichbarkeit, Start-Bild.
  { prefix: 'src/app/shell/', specs: ['rahmen.spec.ts', 'breiten.spec.ts', 'erreichbar.spec.ts', 'perf.spec.ts'], smoke: true },
  { prefix: 'src/areas/', specs: ['erreichbar.spec.ts'], smoke: true },
  { prefix: 'src/styles/parts/shell.css', specs: ['rahmen.spec.ts', 'breiten.spec.ts', 'perf.spec.ts'] },
  { prefix: 'index.html', specs: ['perf.spec.ts', 'breiten.spec.ts'] },
  { prefix: 'tests/e2e/rahmen', specs: ['rahmen.spec.ts'] },
  { prefix: 'tests/e2e/breiten', specs: ['breiten.spec.ts'] },
  { prefix: 'tests/e2e/erreichbar', specs: ['erreichbar.spec.ts'] },
  // Relaunch P6 S1-START: Startbild aus `app/today`, Boot ohne Warten, wartender Start, Messpunkte.
  { prefix: 'src/app/boot', specs: ['start.spec.ts', 'perf.spec.ts'], smoke: true },
  { prefix: 'src/main', specs: ['start.spec.ts', 'perf.spec.ts'], smoke: true },
  { prefix: 'src/data/todayDoc', specs: ['start.spec.ts', ...TODAY, 'rueckweg.spec.ts'] },
  { prefix: 'src/features/today/start', specs: ['start.spec.ts', 'perf.spec.ts'] },
  { prefix: 'src/features/today/StartWaiting', specs: ['start.spec.ts'] },
  { prefix: 'src/features/today/DayCard', specs: ['start.spec.ts', 'perf.spec.ts', 'breiten.spec.ts'] },
  { prefix: 'src/features/system/HomeSkeleton', specs: ['start.spec.ts', 'perf.spec.ts', 'platform.spec.ts'] },
  { prefix: 'tests/e2e/start', specs: ['start.spec.ts'] },
];

/** Ändert sich nur so etwas, gibt es nichts zu testen (Texte, Pläne, Notizen). */
export const NO_TEST = [/^dist\//, /^docs\//, /\.md$/, /^\.claude\//, /^CLAUDE\.md$/];
