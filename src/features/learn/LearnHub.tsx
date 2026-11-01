import { useState } from 'react';
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
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const [open, setOpen] = useState<string | null>(null);
  const program = flags.program;
  const fix = useFix();
  const { cursor } = useChapterNow();
  useCompanionSee({ area: 'grammar', label: t('grTitle'), phase: 'idle' });
  const highlight = cursor?.topic ?? null;

  return (
    <div className="lx-vg" data-testid="learn-hub">
      <HereCard />

      {program && <ChapterList />}

      <Slot name="grammar.foot" />

      <div className="lx-vg-rows" data-testid="hub-errors-list">
        {fix.nDue > 0 ? (
          // Zeile wie `VRow`, mit den Zahlen als Attribute (Tests prüfen „n fällig · heute m“ gegen den Hauptknopf, P7).
          <button type="button" className="lx-v-row" onClick={() => fix.start(api)} data-testid="hub-errors" data-due={fix.nDue} data-today={fix.nToday}>
            <span className="lx-v-row-ic" aria-hidden="true">
              <Icon name="refresh" size={18} />
            </span>
            <span className="lx-v-row-t">
              <b>{t('vgErrors')}</b>
              <span className="lx-v-num">{t('hxLearnFixLine', { n: fix.nDue, today: fix.nToday })}</span>
            </span>
            <span className="lx-v-row-chev" aria-hidden="true">
              <Icon name="chevronRight" size={18} />
            </span>
          </button>
        ) : (
          <VRow icon="check" title={t('nbLernenFixNone')} sub={t('nbLernenFixNoneSub')} data-testid="hub-errors-none" />
        )}
        <div className="lx-v-row lx-vg-lookup" role="group" aria-label={t('hxLearnLookup')} data-testid="hub-lookup-row">
          <span className="lx-v-row-ic" aria-hidden="true">
            <Icon name="book" size={18} />
          </span>
          <span className="lx-v-row-t">
            <b>{t('hxLearnLookup')}</b>
            <span className="lx-vg-links">
              <button type="button" onClick={() => go({ name: 'wissen' })} className="lx-vg-link" data-testid="hub-wissen">
                {t('hxLearnRules')}
              </button>
              <button type="button" onClick={() => go({ name: 'patterns' })} className="lx-vg-link" data-testid="hub-traps">
                {t('hxLearnTraps')}
              </button>
              <button type="button" onClick={() => go({ name: 'grammar' })} className="lx-vg-link" data-testid="hub-lookup">
                {t('hxLearnSearch')}
              </button>
            </span>
          </span>
        </div>
        <ForeignRows />
      </div>

      {program ? (
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

