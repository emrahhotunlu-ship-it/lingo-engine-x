# Test-Link 2 (Lernplattform 2.0, Stand 07.10.2026)

**Link:** https://claude.ai/artifact/AXHkh6xneA4xfjpHkmy1wE · Version `1791356295-cae9` (Artefakt-Version 41) · Code `ab0a598`
**Rückweg:** Version `1791219199-07a2` (davor). Die alte Live-App `JLL8…` ist unberührt.

## 1. Was ist neu (aus deiner Sicht)
- **Ein einheitlicher Übungsrahmen** für Wörter, Grammatik, Satzbau und Fehlersätze: Aufgabe oben, Antwort in der Mitte, unten die feste Leiste mit „Prüfen“ und „Weiter“. „Richtig“ ist überall derselbe Smaragd-Ton, „Ausgewählt“ sieht anders aus.
- **Erklär-Karte nach jeder Antwort:** Muster, Beispiele nur aus diesem Muster, bei falscher Auswahl eine Zeile zu dem, was du gewählt hast.
- **Alle 39 Grammatikthemen** haben jetzt Muster und mehr Aufgaben (Lückensätze, „Fehler finden“, „Schlüsselwort“, Bedeutung).
- **Tag in 4 Schritten:** Wörter · Grammatik · Satzbau · **Fehler korrigieren** (Satz für Satz, auch am Sonntag, wenn Fehlersätze fällig sind). Fehlersätze kommen als neue Variante desselben Musters zurück, nicht als derselbe Satz.
- **Handy und Laptop:** Am Handy gibt es in der Pflicht nie ein langes Textfeld (Bausteine oder kurze Ersetzung), der Plan ist trotzdem gleich.
- **Heute** zeigt ein Segment je Pflichtschritt und am Ende echten Zuwachs. Fortschritt zeigt „Messwerte dahinter“.
- App-Datei ist kleiner (4,1 MB statt 7,6 MB).

## 2. So testest du am iPhone
1. In claude.ai den Link oben öffnen (Test-Kopie, nicht die Live-App).
2. **Heute** → großen Knopf „Als Nächstes …“ tippen. Schritt 1 (Wörter): eine Antwort wählen → **Prüfen** → **Weiter**.
3. **Schritt 2 (Grammatik):** eine Aufgabe falsch beantworten (absichtlich) → auf die Erklär-Karte achten.
4. **Schritt 4 (Fehler korrigieren):** zeigt einen deiner früheren falschen Sätze. Tippe die falsche Stelle an und gib nur den Ersatz ein.
5. Reiter **Grammatik** → Lernpfad (7 Kapitel) öffnen. Reiter **Fortschritt** → ganz unten „Messwerte dahinter“.
6. Eingabe am Handy: Tastatur öffnen und prüfen, dass „Prüfen“ sichtbar bleibt.

## 3. Woran du erkennst, dass es klappt – und was du schicken sollst
- Gut: Pflichtknopf unten bleibt sichtbar, nichts springt beim Antippen, „x von 3/4“ und Ring auf Heute stimmen überein, nach dem Ende steht ein Zuwachs („n Wörter/Muster sicher“).
- Schlecht: Knopf verdeckt, leere Fläche beim Wechsel, Zahlen, die sich widersprechen, Tastatur verdeckt das Feld.
- **Schick mir** einen Bildschirmfoto-Kommentar direkt in der App (mit Ort), oder: Reiter + was du getippt hast + was erschien. Bei Absturz: Einstellungen → Diagnose → Foto.

## Ehrliche Grenzen
- **Kein Safari/WebKit-Test möglich** (nur Chromium in iPhone-Größe). Tastatur im Einbettungsrahmen, Wischen, Schrift am iPhone sind ungeprüft.
- **Start-Leistung:** `perf.spec` (Start mit Großdatensatz bei 4× gedrosselter CPU) liegt hier bei 5,4–7,0 s statt unter 4 s. Auf dem Stand vor Welle 2 war es mit 5,4–6,0 s ähnlich (gemessen im selben Lauf), also kein neuer Einbruch, aber Ziel verfehlt. Echtzeit-Messung nur am Gerät.
- **Design-Vorschau nicht verglichen** (Fläche war von hier nicht abrufbar); der ux-reviewer verglich mit dem Konzepttext. Gedämpft-Modus, Englisch und 2560 px nicht per Screenshot geprüft.
- **Offene Befunde:** siehe `stand.md` (Eintrag 07.10.2026 „Abschluss Welle 2“).
