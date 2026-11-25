import { VMOD_CARE_PATH } from '../../modules/vocab/registry';

// Entwicklungs-Adapter: erfundene Wörter-Pflege (Emrah 25.11.2026, docs/umbau/vokabeln/pflege.md) für den Dev-Server (`?fake=care`) und die
// E2E-Tests. Nur Testwörter aus seed/sample-data.json (achieve, convince, persuade, postpone, feasible) und ein erfundenes Doppel
// `vocab/achieve-dup`; keine echten Daten. Nie im Produktions-Build (nur install.ts und Tests importieren es).

type Doc = Record<string, unknown>;

/** Geprüfte Wortfamilien der Testwörter (Format `famx`, Form in eckigen Klammern im Satz). */
export const SAMPLE_FAM: Readonly<Record<string, readonly Doc[]>> = {
  'vocab/achieve': [
    { form: 'achievement', pos: 'noun', de: 'Leistung, Erfolg', ex: 'The new billing system was a real [achievement] for the team.' },
    { form: 'achievable', pos: 'adjective', de: 'erreichbar', ex: 'With two more developers, the deadline is [achievable].' },
  ],
  'vocab/postpone': [{ form: 'postponement', pos: 'noun', de: 'Verschiebung', ex: 'The [postponement] of the launch cost us two weeks.' }],
  'vocab/convince': [{ form: 'convincing', pos: 'adjective', de: 'überzeugend', ex: 'Her business case was very [convincing].' }],
};

/** Ein erfundenes Doppel von „to achieve“ (für das Zusammenführen). */
export const SAMPLE_DUP: Doc = { id: 'achieve-dup', word: 'achieve', de: 'erreichen', ex: 'We [achieved] all targets this quarter.', pos: 'verb', src: 'lookup', added: '2026-09-18', order: 901, state: 'new', col: [] };

/**
 * Offene Pflege-Aufträge (Dokument VMOD_CARE_PATH): je eine Korrektur, Wortfamilie, Verknüpfung und Zusammenführung, dazu eine Korrektur mit
 * veraltetem alten Wert (wird übersprungen). `t` = Zeitpunkt des Auftrags.
 */
export function sampleCareDoc(t: number): Doc {
  return {
    v: 1,
    ops: {
      'fix-feasible-de': { k: 'fix', t, st: 'open', by: 'pflege@1', why: 'Bedeutung ergänzt.', p: 'vocab/feasible', set: { de: { from: 'machbar', to: 'machbar, durchführbar' } } },
      'fix-stale': { k: 'fix', t: t + 1, st: 'open', by: 'pflege@1', p: 'vocab/postpone', set: { de: { from: 'aufschieben (alt)', to: 'verschieben, vertagen' } } },
      'fam-achieve': { k: 'fam', t: t + 2, st: 'open', by: 'pflege@1', p: 'vocab/achieve', w: 'to achieve', from: null, fam: SAMPLE_FAM['vocab/achieve'] },
      'link-convince': { k: 'link', t: t + 3, st: 'open', by: 'pflege@1', why: 'Verwandte Verben, verschiedene Bedeutung.', hs: { 'vocab/convince': 'to convince', 'vocab/persuade': 'to persuade' } },
      'merge-achieve': { k: 'merge', t: t + 4, st: 'open', by: 'pflege@1', why: 'Gleiches Wort zweimal.', keep: 'vocab/achieve', drop: 'vocab/achieve-dup', kw: 'to achieve', dw: 'achieve', ok: '2026-09-20' },
    },
  };
}

/** Patch für den Anfangsbestand: Pflege-Auftrag und das erfundene Doppel. */
export function carePatch(t: number): Record<string, Doc> {
  return { [VMOD_CARE_PATH]: sampleCareDoc(t), 'vocab/achieve-dup': SAMPLE_DUP };
}
