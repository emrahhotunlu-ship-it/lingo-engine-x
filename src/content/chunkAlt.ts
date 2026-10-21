// Gleichwertige Fassungen ganzer Wendungen (Emrahs Meldung 21.10.2026, Bausteine „ein Viertelprozentpunkt“): Die deutsche Vorgabe führt hier zu mehr als
// einer richtigen englischen Fassung. Sie gelten in Bausteinen und getippten Abfragen der GANZEN Wendung als richtig („Auch richtig“), nie als Ablenker.
// Daten, kein Code. Schlüssel: die Wendung klein geschrieben, ohne „…“ (wie `typedForm`). Bindestrich und Leerzeichen sind beim Prüfen gleichwertig.
// Quelle der Einträge: die Notizen der Artikel-Wendungen (`content/legacy/feed-seed.json`, „Im Fachjargon auch …“, „… geht auch“).

export const CHUNK_ALT: Readonly<Record<string, readonly string[]>> = {
  // „Im Fachjargon auch 25 basis points“; in Nachrichten ebenso „a quarter point“ / „a quarter-point“ und „a quarter percentage point“.
  'a quarter of a percentage point': ['a quarter percentage point', 'a quarter point', 'a quarter-point', '25 basis points'],
  // „Increase rates geht auch“; Zeitungen sagen oft nur „raise rates“.
  'to raise interest rates': ['to increase interest rates', 'to raise rates'],
};
