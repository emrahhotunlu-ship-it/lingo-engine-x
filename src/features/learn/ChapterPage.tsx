import { useMemo } from 'react';
import { useNav } from '../../app/nav';
import { programChapters } from '../../domain/c1/chapters';
import { useCompanionSee } from '../companion/seeing';
import { useT } from '../../i18n';
import { ChapterDetail } from '../c1/ChapterSheet';
import { useChapterState } from '../c1/ProgramMap';
import { chapterLater } from './learnView';

// Kapitel als eigene Seite (Relaunch Teil 1c, D5 V-GRAMMATIK; Vorschau H6 `chapter` screens.js:472–474): Kopf „‹ Grammatik“ und „Fragen“ kommen
// vom Rahmen (Seite), darunter das Kapitel-Detail. Am Handy und bis 1.279 px; ab 1.280 px steht dasselbe in der Kontextspalte des Reiters.

export function ChapterPage() {
  const { t, lang } = useT();
  const id = useNav((s) => (s.route.name === 'chapter' ? s.route.id : null));
  const state = useChapterState();
  const chs = programChapters();
  const idx = useMemo(() => chs.findIndex((c) => c.id === id), [chs, id]);
  const c = idx >= 0 ? chs[idx] : undefined;
  const p = idx >= 0 ? state.chapters[idx] : undefined;
  useCompanionSee({ area: 'grammar', label: c ? t('pxChTitle', { n: c.n, name: c.name[lang] }) : t('lhTitle'), phase: 'idle' });
  if (!c || !p) return null;
  const later = chapterLater(p, idx, state.current);
  return (
    <div className="lx-vg lx-vg-page" data-testid="chapter-page">
      <ChapterDetail chapter={c} progress={p} view="page" later={later} key={c.id} />
    </div>
  );
}
