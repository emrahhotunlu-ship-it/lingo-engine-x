// Rückfall ohne Claude (Lehrer-Feedback einfügen, 28.09.2026, Kap. 3.1 „not_granted“): einfache
// Zeilen „Wort – Bedeutung“ (Bindestrich, Gedankenstrich oder Pfeil) werden zu Kartenvorschlägen.
// Rein, keine KI. Ein Ursprungssatz fehlt hier (Kap. 15 verbietet Karten ohne ihn); `ex` bleibt
// leer und muss vor dem Speichern ergänzt werden (siehe `addWord`, das ohne Satz ablehnt).

export type FallbackWord = { en: string; de: string };

const LINE = /^\s*[-*•]?\s*([A-Za-zÀ-ž][A-Za-zÀ-ž '.-]{0,58}?)\s*(?:[-–—:]|->|=>)\s*(.{1,120}?)\s*$/;

/** Höchstens 20 Zeilen im Muster „Wort – Bedeutung“; leere oder unpassende Zeilen fallen weg. */
export function parseFallbackLines(raw: string): FallbackWord[] {
  const out: FallbackWord[] = [];
  const seen = new Set<string>();
  for (const line of raw.split('\n')) {
    if (out.length >= 20) break;
    const m = LINE.exec(line);
    if (!m) continue;
    const en = (m[1] ?? '').trim();
    const de = (m[2] ?? '').trim();
    if (!en || !de || /^\d+$/.test(en)) continue;
    const key = en.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ en, de });
  }
  return out;
}
