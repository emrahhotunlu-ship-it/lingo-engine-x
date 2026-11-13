import { useState } from 'react';
import { useLive } from '../../data/live';
import { grammarModuleOn } from '../../modules/grammar/api';
import { flags } from '../../app/flags';
import { useNav } from '../../app/nav';
import { openSheet } from '../../app/sheets';
import { entriesFor } from '../../app/registry';
import { Slot } from '../../app/slots';
import { pathTopics } from '../../domain/grammar/path';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { Disclosure } from '../../ui/Disclosure';
import { Icon } from '../../ui/Icon';
import { VRow } from '../../ui/v';
import { useCompanionSee } from '../companion/seeing';
import { TopicSheet } from '../grammar/GrammarScreen';
import { PathList } from '../grammar/PathList';
import { useChapterNow } from '../c1/chapterRun';
import { ChapterList } from './ChapterList';
import { useFix } from './fix';
import { HereCard } from './HereCard';
import { TopicPath } from './TopicPath';
import { useBookNext } from '../grammar/BookScreen';
import { bookChapters } from '../../domain/grammar/book';
import { topicName } from '../grammar/topicUi';
import { useFocusView } from '../grammar/focusView';
import { startGrammar, topicTestReady, useGrammarSession } from '../grammar/session';
import { TT_N } from '../../domain/grammar/topicTest';

// Reiter „Grammatik“ (Relaunch Teil 1c, D5 V-GRAMMATIK; Vorschau H6 `path` screens.js:468–480, L4 desk.js:238–248). Aufbau wie die Vorschau:
// Kopf „Grammatik“ (vom Rahmen, `LearnHead`), Karte „Du bist hier“ mit dem EINEN Hauptknopf, die Kapitelliste „Dein Weg zu C1“ und leise
// „Mehr üben, freiwillig“. Das Kapitel-Detail steht am Laptop ab 1.280 px in der Kontextspalte (`LearnContext`), sonst auf eigener Seite.
// Sternbild/C1-Reise und Programmkarte fallen auf der Wurzel weg; die Reise ist über das Kapitel-Detail erreichbar (Seite `journey`).
// Alle bisherigen Einstiege bleiben (Funktionsliste im Bericht D5): Einstufung (Slot `grammar.foot`), „Fehler korrigieren“, Nachschlagen
// (Regeln, Deutsch-Fallen, Suche), die vollständige Themenliste (eingeklappt) mit Themenblatt, Extra und die Einstiege anderer Bereiche.

/** Einstiege anderer Bereiche auf dem Platz `learn` (z. B. „Lehrer-Feedback einfügen“): nichts geht verloren. */
function ForeignRows() {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const list = entriesFor('learn');
  if (!list.length) return null;
  return (
    <>
      {list.map((e) => (
        <VRow key={e.id} icon={e.icon} title={t(e.label)} sub={e.sub ? t(e.sub) : undefined} onClick={() => (e.start ? e.start(api) : e.route ? go(e.route) : undefined)} data-testid={e.id} />
      ))}
    </>
  );
}

export function LearnHub() {
  const { t, lang } = useT();
  const bookNext = useBookNext();
  const chN = (id: string) => bookChapters().find((c) => c.id === id)?.n ?? 1;
  const bookSub = !bookNext
    ? t('bkRowSub')
    : bookNext.kind === 'exam'
      ? t('bkNextExam', { ch: chN(bookNext.chapter) })
      : t('bkNextPage', { ch: chN(bookNext.chapter), topic: topicName(bookNext.topic, lang), page: t(bookNext.part === 'A' ? 'bkPartShortA' : bookNext.part === 'B' ? 'bkPartShortB' : bookNext.part === 'C' ? 'bkPartShortC' : 'bkPartShortT') });
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const [open, setOpen] = useState<string | null>(null);
  const program = flags.program;
  const fix = useFix();
  const { cursor } = useChapterNow();
  useCompanionSee({ area: 'grammar', label: t('grTitle'), phase: 'idle' });
  // Politur P3: mit der neuen Grammatik ist das Fokus-Thema „jetzt dran“ (Karte „Du bist hier“); der Themen-Weg hebt dasselbe Thema hervor.
  const focus = useFocusView();
  const docs = useLive((s) => s.collections.grammar);
  // Großpaket G5: mit der neuen Grammatik EIN Themen-Weg (Als Nächstes / Sitzt schon) statt Kapitelliste und zweiter Themenliste (M12);
  // die Fehlersätze stehen mit Überschrift an EINEM Ort. Schalter aus (`gcfg.mod = 0`): der bisherige Aufbau, unverändert (Hervorhebung = Kapitel-Cursor).
  const gmod = useLive((s) => grammarModuleOn(s.docs['app/profile']));
  const highlight = (gmod ? focus?.topic : null) ?? cursor?.topic ?? null;
  const testTopic = gmod ? (focus?.topic ?? null) : null;
  const testReady = !!testTopic && topicTestReady(testTopic, docs ?? undefined);
  /** Themen-Test zum Fokus-Thema (6 Aufgaben ohne Hilfe): bestanden heißt, das Thema ist abgeschlossen. */
  const startTest = () => {
    if (!testTopic) return;
    const step0 = useGrammarSession.getState().step;
    const kind = startGrammar({ mode: 'topic', topic: testTopic, test: true });
    if (useGrammarSession.getState().step === step0) return;
    if (kind === 'typed') api.focusNow();
    else api.blur();
    go({ name: 'grammarSession', mode: 'topic', topic: testTopic });
  };

  const lookupRows = (
    <>
      {/* Großpaket B (04.11.2026): EIN Weg „Nachschlagen“ (Suche, Themen, typische Fallen auf einer Seite) statt dreier Links. */}
      <VRow icon="book" title={t('hxLearnLookup')} sub={t('lkRowSub')} chevron onClick={() => go({ name: 'grammar' })} data-testid="hub-lookup" />
      <ForeignRows />
    </>
  );

  return (
    <div className="lx-vg" data-testid="learn-hub">
      <HereCard />

      {gmod ? (
        // Politur P3 (ein Weg): Buch, Themen-Test, Kapitel/Themen und Einstufung stehen als Detail unter der Karte, eingeklappt.
        <section className="lx-vg-all" data-testid="hub-details">
          <Disclosure label={t('gfDetails')} testId="hub-details-toggle">
            <div className="flex flex-col gap-3">
              <div className="lx-vg-rows" data-testid="hub-book-list">
                <VRow icon="book" title={t('bkRow')} sub={bookSub} onClick={() => go({ name: 'book' })} data-testid="hub-book" />
                {testTopic && (
                  <VRow
                    icon="target"
                    title={t('gmBtnTest', { n: TT_N })}
                    sub={testReady ? `${t('gfDetailTest', { topic: topicName(testTopic, lang) })} · ${t('gfDetailTestSub', { n: TT_N })}` : t('gfDetailTestPrep')}
                    {...(testReady ? { onClick: startTest } : {})}
                    data-testid="hub-topic-test"
                    data-ready={testReady ? 'true' : 'false'}
                  />
                )}
              </div>
              <TopicPath current={highlight} onOpen={setOpen} />
              <Slot name="grammar.foot" />
            </div>
          </Disclosure>
        </section>
      ) : (
        <>
          {/* Grammatik-Buch (Emrah 08.11.2026): Kapitel, Lektionen, Übungen und Klausuren; die Zeile nennt den nächsten Schritt. */}
          <div className="lx-vg-rows" data-testid="hub-book-list">
            <VRow icon="book" title={t('bkRow')} sub={bookSub} onClick={() => go({ name: 'book' })} data-testid="hub-book" />
          </div>
          {program && <ChapterList />}
          <Slot name="grammar.foot" />
        </>
      )}

      {gmod && (
        <h2 className="lx-vg-lbl lx-vg-pathlbl" data-testid="hub-errors-head">
          {t('gmErrorsHead')}
        </h2>
      )}
      <div className="lx-vg-rows" data-testid="hub-errors-list">
        {fix.nDue > 0 ? (
          // Zeile wie `VRow`, mit den Zahlen als Attribute (Tests prüfen „n fällig · heute m“ gegen den Hauptknopf, P7).
          <button type="button" className="lx-v-row" onClick={() => fix.start(api)} data-testid="hub-errors" data-due={fix.nDue} data-today={fix.nToday}>
            <span className="lx-v-row-ic" aria-hidden="true">
              <Icon name="refresh" size={18} />
            </span>
            <span className="lx-v-row-t">
              <b>{t('vgErrorsAll')}</b>
              <span className="lx-v-num">{t('hxLearnFixLine', { n: fix.nDue, today: fix.nToday })}</span>
            </span>
            <span className="lx-v-row-chev" aria-hidden="true">
              <Icon name="chevronRight" size={18} />
            </span>
          </button>
        ) : (
          <VRow icon="check" title={t('nbLernenFixNone')} sub={t('nbLernenFixNoneSub')} data-testid="hub-errors-none" />
        )}
        {!gmod && lookupRows}
      </div>

      {gmod && (
        <div className="lx-vg-rows" data-testid="hub-more-list">
          {lookupRows}
        </div>
      )}

      {gmod ? null : program ? (
        // Die vollständige Themenliste bleibt eingeklappt erreichbar (kein doppelter Kapitelkopf neben der Kapitelliste).
        <section className="lx-vg-all" aria-label={t('nbLernenPathAll', { n: pathTopics().length })}>
          <Disclosure label={t('nbLernenPathAll', { n: pathTopics().length })} testId="hub-all-topics">
            <div className="pt-3">
              <PathList onOpen={setOpen} highlight={highlight} program />
            </div>
          </Disclosure>
        </section>
      ) : (
        <section className="lx-vg-all" aria-labelledby="lh-path">
          <h2 id="lh-path" className="lx-vg-lbl lx-vg-pathlbl">
            {t('nbLernenPathTitle', { n: pathTopics().length })}
          </h2>
          <PathList onOpen={setOpen} highlight={highlight} />
        </section>
      )}

      <button type="button" className="lx-vg-quiet" onClick={() => openSheet('x:extra', { scope: 'grammar' })} data-testid="hub-extra">
        {t('vgMore')}
      </button>

      <TopicSheet topic={open} onClose={() => setOpen(null)} />
    </div>
  );
}
