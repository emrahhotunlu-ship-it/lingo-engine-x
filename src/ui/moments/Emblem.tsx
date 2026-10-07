// Embleme (Lernplattform 3.0 P60, Motivation §4.2): sieben Kapitel-Embleme und eines für „Bereit für C1“, als kleine SVG-Monogramme (je ≈ 400 B).
// Ein Rahmen (Sechseck für Kapitel, Doppelkreis für C1), eine ruhige Fläche und ein Zeichen für das Thema. Der Rahmen und das Zeichen zeichnen sich
// im Aufstieg einmal nach (`data-draw`, `pathLength=1`), die Fläche blendet danach auf (`data-fill`). Keine Schrift im Bild, keine Fremddateien.

export type EmblemId = 'k1' | 'k2' | 'k3' | 'k4' | 'k5' | 'k6' | 'k7' | 'c1';
export const EMBLEM_IDS: readonly EmblemId[] = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'c1'];

const HEX = 'M24 3l18.2 10.5v21L24 45 5.8 34.5v-21z';
const HEX_IN = 'M24 8l13.9 8v16L24 40l-13.9-8V16z';

/** Zeichen je Emblem (24 × 24 Mitte bei 24/24). */
export const EMBLEM_MARK: Readonly<Record<EmblemId, string>> = {
  // Zeiten: Uhrzeiger.
  k1: 'M24 15v9l6 4',
  // Zukunft: Pfeil nach vorn.
  k2: 'M15 24h17M27 18.5l5.5 5.5-5.5 5.5',
  // Bedingung und Wunsch: Weggabelung.
  k3: 'M24 33v-8M24 25l-7-8M24 25l7-8',
  // Passiv und Berichten: Sprechblase.
  k4: 'M16 17h16v11h-8l-5 4v-4h-3z',
  // Modalität: Waage.
  k5: 'M24 15v18M16 19h16M16 19l-3 7h6zM32 19l-3 7h6z',
  // Verbmuster: Glieder einer Kette.
  k6: 'M14 24h5M29 24h5M19 20h10v8H19z',
  // Satzbau und Betonung: Zeilen mit betonter Mitte.
  k7: 'M15 18h18M15 24h12M15 30h18M30 24h3',
  // C1: Stern.
  c1: 'M24 13.5l3.1 6.4 7 1-5.1 5 1.2 7L24 29.6l-6.2 3.3 1.2-7-5.1-5 7-1z',
};

type Props = { id: EmblemId; size?: number; label: string };

export function Emblem({ id, size = 88, label }: Props) {
  const c1 = id === 'c1';
  return (
    <svg className="lx-emblem" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={label} data-testid="emblem" data-id={id}>
      {c1 ? (
        <>
          <circle data-fill="" cx="24" cy="24" r="16" fill="currentColor" opacity="0.12" />
          <circle data-draw="" cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="1.6" pathLength={1} />
          <circle data-draw="" cx="24" cy="24" r="17.5" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.6" pathLength={1} />
        </>
      ) : (
        <>
          <path data-fill="" d={HEX_IN} fill="currentColor" opacity="0.12" />
          <path data-draw="" d={HEX} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" pathLength={1} />
        </>
      )}
      <path data-draw="" d={EMBLEM_MARK[id]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
    </svg>
  );
}
