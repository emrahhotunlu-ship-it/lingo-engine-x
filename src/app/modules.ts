import type { InputIconName } from '../ui/InputIcon';
import type { MessageKey } from '../i18n';
import type { InputRoute } from './nav';

// Modul-Einstieg (Plan §2.2 INT, M13): die Übungsbereiche als Daten. Phase 4 trägt Lesen,
// Hören, Schreiben und Entdecken ein; weitere Phasen hängen ihre Einträge an. Die Oberfläche
// (Reiter „Lernen" bzw. Liste auf „Dein Stand") liest nur diese Liste.

export type ModuleDef = {
  id: 'read' | 'listen' | 'write' | 'discover';
  label: MessageKey;
  icon: InputIconName;
  channel: 'read' | 'listen' | 'write' | 'discover';
  route: InputRoute;
  history: InputRoute;
};

export const INPUT_MODULES: readonly ModuleDef[] = [
  { id: 'read', label: 'ch_read', icon: 'article', channel: 'read', route: { name: 'read', ctx: 'extra' }, history: { name: 'history', kind: 'read' } },
  { id: 'listen', label: 'ch_listen', icon: 'headphones', channel: 'listen', route: { name: 'listen', ctx: 'extra' }, history: { name: 'history', kind: 'listen' } },
  { id: 'write', label: 'ch_write', icon: 'pen', channel: 'write', route: { name: 'write', ctx: 'extra' }, history: { name: 'history', kind: 'write' } },
  { id: 'discover', label: 'ch_discover', icon: 'compass', channel: 'discover', route: { name: 'discover' }, history: { name: 'history', kind: 'discover' } },
];

export const INPUT_SCREENS = ['read', 'listen', 'write', 'discover', 'discoverItem', 'history'] as const;
export const isInputScreen = (name: string): boolean => (INPUT_SCREENS as readonly string[]).includes(name);
