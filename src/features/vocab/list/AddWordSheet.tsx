import { useState } from 'react';
import { useClock } from '../../../app/clock';
import { useAiAvailable } from '../../../ai/scope';
import { useAsk } from '../../../ai/useAsk';
import { useT, type MessageKey } from '../../../i18n';
import { wordGen, type GenWord } from '../../../prompts/wordGen';
import { Button } from '../../../ui/Button';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';
import { EnglishText } from '../../../engine/EnglishText';
import { addGenerated, addWord, knownWords, type AddOutcome } from './actions';

// Wörter hinzufügen (Funktionsabgleich M2): eigenes Wort (Englisch, Deutsch, Satz – ohne Satz
// keine Karte, Kap. 15; mit Claude lässt sich alles auf Knopfdruck ergänzen), „Neue Wörter von
// Claude" und „Fachwörter für meinen Beruf" (je 8, nur auf Klick).

const OUTCOME: Record<AddOutcome, MessageKey> = {
  created: 'lkSavedToast',
  extended: 'lkAddedToast',
  exists: 'lkExistsToast',
  invalid: 'vcAddInvalid',
  failed: 'lkSaveFailed',
};

export function AddWordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('vcAddTitle')} closeLabel={t('close')}>
      {open && <AddBody />}
    </Sheet>
  );
}

function AddBody() {
  const { t } = useT();
  const ai = useAiAvailable();
  const today = useClock((s) => s.today);
  const fill = useAsk(wordGen);
  const gen = useAsk(wordGen);
  const [en, setEn] = useState('');
  const [de, setDe] = useState('');
  const [ex, setEx] = useState('');
  const [extra, setExtra] = useState<{ pos: string; def: string; level: string }>({ pos: '', def: '', level: '' });
  const [genSrc, setGenSrc] = useState<'ai' | 'job'>('ai');
  const [added, setAdded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const busy = (p: string) => p === 'queued' || p === 'thinking' || p === 'streaming' || p === 'slow';

  const doFill = async () => {
    const out = await fill.run({ mode: 'fill', count: 1, known: [], word: en.trim() });
    const w = out?.words[0];
    if (!w) return;
    if (!de.trim()) setDe(w.de);
    if (!ex.trim()) setEx(w.ex);
    setExtra({ pos: w.pos, def: w.def, level: w.level });
  };

  const save = async () => {
    setSaving(true);
    const res = await addWord({ word: en.trim(), de: de.trim(), ex: ex.trim(), pos: extra.pos || null, def: extra.def || null, level: extra.level || null }, 'user', today);
    setSaving(false);
    toast(t(OUTCOME[res]), res === 'failed' || res === 'invalid' ? 'error' : 'info');
    if (res === 'created' || res === 'extended') {
      setEn('');
      setDe('');
      setEx('');
      setExtra({ pos: '', def: '', level: '' });
    }
  };

  const generate = async (mode: 'general' | 'job') => {
    setGenSrc(mode === 'job' ? 'job' : 'ai');
    setAdded([]);
    await gen.run({ mode, count: 8, known: knownWords() });
  };

  const addOne = async (w: GenWord) => {
    const res = await addGenerated(w, genSrc, today);
    if (res === 'created' || res === 'extended' || res === 'exists') setAdded((a) => [...a, w.word]);
    else toast(t(OUTCOME[res]), 'error');
  };

  const addAll = async () => {
    for (const w of gen.data?.words ?? []) if (!added.includes(w.word)) await addOne(w);
    toast(t('vcAllAdded'));
  };

  const canSave = en.trim() && de.trim() && ex.trim();
  return (
    <div className="flex flex-col gap-8 pb-4" data-testid="add-word">
      <section className="flex flex-col gap-3">
        <h3 className="lx-eyebrow">{t('vcOwnWord')}</h3>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('vcFieldEn')}</span>
          <input className="lx-field" lang="en" value={en} onChange={(e) => setEn(e.target.value)} autoCapitalize="off" autoComplete="off" spellCheck={false} data-testid="add-en" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{ai ? t('vcFieldDeOptional') : t('vcFieldDe')}</span>
          <input className="lx-field" lang="de" value={de} onChange={(e) => setDe(e.target.value)} autoComplete="off" data-testid="add-de" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{ai ? t('vcFieldExOptional') : t('vcFieldEx')}</span>
          <textarea className="lx-field" lang="en" rows={2} value={ex} onChange={(e) => setEx(e.target.value)} autoComplete="off" spellCheck={false} data-testid="add-ex" />
        </label>
        <div className="flex flex-wrap gap-2">
          {ai && (
            <Button variant="secondary" icon="sparkle" onClick={() => (busy(fill.phase) ? fill.stop() : void doFill())} disabled={!en.trim()} data-testid="add-fill" data-ai="">
              {busy(fill.phase) ? t('aiStop') : t('vcFill')}
            </Button>
          )}
          <Button variant="primary" icon="bookmarkPlus" onClick={() => void save()} disabled={!canSave} busy={saving} data-testid="add-save">
            {t('lkSave')}
          </Button>
        </div>
        {busy(fill.phase) && (
          <p className="text-sm text-muted" role="status">
            {t('aiThinking')}
          </p>
        )}
        {fill.error && (
          <p className="text-sm text-danger-text" role="alert">
            {t(fill.error)}
          </p>
        )}
        {!ai && <p className="text-xs text-subtle">{t('vcNeedSentence')}</p>}
      </section>

      {ai && (
        <section className="flex flex-col gap-3">
          <h3 className="lx-eyebrow">{t('vcFromClaude')}</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="sparkle" onClick={() => void generate('general')} disabled={busy(gen.phase)} data-testid="add-gen-general" data-ai="">
              {t('vcGenGeneral')}
            </Button>
            <Button variant="secondary" icon="sparkle" onClick={() => void generate('job')} disabled={busy(gen.phase)} data-testid="add-gen-job" data-ai="">
              {t('vcGenJob')}
            </Button>
            {busy(gen.phase) && (
              <Button variant="ghost" onClick={gen.stop}>
                {t('aiStop')}
              </Button>
            )}
          </div>
          {busy(gen.phase) && (
            <p className="text-sm text-muted" role="status">
              {gen.phase === 'slow' ? t('aiSlow') : t('aiThinking')}
            </p>
          )}
          {gen.error && (
            <p className="text-sm text-danger-text" role="alert">
              {t(gen.error)}
            </p>
          )}
          {gen.data && (
            <>
              <ul className="flex flex-col gap-3" data-testid="gen-list">
                {gen.data.words.map((w) => {
                  const done = added.includes(w.word);
                  return (
                    <li key={w.word} className="flex flex-col gap-1 rounded-xl bg-surface p-3" data-testid="gen-word" data-word={w.word}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex flex-col">
                          <span className="font-semibold" lang="en">
                            {w.word}
                          </span>
                          <span className="text-sm text-muted" lang="de">
                            {w.de}
                          </span>
                        </span>
                        <Button variant={done ? 'ghost' : 'secondary'} icon={done ? 'check' : 'plus'} onClick={() => void addOne(w)} disabled={done} data-testid="gen-add">
                          {done ? t('lkSaved') : t('vcAddOne')}
                        </Button>
                      </div>
                      <EnglishText as="p" className="text-sm leading-relaxed" text={w.ex} area="lookup" source={null} />
                    </li>
                  );
                })}
              </ul>
              <div>
                <Button variant="primary" icon="plus" onClick={() => void addAll()} data-testid="gen-add-all">
                  {t('vcAddAll')}
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
