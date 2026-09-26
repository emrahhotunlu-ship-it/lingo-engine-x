import { useCapabilities } from '../../platform/capabilities';
import { selectAiAvailable } from '../../ai/scope';
import { TRANSLATE_MAX } from '../../prompts/translate';
import { openCompanion } from './store';

// Globale Taste `/` (Phase 5 §8.2): öffnet den Übersetzer im Begleiter mit Fokus im Eingabefeld.
// Nur wenn kein Eingabefeld fokussiert ist, keine Zusatztaste gedrückt ist und kein anderer Dialog
// offen ist. Markierter Text auf der Seite (≤ 1.500 Zeichen) wird übernommen, aber NICHT gesendet.

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

function isEditable(el: Element | null): boolean {
  return !!el && (el.matches(EDITABLE) || !!el.closest('[contenteditable="true"]'));
}

function otherDialogOpen(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"]')).some((d) => d.getAttribute('data-testid') !== 'companion');
}

let installed = false;

export function installCompanionHotkeys(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || e.isComposing) return;
    if (isEditable(document.activeElement)) return;
    if (otherDialogOpen()) return;
    if (!selectAiAvailable(useCapabilities.getState())) return;
    const selected = (window.getSelection()?.toString() ?? '').trim();
    e.preventDefault();
    openCompanion(selected && selected.length <= TRANSLATE_MAX ? { tab: 'translate', text: selected } : { tab: 'translate' });
    // Fokus ins Eingabefeld, sobald der Reiter steht.
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('[data-testid="tr-input"]')?.focus(), 60);
  });
}
