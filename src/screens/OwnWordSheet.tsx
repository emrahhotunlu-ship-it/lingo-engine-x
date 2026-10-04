import { useState } from 'react';
import { useT } from '../i18n';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { openWord } from '../app/route';
import { saveCards, useCoach } from '../coach/store';
import { bankCard, duplicateFinder, ownCard, type Duplicate } from '../coach/vocab';

// Eigenes Wort hinzufügen: Englisch, Deutsch, Beispielsatz (freiwillig). Ist das Wort schon da,
// gibt es einen Hinweis statt einer zweiten Karte.

type Notice = { kind: 'need' } | { kind: 'dup'; word: string; dup: Duplicate };

const fieldClass = 'mt-1 block w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5 text-base text-fg outline-none focus:border-accent';

export function OwnWordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const cards = useCoach((s) => s.cards);
  const [en, setEn] = useState('');
  const [de, setDe] = useState('');
  const [ex, setEx] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const done = () => {
    setEn('');
    setDe('');
    setEx('');
    setNotice(null);
    onClose();
  };

  function save() {
    const made = ownCard({ en, de, ex }, Date.now());
    if (!made) {
      setNotice({ kind: 'need' });
      return;
    }
    const dup = duplicateFinder(cards)(en);
    if (dup) {
      setNotice({ kind: 'dup', word: en.trim(), dup });
      return;
    }
    void saveCards([made]);
    toast(t('mwOwnSaved', { word: made[1].w ?? en.trim() }));
    done();
  }

  return (
    <Sheet open={open} onClose={done} title={t('mwOwnTitle')} closeLabel={t('cClose')}>
      <form
        data-testid="own-word"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="block text-sm font-medium" htmlFor="own-en">
          {t('mwOwnEn')}
        </label>
        <input
          id="own-en"
          type="text"
          value={en}
          onChange={(e) => {
            setEn(e.target.value);
            setNotice(null);
          }}
          placeholder={t('mwOwnEnPh')}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          lang="en"
          className={fieldClass}
          data-testid="own-en"
        />
        <label className="mt-4 block text-sm font-medium" htmlFor="own-de">
          {t('mwOwnDe')}
        </label>
        <input id="own-de" type="text" value={de} onChange={(e) => setDe(e.target.value)} placeholder={t('mwOwnDePh')} autoCapitalize="off" className={fieldClass} data-testid="own-de" />
        <label className="mt-4 block text-sm font-medium" htmlFor="own-ex">
          {t('mwOwnEx')}
        </label>
        <textarea id="own-ex" value={ex} onChange={(e) => setEx(e.target.value)} rows={2} lang="en" className={`${fieldClass} resize-none`} data-testid="own-ex" />

        {notice?.kind === 'need' && (
          <p className="mt-4 text-sm text-danger-text" role="alert" data-testid="own-need">
            {t('mwOwnNeed')}
          </p>
        )}
        {notice?.kind === 'dup' && (
          <div className="mt-4 rounded-[var(--radius-control)] bg-surface p-3" role="alert" data-testid="own-dup" data-dup={notice.dup.kind}>
            <p className="text-sm">{t(notice.dup.kind === 'card' ? 'mwDupCard' : 'mwDupBank', { word: notice.word })}</p>
            <div className="mt-3">
              {notice.dup.kind === 'card' ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const id = notice.dup.id;
                    done();
                    openWord(id);
                  }}
                  data-testid="own-dup-open"
                >
                  {t('mwDupOpen')}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  icon="plus"
                  onClick={() => {
                    void saveCards([[notice.dup.id, bankCard(Date.now())]]);
                    done();
                  }}
                  data-testid="own-dup-take"
                >
                  {t('mwDupTake')}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="mt-6">
          <Button type="submit" variant="primary" size="lg" data-testid="own-save">
            {t('mwOwnSave')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
