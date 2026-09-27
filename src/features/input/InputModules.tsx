import { INPUT_MODULES, type ModuleDef } from '../../app/modules';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { Card } from '../../ui/Card';
import { InputIcon } from '../../ui/InputIcon';
import { useChannelState } from './InputOffers';

// Modul-Einstieg im Reiter „Lernen" (Plan §2.2 INT, M13): Lesen, Hören, Schreiben – jederzeit
// freiwillig erreichbar, dazu der Verlauf. Entdecken hat einen eigenen Reiter.
// Heute Geübtes steht als ruhiger Hinweis „heute geübt“ daneben (Extra, keine Pflicht).

export function InputModules({ only }: { only?: ReadonlyArray<ModuleDef['id']> }) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const { rows } = useChannelState();
  return (
    <Card aria-labelledby="ov-input" data-testid="input-modules">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="ov-input" className="text-lg font-semibold tracking-tight">
            {t('inModulesTitle')}
          </h2>
          <p className="text-sm text-muted">{t('inModulesHint')}</p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {INPUT_MODULES.filter((m) => !only || only.includes(m.id)).map((m) => {
            const done = rows.find((r) => r.module.id === m.id)?.done ?? false;
            return (
              <li key={m.id} className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => go(m.route)}
                  data-testid="module"
                  data-module={m.id}
                  className="flex min-h-14 flex-1 items-center gap-3 rounded-[var(--radius-control)] bg-surface px-3 text-left transition-colors hover:bg-surface-strong"
                >
                  <span className="inline-flex size-9 flex-none items-center justify-center" style={{ color: `var(--lx-ch-${m.channel})` }}>
                    <InputIcon name={m.icon} />
                  </span>
                  <span className="flex-1 font-medium">{t(m.label)}</span>
                  {done && (
                    // Freiwilliges Angebot (Kap. 2.6): Hinweis „heute geübt", kein „Erledigt"-Häkchen am Knopf.
                    <span className="whitespace-nowrap text-xs text-muted" data-testid="module-done">
                      {t('inPracticedToday')}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => go(m.history)}
                  aria-label={t('inHistoryOf', { channel: t(m.label) })}
                  title={t('inHistoryOf', { channel: t(m.label) })}
                  className="inline-flex min-h-14 w-12 items-center justify-center rounded-[var(--radius-control)] bg-surface text-subtle hover:text-fg"
                  data-testid="module-history"
                >
                  <InputIcon name="history" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
