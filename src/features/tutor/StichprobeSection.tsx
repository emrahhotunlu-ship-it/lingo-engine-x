import { useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { heldRepairRows } from '../../domain/repair/gate';
import { readRepairs } from '../../domain/repair/repair';
import { fitAltRows } from '../../domain/tutor/fitAlt';
import { sampleFile, shownSample, totalQuality } from '../../domain/tutor/quality';
import { bankSample, readGate, sbWaiting } from '../../domain/tutor/sentenceBank';
import { SbGatePanel } from './SbGatePanel';
import { currentGate } from '../vocab/sentenceBank';
import { useT } from '../../i18n';
import { saveFile } from '../../platform/downloads';
import { useCapabilities } from '../../platform/capabilities';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';

// Einstellungen › Diagnose: „KI-Stichprobe sichern“ (Lernplattform 3.0 P25). Die letzten 30 gezeigten Inhalte von Claude (Aufgabe, Antwort,
// Erklärung, Meldung) als JSON-Datei über `downloads`; dazu eine Zeile mit den Qualitätszählern. Emrah schickt die Datei in claude.ai, der
// Englischlehrer prüft sie dort. Ohne `downloads` gibt es den Knopf nicht.
// Satzbank (19.10.2026): dieselbe Datei trägt die Stichprobe von 30 Claude-Sätzen (`bankSample`) mit dem Stand des Freigabe-Schalters.
// Tutor-Engine v3 §3.2: dieselbe Datei trägt die gemerkten „Auch richtig“-Antworten (`grammar/<topic>.fitAlt`) zur Gegenlesung.

export function StichprobeSection() {
  const { t, num } = useT();
  const downloads = useCapabilities((s) => s.downloads);
  const grammar = useLive((s) => s.collections.grammar);
  const fitRows = useMemo(() => (grammar ? fitAltRows(grammar) : []), [grammar]);
  const repairDoc = useLive((s) => s.docs['app/repair']);
  const heldRows = useMemo(() => heldRepairRows(readRepairs(repairDoc ?? undefined)), [repairDoc]);
  // Satzbank (Engine-Verdrahtung 19.10.2026): Stichprobe von 30 Claude-Sätzen für den Englischlehrer.
  const vocab = useLive((s) => s.collections.vocab);
  const profile = useLive((s) => s.docs['app/profile']);
  const now = useClock((s) => s.now);
  const bank = useMemo(() => bankSample(vocab, currentGate(profile), now), [vocab, profile, now]);
  // Freigabe eintragen (21.10.2026): gespeicherter Schalter (nicht der wirksame) und die Sätze, deren eigene 4 Wochen noch laufen.
  const stored = useMemo(() => readGate(profile?.sbGate), [profile]);
  const waiting = useMemo(() => sbWaiting(vocab, now), [vocab, now]);
  const [n, setN] = useState(() => shownSample().length);
  const [busy, setBusy] = useState(false);
  if (downloads !== 'ready') return null;
  const q = totalQuality();
  // Einzahl/Mehrzahl („1 Satz“, „2 Sätze“); der Hinweis „kommt mit in die Datei“ steht einmal im Einleitungstext.
  const sentences = (k: number): string => (k === 1 ? t('ttSbSentence1') : t('ttSbSentences', { n: num(k) }));
  const save = async () => {
    const items = shownSample();
    setN(items.length);
    if (!items.length && !fitRows.length && !heldRows.length && !bank.n) {
      toast(t('ttSampleEmpty'));
      return;
    }
    setBusy(true);
    try {
      const f = sampleFile(Date.now(), fitRows, heldRows, bank);
      const r = await saveFile(f.name, f.data);
      toast(r === 'saved' ? t('ttSampleSaved') : t('ttSampleFailed'), r === 'saved' ? 'info' : 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flex flex-col gap-3" data-testid="ai-sample">
      <h3 className="lx-eyebrow">{t('ttSampleTitle')}</h3>
      <p className="m-0 text-sm text-muted">{t('ttSampleText', { n: num(n) })}</p>
      <p className="m-0 text-xs text-subtle" data-testid="ai-quality">
        {t('ttQualityRow', { gen: num(q.gen), acc: num(q.acc), shown: num(q.shown), flag: num(q.flag) })}
      </p>
      <p className="m-0 text-xs text-subtle" data-testid="ai-fitalt">
        {t('ttJgFitAltRow', { n: num(fitRows.length) })}
      </p>
      <p className="m-0 text-xs text-subtle" data-testid="ai-held-repairs">
        {t('ttHeldRepairsRow', { n: num(heldRows.length) })}
      </p>
      <p className="m-0 text-xs text-subtle" data-testid="ai-sb" data-n={bank.n} data-sample={bank.sample.length} data-on={bank.gate.on ? '1' : '0'}>
        {t('ttSbSampleRow', { ns: sentences(bank.n), q: num(bank.quarantined), ss: sentences(bank.sample.length), state: t(bank.gate.on ? 'ttSbGateOn' : 'ttSbGateOff') })}
      </p>
      <div>
        <Button variant="secondary" onClick={() => void save()} busy={busy} data-testid="ai-sample-save">
          {t('ttSampleSave')}
        </Button>
      </div>
      <SbGatePanel gate={stored} sampleN={bank.sample.length} quarantined={waiting} now={now} />
    </section>
  );
}
