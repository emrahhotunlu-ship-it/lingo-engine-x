import { useState } from 'react';
import { sampleFile, shownSample, totalQuality } from '../../domain/tutor/quality';
import { useT } from '../../i18n';
import { saveFile } from '../../platform/downloads';
import { useCapabilities } from '../../platform/capabilities';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';

// Einstellungen › Diagnose: „KI-Stichprobe sichern“ (Lernplattform 3.0 P25). Die letzten 30 gezeigten Inhalte von Claude (Aufgabe, Antwort,
// Erklärung, Meldung) als JSON-Datei über `downloads`; dazu eine Zeile mit den Qualitätszählern. Emrah schickt die Datei in claude.ai, der
// Englischlehrer prüft sie dort. Ohne `downloads` gibt es den Knopf nicht.

export function StichprobeSection() {
  const { t, num } = useT();
  const downloads = useCapabilities((s) => s.downloads);
  const [n, setN] = useState(() => shownSample().length);
  const [busy, setBusy] = useState(false);
  if (downloads !== 'ready') return null;
  const q = totalQuality();
  const save = async () => {
    const items = shownSample();
    setN(items.length);
    if (!items.length) {
      toast(t('ttSampleEmpty'));
      return;
    }
    setBusy(true);
    try {
      const f = sampleFile();
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
      <div>
        <Button variant="secondary" onClick={() => void save()} busy={busy} data-testid="ai-sample-save">
          {t('ttSampleSave')}
        </Button>
      </div>
    </section>
  );
}
