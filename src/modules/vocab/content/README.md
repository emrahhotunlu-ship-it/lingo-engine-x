# Inhalte des Wörter-Moduls (V2, Lehrer-Chargen 1–3)

Daten, kein Code. Jede Datei wird von `content/index.ts` mit zod geprüft (`tests/unit/vocab/content.test.ts`). Alles erfunden bzw.
allgemeines Lehrwissen, **keine echten Daten**. Englisch in **US-Schreibweise** (britische Formen nur in `uk`), Deutsch mit Umlauten.
Jede Charge wird zu 100 % vom `english-teacher` gegengelesen (je Prüfdurchgang ≤ 40 Einträge); das Ergebnis steht in `review`.

## Gemeinsame Felder
| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | eindeutig, `[a-z0-9-]`, mit Präfix der Charge (`t-`, `b-`) |
| `en` | ja | Lexem in Grundform (Wort, Phrasal Verb, Kollokation, Wendung), ohne „to“ |
| `k` | ja | Art: `w` Wort · `pv` Phrasal Verb · `col` Kollokation · `ch` Wendung/Chunk |
| `de` | ja | **deutscher Chunk** für „Deutsch → Englisch ohne Satz“ (M27): so geschrieben, dass **nur eine** englische Lösung passt; nie eine Einzelwort-Gleichung, wenn ein Chunk möglich ist (z. B. „eine Frist einhalten“ → *meet a deadline*) |
| `ex` | ja | ein natürlicher Business-Satz (B2–C1), das Ziel in eckigen Klammern genau so, wie es getippt werden muss: `We need to [meet the deadline] on Friday.` |
| `why` | ja | Warum-Zeile, Deutsch, ≤ 120 Zeichen: Wortart · typische Verbindung · Abgrenzung zur Falle |
| `reg` | ja | Stilebene (M80): `f` formell · `n` neutral · `i` informell |
| `syn` | nein | in **diesem** Satz gleichwertige Lösungen („Auch richtig“, M41), nur echte Synonyme; ähnliche Wörter zählen nicht |
| `evade` | nein | einfachere Ausweichwörter, die im Satz passen, aber ungenauer sind (*problem* statt *bottleneck*); nur wo das Ziel wirklich genauer ist |
| `uk` | nein | britische Varianten (Wortschatz, nicht Schreibweise), z. B. *take a decision*: „Auch richtig“ mit US-Hinweis |
| `gr` | nein | `{pat?, cnt?, sep?, var?}` wie `lex.gr`: `pat` Wortmuster (*discuss sth*, *depend on sth*), `cnt` Zählbarkeit `u`/`c`/`uc` (nur Nomen), `sep` Trennbarkeit (nur `pv`: 1 = *set it up*, 0 = *look after it*), `var` gleichwertige Varianten des Lexems selbst (≤ 8) |

## Charge 1 `charge1-traps.json` – Deutsch-Fallen
Zusätzlich `type` und je nach Typ:
| `type` | Bedeutung | Zusatzfelder |
|---|---|---|
| `ff` | falscher Freund (*eventually* ≠ eventuell): Kontrastkarte statt Pause (M14) | `trap` (das deutsche Fallenwort), `trapEn` (was der Lerner eigentlich meint, englisch) |
| `pair` | echtes englisches Verwechslungspaar (*affect/effect*): Paar-Regel (M14), Ausgang „anderes Wort“ (M40e) | `pair` (das andere englische Wort, steht selbst als Eintrag in der Datei) |
| `spell` | bekannter Rechtschreibfehler deutscher Lerner (M40b) | `wrong` (Liste falscher Schreibungen, z. B. `adress`) |
| `uncount` | nicht zählbar (M79) | `wrong` (z. B. `informations`), `gr.cnt = "u"` |
| `prep` | Präposition/Wortmuster (M78) | `wrong` (z. B. `discuss about`), `gr.pat` |
| `colloc` | Kollokationsfalle (*make/do*, *hold a presentation*) | `wrong` (falsche Verbindung), `k = "col"` |

## Charge 2 `charge2-business.json` – Business-Funktionswendungen
Zusätzlich `fn`: `hedge` · `discourse` · `negotiate` · `objection` · `email` · `meeting` · `dms` (DMS/ECM-Fachsprache). Keine Doppel zu
`src/content/c1/pack.json` (gleiches `en`).

## Charge 3 `charge3-gr.json` – `k` und `gr` je Bestands-Lexem
Je Lexem aus `src/content/legacy/vocab.json` (`seedVocab`) und `src/content/c1/pack.json`: `{head, src, k, reg, gr?, wrong?}`.
`head` = Stichwort wie in der Quelle ohne „to “, `src` = `seed:<w>` bzw. `pack:<id>`, `wrong` = typische falsche Muster für M78/M81
(z. B. `discuss about`, `set up it`). Erst wenn diese Charge geprüft ist, schaltet das Modul die Formen M78–M81 frei (`GR_FORMS_ON`).

## `review`
Jede Datei hat oben `review: {by: "english-teacher", passes: [{n, items, ok, fixed}], date}`. Ein Eintrag ohne bestandene Prüfung wird
vom Modul nicht benutzt (`content/index.ts` filtert nach `review`).
