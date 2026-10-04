import { useT } from '../i18n';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { bank, wordId } from '../bank/words';
import { lemmaCandidates } from '../domain/text/lemma';
import { openSheet, openWord, useRoute } from '../app/route';
import { useCoach } from '../coach/store';
import { viewOf } from '../coach/cardView';
import type { CardRec } from '../coach/types';
import { WordDetails } from './parts';
import { WordActions } from './WordActions';

// Wort antippen (Kap. 15: jedes Wort antippbar): Bedeutung aus dem eingebauten Wörterbuch,
// Aussprache, „Ins Training", „Claude fragen". Ohne KI-Anfrage. Auch aus der Wortschatz-Liste
// geöffnet: dann ist der Text die Kennung einer Karte (auch eigene und alte Karten ohne Bank-Eintrag).

function resolve(token: string, cards: ReadonlyMap<string, CardRec>): string | null {
  const low = token.toLowerCase();
  if (cards.has(token)) return token;
  const b = bank().byId;
  if (cards.has(low) || b.has(wordId(low))) return cards.has(low) ? low : wordId(low);
  for (const l of lemmaCandidates(low)) {
    const id = wordId(l);
    if (cards.has(id) || b.has(id)) return id;
  }
  return null;
}

export function WordSheet() {
  const { t } = useT();
  const token = useRoute((s) => s.word);
  const cards = useCoach((s) => s.cards);
  const id = token ? resolve(token, cards) : null;
  const view = id ? viewOf(id, cards.get(id)) : null;
  const close = () => openWord(null);
  // Beim Öffnen aus der Liste ist der Text eine Kennung: dann das Wort der Karte als Titel.
  const title = view && id === token ? view.word : (token ?? '');
  return (
    <Sheet open={!!token} onClose={close} title={title} closeLabel={t('cClose')}>
      <div data-testid="word-sheet">
        {view ? <WordDetails view={view} /> : <p className="text-sm text-muted">{t('cTrNoHit')}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          {id && <WordActions id={id} />}
          <Button
            variant="ghost"
            icon="chat"
            onClick={() => {
              close();
              openSheet('ask', `${t('cAsk')}: „${title}“ – `);
            }}
          >
            {t('cAsk')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
