import { expect, test, type Page } from '@playwright/test';
import { bootAt, screen } from './fixtures';

// Lernplattform 2.0 §7 / §10.4 P1 (Abnahme): „Grün heißt richtig“ und „Ausgewählt ist nicht Richtig“ in allen
// 4 Paletten × 3 Modi. Geprüft werden berechnete Stile von Bausteinen mit den Klassen der App; die Farben kommen
// aus den Tokens (`--lx-ok*`), nie aus der Palette.

const PALETTES = ['sage', 'ocean', 'plum', 'graphite'] as const;
const THEMES = ['dark', 'dim', 'light'] as const;

type Probe = {
  tokens: Record<'ok' | 'okText' | 'okSoft' | 'fg' | 'lineStrong' | 'nearSoft' | 'wrong', string>;
  verdict: string;
  choiceCorrect: { border: string; bg: string; mark: string };
  choiceSelected: { border: string; bg: string; width: string };
  gapCorrect: { bg: string; shadow: string };
  spotSelected: { bg: string; shadow: string };
  tileSelected: { border: string; bg: string };
  tileOk: { border: string; bg: string };
};

async function probe(page: Page, theme: string, palette: string): Promise<Probe> {
  return page.evaluate(
    ([th, pal]) => {
      const root = document.documentElement;
      root.dataset.theme = th;
      if (pal === 'sage') delete root.dataset.palette;
      else root.dataset.palette = pal;
      const host = document.createElement('div');
      host.id = 'lx-probe';
      host.innerHTML = `
        <span id="p-ok" style="color:var(--lx-ok);background:var(--lx-ok-soft);border:2px solid var(--lx-fg)"></span>
        <span id="p-oktext" style="color:var(--lx-ok-text)"></span>
        <span id="p-fg" style="color:var(--lx-fg);background:var(--lx-line-strong);border:2px solid var(--lx-ok);outline-color:var(--lx-near-soft)"></span>
        <span id="p-near" style="color:var(--lx-wrong);background:var(--lx-near-soft)"></span>
        <p id="p-verdict" class="text-ok-text">Richtig</p>
        <button id="c-correct" class="lx-choice" data-state="correct" aria-pressed="true"><span class="lx-choice-mark" data-mark="correct">✓</span></button>
        <button id="c-sel" class="lx-choice" aria-pressed="true"></button>
        <span id="g-correct" class="lx-gap" data-state="correct"></span>
        <span id="s-sel" class="lx-spot" data-selected></span>
        <span id="t-sel" class="lx-tile" data-selected></span>
        <span id="t-ok" class="lx-tile" data-state="ok"></span>`;
      document.body.appendChild(host);
      const q = (id: string) => getComputedStyle(host.querySelector(`#${id}`) as HTMLElement);
      const out: Probe = {
        tokens: { ok: q('p-ok').color, okText: q('p-oktext').color, okSoft: q('p-ok').backgroundColor, fg: q('p-fg').color, lineStrong: q('p-fg').backgroundColor, nearSoft: q('p-near').backgroundColor, wrong: q('p-near').color },
        verdict: q('p-verdict').color,
        choiceCorrect: { border: q('c-correct').borderTopColor, bg: q('c-correct').backgroundColor, mark: q('c-correct').getPropertyValue('color') },
        choiceSelected: { border: q('c-sel').borderTopColor, bg: q('c-sel').backgroundColor, width: q('c-sel').borderTopWidth },
        gapCorrect: { bg: q('g-correct').backgroundColor, shadow: q('g-correct').boxShadow },
        spotSelected: { bg: q('s-sel').backgroundColor, shadow: q('s-sel').boxShadow },
        tileSelected: { border: q('t-sel').borderTopColor, bg: q('t-sel').backgroundColor },
        tileOk: { border: q('t-ok').borderTopColor, bg: q('t-ok').backgroundColor },
      };
      host.remove();
      return out;
    },
    [theme, palette] as const,
  );
}

for (const palette of PALETTES) {
  for (const theme of THEMES) {
    test(`Richtig ist grün, Ausgewählt ist neutral: ${palette} / ${theme}`, async ({ page }) => {
      await bootAt(page, { name: 'today' }, { theme });
      await screen(page, 'today');
      const p = await probe(page, theme, palette);
      // Richtig: die Schrift der Urteilszeile trägt `--lx-ok-text`, Option und Lücke `--lx-ok` auf `--lx-ok-soft`.
      expect(p.verdict).toBe(p.tokens.okText);
      expect(p.choiceCorrect.border).toBe(p.tokens.ok);
      expect(p.choiceCorrect.bg).toBe(p.tokens.okSoft);
      expect(p.gapCorrect.bg).toBe(p.tokens.okSoft);
      expect(p.gapCorrect.shadow).toContain(p.tokens.ok);
      expect(p.tileOk.border).toBe(p.tokens.ok);
      expect(p.tileOk.bg).toBe(p.tokens.okSoft);
      // Ausgewählt: neutraler Rahmen in der Schriftfarbe, Fläche `--lx-line-strong`, nie `--lx-ok`.
      expect(p.choiceSelected.border).toBe(p.tokens.fg);
      expect(p.choiceSelected.border).not.toBe(p.tokens.ok);
      expect(p.choiceSelected.bg).toBe(p.tokens.lineStrong);
      expect(p.choiceSelected.width).toBe('2px');
      expect(p.choiceSelected.bg).not.toBe(p.choiceCorrect.bg);
      expect(p.choiceSelected.border).not.toBe(p.choiceCorrect.border);
      expect(p.spotSelected.shadow).not.toContain(p.tokens.ok);
      expect(p.tileSelected.border).toBe(p.tokens.fg);
      expect(p.tileSelected.bg).toBe(p.tokens.lineStrong);
    });
  }
}
