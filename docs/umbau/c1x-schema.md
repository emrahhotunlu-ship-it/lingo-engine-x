# c1x-Inhaltsschema (für Inhalts-Fenster, Stand R1 P12)

Dieses Dokument ist die Arbeitsanweisung für alle, die c1x-Aufgaben **schreiben** (Inhalts-Pakete P18, P21, P35 …). Maßgeblich im Code: `src/domain/c1x/types.ts` (Typen) und `schema.ts` (zod). Hintergrund: `docs/umbau/lernplattform-3.md` §3 und `docs/umbau/c1-aufgaben.md` §3.1–§3.9. Pipeline: `docs/umbau/inhalts-pipeline.md`.

## Wohin und wie
- Dateien: `src/content/c1x/src/<art>/<charge>.json` mit `{ "v": 1, "items": [ … ] }`, je Charge **eine eigene Datei** (z. B. `kwt/k1-001.json`). Arten: `mcc ocl wf kwt err pair cnet reg para`. `pilot/` gehört P12 (nicht anfassen).
- **IDs:** `<art>-NNNN` (vier Ziffern), je Art eindeutig im ganzen Repository. Vergebene Bereiche: `9001–9999` = Pilot/Tests (nicht benutzen). Chargen nehmen **fortlaufende Bereiche je Paket**: P18 `kwt 0001–0199`, `err 0001–0399`; P21 `ocl 0001–0399`, `mcc 0001–0399`; P35 Einstufungsvorrat `0401–0499` je Art; P39 `wf 0001–0199`; P36/P37 neue Themen ab `0500`; P43 Kapitelprüfungs-Vorrat Kapitel 1–3 `0701–0828` (quer über `ocl`, `kwt`, `err`, Ordner `gate/`, `pool: 'gate'`), P81 Kapitel 4–7 ab `0829`; weitere Pakete tragen ihren Bereich hier ein. Eine doppelte ID bricht den Build (Packer).
- Prüfen: `npx vitest run tests/unit/c1xContent.test.ts` (läuft über **alle** Dateien) und `tests/unit/c1xSchema.test.ts`. Nichts committen, solange das rot ist.
- Sprache: **US-Englisch**; `de`/`en` jeder Begründung in der richtigen Sprache (deutsche Hinweise dürfen englische Beispiele nennen); ⅔ Beruf (Vertrieb, DMS/ECM, Cloud), ⅓ Alltag (`dom`); eigene Sätze, **keine** Cambridge-Originale; keine geraden Anführungszeichen `"` in Fließtexten (typografisch `„…“`/`“…”`).

## Gemeinsame Felder (`C1Base`)
| Feld | Regel |
|---|---|
| `id` | siehe oben |
| `kind` | Art |
| `area` | `gram` (bucht auf ein Thema) oder `lex` (Wortbildung, Netze, Wort-Kollokationen) |
| `pat` | Muster-Kennung im LP2-Format `prefix.slug` (z. B. `pp.personal`, `gi.prep-ing`). Bei `area: gram` muss sie in der **Musterdatei des Themas** stehen (`src/content/grammar/patterns/<topic>.json`, Feld `patterns[].id`), bei `lex` heißt sie `lx.<slug>` |
| `topic` | Pflicht bei `gram`: eines der 47 Themen (Dateiname in `src/content/grammar/patterns/` bzw. die 8 neuen Themen `inversion emph-plus ellipsis modals-prob stative-adv future-past noun-phrase quant-neg`) |
| `lex` | ≤ 3 betroffene Wörter/Wendungen (Brücke zu Karten; nur diese werden gebucht) |
| `trap` | Deutsch-Falle `f01`–`f28` (`src/content/nb/traps.ts`) |
| `level` | `B2` · `B2+` · `C1` |
| `dom` | `biz` · `life` |
| `why` | `{ ok: { de, en }, wrong: WhyRule[] }` (≤ 4 Regeln). `ok` = Kernbegründung ≤ 240 Zeichen je Sprache; jede `WhyRule` ≤ 140 Zeichen |
| `src` | `seed` |
| `set`, `seq` | Textmodus (Aufgaben eines Absatzes) |
| `probe`, `form` | nur C1-Check (Form `A`–`L`) |
| `pool` | `gate` (Kapitelprüfung) / `place` (Einstufung); `b` = Rang (nur Einstufung) |

**Begründung je falsche Wahl = `WhyRule`:** `{ "opt": "<Option>", "cat": "calque|partner|grammar|meaning|register", "de": …, "en": … }` (Auswahlarten: `opt` = genau der Optionstext). Für getippte Fallen: `{ "if": ["Wörter, alle in der Antwort"], "not": ["…"], "de": …, "en": … }` (Wörter an Wortgrenzen, nach `legacyNorm`). Für „Fehler finden“: `{ "tap": "<angetipptes Wort>" | "*" | "none", … }`. `cat`: *Deutsch gedacht* (`calque`), *falscher Partner* (`partner`), *passt grammatisch nicht* (`grammar`), *andere Bedeutung* (`meaning`), *falsche Stilebene* (`register`).

## Je Art
**`mcc`** – `text` (genau **eine** Lücke `___`, 8–30 Wörter), `options` (genau 4 Strings, alle verschieden), `answer` (0–3). Jede der 3 falschen Optionen braucht eine `WhyRule` mit `opt`. Das Lösungswort steht nicht schon im Satz. Lösungsposition je 20–30 % über den Bestand.
**`ocl`** – `text` (eine Lücke, 8–30 Wörter), `accept` (Wörter, `[A-Za-z']`), `cls` (`art aux prep pron rel conj det adv part`), `chips` (3 Wörter derselben Klasse, nicht in `accept`).
**`wf`** – `text` (eine Lücke), `stem` (GROSS), `accept[]`, `pos`, `parts { pre?, base, suf?[], change? }`, `family[]` (≥ 2, **enthält** jede Lösung). Lösung enthält den Stamm (≥ 60 %), sonst `parts.change`.
**`kwt`** – `lead` (Satz A, 6–25 Wörter), `key` (GROSS, steht **nicht** in `lead`), `before`/`after` (Satz B um die Lücke; `before` darf leer sein), `keys[]` = ganze Lösungsvarianten `{ a: [Teil A …], b: [Teil B …] }` (Teil A ≤ 3 Wörter; das musterbildende Wort gehört in Teil B), `tiles` (Bausteine der **ersten** Lösung ohne Schlüsselwort, als Mehrfachmenge), `extra` (2–4 Ablenker, keine Lösungswörter), `traps[]` (typische falsche Antworten als Text; jede ergibt < 2 Punkte **und** wird von einer `WhyRule` mit `if`/`not` in `why.wrong` getroffen). Lösung **3–6 Wörter** nach Cambridge-Zählung (Kurzformen = 2 Wörter, `can't` = 1; `'d` + 3. Form = had).
**`err`** – `text` (6–25 Wörter), `bad` = `null` (**fehlerfrei**; Anteil 25–35 % je Charge) oder `{ span, nth?, fix[], choices[3] }`: `span` = die falschen Wörter genau wie im Satz (Satzzeichen egal), `nth` bei Wiederholung, `fix[]` = gültige Ersatztexte (US), `choices` = 3 Chips, `fix[0]` ist einer davon, **genau einer** ist gültig. **Eine** zusammenhängende Abweichung.
**`pair`** – `sa`, `sb` (zwei Sätze), `means` (3 Bedeutungen `{de,en}`: 0 = zu `sa`, 1 = zu `sb`, 2 = Ablenker), optional `transfer { text (eine Lücke), cue, accept[] }`.
**`cnet`** – `hub`, `slot` (`V+N Adj+N N+prep Adv+Adj`), `right[3–4] { w, de, ex }` (`ex` enthält `hub` und den Partner), `wrong[3–4] { w, calque? }` (je eine `WhyRule` mit `opt`), `also[] { w, note }` (nicht abgefragt).
**`reg`** – `ctx {de,en}`, `from` (`casual neutral direct`), `to` (`neutral formal diplomatic`), `text`, `segs[1–3] { span, accept[], choices[3], why {de,en} }` (genau ein `choice` ∈ `accept`), `answers[]` (ganze Sätze, erfüllen alle Abschnitte).
**`para`** – `focus`, `a` (Satz A), `start` (fester Anfang), `answers[]` (alle beginnen mit `start`), `options` (4 Sätze), `answer` (0–3, `options[answer]` ∈ `answers`), jede falsche Option mit `WhyRule` (`opt`).

## Abweichungen von c1-aufgaben.md (Kanon LP3)
- `pattern` → `pat` (LP2-Format); `why: Bi` → `why: TaskWhy`; Begründung je Option/Falle als `WhyRule` in `why.wrong` (statt `McOpt.why`, `traps[].why`, `cnet.wrong[].why`, `optWhy`).
- `mcc.options`: nur Strings; `ocl.accept`/`para.options` wie in CA; `kwt.traps`: Strings; `cnet.wrong`: `{ w, calque? }`.
- `pair`: Sätze heißen `sa`/`sb` (nicht `a`/`b`, weil `C1Base.b` der Einstufungs-Rang ist).
- Nur für die LP2-Übernahme (`kwt-v2-<n>`, `err-v2-<n>`): `kwt.words`, leeres `extra`, `err.bad.choices` fehlt, `fix: ''` (streichen). **Neue Inhalte nutzen das nicht.**

## Beispiel (`kwt`, in `src/content/c1x/src/pilot/kwt.json`)
Die sechs Pilotaufgaben (`pilot/kwt.json`, `pilot/err.json`) sind vollständige, geprüfte Beispiele; `tests/fixtures/c1x/examples.json` enthält alle neun Arten dreifach.
