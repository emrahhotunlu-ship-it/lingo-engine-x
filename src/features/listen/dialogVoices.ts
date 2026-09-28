import type { Accent } from '../../prompts/nb/p4/listeningDialog';
import type { VoiceInfo } from '../../platform/speech';

// Stimmen für das Hör-Meeting (Backlog B6, Lehrer H3): je Sprecher eine eigene Stimme, möglichst
// mit passendem Akzent (en-US/-GB/-IN/-AU). Was das Gerät nicht hat, wird mit einer anderen
// freien englischen Stimme besetzt; gibt es nur eine Stimme, sprechen alle mit ihr (`null` =
// Standardstimme). Rein und getestet.

const LANG: Record<Accent, string> = { us: 'en-us', gb: 'en-gb', in: 'en-in', au: 'en-au' };

export type VoicePlan = {
  /** Stimme je Sprecher (Name) oder `null` = Standardstimme. */
  names: Array<string | null>;
  /** Anzahl verschiedener Stimmen (mindestens 1). */
  distinct: number;
  /** Ob jeder Sprecher eine Stimme mit seinem Akzent bekommen hat. */
  accents: boolean[];
};

export function assignVoices(accents: readonly Accent[], voices: readonly VoiceInfo[]): VoicePlan {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (english.length < 2) return { names: accents.map(() => null), distinct: 1, accents: accents.map(() => false) };
  const used = new Set<string>();
  const names: Array<string | null> = [];
  const hit: boolean[] = [];
  // Erst alle passenden Akzente vergeben (lokale Stimmen zuerst), dann die übrigen Sprecher auffüllen.
  const byLocal = [...english].sort((a, b) => Number(b.local) - Number(a.local));
  accents.forEach((a, i) => {
    const v = byLocal.find((x) => !used.has(x.name) && x.lang.toLowerCase() === LANG[a]);
    names[i] = v ? v.name : null;
    hit[i] = !!v;
    if (v) used.add(v.name);
  });
  accents.forEach((_, i) => {
    if (names[i]) return;
    const v = byLocal.find((x) => !used.has(x.name));
    if (v) {
      names[i] = v.name;
      used.add(v.name);
    } else {
      // Mehr Sprecher als Stimmen: reihum wiederverwenden.
      names[i] = byLocal[i % byLocal.length]?.name ?? null;
    }
  });
  const distinct = new Set(names.filter((n): n is string => !!n)).size || 1;
  return { names, distinct, accents: hit };
}
