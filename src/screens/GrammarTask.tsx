import { useRef, useState } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { TYPE_INSTR, topicById, type GrammarTask } from '../coach/grammar';
import { gradeGrammar } from '../coach/gradeGrammar';
import type { MixItem } from '../coach/mix';
import { StepHead, type StepKind } from './Exercise';

// Grammatik- und Mix-Aufgaben (Einstufung und Training). Nach jeder Antwort: richtig oder die
// Lösung, dazu immer das Warum (Kap. 2.4), auch bei richtiger Antwort.

export function GrammarItem({ task, onDone, bare = false, kind = 'grammar', revealOnSkip = false }: { task: GrammarTask; onDone: (ok: boolean) => void; bare?: boolean; kind?: StepKind; revealOnSkip?: boolean }) {
  const { t, lang } = useT();
  const [value, setValue] = useState('');
  const [verdict, setVerdict] = useState<null | boolean>(null);
  const input = useRef<HTMLInputElement>(null);
  const topic = topicById(task.topic);

  function check(given: string) {
    setVerdict(gradeGrammar(given, task));
  }

  return (
    <div className={bare ? '' : 'lx-glass mt-6 rounded-[var(--radius-card)] p-6'} data-testid="grammar-item">
      {bare && <StepHead kind={kind} lv={null} />}
      <p className="text-2xs text-muted">
        {topic ? (lang === 'de' ? topic.name : topic.name_en) : ''} · {TYPE_INSTR[lang][task.type]}
      </p>
      <p className="mt-3 text-lg leading-relaxed" lang="en" data-testid="grammar-prompt">
        {task.prompt}
        {task.hint ? <span className="ml-2 text-muted">{task.hint}</span> : null}
      </p>
      {task.type === 'mc' && task.options ? (
        <div className="mt-5 grid gap-2" data-testid="grammar-options">
          {task.options.map((o) => {
            const isAnswer = o === task.answer;
            const tone = verdict === null ? '' : isAnswer ? 'ring-2 ring-accent' : '';
            return (
              <Button key={o} variant="secondary" className={tone} disabled={verdict !== null} onClick={() => setVerdict(isAnswer)}>
                <span lang="en">{o}</span>
              </Button>
            );
          })}
        </div>
      ) : (
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (verdict === null && value.trim()) check(value);
          }}
        >
          <input
            ref={input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={verdict !== null}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            lang="en"
            aria-label={TYPE_INSTR[lang][task.type]}
            className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-base text-fg outline-none focus:border-accent"
            data-testid="grammar-input"
          />
          {verdict === null && (
            <Button type="submit" variant="primary" disabled={!value.trim()}>
              {t('cCheck')}
            </Button>
          )}
        </form>
      )}
      {verdict !== null && (
        <div className="mt-4 text-sm" data-testid="grammar-feedback">
          <p className={`flex items-center gap-2 font-semibold ${verdict ? 'text-accent-text' : 'text-gold-text'}`}>
            <Icon name={verdict ? 'check' : 'info'} size={16} />
            {verdict ? t('cFbRight') : `${t('cFbWrong')}: `}
            {!verdict && <span lang="en">{task.answer}</span>}
          </p>
          <p className="mt-1.5 text-muted">{lang === 'de' ? task.expl : task.expl_en}</p>
        </div>
      )}
      <div className="mt-5 flex gap-2">
        {verdict === null ? (
          <Button variant="ghost" onClick={() => (revealOnSkip ? setVerdict(false) : onDone(false))} data-testid="grammar-skip">
            {t('cPlDontKnow')}
          </Button>
        ) : (
          <Button variant="primary" iconAfter="arrowRight" onClick={() => onDone(verdict)} data-testid="grammar-next">
            {t('cNext')}
          </Button>
        )}
      </div>
    </div>
  );
}


/** Thema des Tages: Regel kurz vorweg, dann geht es los. */
export function RuleCard({ topic, sure, onGo }: { topic: string; sure: number; onGo: () => void }) {
  const { t, lang } = useT();
  const tp = topicById(topic);
  return (
    <div data-testid="rule-card">
      <StepHead kind="grammar" lv={null} />
      <p className="lx-eyebrow text-muted">{t('cGrammarFocus')}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{tp ? (lang === 'de' ? tp.name : tp.name_en) : topic}</h2>
      {tp && <p className="mt-3 text-base leading-relaxed">{lang === 'de' ? tp.rule : tp.rule_en}</p>}
      <p className="mt-3 text-2xs text-subtle">{t('cGrammarSure', { pct: Math.round(sure * 100) })}</p>
      <div className="mt-6">
        <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onGo} data-testid="rule-go">
          {t('cGrammarGo')}
        </Button>
      </div>
    </div>
  );
}

const blankParts = (prompt: string): [string, string] => {
  const i = prompt.indexOf('___');
  return i < 0 ? [prompt, ''] : [prompt.slice(0, i), prompt.slice(i + 3)];
};

/** Feste Verbindung oder falscher Freund: Auswahl, danach Lösung und Erklärung. */
export function MixTask({ item, onDone }: { item: MixItem; onDone: (ok: boolean) => void }) {
  const { t, lang } = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const ok = picked === item.answer;
  const [before, after] = blankParts(item.prompt);
  const expl = lang === 'de' ? item.expl : item.expl_en;
  return (
    <div data-testid="mix-task" data-type={item.type}>
      <StepHead kind={item.type === 'ff' ? 'ff' : 'colloc'} lv={null} />
      <p className="text-sm text-muted">{item.type === 'ff' ? t('cTaskFF') : t('cTaskColloc')}</p>
      <p className="mt-3 text-xl leading-relaxed" lang="en" data-testid="mix-prompt">
        {before}
        <span className={`inline-block min-w-16 border-b-2 px-1 text-center ${picked ? (ok ? 'border-accent text-accent-text' : 'border-danger-text text-danger-text') : 'border-line'}`}>{picked ?? '\u00a0'}</span>
        {after}
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2" data-testid="mix-options">
        {item.options.map((o) => (
          <Button
            key={o}
            variant="secondary"
            disabled={picked !== null}
            className={picked && o === item.answer ? 'ring-2 ring-accent' : picked === o ? 'ring-2 ring-danger-text/60' : ''}
            onClick={() => setPicked(o)}
          >
            <span lang="en">{o}</span>
          </Button>
        ))}
      </div>
      {picked !== null && (
        <div className="mt-5 border-t border-line/60 pt-4 text-sm" data-testid="mix-feedback">
          <p className={`flex items-center gap-2 font-semibold ${ok ? 'text-accent-text' : 'text-danger-text'}`}>
            <Icon name={ok ? 'check' : 'close'} size={16} />
            {ok ? t('cFbRight') : `${t('cFbWrong')}: `}
            {!ok && <span lang="en" className="text-fg">{item.answer}</span>}
          </p>
          {item.de && <p className="mt-1.5">{item.type === 'ff' ? `„${item.de}“` : item.de}</p>}
          {expl && <p className="mt-1.5 text-muted">{expl}</p>}
          <div className="mt-4">
            <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => onDone(ok)} data-testid="next">
              {t('cNext')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

