import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readArticleReply, readTopicsReply } from '../../../src/platform/dev/canned/read';
import { acceptArticle } from '../../../src/modules/read/domain/accept';
import { parseDayDoc, parseMonthDoc, parsePrefs } from '../../../src/modules/read/domain/docs';
import { readDocCountOf } from '../../../src/modules/read/domain/count';
import { TOPIC_KEYS } from '../../../src/modules/read/schemas';
import type { TopicKey } from '../../../src/modules/read/schemas';
import { readArticle, readTopics } from '../../../src/modules/read/prompt';

// Feste Antworten des Entwicklungs-Adapters und erfundener Seed für das Lesen-Modul.

const prompt = (topic: TopicKey, recent: Array<{ title: string }> = [], custom?: string) => readArticle.build({ topic, ...(custom ? { custom } : {}), date: '2026-10-02', recent });

describe('Dev-Adapter: read-article@1', () => {
  it('besteht für jedes Thema alle neun Prüftore (acceptArticle) und trägt das angefragte Thema', () => {
    for (const k of TOPIC_KEYS) {
      const custom = k === 'custom' ? 'Pricing for dev tools' : undefined;
      const res = acceptArticle(JSON.parse(readArticleReply(prompt(k, [], custom))) as unknown, { topic: k });
      expect(res.ok, `${k}: ${res.ok ? '' : JSON.stringify(res.issues.slice(0, 3))}`).toBe(true);
      if (res.ok) expect(res.article.topic).toBe(k);
    }
  });

  it('der Titel ist neu, auch wenn der Verlauf den Grundtitel schon enthält (Dublettentor)', () => {
    const first = JSON.parse(readArticleReply(prompt('saas'))) as { title: string };
    const second = JSON.parse(readArticleReply(prompt('saas', [{ title: first.title }]))) as { title: string };
    expect(second.title).not.toBe(first.title);
    expect(second.title).toBe('Three Practical Questions About Pricing');
    expect(acceptArticle(second, { topic: 'saas', recent: [{ title: first.title }] }).ok).toBe(true);
  });

  it('acht Artikel desselben Themas hintereinander bestehen das Dublettentor (jeder Titel deutlich anders)', () => {
    const recent: Array<{ title: string; topic: string }> = [];
    for (let i = 0; i < 8; i++) {
      const a = JSON.parse(readArticleReply(prompt('ai', recent))) as { title: string };
      const res = acceptArticle(a, { topic: 'ai', recent });
      expect(res.ok, a.title).toBe(true);
      recent.unshift({ title: a.title, topic: 'ai' });
    }
    expect(new Set(recent.map((r) => r.title)).size).toBe(8);
  });

  it('Sonderwörter im eigenen Thema: zzjson → kein JSON; zzbad → erste Antwort fällt durch, der Neuversuch besteht', () => {
    expect(() => {
      JSON.parse(readArticleReply(prompt('custom', [], 'zzjson')));
    }).toThrow();
    const bad = JSON.parse(readArticleReply(prompt('custom', [], 'zzbad'))) as unknown;
    expect(acceptArticle(bad, { topic: 'custom' }).ok).toBe(false);
    const retryPrompt = `${prompt('custom', [], 'zzbad')}\n\nYour previous reply did not match the required format:\n- x`;
    expect(acceptArticle(JSON.parse(readArticleReply(retryPrompt)) as unknown, { topic: 'custom' }).ok).toBe(true);
  });
});

describe('Dev-Adapter: read-topics@1', () => {
  it('liefert bis zu sechs Vorschläge, die das Schema der Vorlage bestehen, und lässt Gewähltes weg', () => {
    const out = readTopics.schema({ active: [] }).parse(JSON.parse(readTopicsReply(readTopics.build({ active: [] }))));
    expect(out.topics).toHaveLength(6);
    const again = JSON.parse(readTopicsReply(readTopics.build({ active: ['Pricing strategy for B2B software'] }))) as { topics: string[] };
    expect(again.topics).not.toContain('Pricing strategy for B2B software');
  });
});

describe('Seed: erfundene Lesetage', () => {
  const seed = JSON.parse(readFileSync(join(import.meta.dirname, '../../../seed/sample-data.json'), 'utf8')) as Record<string, Record<string, unknown>>;
  const readDocs = Object.keys(seed).filter((k) => k.startsWith('read/'));

  it('zwei Tage, drei Artikel; Tages- und Monatsdokumente und Einstellungen bestehen die Feinprüfung ohne ausgeblendete Einträge', () => {
    const dayPaths = readDocs.filter((k) => k.startsWith('read/d-'));
    expect(dayPaths).toHaveLength(2);
    let articles = 0;
    const ids = new Set<string>();
    for (const p of dayPaths) {
      const d = parseDayDoc(seed[p]);
      expect(d.ok && d.hidden).toEqual([]);
      if (d.ok) {
        articles += d.items.length;
        for (const i of d.items) ids.add(i.id);
        for (const i of d.items) expect(i.keyWords).toHaveLength(5);
      }
    }
    expect(articles).toBe(3);
    const m = parseMonthDoc(seed['read/m-2026-09']);
    expect(m.ok && m.hidden).toEqual([]);
    expect(m.ok && m.items.map((i) => i.id).sort()).toEqual([...ids].sort());
    expect(parsePrefs(seed['read/p']).view).toBe('b');
  });

  it('die Dokumentzählung aus read/p stimmt mit den Dokumenten im Seed überein', () => {
    expect(readDocCountOf(seed['read/p'])).toBe(readDocs.length);
  });

  it('der Seed ist erfunden: keine echten Namen oder Adressen', () => {
    const text = JSON.stringify(readDocs.map((k) => seed[k]));
    expect(text).not.toMatch(/@|https?:\/\//);
  });
});
