import { useMemo, useState } from 'react';
import { detectTargets } from '../../domain/week';
import { useT } from '../../i18n';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';

// Neubau N78 (Soll, Lehrer I5): Anwenden-Schritt im Verhandlungs-Baukasten – Emrah formuliert
// selbst für seine Lage (laut sprechen, dann tippen oder diktieren). Lokal ohne KI: welche der
// Wendungen er benutzt hat, zählt beim Tippen mit (`detectTargets`). Nichts wird gespeichert.

export function ApplyStep({ phrases }: { phrases: readonly string[] }) {
  const { t } = useT();
  const [text, setText] = useState('');
  const scan = useMemo(() => detectTargets(text, { goals: [], phrases: [...phrases] }), [text, phrases]);
  return (
    <Card as="div" className="flex flex-col gap-3" data-testid="pb-apply">
      <p className="lx-eyebrow">{t('nbSprechenApplyTitle')}</p>
      <p className="text-sm">{t('nbSprechenApplyTask')}</p>
      <textarea
        value={text}
        rows={3}
        maxLength={600}
        onChange={(e) => setText(e.target.value)}
        autoCapitalize="sentences"
        spellCheck={false}
        aria-label={t('nbSprechenApplyTitle')}
        data-testid="pb-apply-input"
        className="resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-fg outline-none focus:border-[var(--lx-accent)]"
      />
      <p className="text-xs text-muted">{t('nbSprechenDictateHint')}</p>
      {text.trim() && (
        <p className={`flex items-center gap-2 text-sm ${scan.phrasesUsed.length ? 'text-accent-text' : 'text-muted'}`} data-testid="pb-apply-used" data-n={scan.phrasesUsed.length}>
          {scan.phrasesUsed.length > 0 && <Icon name="check" size={16} aria-hidden="true" />}
          {scan.phrasesUsed.length ? t('nbSprechenApplyUsed', { list: scan.phrasesUsed.join(' · ') }) : t('nbSprechenApplyNone')}
        </p>
      )}
    </Card>
  );
}
