// Emrah 08.11.2026 (Live-Kommentar „Passt die Erläuterung zu dieser Übung“): bei „The recruiter told us that the offer will be ready the
// following week.“ (Muster pp.reported) zeigte die Karte „Regel“ die erste Falle des ganzen Themas: „… the film had already started“.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { patternById } from '../../src/domain/grammar/patterns';
import { RuleSide } from '../../src/features/grammar/RuleSide';

// Englische Wörter stehen einzeln antippbar in Spannen: verglichen wird der reine Text.
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

describe('Karte „Regel“ folgt dem Muster der Aufgabe', () => {
  it('pp.reported: Regel, Falle und Signalwörter der indirekten Rede, nicht das Film-Beispiel', () => {
    const p = patternById('past-perfect:pp.reported');
    expect(p).toBeTruthy();
    const html = text(renderToStaticMarkup(createElement(RuleSide, { topic: 'past-perfect', pattern: p, onWhole: () => undefined })));
    expect(html).not.toContain('the film had already started');
    expect(html).toContain('would send the report');
    expect(html).toContain('the following week');
  });
  it('ohne Muster bleibt die Themenregel', () => {
    const html = text(renderToStaticMarkup(createElement(RuleSide, { topic: 'past-perfect', onWhole: () => undefined })));
    expect(html).toContain('the film had already started');
  });
});
