import { motion } from 'framer-motion';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';

// Ruhige Hinweiszeile unter der Lücke für den zweiten Versuch („Erst ein Hinweis, dann die
// Lösung", Lernberatung Vorschlag 4). Nur Tokens des Design-Systems (gold = „noch nicht ganz"),
// ohne Fokus-Wechsel: die Eingabe bleibt in der Lücke, die Tastatur bleibt offen.

export function RetryHintLine({ text }: { text: string }) {
  const { t, lang } = useT();
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      className="flex items-start gap-2 text-sm text-gold-text"
      role="status"
      data-testid="retry-hint"
      lang={lang}
    >
      <Icon name="lightbulb" size={16} className="mt-0.5 flex-none" />
      <span>
        <span className="sr-only">{t('rhLabel')}: </span>
        {text}
      </span>
    </motion.p>
  );
}
