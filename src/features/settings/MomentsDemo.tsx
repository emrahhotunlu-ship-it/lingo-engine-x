import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import demoJson from '../../content/demo/moments.json';
import { levelUpFor, roundSparks } from '../../domain/moments/detect';
import { emit } from '../../engine/fx/events';
import { momentLines, startMoment, subscribeMomentLines } from '../../engine/fx/measure';
import { useT, type MessageKey } from '../../i18n';
import { logWarn } from '../../platform/diagnostics';
import { CopyButton } from '../../ui/CopyBox';
import { DayRing } from '../../ui/DayRing';
import { Odometer } from '../../ui/Odometer';
import { useLevelUp } from '../../ui/moments/store';

// „Momente ansehen“ (Lernplattform 3.0 P60): spielt Runde, Tag und Aufstieg mit Beispielzahlen ab. Einzige Quelle ist `content/demo/moments.json`
// (kein Seed, kein Entwicklungs-Adapter, keine Datenbank: nichts wird gelesen oder geschrieben). Darunter die gemessenen Zeilen der letzten Momente
// (Bildrate, längstes Bild, Stufe) zum Kopieren für die Diagnose.

const State = z.enum(['new', 'learning', 'safe', 'firm']);
const Demo = z.object({
  v: z.literal(1),
  round: z.object({ right: z.number(), total: z.number(), ups: z.array(z.object({ id: z.string(), word: z.string(), to: State })) }),
  day: z.object({ fills: z.array(z.number()), before: z.string(), hero: z.string() }),
  level: z.array(z.string()),
});
type DemoData = z.infer<typeof Demo>;

function loadDemo(): DemoData | null {
  const r = Demo.safeParse(demoJson);
  if (!r.success) logWarn('fx:demo', r.error, 'moments.json');
  return r.success ? r.data : null;
}

const STATE_KEY: Record<z.infer<typeof State>, MessageKey> = { new: 'exStateNew', learning: 'exStateLearning', safe: 'exStateSafe', firm: 'exStateFirm' };

type Scene = 'round' | 'day' | null;

function RoundScene({ data }: { data: DemoData['round'] }) {
  const { t, num } = useT();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stop = startMoment('round', 900);
    const id = setTimeout(() => {
      const from = roundSparks(data.ups).map((u) => box.current?.querySelector(`[data-demo-chip="${u.id}"]`) ?? null);
      emit({ k: 'moment', m: 'round', el: box.current, from });
    }, 180);
    return () => {
      clearTimeout(id);
      stop();
    };
  }, [data]);
  return (
    <div ref={box} className="flex flex-col items-center gap-3" data-testid="demo-round">
      <span className="text-3xl font-semibold tracking-tight">
        <Odometer text={`${num(data.right)}/${num(data.total)}`} from={`0/${num(data.total)}`} delay={120} />
      </span>
      <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
        {data.ups.map((u) => (
          <li key={u.id}>
            <span className="lx-t-support inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface-strong px-3" data-demo-chip={u.id}>
              <span lang="en">{u.word}</span>
              <span className="lx-t-meta text-muted">{t(STATE_KEY[u.to])}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DayScene({ data }: { data: DemoData['day'] }) {
  const { t } = useT();
  const ring = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const stop = startMoment('day');
    const id = setTimeout(() => emit({ k: 'moment', m: 'day', el: ring.current }), 640);
    return () => {
      clearTimeout(id);
      stop();
    };
  }, []);
  const n = data.fills.length;
  return (
    <div className="flex flex-col items-center gap-3" data-testid="demo-day">
      <span ref={ring} className="dz-done-ring" data-play="">
        <DayRing fills={data.fills} closed play size={168} stroke={14} label={t('nbHeuteRingLabel', { done: n, total: n })} />
      </span>
      <span className="dz-hero-n">
        <Odometer text={data.hero} from={data.before} delay={820} />
      </span>
    </div>
  );
}

export function MomentsDemo() {
  const { t } = useT();
  const [data] = useState(loadDemo);
  const [scene, setScene] = useState<Scene>(null);
  const [run, setRun] = useState(0);
  const [levelIx, setLevelIx] = useState(0);
  const show = useLevelUp((s) => s.show);
  const lines = useSyncExternalStore(subscribeMomentLines, momentLines, momentLines);
  const pre = useRef<HTMLPreElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // UX-Prüfung W7: die Bühne beim Abspielen ins Bild holen (Mitte), sonst läuft der Moment am Handy unter dem Bildrand ab.
  useEffect(() => {
    if (!scene || run === 0) return;
    const off = document.documentElement.dataset['fx'] === 'off';
    stage.current?.scrollIntoView({ block: 'center', behavior: off ? 'auto' : 'smooth' });
  }, [scene, run]);
  if (!data) return null;
  const play = (s: Exclude<Scene, null>): void => {
    setScene(s);
    setRun((r) => r + 1);
  };
  const playLevel = (): void => {
    const id = data.level[levelIx % data.level.length] ?? '';
    const level = levelUpFor(id);
    setLevelIx((i) => i + 1);
    if (level) show({ id: `demo:${id}:${levelIx}`, level, demo: true });
  };
  const btn = 'inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-semibold hover:bg-surface';
  return (
    <div className="flex flex-col gap-3" data-testid="moments-demo">
      <p className="m-0 text-sm text-muted">{t('eeR6MomentsHelp')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => play('round')} data-testid="demo-play-round">
          {t('eeR6PlayRound')}
        </button>
        <button type="button" className={btn} onClick={() => play('day')} data-testid="demo-play-day">
          {t('eeR6PlayDay')}
        </button>
        <button type="button" className={btn} onClick={playLevel} data-testid="demo-play-level">
          {t('eeR6PlayLevel')}
        </button>
      </div>
      {scene && (
        <div ref={stage} className="lx-moments-stage" data-testid="demo-stage" data-scene={scene}>
          {scene === 'round' ? <RoundScene key={run} data={data.round} /> : <DayScene key={run} data={data.day} />}
        </div>
      )}
      <h4 className="lx-eyebrow m-0">{t('eeR6LinesTitle')}</h4>
      {lines.length > 0 ? (
        <>
          <pre ref={pre} className="lx-moments-lines" data-testid="moment-lines">
            {lines.join('\n')}
          </pre>
          <CopyButton text={lines.join('\n')} target={() => pre.current} testId="moment-lines-copy" />
        </>
      ) : (
        <p className="m-0 text-xs text-subtle" data-testid="moment-lines-none">
          {t('eeR6LinesNone')}
        </p>
      )}
    </div>
  );
}
