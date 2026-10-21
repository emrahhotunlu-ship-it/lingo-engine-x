// Gleichwertige Fassungen ganzer Wendungen (Emrahs Meldung 21.10.2026, Bausteine „ein Viertelprozentpunkt“): Die deutsche Vorgabe führt hier zu mehr als
// einer richtigen englischen Fassung. Sie gelten in Bausteinen und getippten Abfragen der GANZEN Wendung als richtig („Auch richtig“), nie als Ablenker.
// Daten, kein Code. Schlüssel: die Wendung klein geschrieben, ohne „…“ (wie `typedForm`). Bindestrich und Leerzeichen sind beim Prüfen gleichwertig.
// Quelle der Einträge: die Notizen der Artikel-Wendungen (`content/legacy/feed-seed.json`, „Im Fachjargon auch …“, „… geht auch“).

export const CHUNK_ALT: Readonly<Record<string, readonly string[]>> = {
  // „Im Fachjargon auch 25 basis points“; in Nachrichten ebenso „a quarter point“ (= „a quarter-point“) und „a quarter percentage point“.
  // Englischlehrer 21.10.2026: bewusst NICHT „25 percent“, „a quarter percent“ (= 0,25 %) und „a quarter of a percent“.
  'a quarter of a percentage point': ['a quarter percentage point', 'a quarter point', '25 basis points', 'twenty-five basis points', '0.25 percentage points', '0.25 percentage point'],
  // „Increase rates geht auch“; Zeitungen sagen oft nur „raise rates“ oder „hike rates“; „put up interest rates“ ist britisch und gilt als richtig.
  // Bewusst NICHT „to rise interest rates“ (typischer rise/raise-Fehler, bleibt falsch). Die Fassung ohne „to“ zählt wie die Hauptform (`checkTyped`).
  'to raise interest rates': ['to increase interest rates', 'to raise rates', 'to increase rates', 'to hike interest rates', 'to hike rates', 'to put up interest rates', 'to put interest rates up'],
};
