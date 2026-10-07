// Lädt alle Slot-Anmeldungen: jede Datei `*.slot.ts(x)` irgendwo unter `src/` (Lernplattform 3.0 P11). Kein Paket ändert eine gemeinsame Datei.
// Die Dateien melden sich beim Laden selbst an (`registerSlot`); eager, damit der erste Zeichenvorgang sie schon kennt.
import.meta.glob('../**/*.slot.{ts,tsx}', { eager: true });
