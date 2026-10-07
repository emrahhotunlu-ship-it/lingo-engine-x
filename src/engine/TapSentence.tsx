import { SpotSentence, type SpotMark } from './SpotSentence';
import type { WordTapArea } from './wordTap';

// Satz mit antippbaren Wörtern (Lernplattform 3.0 §3.1, P17, „Fehler finden“): jedes Wort ein Knopf mit Trefferfläche ≥ 44 × 44 px; ein Tipp wählt
// das Wort (nochmal = abwählen), ←/→ bewegen den Fokus. WÄHREND der Frage gibt es kein Nachschlagen (die Wörter sind Auswahlknöpfe), NACH dem Prüfen
// öffnet jedes Wort wieder das Nachschlagen. Gewählt ist neutral, nie „richtig“; Ergebnisfarben kommen nur über `marks` (mit ✓/✕ und Text).

export type TapSentenceProps = {
  words: string[];
  /** Index des gewählten Worts oder `null`. */
  selected: number | null;
  onSelect: (i: number | null) => void;
  locked: boolean;
  marks?: SpotMark[];
  area?: WordTapArea;
  source?: string | null;
  testId?: string;
  /** Handy: jedes Wort mindestens 44 × 44 px (Standard). Am Laptop genügt die normale Größe. */
  wide?: boolean;
};

export function TapSentence({ words, selected, onSelect, locked, marks, area = 'trainer', source = null, testId = 'tap-sentence', wide = true }: TapSentenceProps) {
  return (
    <SpotSentence
      words={words}
      pick="one"
      selected={selected === null ? null : [selected, selected]}
      onSelect={(s) => onSelect(s ? s[0] : null)}
      locked={locked}
      {...(marks ? { marks } : {})}
      area={area}
      source={source}
      testId={testId}
      wide={wide}
    />
  );
}
