// Vertrag der gemeinsamen Rückmeldung (docs/neubau/plan.md §4.10, WP0a). Jede Übung bildet ihr
// Ergebnis auf `Feedback` ab; `<FeedbackPanel fb={…} onNext={…}/>` sortiert und kappt selbst
// (höchstens 3 Korrekturen, höchstens 2 Verbesserungen). Fertig gestaltet in WP0b (N05–N07).

/**
 * Eine Korrektur: was ich geschrieben habe, was richtig ist, warum. `why` steht nach JEDEM Versuch,
 * auch bei `verdict: 'ok'` (Prüfbefund M9) – dann z. B. als Begründung der richtigen Form.
 */
export type Fix = {
  /** Reihenfolge der Anzeige: Bedeutung vor Falle vor Ziel vor Form. */
  kind: 'meaning' | 'trap' | 'goal' | 'form';
  mine: string;
  right: string;
  why: string;
  /** Deutsch-Falle (Startsatz-ID), wenn die Korrektur eine bekannte Falle ist. */
  trapId?: string;
};

/** Natürlichere Fassung („klingt besser“), ohne Fehler zu sein. */
export type Upgrade = { to: string; from?: string; note?: string };

export type Feedback = {
  /** `unchecked`: ohne KI gespeichert (A6.3, G6) – nie als Fehler dargestellt. */
  verdict: 'ok' | 'close' | 'wrong' | 'unchecked';
  /** Wirkung in einem Satz („Klingt höflich, aber etwas steif.“). */
  effect?: string;
  mine?: string;
  solution?: string;
  fixes: Fix[];
  upgrades?: Upgrade[];
  /** Hinweis vor der Lösung (erst Hinweis, dann Lösung). */
  retryHint?: string;
  /** „Nochmal, aber besser“: neuer Versuch derselben Aufgabe. */
  again?: () => void;
  /** „Warum?“ öffnet das Claude-Blatt mit fertiger Frage (P6). */
  why?: { question: string };
};

export const MAX_FIXES = 3;
export const MAX_UPGRADES = 2;

const FIX_ORDER: Record<Fix['kind'], number> = { meaning: 0, trap: 1, goal: 2, form: 3 };

/** Sortiert (Bedeutung → Falle → Ziel → Form) und kappt auf höchstens 3 Korrekturen (rein, getestet). */
export function topFixes(fixes: readonly Fix[]): Fix[] {
  return [...fixes].sort((a, b) => FIX_ORDER[a.kind] - FIX_ORDER[b.kind]).slice(0, MAX_FIXES);
}

/** Höchstens 2 Verbesserungen. */
export function topUpgrades(upgrades: readonly Upgrade[] | undefined): Upgrade[] {
  return (upgrades ?? []).slice(0, MAX_UPGRADES);
}
