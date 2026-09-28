import { useState } from 'react';
import { useClock } from '../../../app/clock';
import { useAsk } from '../../../ai/useAsk';
import { useT } from '../../../i18n';
import { textCards, TEXT_MAX_CHARS, type TextCard } from '../../../prompts/nb/p3/textCards';
import { Button } from '../../../ui/Button';
import { toast } from '../../../ui/Toast';
import { addWord, knownWords } from './actions';

// „Aus Text“ (plan.md N34, Soll): englischen Text einfügen → 5–15 Kartenvorschläge mit dem Satz aus
// dem Text, Häkchen, „Übernehmen“. Nur auf Knopfdruck; ohne KI unsichtbar (Aufrufer).

const busy = (p: string) => p === 'queued' || p === 'thinking' || p === 'streaming' || p === 'slow';

export function FromText() {
  const { t, tn } = useT();
  const today = useClock((s) => s.today);
  const ask = useAsk(textCards);
  const [text, setText] = useState('');
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const cards: TextCard[] = ask.data?.cards ?? [];
  const chosen = cards.filter((c) => !off.has(c.word));
  const take = async () => {
    setSaving(true);
    let n = 0;
    for (const c of chosen) {
      const r = await addWord({ word: c.word, de: c.de, def: c.def, pos: c.pos, ex: c.ex }, 'user', today);
      if (r === 'created' || r === 'extended') n++;
    }
    setSaving(false);
    toast(tn('nbWsFromTextSaved', n), 'info');
    setText('');
    setOff(new Set());
  };
  return (
    <section className="flex flex-col gap-3" data-testid="add-from-text">
      <p className="lx-eyebrow">{t('nbWsFromText')}</p>
      <textarea className="lx-field min-h-24" lang="en" value={text} maxLength={TEXT_MAX_CHARS} placeholder={t('nbWsFromTextHint')} onChange={(e) => setText(e.target.value)} data-testid="add-text" />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon="sparkle" disabled={text.trim().length < 40 || busy(ask.phase)} onClick={() => void ask.run({ text, known: knownWords() })} data-testid="add-text-go" data-ai="">
          {t('nbWsFromTextGo')}
        </Button>
        {busy(ask.phase) && (
          <Button variant="ghost" onClick={ask.stop}>
            {t('aiStop')}
          </Button>
        )}
      </div>
      {busy(ask.phase) && <p className="text-sm text-muted">{ask.phase === 'slow' ? t('aiSlow') : t('aiThinking')}</p>}
      {ask.error && (
        <p className="text-sm text-danger-text" role="alert">
          {t(ask.error)}
        </p>
      )}
      {cards.length > 0 && (
        <>
          <ul className="flex flex-col gap-2" data-testid="add-text-cards">
            {cards.map((c) => (
              <li key={c.word}>
                <label className="flex items-start gap-3 rounded-xl bg-surface p-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 flex-none"
                    checked={!off.has(c.word)}
                    onChange={() =>
                      setOff((s) => {
                        const n = new Set(s);
                        if (n.has(c.word)) n.delete(c.word);
                        else n.add(c.word);
                        return n;
                      })
                    }
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium" lang="en">
                      {c.word} <span className="text-muted">· {c.de}</span>
                    </span>
                    <span className="text-sm text-muted" lang="en">
                      {c.ex}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div>
            <Button variant="primary" busy={saving} disabled={!chosen.length} onClick={() => void take()} data-testid="add-text-take">
              {t('nbWsFromTextTake', { n: chosen.length })}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
