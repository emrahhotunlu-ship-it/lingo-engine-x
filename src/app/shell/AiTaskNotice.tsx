import { AnimatePresence, motion } from 'framer-motion';
import { useNav } from '../nav';
import { useT } from '../../i18n';
import { Button, IconButton } from '../../ui/Button';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { dismissTask, markTaskSeen, useAiTasks, type AiTask } from './aiTasks';

// Ruhiger Hinweis zu Korrekturen im Hintergrund (M14): „Korrektur läuft …" bzw. „Korrektur
// fertig · Ansehen", nur wenn Emrah gerade woanders ist. Kein Toast-Regen, eine Zeile.

const sameScreen = (a: AiTask['route'], b: { name: string }): boolean => a.name === b.name;

export function AiTaskNotice() {
  const { t } = useT();
  const route = useNav((s) => s.route);
  const go = useNav((s) => s.go);
  const tasks = useAiTasks((s) => s.tasks);
  const visible = Object.values(tasks).filter((x) => !x.seen && !sameScreen(x.route, route));
  const task = visible.find((x) => x.status !== 'running') ?? visible[0];
  return (
    <AnimatePresence>
      {task && (
        <motion.div
          key={task.key}
          className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
        >
          <div className="lx-glass flex max-w-md items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 text-sm shadow-xl" role="status" data-testid="ai-task-notice" data-status={task.status}>
            <span className={task.status === 'error' ? 'text-danger-text' : ''}>
              {task.status === 'running' ? t('inAiRunning') : task.status === 'done' ? t('inAiReady') : t('inAiFailed')}
            </span>
            {task.status !== 'running' && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    markTaskSeen(task.key);
                    go(task.route);
                  }}
                  data-testid="ai-task-view"
                >
                  {t('inAiView')}
                </Button>
                <IconButton icon="close" label={t('close')} onClick={() => dismissTask(task.key)} />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
