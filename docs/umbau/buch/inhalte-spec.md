# Grammatik-Buch – Vorgabe für die Inhalte (Übung A und B)

Emrah 08.11.2026: „Gezielte Grammatik-Übungen wie im Buch, wo man dann auch eine Klausur schreibt.“ Je Lektion (= Thema aus `src/content/grammar/path.json`) gibt es feste Seiten:

| Seite | Inhalt | Quelle |
|---|---|---|
| Regel | Kurzregel, Formen, deutsche Falle | `src/content/grammar/patterns/<thema>.json` (vorhanden) |
| **Übung A „Form bilden“** | 6 Lückensätze | **neu** (diese Vorgabe) |
| **Übung B „Unterscheiden“** | 6 Auswahlaufgaben mit 3 Optionen | **neu** (diese Vorgabe) |
| Übung C „Umformen und Fehler finden“ | Schlüsselwort-Umformung und Fehler finden | `src/content/grammar/tasks-v2.json` (vorhanden) |
| Lektionstest | 8 Aufgaben aus A, B, C, die beim Üben nicht kamen | gemischt |
| Klausur (Kapitelende) | 20 Aufgaben aus allen Lektionen | gemischt |

## Ausgabe

Eine Datei je Thema: `<thema>.json`

```json
{ "topic": "past-simple-perfect", "tasks": [ … 12 Aufgaben … ] }
```

### Übung A – Lücke (`"part": "A"`, `"type": "gap"`)

```json
{
  "id": "psp-a1",
  "topic": "past-simple-perfect",
  "pat": "<Muster-Kennung aus patterns/<thema>.json>",
  "part": "A",
  "type": "gap",
  "prompt": "We ___ the new pricing model in March last year.",
  "hint": "(launch)",
  "answer": "launched",
  "accepted": [],
  "why": {
    "ok": { "de": "…", "en": "…" },
    "wrong": [ { "if": ["has", "launched"], "de": "…", "en": "…" } ]
  }
}
```

### Übung B – Auswahl (`"part": "B"`, `"type": "mc"`)

```json
{
  "id": "psp-b1", "topic": "…", "pat": "…", "part": "B", "type": "mc",
  "prompt": "Sorry, I ___ your email yet – I'll reply this afternoon.",
  "options": ["haven't read", "didn't read", "don't read"],
  "answer": "haven't read",
  "why": {
    "ok": { "de": "…", "en": "…" },
    "wrong": [
      { "opt": "didn't read", "de": "…", "en": "…" },
      { "opt": "don't read", "de": "…", "en": "…" }
    ]
  }
}
```

## Regeln

1. **Menge je Thema:** genau 6 × A und 6 × B. Jedes Muster des Themas (`patterns[].id`) kommt in A **und** B mindestens einmal vor; die Reihenfolge folgt `order`.
2. **Niveau und Kontext:** B2 → C1, Business-Alltag (Meetings, E-Mails, Kunden, Projekte, Zahlen). Natürliches **amerikanisches** Englisch. 8–18 Wörter je Satz, ein Satz, keine Namen echter Firmen.
3. **Genau eine Lücke** `___` je `prompt`. Die Lösung steht nirgends im Satz.
4. **Eindeutigkeit (wichtigste Regel):**
   - Der Satz enthält ein **Signal** (Zeitangabe, Konjunktion, Kontext), das genau **eine** Lösung erzwingt. Ist eine andere Form ebenso natürlich, kommt sie in `accepted` (z. B. Kurzformen `'s testing`, `won't`/`will not`).
   - Ist die Mehrdeutigkeit nicht auflösbar, wird der Satz umgeschrieben.
5. **`hint`:**
   - Bei Verbformen das Grundverb in Klammern, z. B. `(launch)`. Bei Verneinung `(not / launch)`.
   - Bei Artikeln, Präpositionen, Quantoren und Linkern kein Hinweis (`"hint": null`) – dafür muss der Satz eindeutig sein.
6. **Übung B:**
   - Genau 3 Optionen, eine richtig. Die Ablenker sind die **typischen Verwechslungen** des Themas (Nachbar-Muster, deutsche Gewohnheit) und im Kontext **eindeutig falsch**, nicht nur „weniger gut“.
   - `answer` steht wörtlich in `options`. Die Position der richtigen Antwort wechselt.
7. **`why.ok`** (Deutsch und Englisch, je **höchstens 140 Zeichen**):
   - Warum genau die Lösung hier stimmt.
   - Nennt das **Signal im Satz** in Anführungszeichen („in March last year“).
   - Keine Fachwörter außer Zeitformnamen (Past Simple, Present Perfect …).
8. **`why.wrong`** (je höchstens 140 Zeichen, 1–3 Regeln):
   - **A:** `if` = Wörter, die in der typischen falschen Antwort vorkommen (klein, einzeln, z. B. `["has","launched"]`). Der Text nennt die falsche Form und sagt, warum sie hier nicht passt, mit dem Signal im Satz.
   - **B:** `opt` = Ablenker wörtlich. Je Ablenker genau eine Regel.
   - Deutsche Falle nur nennen, wenn sie echt ist (seit + Präsens, „Informationen“, „gestern habe ich …“, „Wenn … wird“).
9. **Keine Doppel** mit `src/content/grammar/tasks-v2.json` und `src/content/grammar-bank.json` desselben Themas (anderer Inhalt, anderes Satzgerüst).
10. **Kennungen:** `<kürzel>-a1` … `-a6`, `-b1` … `-b6` (Kürzel 2–5 Buchstaben aus dem Thema).
11. **JSON:**
    - Gerade Anführungszeichen `"` nur als JSON-Begrenzer.
    - Im Text deutsche „…“ und englische “…”.
    - Apostroph als `'`.
