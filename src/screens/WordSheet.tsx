import { useT } from '../i18n';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { bank, wordId } from '../bank/words';
import { lemmaCandidates } from '../domain/text/lemma';
import { openSheet, openWord, useRoute } from '../app/route';
import { useCoach } from '../coach/store';
import { viewOf } from '../coach/cardView';
import { WordDetails } from './parts';
import { AddToTraining } from './TranslateSheet';

// Wort antippen (Kap. 15: jedes Wort antippbar): Bedeutung aus dem eingebauten Wörterbuch,
// Aussprache, „Ins Training", „Claude fragen". Ohne KI-Anfrage.

function resolve(token: string): string | null {
  const low = token.toLowerCase();
  const b = bank().byId;
  if (b.has(wordId(low))) return wordId(low);
  for (const l of lemmaCandidates(low)) if (b.has(wordId(l))) return wordId(l);
  return null;
}

export function WordSheet() {
  const { t } = useT();
  const token = useRoute((s) => s.word);
  const cards = useCoach((s) => s.cards);
  const id = token ? resolve(token) : null;
  const view = id ? viewOf(id, cards.get(id)) : null;
  const close = () => openWord(null);
  return (
    <Sheet open={!!token} onClose={close} title={token ?? ''} closeLabel={t('cClose')}>
      <div data-testid="word-sheet">
        {view ? <WordDetails view={view} /> : <p className="text-sm text-muted">{t('cTrNoHit')}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          {id && <AddToTraining id={id} />}
          <Button
            variant="ghost"
            icon="chat"
            onClick={() => {
              close();
              openSheet('ask', `${t('cAsk')}: „${token ?? ''}“ – `);
            }}
          >
            {t('cAsk')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
