import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Icon } from '../../src/ui/Icon';
import { vDe } from '../../src/i18n/parts/v.de';
import { vEn } from '../../src/i18n/parts/v.en';
import {
  VButton,
  VCard,
  VChip,
  VIconButton,
  VNotice,
  VPageHead,
  VReload,
  VRing,
  VRow,
  VSheet,
  VSkeleton,
  VLoading,
  VStateList,
  VTile,
  VTiles,
  VTileBar,
  VWeekStrip,
  type VChannel,
  type VWeekDay,
} from '../../src/ui/v';

// Test-Galerie der Design-Bausteine (D1 V-BAU) für das Vergleichsgerüst tests/e2e/vorschau.spec.ts. Nur Testbetrieb: wird von
// tests/e2e/vorschauHelpers.ts beim Testlauf gebündelt und neben dem CSS aus dist/ geladen; nie Teil des Builds.
// Jeder Teil stellt dieselbe Lage nach wie der Vorschau-Bildschirm, gegen den gemessen wird (Inhalte wie dort, nur zum Messen).
// Adresse: #teil=<heute|kacheln|hinweis|alle>&lang=<de|en>

const params = new URLSearchParams(location.hash.slice(1));
const teil = params.get('teil') ?? 'alle';
const en = params.get('lang') === 'en';
const L = (de: string, e: string) => (en ? e : de);
const T = en ? vEn : vDe;

// Tagesblöcke wie Vorschau app.js:95–102 (NORMAL), Zustand wie H1 `ring` (zwei erledigt, dritter zu 40 %).
const BLOCKS: Array<{ ch: VChannel; name: string; m: number }> = [
  { ch: 'w', name: L('Gestern-Check', 'Yesterday check'), m: 3 },
  { ch: 'w', name: L('Wörter', 'Words'), m: 7 },
  { ch: 'g', name: L('Grammatik', 'Grammar'), m: 5 },
  { ch: 'l', name: L('Hören', 'Listening'), m: 4 },
  { ch: 's', name: L('Sag es', 'Say it'), m: 4 },
  { ch: 's', name: L('Flüssigkeit', 'Fluency'), m: 5 },
];

function Heute() {
  const [list, setList] = useState(true);
  const [sheet, setSheet] = useState(false);
  const done = 2;
  const partial = 0.4;
  const total = BLOCKS.reduce((a, b) => a + b.m, 0);
  const rem = Math.round(total - BLOCKS.slice(0, done).reduce((a, b) => a + b.m, 0) - (BLOCKS[done]?.m ?? 0) * partial);
  const names = en ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
  const days: VWeekDay[] = names.map((short, i) => ({ short, name: short, state: i === 6 ? 'rest' : i < 3 ? 'done' : i === 3 ? 'today' : 'open' }));
  return (
    <div data-galerie="heute">
      <VPageHead title={L('Heute', 'Today')} right={<VIconButton icon="ask" label={L('Fragen', 'Ask')} />} />
      <div className="lx-v-gx">
        <VCard raised style={{ padding: '22px 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <VRing
            blocks={BLOCKS.map((b) => ({ minutes: b.m }))}
            done={done}
            partial={partial}
            draw
            label={T.vRingShowBlocks}
            onActivate={() => setList((v) => !v)}
            expanded={list}
            data-testid="g-ring"
          >
            <b className="lx-v-disp lx-v-num">{rem}</b>
            <span>{L('Min. übrig', 'min left')}</span>
          </VRing>
          {list && (
            <VStateList
              spring
              label={T.vRingBlocks}
              stateLabels={{ done: T.vStepDone, run: T.vStepRun, open: T.vStepOpen }}
              steps={BLOCKS.map((b, i) => ({
                id: String(i),
                name: b.name,
                ch: b.ch,
                state: i < done ? 'done' : i === done ? 'run' : 'open',
                meta: i === done ? L('läuft', 'in progress') : T.vStepMinutes.replace('{n}', String(b.m)),
              }))}
            />
          )}
          <VButton variant="pri" full data-testid="g-go">
            {L('Weiter', 'Continue')}
          </VButton>
        </VCard>
      </div>
      <div className="lx-v-gx">
        <VWeekStrip
          days={days}
          label={T.vWeek}
          stateLabels={{ done: T.vDayDone, today: T.vDayToday, todayDone: T.vDayTodayDone, rest: T.vDayRest, open: T.vDayOpen }}
          streak={{ value: '14', label: T.vStreak_other }}
        />
      </div>
      <div className="lx-v-gx" style={{ marginTop: 22 }}>
        <VRow icon="book" title={L('Lesen', 'Reading')} sub={L('Lieferketten unter Druck · 4 Min.', 'Daily article: supply chains under pressure · 4 min')} onClick={() => setSheet(true)} />
        <VRow icon="sparkle" title={L('Wort-Werkstatt', 'Word workshop')} sub={L('5 Wörter brauchen eine neue Darstellung', '5 words need a fresh look')} onClick={() => setSheet(true)} />
      </div>
      <VSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={L('Wozu diese Übung?', 'Why this exercise?')}
        closeLabel={T.vClose}
        foot={
          <VButton variant="pri" full onClick={() => setSheet(false)}>
            {L('Verstanden', 'Got it')}
          </VButton>
        }
        data-testid="g-sheet"
      >
        <p style={{ margin: 0 }}>{L('Erst versuchen, dann die Regel.', 'Try first, then the rule.')}</p>
      </VSheet>
    </div>
  );
}

function Kacheln() {
  return (
    <div data-galerie="kacheln" className="lx-v-gx">
      <VTiles>
        <VTile ch="w" head={L('Bildest du selbst', 'You produce')} trend={<Icon name="arrowRight" size={14} />} big="38" way={L('auf dem Weg: 41', 'on the way: 41')}
          bar={<VTileBar label={L('voll: bildest du selbst · halbtonig: auf dem Weg', 'full: you produce · halftone: on the way')} parts={[{ from: 0, width: 7.7, kind: 'full' }, { from: 7.7, width: 8.4, kind: 'half' }]} />} line={L('erkennst du: 412', 'you recognize: 412')} onClick={() => {}} />
        <VTile ch="g" head={L('Grammatik', 'Grammar')} trend={<Icon name="minus" size={14} />} big="1" unit={L('von 8', 'of 8')} line={L('Kapitel in Arbeit · Thema 1 von 4', 'chapter in progress · topic 1 of 4')} onClick={() => {}} />
        <VTile ch="l" head={L('Hören', 'Listening')} big="–" line={T.vThin} onClick={() => {}} />
        <VTile ch="s" head={L('Sprechen', 'Speaking')} big="–" line={L('ab 3 Sprechaufgaben', 'after 3 speaking tasks')} onClick={() => {}} />
      </VTiles>
    </div>
  );
}

function Hinweis() {
  return (
    <div data-galerie="hinweis" className="lx-v-gx" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
      <VNotice icon="alert" live>
        {L(
          'Claude antwortet gerade nicht. Deine Antwort ist gespeichert. Die Rückmeldung kommt, sobald es wieder geht.',
          'Claude isn’t responding right now. Your answer is saved. Feedback will follow as soon as it’s back.',
        )}
      </VNotice>
      <VReload message={T.vLoadFailed} retryLabel={T.vReload} onRetry={() => {}} />
      <div style={{ display: 'flex', gap: 8 }}>
        <VButton variant="sec">{T.vRetry}</VButton>
        <VButton variant="pri" style={{ flex: 1 }}>
          {L('Weiter', 'Continue')}
        </VButton>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <VChip onClick={() => {}} selected count="214">
          {L('Alle', 'All')}
        </VChip>
        <VChip onClick={() => {}} count="41">
          {L('Auf dem Weg', 'On the way')}
        </VChip>
        <VChip lang="en">lead time</VChip>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <VButton variant="ghost">{L('Heute wenig Zeit?', 'Short on time today?')}</VButton>
        <VButton variant="sec" size="sm">
          {L('Mehr', 'More')}
        </VButton>
      </div>
      <VLoading label={T.vLoading}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <VSkeleton width={188} height={188} round />
          <VSkeleton width="72%" height={22} />
          <VSkeleton height={52} radius={14} />
        </div>
      </VLoading>
    </div>
  );
}

function Galerie() {
  return (
    <main style={{ maxWidth: teil === 'alle' ? '45rem' : undefined, margin: '0 auto', paddingBottom: 24 }}>
      {(teil === 'heute' || teil === 'alle') && <Heute />}
      {(teil === 'kacheln' || teil === 'alle') && <Kacheln />}
      {(teil === 'hinweis' || teil === 'alle') && <Hinweis />}
    </main>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <StrictMode>
      <Galerie />
    </StrictMode>,
  );
  el.setAttribute('data-ready', '');
}
