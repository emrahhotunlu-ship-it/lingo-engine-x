import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  VButton,
  VCard,
  VChip,
  VIconButton,
  VNotice,
  VPageHead,
  VReload,
  VRing,
  VRow,
  VSheet,
  VSkeleton,
  VLoading,
  VStateList,
  VTile,
  VWeekStrip,
  ringSegments,
  type VWeekDay,
} from '../../src/ui/v';
import { vDe } from '../../src/i18n/parts/v.de';
import { vEn } from '../../src/i18n/parts/v.en';

// D1 V-BAU (docs/relaunch/stufe1c-plan.md §3.1): je Baustein Rollen und Beschriftungen, Zielgröße ≥ 44 px, Rückfall bei
// reduced-motion, Maße 1:1 aus der Vorschau-Quelle (docs/relaunch/vorschau/src/style.css). Die Messung im Browser gegen die laufende
// Vorschau macht tests/e2e/vorschau.spec.ts.

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const ROOT = new URL('../../', import.meta.url).pathname;
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const V_CSS = strip(readFileSync(`${ROOT}src/styles/parts/v.css`, 'utf8'));
const PREVIEW_CSS = strip(readFileSync(`${ROOT}docs/relaunch/vorschau/src/style.css`, 'utf8'));

/** Deklarationen eines Selektors (alle Regeln außerhalb von @media, deren Selektorliste ihn genau enthält, zusammengeführt). */
function decls(css: string, selector: string): Record<string, string> {
  const top = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const out: Record<string, string> = {};
  let found = false;
  for (const m of top.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = (m[1] ?? '').split(',').map((s) => s.trim());
    if (!sels.includes(selector)) continue;
    found = true;
    for (const d of (m[2] ?? '').split(';')) {
      const i = d.indexOf(':');
      if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
  }
  if (!found) throw new Error(`Selektor fehlt: ${selector}`);
  return out;
}

describe('Maße 1:1 aus der Vorschau (Quelle style.css)', () => {
  // [Vorschau-Selektor, App-Selektor, Eigenschaften]
  const PAIRS: Array<[string, string, string[]]> = [
    ['.phead', '.lx-v-phead', ['min-height', 'padding-top']],
    ['.phead h1', '.lx-v-phead h1', ['font-size', 'line-height', 'font-weight']],
    ['.iconbtn', '.lx-v-iconbtn', ['width', 'height', 'border-radius']],
    ['.btn', '.lx-v-btn', ['min-height', 'padding', 'border-radius', 'font-size', 'font-weight', 'gap']],
    ['.btn.ghost', ".lx-v-btn[data-variant='ghost']", ['min-height', 'font-size', 'font-weight']],
    ['.btn.sm', ".lx-v-btn[data-size='sm']", ['min-height', 'font-size', 'padding']],
    ['.card', '.lx-v-card', ['padding', 'border-radius']],
    ['.row', '.lx-v-row', ['min-height', 'padding', 'gap']],
    ['.row .ri', '.lx-v-row-ic', ['width', 'height', 'border-radius']],
    ['.row .rt b', '.lx-v-row-t b', ['font-size', 'font-weight']],
    ['.row .rt span', '.lx-v-row-t span', ['font-size']],
    ['.chip', '.lx-v-chip', ['min-height', 'padding', 'border-radius', 'font-size', 'font-weight', 'gap']],
    ['.tiles', '.lx-v-tiles', ['gap']],
    ['.tile', '.lx-v-tile', ['min-height', 'padding', 'border-radius']],
    ['.tile .th', '.lx-v-tile-h', ['font-size', 'line-height', 'gap']],
    ['.tile .big', '.lx-v-tile-big', ['font-size', 'line-height', 'font-weight', 'margin-top']],
    ['.tile .way', '.lx-v-tile-way', ['font-size', 'line-height']],
    ['.tile .one', '.lx-v-tile-one', ['font-size', 'line-height', 'padding-top']],
    ['.tile .wbar', '.lx-v-tile-bar', ['height', 'margin-top', 'border-radius', 'box-shadow']],
    ['.notice', '.lx-v-notice', ['padding', 'gap', 'font-size', 'line-height', 'border-radius']],
    ['.ring', '.lx-v-ring', ['width', 'height']],
    ['.ring .seg', '.lx-v-ring-seg', ['stroke-width', 'stroke-linecap']],
    ['.ringc b', '.lx-v-ringc b', ['font-size', 'line-height', 'font-weight']],
    ['.ringc span', '.lx-v-ringc span', ['font-size']],
    ['.week', '.lx-v-week', ['padding', 'gap']],
    ['.wd', '.lx-v-wd', ['width', 'gap', 'font-size']],
    ['.wd i', '.lx-v-wd i', ['width', 'height']],
    ['.streak b', '.lx-v-streak b', ['font-size', 'line-height', 'font-weight']],
    ['.st', '.lx-v-st', ['min-height', 'gap', 'font-size']],
    ['.st .mk', '.lx-v-st-mk', ['width', 'height']],
    ['.st .sm', '.lx-v-st-sm', ['font-size']],
    ['.sheet', '.lx-v-sheet', ['max-height', 'border-radius']],
    ['.grab', '.lx-v-grab', ['width', 'height', 'margin', 'border-radius']],
    ['.sheet h2', '.lx-v-sheet h2', ['font-size', 'line-height', 'font-weight', 'margin']],
    ['.sheet .sb', '.lx-v-sheet-body', ['padding-top', 'padding-bottom']],
    ['.sheet .sf', '.lx-v-sheet-foot', ['padding-top', 'padding-bottom', 'border-top']],
    ['.sk', '.lx-v-sk', ['border-radius', 'background-size']],
  ];
  it.each(PAIRS)('%s → %s', (pre, app, props) => {
    const a = decls(PREVIEW_CSS, pre);
    const b = decls(V_CSS, app);
    for (const p of props) expect(`${p}: ${b[p]}`, `${app} ${p}`).toBe(`${p}: ${a[p]}`);
  });
});

describe('Zielgröße ≥ 44 px und Bewegung', () => {
  it('jedes bedienbare Element hat mindestens 44 px', () => {
    const px = (v: string | undefined) => Number(/^(\d+)px$/.exec(v ?? '')?.[1] ?? NaN);
    expect(px(decls(V_CSS, '.lx-v-iconbtn').width)).toBeGreaterThanOrEqual(44);
    expect(px(decls(V_CSS, '.lx-v-iconbtn').height)).toBeGreaterThanOrEqual(44);
    expect(px(decls(V_CSS, '.lx-v-btn')['min-height'])).toBeGreaterThanOrEqual(44);
    expect(px(decls(V_CSS, ".lx-v-btn[data-variant='ghost']")['min-height'])).toBeGreaterThanOrEqual(44);
    expect(px(decls(V_CSS, ".lx-v-btn[data-size='sm']")['min-height'])).toBeGreaterThanOrEqual(44);
    expect(px(decls(V_CSS, '.lx-v-row')['min-height'])).toBeGreaterThanOrEqual(44);
    expect(px(decls(V_CSS, '.lx-v-ring').width)).toBeGreaterThanOrEqual(44);
    // Bedienbarer Chip: 34 px sichtbar + je 5 px unsichtbar oben und unten = 44 px.
    expect(px(decls(V_CSS, 'button.lx-v-chip')['min-height'])).toBe(34);
    expect(decls(V_CSS, 'button.lx-v-chip::before').inset).toBe('-5px 0');
  });

  it('jede Animation hat einen Rückfall bei reduced-motion und bei Effekten „Aus“', () => {
    const animated = [...V_CSS.matchAll(/([^{}]+)\{[^{}]*animation:[^{}]*\}/g)]
      .flatMap((m) => (m[1] ?? '').split(','))
      .map((s) => s.trim())
      .filter((s) => !s.startsWith('[data-fx') && !s.startsWith('@') && !s.startsWith('from') && !s.startsWith('to'));
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(V_CSS)?.[1] ?? '';
    const fxOff = V_CSS.split('\n').filter((l) => l.startsWith("[data-fx='off']")).join('\n');
    expect(animated.length).toBeGreaterThan(4);
    for (const sel of animated) {
      const base = sel.split(' ').find((p) => p.startsWith('.lx-v-'))?.replace(/\[.*$/, '') ?? sel;
      expect(reduced, `reduced-motion: ${sel}`).toContain(base.replace(/:.*$/, ''));
      expect(fxOff, `data-fx off: ${sel}`).toContain(base.replace(/:.*$/, ''));
    }
  });

  it('keine Glasflächen und keine festen Farben', () => {
    expect(V_CSS).not.toMatch(/backdrop-filter/);
    expect(V_CSS).not.toMatch(/#[0-9a-f]{3,8}\b|oklch\(|rgba?\(/i);
  });
});

describe('Bausteine: Rollen und Beschriftungen', () => {
  it('VPageHead: Kopf mit h1 und rechten Knöpfen', () => {
    const s = html(h(VPageHead, { title: 'Wörter', right: h(VIconButton, { icon: 'ask', label: 'Fragen' }) }));
    expect(s).toMatch(/^<header class="lx-v-phead lx-v-gx"><h1 class="lx-v-disp">Wörter<\/h1>/);
    expect(s).toContain('aria-label="Fragen"');
    expect(s).toContain('type="button"');
  });

  it('VButton: Varianten, Größe, volle Breite, belegt', () => {
    expect(html(h(VButton, { variant: 'pri', full: true, children: 'Los geht’s' }))).toBe(
      '<button type="button" class="lx-v-btn" data-variant="pri" data-full=""><span>Los geht’s</span></button>',
    );
    const busy = html(h(VButton, { size: 'sm', busy: true, busyLabel: 'Lädt …', children: 'Erneut laden' }));
    expect(busy).toContain('data-size="sm"');
    expect(busy).toContain('disabled=""');
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain('Lädt …');
  });

  it('VCard und VNotice', () => {
    expect(html(h(VCard, { raised: true, children: 'x' }))).toBe('<div class="lx-v-card" data-raised="">x</div>');
    const n = html(h(VNotice, { icon: 'info', live: true, children: 'Claude antwortet gerade nicht.' }));
    expect(n).toContain('role="status"');
    expect(n).toContain('aria-hidden="true"');
  });

  it('VRow: Knopf mit Pfeil, Anzeige ohne', () => {
    const b = html(h(VRow, { icon: 'book', title: 'Lesen', sub: 'Tagesartikel', onClick: () => {} }));
    expect(b.startsWith('<button type="button" class="lx-v-row">')).toBe(true);
    expect(b).toContain('lx-v-row-chev');
    const d = html(h(VRow, { title: 'Lesen' }));
    expect(d.startsWith('<div class="lx-v-row">')).toBe(true);
    expect(d).not.toContain('lx-v-row-chev');
  });

  it('VChip: Anzeige als span, Filter als Knopf mit aria-pressed', () => {
    expect(html(h(VChip, { children: 'lead time', lang: 'en' }))).toBe('<span class="lx-v-chip" lang="en"><span>lead time</span></span>');
    const f = html(h(VChip, { children: 'Alle', count: '214', selected: true, onClick: () => {} }));
    expect(f).toContain('aria-pressed="true"');
    expect(f).toContain('<span class="lx-v-chip-n lx-v-num">214</span>');
  });

  it('VTile: Kachel mit Zahl und Einheit; bedienbar als Knopf', () => {
    const t = html(h(VTile, { ch: 'w', head: 'Bildest du selbst', big: '–', line: 'noch zu wenig Belege' }));
    expect(t).toContain('class="lx-v-tile"');
    expect(t).toContain('lx-v-tile-big');
    expect(t).not.toMatch(/<button/);
    expect(html(h(VTile, { head: 'x', big: '1', unit: '%', onClick: () => {} }))).toMatch(/^<button type="button" class="lx-v-tile">.*<small>%<\/small>/);
  });

  it('VRing: ein Segment je Block, Bogen nach Minuten, Knopf mit aria-expanded', () => {
    const blocks = [{ minutes: 6 }, { minutes: 8 }, { minutes: 4 }, { minutes: 4 }, { minutes: 5 }];
    const segs = ringSegments(blocks);
    expect(segs).toHaveLength(5);
    // Erster Bogen beginnt 4° nach 12 Uhr (Abstand 8° je Grenze, Vorschau app.js:118–121).
    const [x0, y0] = /^M([\d.]+) ([\d.]+)/.exec(segs[0] ?? '')!.slice(1).map(Number) as [number, number];
    expect(x0).toBeCloseTo(100 + 86 * Math.cos((-86 * Math.PI) / 180), 1);
    expect(y0).toBeCloseTo(100 + 86 * Math.sin((-86 * Math.PI) / 180), 1);
    const s = html(h(VRing, { blocks, done: 2, partial: 0.5, label: vDe.vRingShowBlocks, onActivate: () => {}, expanded: false, children: 'x' }));
    expect(s).toContain('aria-label="Blöcke von heute zeigen"');
    expect(s).toContain('aria-expanded="false"');
    expect((s.match(/lx-v-ring-trk/g) ?? []).length).toBe(5);
    expect((s.match(/lx-v-ring-on/g) ?? []).length).toBe(3); // zwei erledigt + einer anteilig
    expect(s).toContain('stroke-dasharray="50.0 100"');
    const img = html(h(VRing, { blocks, done: 0, label: 'Plan heute' }));
    expect(img).toContain('role="img"');
    expect(ringSegments([])).toEqual([]);
    expect(ringSegments([{ minutes: 10 }])).toHaveLength(1);
  });

  it('VWeekStrip: Zustand je Tag als Text, heute mit aria-current', () => {
    const labels = { done: vDe.vDayDone, today: vDe.vDayToday, todayDone: vDe.vDayTodayDone, rest: vDe.vDayRest, open: vDe.vDayOpen };
    const days: VWeekDay[] = ['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((short, i) => ({
      short,
      name: `Tag ${i + 1}`,
      state: (i < 3 ? 'done' : i === 3 ? 'today' : i === 6 ? 'rest' : 'open'),
    }));
    const s = html(h(VWeekStrip, { days, label: vDe.vWeek, stateLabels: labels, streak: { value: '14', label: vDe.vStreak_other } }));
    expect((s.match(/<li /g) ?? []).length).toBe(7);
    expect(s).toContain('aria-label="Diese Woche"');
    expect(s).toContain('aria-current="date"');
    expect(s).toContain('Tag 7: Ruhetag');
    expect(s).toContain('<b class="lx-v-disp lx-v-num">14</b>Tage Serie');
  });

  it('VStateList: Liste ohne Knöpfe, laufender Schritt markiert', () => {
    const s = html(
      h(VStateList, {
        label: vDe.vRingBlocks,
        stateLabels: { done: vDe.vStepDone, run: vDe.vStepRun, open: vDe.vStepOpen },
        steps: [
          { id: 'a', name: 'Gestern-Check', meta: '6 Min.', state: 'done', ch: 'w' },
          { id: 'b', name: 'Wörter', meta: 'läuft', state: 'run', ch: 'w' },
          { id: 'c', name: 'Grammatik', meta: '4 Min.', state: 'open', ch: 'g' },
        ],
      }),
    );
    expect(s).not.toContain('<button');
    expect(s).toContain('aria-current="step"');
    expect(s).toContain('data-state="done"');
    expect(s).toContain('<span class="sr-only">erledigt</span>');
  });

  it('VSheet: geschlossen nichts im Dokument', () => {
    expect(html(h(VSheet, { open: false, onClose: () => {}, title: 'Mehr', closeLabel: 'Schließen', children: 'x' }))).toBe('');
  });

  it('VSkeleton, VLoading und VReload', () => {
    expect(html(h(VSkeleton, { width: 188, height: 188, round: true }))).toBe(
      '<span class="lx-v-sk" data-round="" style="width:188px;height:188px" aria-hidden="true"></span>',
    );
    const l = html(h(VLoading, { label: vDe.vLoading, children: h(VSkeleton, {}) }));
    expect(l).toContain('aria-busy="true"');
    const r = html(h(VReload, { message: vDe.vLoadFailed, retryLabel: vDe.vReload, onRetry: () => {} }));
    expect(r).toContain('role="status"');
    expect(r).toContain('data-variant="sec"');
    expect(r).not.toContain('data-variant="pri"');
  });
});

describe('Texte der Bausteine (DE/EN)', () => {
  it('gleiche Schlüssel, keine leeren Texte, keine Ziffern außer Platzhaltern', () => {
    expect(Object.keys(vEn).sort()).toEqual(Object.keys(vDe).sort());
    for (const [k, v] of [...Object.entries(vDe), ...Object.entries(vEn)]) {
      expect(v.trim(), k).not.toBe('');
      expect(v.replace(/\{\w+\}/g, ''), k).not.toMatch(/\d/);
    }
  });
});
