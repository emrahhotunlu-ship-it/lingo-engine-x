# F3 Anwenden-Modul – Bauplan (04.11.2026)

Ziel (Emrah 04.11.2026): „Anwenden ist die aktive Nutzung von Vokabel, Grammatik sowie verschiedene Disziplinen wie auf E-Mail antworten bzw. eine schreiben, Artikel zusammenfassen.“ Vier Disziplinen, Handy und Laptop gleichwertig, UI-Standard `ui-standard.md`.

## Disziplinen
| id | Was Emrah tut | Material | Prüfung durch Claude | Länge Handy / Laptop |
|---|---|---|---|---|
| `combo` | eigener Satz mit Wort + Regel (3 Sätze) | vorhanden (`ComboSentence`, `comboCheck`) | vorhanden | unverändert |
| `reply` | auf eine eingegangene Geschäftsmail antworten | `content/nb` inbox (16 Mails, `inboxMails()`), Pflichtpunkte `must[]` | `c1-mail@1` mit Situation = eingegangene Mail + Pflichtpunkte (Situation bis 1.200 Zeichen) | 60–120 / 100–160 Wörter |
| `write` | Mail nach deutschen Stichpunkten schreiben | `content/c1/mail-situations.json` (12), `pickSituation` | `c1-mail@1` (vorhanden) | 60–120 / 120–180 |
| `summary` | Artikel in 3–5 Sätzen auf Englisch zusammenfassen | Tagesartikel `read/r-<Tag>` (3 Tage zurück) über eine neue Lesetür in `modules/read/index.ts`; sonst kleiner geprüfter Vorrat (5 Texte, english-teacher) | neuer Prompt `summary-check@1`: Fehlerstellen (`keepEdits`), Kernpunkte getroffen/fehlen (höchstens 3), bessere Fassung, Wörter benutzt (`keepUsed`) | 3–5 Sätze, ≤ 120 Wörter |

## Ablauf (gleich für reply/write/summary)
1. Aufgabe: Titel als Handlung, ein Wozu-Satz, Material (Mail bzw. Artikel ausklappbar), Stichpunkte, Ziel-Wortzahl, Wortzähler.
2. Schreiben (Textfeld groß, Entwurf lokal gespeichert, keine Autofill-Vorschläge).
3. Prüfen (eine Anfrage, `takeTutorCall`, Fehlerfälle wie WritingStudio) → Ergebnis wie `MailResult`: Urteil, jede Fehlerstelle deins → richtig → warum (1 Satz), Ton, bessere Fassung, benutzte Lernwörter.
4. Speichern: `out/<Monat>` (Arten `c1mail`, neu `reply`, `summary` im vorhandenen `OutKind`), Fehlersätze `app/repair` `src:'write'` (höchstens 3, ab morgen fällig, nur erste Prüfung), Wörter-Beleg `used` (getippt) über `modules/vocab/api.reportEvidence` sobald F2 fertig ist (bis dahin nur Speicherung), `app/c1.prod` wie Mail.

## Tagesplan (Schritt 3)
- Die Disziplin des Tages ist fest je Lerntag (Rotation über das Datum: combo → reply → write → summary), wird beim Einfrieren des Plans festgehalten und nie neu gewürfelt; fehlt Claude oder Material, gilt `combo` (bzw. ohne Claude Satzbau wie bisher).
- „Weitere Aufgabe“ freiwillig (Extra, zählt nicht zur Pflicht).

## Seite „Anwenden“
Vier Zeilen (Handlung + Wozu + Dauer), oben „Heute dran“ (die Tagesdisziplin, erledigt = Zustand), darunter „Fehler korrigieren“ (fällige Fehlersätze, freiwillig). Ersetzt den bisherigen Praxis-Hub (`ApplyHub`) unter Fokus 2.0.

## Prüfung
english-teacher: Inbox-Mails, Situationen, Vorrat-Artikel, Prompt-Texte. learning-scientist: Ablauf, Fehlersätze, Pflicht/Extra. data-guard: neue `OutKind`-Werte, Tagesplan-Feld. ux-reviewer: Seite + Ergebnis 390/744/1440.
