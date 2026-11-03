import { programChapters } from '../../domain/c1/chapters';
import { ChapterDetail } from '../c1/ChapterSheet';
import { useChapterState } from '../c1/ProgramMap';
import { useLive } from '../../data/live';
import { grammarModuleOn } from '../../modules/grammar/api';
import { chapterLater, useLearnPick } from './learnView';

// Kontextspalte des Grammatik-Reiters ab 1.280 px (Relaunch Teil 1c, D5 V-GRAMMATIK; Vorschau L4 `ctx: chapterDetail()` desk.js:247): das
// Kapitel-Detail des gewählten Kapitels, ohne Wahl das aktuelle. Gerendert vom Rahmen (`ContextHost`), wenn die Spalte sonst leer wäre.

export function LearnContext() {
  const state = useChapterState();
  const picked = useLearnPick((s) => s.idx);
  // G8 (UX M1): mit neuer Grammatik nur, was der Themen-Weg links nicht zeigt.
  const gmod = useLive((s) => grammarModuleOn(s.docs['app/profile']));
  const chs = programChapters();
  if (!chs.length || state.chapters.length !== chs.length) return null;
  const idx = Math.min(chs.length - 1, picked ?? Math.max(0, state.current));
  const c = chs[idx]!;
  const p = state.chapters[idx]!;
  const later = chapterLater(p, idx, state.current);
  return (
    <div className="lx-vg-ctx" data-testid="learn-context">
      <ChapterDetail key={c.id} chapter={c} progress={p} view="column" later={later} slim={gmod} />
    </div>
  );
}
