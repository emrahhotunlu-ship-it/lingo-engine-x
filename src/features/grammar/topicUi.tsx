import { topicById } from '../../domain/content';

// Kleine Bausteine der Grammatik-Bildschirme (eigene Datei, damit Pfadliste und Seite sich nicht gegenseitig importieren).

export function topicName(id: string, lang: 'de' | 'en'): string {
  const tp = topicById(id);
  if (!tp) return id;
  return lang === 'en' ? (tp.name_en ?? tp.name) : tp.name;
}

export function Dots({ n }: { n: number }) {
  return (
    <span className="lx-dots" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="lx-dot" data-on={i < n || undefined} />
      ))}
    </span>
  );
}
