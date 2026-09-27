import { courseExtendExample } from '../../../prompts/courseExtend';

// Feste Antwort für course-extend@1 (Kap. 6.2): vier Lektionen zu den im Prompt genannten
// schwächsten Themen. „zzjson“ im Berufskontext → kein JSON (Fehlerpfad). Nur Entwicklung und Tests.

const line = (input: string, label: string): string => (new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();

export function courseExtendReply(input: string): string {
  if (/zzjson/i.test(line(input, "Learner's job"))) return 'Sorry, I cannot plan that right now.';
  const unitN = Number(line(input, 'Unit number')) || 7;
  const weak = line(input, 'Weakest grammar topics \\(weakest first\\)');
  const weakTopics = weak && weak !== 'none' ? weak.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const topics = line(input, 'Allowed grammar topics \\(id: name\\)')
    .split('; ')
    .map((p) => {
      const i = p.indexOf(': ');
      return i < 0 ? { id: p.trim(), name: p.trim() } : { id: p.slice(0, i).trim(), name: p.slice(i + 2).trim() };
    })
    .filter((t) => t.id);
  return JSON.stringify(courseExtendExample({ unitN, weakTopics, topics }));
}
