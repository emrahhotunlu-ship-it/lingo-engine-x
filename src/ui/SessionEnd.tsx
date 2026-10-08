import { useEffect, useState, type ReactNode } from "react";
import { Slot } from "../app/slots";
import type { UnitState } from "../domain/metrics";
import { useT, type MessageKey } from "../i18n";
import { ActionBar, PrimaryAction } from "./ActionBar";
import { Button } from "./Button";
import { Odometer } from "./Odometer";
import { roundSparks } from "../domain/moments/detect";
import { Eyebrow } from "./Eyebrow";
import { emit } from "../engine/fx";
import { startMoment } from "../engine/fx/measure";
import { isUnsure } from "./exercise/ExerciseStatus";

// Gemeinsames Ende einer Runde (N06, plan.md §4.10, Prototyp v1): Kacheln Richtig · Zeit · Neu,
// „Das nimmst du mit“ (antippbar – die Übung reicht antippbare Wörter herein), GENAU EIN nächster
// Schritt als gefüllter Knopf, optional ein ruhiger zweiter Weg. Kein Konfetti.
// <SessionEnd right={n} total={m} ms={…} newItems={string[]} takeaways={…} next={{ label, run }} />

type SessionEndPropsAlt = {
  right: number;
  total: number;
  /** Aktive Zeit der Runde in ms. */
  ms: number;
  /** Neu hinzugekommene Karten/Wendungen (Anzeige, höchstens 8). */
  newItems?: string[];
  /** Was bleiben soll (z. B. 1–3 Wendungen oder ein Satz; Wörter antippbar über `EnglishText`). */
  takeaways?: ReactNode;
  /** Der eine Hauptknopf (z. B. „Weiter: Block 3“ oder „Zurück zu Heute“). */
  next: { label: string; run: () => void };
  /** Optional ein ruhiger zweiter Weg. */
  secondary?: { label: string; run: () => void };
  /** Überschrift (Standard „Geschafft“), z. B. „✓ Wiederholen geschafft“. */
  title?: string;
};

/**
 * Lernplattform 2.0 §4.5: `growth` zeigt echten Zuwachs statt Kacheln (Musterpunkte ●●○○ → ●●●○, „Neu sicher: …“,
 * Fehlerliste mit „kommt morgen wieder“). Der Hauptknopf steht dann in der ActionBar (Test-ID `session-end-next`).
 * Ohne `mode` bleibt alles wie bisher (Kacheln).
 */
export type SessionEndProps = SessionEndPropsAlt & {
  mode?: "tiles" | "growth";
  /** Je geübter Einheit eine Zeile; die Punkte wandern in 300 ms von `from` zu `to` (von `max`). */
  items?: Array<{
    label: string;
    from: number;
    to: number;
    max: number;
    state: UnitState | null;
  }>;
  /** „Neu sicher: wish + Past (3 von 3 ohne Hilfe)“ – nur Tatsachen, die wirklich eintraten. */
  facts?: string[];
  mistakes?: Array<{
    wrong: string;
    right: string;
    rule: string;
    when: string;
  }>;
  /**
   * Lernplattform 3.0 P28 (Motivation §4.7): Wachstum statt Antwortzahl. Alle Zahlen kommen aus dem Selektor `roundGrowth`
   * (`domain/metrics/round.ts`): Namen der Aufgestiegenen (höchstens 6 genannt), sonst die Gedächtnis-Zeit, Rückfälle, schwerer Block.
   */
  growth?: GrowthView | null;
  warning?: { text: string; retry: () => void } | null;
  /** „Noch 12 fällig · Noch eine Runde“. */
  more?: { label: string; run: () => void } | null;
};

export type GrowthView = {
  up: ReadonlyArray<{ id: string; word: string; to: UnitState }>;
  memory: { n: number; before: number; after: number } | null;
  down: number;
  /** Schwerer Block (unter 60 % bei mindestens 8 Antworten): ein ruhiger Satz. */
  hard: boolean;
  /** Antippen eines Namens (z. B. Wortblatt); ohne sind die Namen nur Text. */
  onOpen?: ((id: string) => void) | undefined;
};

/** So viele Namen werden genannt, der Rest als „und n weitere“. */
const GROWTH_NAMES = 6;

const STATE_KEY: Record<UnitState, MessageKey> = {
  new: "exStateNew",
  learning: "exStateLearning",
  safe: "exStateSafe",
  firm: "exStateFirm",
};

/** Punkte, die sich von `from` auf `to` füllen (300 ms; bei reduzierter Bewegung sofort, das regelt die globale CSS-Regel). */
function GrowthDots({
  from,
  to,
  max,
  label,
  unsure = false,
}: {
  from: number;
  to: number;
  max: number;
  label: string;
  unsure?: boolean;
}) {
  const [shown, setShown] = useState(from);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShown(to));
    return () => window.cancelAnimationFrame(id);
  }, [to]);
  return (
    <span
      className="lx-dots lx-dots-grow"
      role="img"
      aria-label={label}
      data-from={from}
      data-to={to}
      data-unsure={unsure || undefined}
    >
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="lx-dot" data-on={i < shown || undefined} />
      ))}
    </span>
  );
}

function Tile({
  value,
  label,
  testId,
}: {
  value: ReactNode;
  label: string;
  testId: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 rounded-[var(--radius-control)] bg-surface px-2 py-3 text-center"
      data-testid={testId}
    >
      <span className="lx-tnum text-xl font-semibold tracking-tight">
        {typeof value === "string" || typeof value === "number" ? <Odometer text={String(value)} id={`end:${testId}`} delay={150} /> : value}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function GrowthBlock({ growth }: { growth: GrowthView }) {
  const { t, num } = useT();
  const names = growth.up.slice(0, GROWTH_NAMES);
  const more = growth.up.length - names.length;
  const showMemory = growth.up.length === 0 && growth.memory !== null;
  if (growth.up.length === 0 && !showMemory && growth.down === 0 && !growth.hard) return null;
  return (
    <div className="lx-card flex flex-col gap-3 p-4" data-testid="session-end-growth">
      {names.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="growth-up">
          <Eyebrow>{t("moGrowthUpTitle")}</Eyebrow>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {names.map((u) => (
              <li key={u.id}>
                {growth.onOpen ? (
                  <button
                    type="button"
                    className="lx-t-support inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 hover:bg-surface"
                    onClick={() => growth.onOpen?.(u.id)}
                    data-testid="growth-chip"
                    data-id={u.id}
                    data-to={u.to}
                  >
                    <span lang="en">{u.word}</span>
                    <span className="lx-t-meta text-muted">{t(STATE_KEY[u.to])}</span>
                  </button>
                ) : (
                  <span className="lx-t-support inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface-strong px-3" data-testid="growth-chip"
                    data-id={u.id}
                    data-to={u.to}>
                    <span lang="en">{u.word}</span>
                    <span className="lx-t-meta text-muted">{t(STATE_KEY[u.to])}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {more > 0 && <p className="lx-t-meta m-0 text-muted" data-testid="growth-more">{t(more === 1 ? "moGrowthMore_one" : "moGrowthMore_other", { n: num(more) })}</p>}
        </div>
      )}
      {showMemory && growth.memory && (
        <p className="lx-t-body m-0" data-testid="growth-memory">
          {t("moGrowthMemory", { n: num(growth.memory.n), before: num(growth.memory.before), after: num(growth.memory.after) })}
        </p>
      )}
      {growth.down > 0 && (
        <p className="lx-t-support m-0 text-muted" data-testid="growth-down">
          {t(growth.down === 1 ? "moGrowthDown_one" : "moGrowthDown_other", { n: num(growth.down) })}
        </p>
      )}
      {growth.hard && (
        <p className="lx-t-support m-0 text-muted" data-testid="growth-hard">
          {t("moGrowthHard")}
        </p>
      )}
    </div>
  );
}

function GrowthEnd({
  title,
  growth = null,
  items = [],
  facts = [],
  mistakes = [],
  warning = null,
  more = null,
  next,
  secondary,
  takeaways,
  right,
  total,
}: SessionEndProps) {
  const { t } = useT();
  return (
    <section
      className="flex flex-col gap-4"
      data-testid="session-end"
      data-mode="growth"
      data-right={right}
      data-total={total}
    >
      <div className="flex flex-col gap-1">
        {/* UX-Prüfung W6: keine Überzeile über dem Titel (sie sagte dasselbe). */}
        <h1 className="m-0 text-2xl leading-8 font-semibold tracking-tight text-balance">
          {title ?? t("nbShEndTitle")}
        </h1>
        {total > 0 && (
          <p className="lx-tnum lx-t-support m-0 text-muted">
            {t("nbShEndScore", { right, total })}
          </p>
        )}
      </div>
      {growth && <GrowthBlock growth={growth} />}
      {items.length > 0 && (
        <div className="lx-card flex flex-col gap-1 p-4">
          <Eyebrow>{t("hxEndMoved")}</Eyebrow>
          <ul
            className="m-0 flex list-none flex-col p-0"
            data-testid="session-end-items"
          >
            {items.map((it) => {
              const word = it.state ? t(STATE_KEY[it.state]) : null;
              const label =
                t("exEndFrom", { from: it.from, to: it.to }) +
                (word ? ` · ${word}` : "");
              return (
                <li
                  key={it.label}
                  className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0"
                  data-testid="session-end-item"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="lx-t-answer" lang="en">
                      {it.label}
                    </span>
                    {word && (
                      <span className="lx-t-meta text-muted" aria-hidden="true">
                        {word}
                      </span>
                    )}
                  </span>
                  <GrowthDots
                    from={it.from}
                    to={it.to}
                    max={it.max}
                    label={label}
                    unsure={isUnsure(it.state)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {facts.length > 0 && (
        <ul
          className="lx-card m-0 flex list-none flex-col gap-1 p-4"
          data-testid="session-end-facts"
          aria-label={t("exEndFacts")}
        >
          {facts.map((f) => (
            <li key={f} className="lx-t-body">
              {f}
            </li>
          ))}
        </ul>
      )}
      {mistakes.length > 0 && (
        <div
          className="lx-card flex flex-col gap-2 p-4"
          data-testid="session-end-mistakes"
        >
          <Eyebrow>{t("exEndMistakes")}</Eyebrow>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {mistakes.map((m) => (
              <li
                key={`${m.wrong}|${m.right}`}
                className="lx-inset flex flex-col gap-0.5"
                data-testid="session-end-mistake"
              >
                <span className="lx-t-support" lang="en">
                  <span className="text-muted line-through decoration-wrong/60">
                    {m.wrong}
                  </span>
                  {" → "}
                  <span className="font-semibold text-ok-text">{m.right}</span>
                </span>
                <span className="lx-t-meta text-muted">
                  {m.rule} · {t("exEndWhen", { when: m.when })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {takeaways && (
        <div
          className="flex flex-col gap-2"
          data-testid="session-end-takeaways"
        >
          <Eyebrow>{t("nbShEndTakeaways")}</Eyebrow>
          {takeaways}
        </div>
      )}
      <Slot name="session.end" />
      {warning && (
        <div
          className="lx-inset flex items-center justify-between gap-3"
          data-testid="session-end-warning"
          role="status"
        >
          <span className="lx-t-support">{warning.text}</span>
          <Button
            variant="secondary"
            onClick={warning.retry}
            data-testid="session-end-retry"
          >
            {t("exRetry")}
          </Button>
        </div>
      )}
      {(more || secondary) && (
        <div className="flex flex-col gap-1">
          {more && (
            <Button
              variant="secondary"
              onClick={more.run}
              data-testid="session-end-more"
            >
              {more.label}
            </Button>
          )}
          {secondary && (
            <Button
              variant="ghost"
              onClick={secondary.run}
              data-testid="session-end-secondary"
            >
              {secondary.label}
            </Button>
          )}
        </div>
      )}
      <ActionBar stateKey="end">
        <PrimaryAction
          iconAfter="arrowRight"
          onClick={next.run}
          testId="session-end-next"
        >
          {next.label}
        </PrimaryAction>
      </ActionBar>
    </section>
  );
}

export function SessionEnd(props: SessionEndProps) {
  // Design-Lead (EE M6): der Moment „Runde geschafft“ einmal beim Erscheinen; was er zeigt, entscheidet der Dirigent (nur Stufe „Voll“ Teilchen).
  // P56 (EE4): Funken nur aus den höchstens drei Chips, deren Zustand gestiegen ist; ohne Aufstieg keine Funken.
  const ups = props.growth?.up ?? [];
  useEffect(() => {
    const stop = startMoment("round", 900);
    const id = setTimeout(() => {
      const from = roundSparks(ups).map((u) => document.querySelector(`[data-testid="growth-chip"][data-id="${CSS.escape(u.id)}"]`));
      emit({ k: "moment", m: "round", el: document.querySelector('[data-testid="session-end"]'), from });
    }, 180);
    return () => {
      clearTimeout(id);
      stop();
    };
    // Einmal beim Erscheinen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (props.mode === "growth") return <GrowthEnd {...props} />;
  return <TilesEnd {...props} />;
}

function TilesEnd({
  right,
  total,
  ms,
  newItems = [],
  takeaways,
  next,
  secondary,
  title,
}: SessionEndProps) {
  const { t } = useT();
  const min = Math.max(1, Math.round(ms / 60_000));
  const shown = newItems.slice(0, 8);
  return (
    <section
      className="lx-card flex flex-col gap-4 p-[1.125rem]"
      data-testid="session-end"
      data-right={right}
      data-total={total}
    >
      <Eyebrow tone="accent">{title ?? t("nbShEndTitle")}</Eyebrow>
      <p className="sr-only" data-testid="session-end-score">
        {t("nbShEndScore", { right, total })} · {t("nbShEndMinutes", { min })}
      </p>
      <div className="grid grid-cols-3 gap-2" aria-hidden="true">
        <Tile
          value={t("nvProgress", { n: right, total })}
          label={t("nbShEndRight")}
          testId="session-end-right"
        />
        <Tile
          value={t("nbShEndMin", { min })}
          label={t("nbShEndTime")}
          testId="session-end-time"
        />
        <Tile
          value={newItems.length}
          label={t("nbShEndNewShort")}
          testId="session-end-newcount"
        />
      </div>
      {shown.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="session-end-new">
          <Eyebrow>{t("nbShEndNew")}</Eyebrow>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {shown.map((w) => (
              <li
                key={w}
                className="inline-flex min-h-9 items-center rounded-full bg-surface-strong px-3 text-sm"
                lang="en"
              >
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
      {takeaways && (
        <div
          className="flex flex-col gap-2"
          data-testid="session-end-takeaways"
        >
          <Eyebrow>{t("nbShEndTakeaways")}</Eyebrow>
          {takeaways}
        </div>
      )}
      <Slot name="session.end" />
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          iconAfter="arrowRight"
          onClick={next.run}
          data-testid="session-end-next"
          className="w-full sm:w-full"
        >
          {next.label}
        </Button>
        {secondary && (
          <Button
            variant="ghost"
            onClick={secondary.run}
            data-testid="session-end-secondary"
          >
            {secondary.label}
          </Button>
        )}
      </div>
    </section>
  );
}
