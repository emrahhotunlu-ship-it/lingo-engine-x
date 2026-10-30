# Emrahs Grundpaket für alle Apps

Ein Paket, das du **einmal** in deinem claude.ai-Konto einrichtest. Danach kennt Claude in jeder neuen Sitzung – am iPhone, am Laptop und am MacBook, in jeder App – deine Arbeitsweise und hat dieselben Werkzeuge dabei.

## Was drin ist

| Teil | Was es tut | So rufst du es auf |
|---|---|---|
| **Arbeitsweise** | Wird bei jedem Sitzungsstart automatisch geladen: wer du bist, dein Anspruch, ehrliche Beratung, effizient bei gutem Tempo, kurze Berichte | automatisch |
| **Produkt-Kern** | Findet mit dir heraus, was die App einzigartig macht, und schreibt `docs/produkt.md` | „Lass uns den Produkt-Kern machen“ |
| **Design-Richtung** | Vorbilder → Musterseite zum Abnicken → `docs/design.md` | „Wir brauchen eine Design-Richtung“ |
| **Erlebnis-Check** | Prüft die App am Handy in allen Facetten, nennt die drei wichtigsten Verbesserungen | „Mach einen Erlebnis-Check“ |
| **Projekt einrichten** | Macht ein Projekt schlank (kurze CLAUDE.md, Verlauf ausgelagert) | „Richte das Projekt schlank ein“ |
| Helfer **produkt-stratege** | Ehrliches Urteil zu einer Idee: bauen, anders bauen oder weglassen, plus die 10x-Version | „Frag den Produkt-Strategen“ |
| Helfer **design-kritiker** | Screenshots, fünf Korrekturen mit genauen Werten | „Lass den Design-Kritiker drüberschauen“ |
| Helfer **code-pruefer** | Sucht echte Fehler im neuen Code | läuft vor dem Zusammenführen |
| Helfer **test-laeufer** | Führt Tests aus, günstiges kleines Modell | läuft bei Tests |

## Einrichten (einmalig, am Handy)

**Weg A – im claude.ai-Konto (empfohlen, gilt für alle Apps):**
1. Die Datei `emrah-grundlagen.plugin` aufs Handy laden (Claude schickt sie dir im Chat).
2. In claude.ai: Menü → **Anpassen** (Customize) → **Plugins** → **Hinzufügen** → **Plugin hochladen** → die Datei wählen.
3. Neue Claude-Code-Sitzung öffnen und fragen: „Welche Arbeitsweise gilt für mich?“ Antwortet Claude mit deinen Regeln, funktioniert es.

**Weg B – falls Weg A in Claude Code nicht ankommt:** Ein eigenes GitHub-Repo `claude-grundlagen` anlegen. Claude legt das Paket dort ab und bindet es in jedem Projekt mit zwei Zeilen in `.claude/settings.json` ein.

## Aufräumen (spart viel Limit)

In claude.ai → Anpassen → Plugins **ausschalten**, was du für Web-Apps nicht brauchst:
- **Unity** (für Spiele), **SearchFit SEO**, **Marketing**, **Engineering** (bringt Datadog, PagerDuty, Asana …)
- **Superpowers** und **Agent Protocols**: beide schreiben dir Arbeitsabläufe vor, die sich mit diesem Paket überschneiden.

Behalten: **Design**, **Figma** (falls genutzt), **UX/UI Audit**.
Bei den Connectoren (Gmail, Kalender, Notion, Miro) nur anlassen, was du beim Bauen wirklich brauchst.

---

# So baust du Apps, die herausragend sind

## Die wichtigste Einsicht
Code kann heute jeder mit KI erzeugen. Code ist deshalb **nicht** das, was deine App einzigartig macht. Schwer nachzubauen sind vier Dinge:

1. **Dein Fachwissen:** Du kennst Küchenstudios und dein eigenes Englischlernen von innen. Wie ein Aufmaß wirklich abläuft, wo Angebote hängen bleiben, warum du ein Wort immer wieder vergisst. Das weiß kein anderer Entwickler.
2. **Eigene Inhalte und Daten:** Deine Lernstände, echte Abläufe, Vorlagen, Preislogik. Je länger die App läuft, desto klüger wird sie für den Nutzer.
3. **Durchdachte Abläufe:** Nicht „ein Formular für alles“, sondern genau der Schritt, den man in dem Moment braucht.
4. **Geschmack und Detailtiefe:** Hunderte kleine Entscheidungen, die zusammen „wow“ ergeben.

Claude **vervielfacht** dein Urteil, ersetzt es aber nicht. Deshalb beginnt jede gute App damit, dein Wissen herauszuholen, bevor gebaut wird.

## Die Reihenfolge, die funktioniert

| Schritt | Was passiert | Werkzeug |
|---|---|---|
| 1. Kern | Für wen, welcher Moment, was ist zehnmal besser, was bauen wir **nicht** | Produkt-Kern |
| 2. Geschmack | Vorbilder, eine Musterseite, dein Ja | Design-Richtung |
| 3. Ein Moment perfekt | **Einen** besonderen Moment komplett und perfekt bauen, nicht zehn halb | normale Sitzung |
| 4. Selbst benutzen | Du nutzt es zwei, drei Tage wirklich und notierst, was stört (Kommentare in der App) | du |
| 5. Prüfen | Was fehlt zu herausragend? Drei Änderungen mit der größten Wirkung | Erlebnis-Check |
| 6. Wiederholen | Nächster Moment | — |

Die meisten bauen in die Breite (viele Funktionen, alle mittelmäßig). Herausragende Apps entstehen **in der Tiefe**: wenige Dinge, die so gut sind, dass man sie vermisst.

## Die vier Facetten

- **Aussehen:** Ohne Vorbild baut KI Durchschnitt. Schick Screenshots von Apps, die du liebst, und sag, was genau dir daran gefällt.
- **Bedienlogik:** Ein Bildschirm, ein Ziel. Jeder Zustand ist gestaltet (leer, lädt, Fehler, erledigt). Nichts widerspricht sich.
- **Inhalt:** Hier gewinnst du am meisten. Generischer Inhalt ist austauschbar, deine Fachtiefe nicht. Frag dich: Würde ein Profi aus der Branche nicken?
- **Tempo und Verlässlichkeit:** Reagiert sofort, verliert nie Daten, erklärt Fehler in einfachen Worten.

## Sätze, die dir bessere Ergebnisse bringen

- „Was würdest du an meiner Stelle anders machen? Sei ehrlich.“
- „Was wäre die 10x-Version davon?“
- „Was sollten wir weglassen?“
- „Zeig mir erst eine Musterseite, bevor du alles umbaust.“
- „Wie teuer ist das fürs Limit: klein, mittel oder groß?“
- „Ein Thema: nur [X]. Fass sonst nichts an.“

## Sparsam mit dem Limit

- **Ein Thema, eine Sitzung.** Neue Sitzung, wenn ein Thema fertig ist. Lange Sitzungen werden mit jeder Nachricht teurer.
- **Helfer gezielt.** Parallel, wenn es Zeit spart – nie dieselbe Sache doppelt.
- **Kurze CLAUDE.md.** Sie wird bei jeder Nachricht mitgelesen.
- **Wenige Plugins.** Jedes installierte Plugin steht in jeder Sitzung im Kopf.
- **Tests nach Größe.** Kleine Änderung, kleiner Test; die volle Runde einmal vor dem Veröffentlichen.
