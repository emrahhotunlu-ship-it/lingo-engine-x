import { z } from 'zod';
import articlesRaw from './articles.json?raw';
import { logError } from '../../platform/diagnostics';

// Artikel-Vorrat für „Einen Artikel zusammenfassen“ (W5 K8, Lehrer-Prüfung F3): geprüfte Texte für Tage ohne Tagesartikel. Als Text eingebettet und erst
// beim ersten Gebrauch geparst (nur der Schreibbildschirm des Moduls Anwenden lädt ihn). Jeder Eintrag wird mit zod geprüft; ungültige fallen weg und landen
// in der Diagnose. Die Kernpunkte stehen fest im Text (derselbe Maßstab bei jeder Prüfung, keine zusätzliche Anfrage).

const StockSchema = z.object({
  id: z.string().regex(/^av\d{2}$/),
  topic: z.enum(['dms', 'saas', 'work', 'tech', 'economy']),
  title: z.string().min(10).max(160),
  text: z.string().min(600).max(2_400),
  points: z.array(z.string().min(12).max(160)).min(3).max(4),
});
export type StockArticle = z.infer<typeof StockSchema>;

let cache: readonly StockArticle[] | null = null;

/** Die Texte des Vorrats (leer, wenn die Datei unlesbar ist). */
export function articleStock(): readonly StockArticle[] {
  if (cache) return cache;
  const out: StockArticle[] = [];
  try {
    const raw = JSON.parse(articlesRaw) as { items?: unknown };
    (Array.isArray(raw.items) ? raw.items : []).forEach((item, i) => {
      const r = StockSchema.safeParse(item);
      if (r.success) out.push(r.data);
      else logError('content:apply:articles', r.error, `Eintrag ${i} ungültig`);
    });
  } catch (err) {
    logError('content:apply:articles', err, 'articles.json nicht lesbar');
  }
  cache = out;
  return cache;
}
