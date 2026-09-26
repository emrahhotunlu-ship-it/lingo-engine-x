import { useMemo, type ReactNode } from 'react';
import { invalidIdsOf, useLive } from '../../data/live';
import { topicById } from '../../domain/content';
import { mergedVocab } from '../../domain/overview';
import { wordState, type ApplySel } from '../../domain/preply/apply';
import type { ImportView } from '../../domain/preply/docs';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { Icon } from '../../ui/Icon';

// Vorschau des Lehrer-Imports (Phase 5 §8.3): vier Gruppen, je Eintrag „was → wohin" als
// Status-Chip. Nichts wird geschrieben, bevor „Übernehmen" gedrückt ist (E5-13). Wörter ohne
// Satz sind nicht übernehmbar (Kap. 15), vorhandene Karten erscheinen als Zustand.

type Doc = Record<string, unknown>;
type Group = 'c' | 't' | 'w';

function Row({ group, state, checked, onToggle, label, children }: { group: Group | 'h'; state: string; checked?: boolean; onToggle?: () => void; label: string; children: ReactNode }) {
  const selectable = !!onToggle;
  return (
    <li data-testid="pi-item" data-group={group} data-state={state} className="flex items-start gap-3 rounded-xl px-2 py-2">
      {selectable ? (
        <label className="-m-1 inline-flex size-11 flex-none cursor-pointer items-center justify-center">
          <input type="checkbox" checked={!!checked} onChange={onToggle} aria-label={label} className="size-5 accent-[var(--lx-accent)]" />
        </label>
      ) : (
        <span className="inline-flex size-9 flex-none items-center justify-center text-muted" aria-hidden="true">
          <Icon name={state === 'exists' ? 'check' : group === 'h' ? 'book' : 'alert'} size={18} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">{children}</div>
    </li>
  );
}

export function ImportReview({ pi, sel, onToggle, onApply, onLater, busy }: { pi: ImportView; sel: ApplySel; onToggle: (g: Group, i: number) => void; onApply: () => void; onLater: () => void; busy: boolean }) {
  const { t, lang } = useT();
  const vocab = useLive((s) => s.collections.vocab);
  const invalid = useLive((s) => s.invalid);
  const ids = useMemo(() => new Set(mergedVocab(vocab ?? new Map<string, Doc>(), invalidIdsOf(invalid, 'vocab')).keys()), [vocab, invalid]);
  const n = sel.c.length + sel.t.length + sel.w.length;
  const topicName = (id: string) => {
    const tp = topicById(id);
    return tp ? (lang === 'en' ? (tp.name_en ?? tp.name) : tp.name) : id === 'vocab' ? t('piTopicVocab') : t('piTopicOther');
  };
  const chip = (text: string) => <span className="inline-flex w-fit items-center rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-text">{text}</span>;
  const empty = !pi.corrections.length && !pi.items.length && !pi.words.length && !pi.homework.length;

  return (
    <section className="flex flex-col gap-5" data-testid="pi-review" aria-label={t('piReviewLabel')}>
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{pi.title || t('ppImportUntitled')}</h2>
        {pi.summary && <p className="text-[0.95rem] text-muted">{pi.summary}</p>}
      </header>
      {empty && <p className="text-sm text-muted">{t('piNothing')}</p>}
      {pi.corrections.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="lx-eyebrow">{t('piCorrections')}</h3>
          <ul className="flex flex-col">
            {pi.corrections.map((c, i) => (
              <Row key={i} group="c" state={sel.c.includes(i) ? 'selected' : 'off'} checked={sel.c.includes(i)} onToggle={() => onToggle('c', i)} label={`${c.wrong} → ${c.right}`}>
                <p className="text-[0.95rem] leading-relaxed" lang="en">
                  <span className="lx-diff-off">{c.wrong}</span>
                  <span className="text-muted"> → </span>
                  <strong className="font-semibold">{c.right}</strong>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {chip(topicById(c.topic) ? t('piToErrors') : t('piToRadar'))}
                  <span className="text-xs text-muted">{topicName(c.topic)}</span>
                </div>
                {c.why && <Disclosure label={t('piWhy')}>{<p className="text-sm text-muted">{c.why}</p>}</Disclosure>}
              </Row>
            ))}
          </ul>
        </div>
      )}
      {pi.items.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="lx-eyebrow">{t('piExercises')}</h3>
          <ul className="flex flex-col">
            {pi.items.map((it, i) => (
              <Row key={i} group="t" state={sel.t.includes(i) ? 'selected' : 'off'} checked={sel.t.includes(i)} onToggle={() => onToggle('t', i)} label={it.prompt}>
                <p className="text-[0.95rem] leading-relaxed" lang="en">
                  {it.prompt} <span className="text-muted">→</span> <strong className="font-semibold">{it.answer}</strong>
                </p>
                {chip(t('piToExercises'))}
              </Row>
            ))}
          </ul>
        </div>
      )}
      {pi.words.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="lx-eyebrow">{t('piWords')}</h3>
          <ul className="flex flex-col">
            {pi.words.map((w, i) => {
              const st = wordState(pi, w, ids);
              const state = st === 'ok' ? (sel.w.includes(i) ? 'selected' : 'off') : st === 'exists' ? 'exists' : 'invalid';
              return (
                <Row key={i} group="w" state={state} checked={sel.w.includes(i)} {...(st === 'ok' ? { onToggle: () => onToggle('w', i) } : {})} label={`${w.en} – ${w.de}`}>
                  <p className="text-[0.95rem] leading-relaxed">
                    <strong className="font-semibold" lang="en">
                      {w.en}
                    </strong>
                    <span className="text-muted"> – </span>
                    <span lang="de">{w.de}</span>
                  </p>
                  {w.ex && (
                    <p className="text-sm text-muted" lang="en">
                      {w.ex}
                    </p>
                  )}
                  {st === 'ok' ? chip(t('piToCards')) : <span className="text-xs text-muted">{st === 'exists' ? t('piExists') : t('piNoSentence')}</span>}
                </Row>
              );
            })}
          </ul>
        </div>
      )}
      {pi.homework.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="lx-eyebrow">{t('piHomework')}</h3>
          <ul className="flex flex-col">
            {pi.homework.map((h, i) => (
              <Row key={i} group="h" state="info" label={h}>
                <p className="text-[0.95rem] leading-relaxed">{h}</p>
              </Row>
            ))}
          </ul>
        </div>
      )}
      <div className="lx-glass sticky bottom-24 z-10 flex flex-wrap items-center gap-3 rounded-2xl p-3 md:bottom-4">
        <Button variant="primary" onClick={onApply} disabled={n === 0 || busy} busy={busy} data-testid="pi-apply">
          {t('piApply', { n })}
        </Button>
        <Button variant="ghost" onClick={onLater} disabled={busy} data-testid="pi-later">
          {t('piLater')}
        </Button>
      </div>
    </section>
  );
}
