import type { ReactNode } from 'react';
import { flags } from '../../app/flags';
import { registerSlot } from '../../app/slots';
import { ProgramMap } from './ProgramMap';

// Grammatik-Reiter: Programmkarte „Dein Weg zu C1“ unter dem Titel (Lernplattform 3.0 P32). Schalter `flags.program`.
registerSlot({ slot: 'grammar.head', order: 10, enabled: () => flags.program, render: (p) => <ProgramMap next={p.next as ReactNode} /> });
