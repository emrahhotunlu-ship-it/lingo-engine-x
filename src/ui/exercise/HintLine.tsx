// Eine Hinweiszeile (§4.3): Tipp, Leitfrage beim Zweitversuch, Fokus. Cyan (`hint`) bzw. Gold (`near`).

export function HintLine({ text, tone }: { text: string; tone: 'hint' | 'near' }) {
  return (
    <p className={`lx-t-support ${tone === 'near' ? 'text-near-text' : 'text-hint-text'}`} data-testid="hint-line" data-tone={tone} role="note">
      {text}
    </p>
  );
}
