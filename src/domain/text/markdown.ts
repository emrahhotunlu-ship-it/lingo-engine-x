// Toleranter Markdown-Parser für Claude-Antworten (Phase 5, E5-08). Rein, ohne Abhängigkeit.
// Unterstützt: Absätze, Zeilenumbrüche, **fett**, *kursiv*/_kursiv_, `code`, Listen (-, *, •, 1.),
// Zitate (>), Überschriften (#…), Code-Blöcke (```). Alles andere – Links, Tabellen, HTML –
// bleibt wörtlicher Text; React maskiert ihn beim Anzeigen (kein innerHTML).
// Unfertige Marker (während des Streamens, z. B. `**bol`) erscheinen als Text. Der Parser
// wirft nie, auch nicht für beliebige Präfixe einer Antwort.

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string };

export type Block =
  | { type: 'p'; inline: Inline[] }
  | { type: 'h'; inline: Inline[] }
  | { type: 'quote'; inline: Inline[] }
  | { type: 'ul' | 'ol'; items: Inline[][] }
  | { type: 'code'; text: string };

const UL = /^\s{0,3}[-*•+]\s+(.*)$/;
const OL = /^\s{0,3}\d{1,3}[.)]\s+(.*)$/;
const HEAD = /^\s{0,3}#{1,6}\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const FENCE = /^\s{0,3}```/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

function pushText(out: Inline[], text: string): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === 'text') last.text += text;
  else out.push({ type: 'text', text });
}

/** Inline-Auszeichnungen. `depth` begrenzt die Verschachtelung (fett in kursiv und umgekehrt). */
export function parseInline(src: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i + 1) {
        out.push({ type: 'code', text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    } else if (ch === '*' && src[i + 1] === '*' && depth < 3) {
      const end = src.indexOf('**', i + 2);
      if (end > i + 2 && src[i + 2] !== ' ' && src[end - 1] !== ' ') {
        out.push({ type: 'strong', children: parseInline(src.slice(i + 2, end), depth + 1) });
        i = end + 2;
        continue;
      }
    } else if ((ch === '*' || ch === '_') && depth < 3) {
      const prev = i > 0 ? (src[i - 1] ?? '') : '';
      // `_` mitten im Wort (snake_case) ist kein Marker.
      const opens = src[i + 1] !== undefined && src[i + 1] !== ' ' && src[i + 1] !== ch && !(ch === '_' && /\w/.test(prev));
      if (opens) {
        let end = src.indexOf(ch, i + 1);
        while (end > 0 && ch === '*' && src[end + 1] === '*') end = src.indexOf(ch, end + 2);
        const after = end >= 0 ? (src[end + 1] ?? '') : '';
        if (end > i + 1 && src[end - 1] !== ' ' && !(ch === '_' && /\w/.test(after))) {
          out.push({ type: 'em', children: parseInline(src.slice(i + 1, end), depth + 1) });
          i = end + 1;
          continue;
        }
      }
    }
    pushText(out, ch ?? '');
    i += 1;
  }
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', inline: parseInline(para.join('\n')) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (FENCE.test(line)) {
      flush();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i] ?? '')) code.push(lines[i++] ?? '');
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (RULE.test(line)) {
      flush();
      continue;
    }
    const h = HEAD.exec(line);
    if (h) {
      flush();
      blocks.push({ type: 'h', inline: parseInline(h[1] ?? '') });
      continue;
    }
    const q = QUOTE.exec(line);
    if (q) {
      flush();
      const parts = [q[1] ?? ''];
      while (i + 1 < lines.length && QUOTE.test(lines[i + 1] ?? '')) parts.push(QUOTE.exec(lines[++i] ?? '')?.[1] ?? '');
      blocks.push({ type: 'quote', inline: parseInline(parts.join('\n')) });
      continue;
    }
    const ul = UL.exec(line);
    const ol = ul ? null : OL.exec(line);
    if (ul || ol) {
      flush();
      const kind = ul ? 'ul' : 'ol';
      const re = ul ? UL : OL;
      const items: Inline[][] = [parseInline((ul ?? ol)?.[1] ?? '')];
      while (i + 1 < lines.length) {
        const next = lines[i + 1] ?? '';
        const m = re.exec(next);
        if (m) {
          items.push(parseInline(m[1] ?? ''));
          i += 1;
        } else if (next.trim() && /^\s{2,}\S/.test(next)) {
          // Eingerückte Fortsetzung gehört zum letzten Punkt.
          const last = items[items.length - 1];
          if (last) pushText(last, `\n${next.trim()}`);
          i += 1;
        } else break;
      }
      blocks.push({ type: kind, items });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** Reiner Text einer Inline-Folge (für Spracherkennung und Tests). */
export function inlineText(inl: readonly Inline[]): string {
  return inl.map((n) => (n.type === 'text' || n.type === 'code' ? n.text : inlineText(n.children))).join('');
}
