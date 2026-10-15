// „Verbform nach Hilfsverb“ (Auswertung 15.10.2026, Punkt 5): Der häufigste wiederkehrende Fehler steht im Radar unter fünf Themen
// (will worked, wouldn't missed, had sign, has been felt, have been worked, Having wrote, had choosen, catched), ist aber EINE Regel:
// Nach will/would/shall/might/can … steht die Grundform, nach have/has/had das Partizip, nach been/being -ing (oder Partizip im Passiv),
// nach having das Partizip. Rein, ohne KI. Zwei Betriebsarten:
//  - `strict`: nur eindeutige Fehler in einem Text (für die Selbstprüfung der korrigierten Fassung, wenig falsche Treffer),
//  - sonst mit der richtigen Lösung `right` als Gegenprobe (Radar: Ereignis `g` falsch, `a` richtig).

export type AuxClass = 'modal' | 'perfect' | 'been' | 'having' | 'form';
export type AuxError = { aux: string; verb: string; text: string; cls: AuxClass };

const MODALS = new Set(['will', 'would', 'shall', 'should', 'might', 'may', 'can', 'could', 'must']);
const PERFECT = new Set(['have', 'has', 'had']);
const SKIP_ADV = new Set(['not', 'never', 'always', 'also', 'still', 'just', 'already', 'really', 'definitely', 'probably', 'only', 'even', 'ever', 'simply', 'finally', 'actually', 'surely', 'certainly', 'soon', 'now', 'then', 'both', 'all', 'first', 'recently']);
// Fragewörter: Steht das Modalverb direkt danach oder am Satzanfang, ist es eine Frage mit vorangestelltem Hilfsverb („Can scanned invoices be archived?“, „What will onboarding cost?“).
const WH = new Set(['what', 'how', 'when', 'where', 'why', 'who', 'whom', 'which', 'whose']);
// Monat „May“ und Namen vor dem Modal: dort ist es kein Hilfsverb.
const MAY_BEFORE = new Set(['in', 'since', 'until', 'of', 'by', 'next', 'last', 'this', 'every', 'early', 'late', 'mid', 'end', 'to', 'from']);

/** Eindeutig falsche Formen (übergeneralisiert oder falsch geschrieben), unabhängig vom Hilfsverb. */
export const OVERREGULARIZED: ReadonlySet<string> = new Set(
  'catched choosen writen writed taked gived goed speaked knowed growed throwed drived buyed teached thinked bringed runned eated falled stealed breaked forgetted begined finded losed sended sleeped standed understanded meeted feeled keeped heared builded sitted comed becomed holded readed telled maked sayed leaved weared drawed drinked swimmed flyed hidded bited shaked payed splitted cutted setted spended choosed lended'.split(' '),
);

/** Einfache Vergangenheit, die vom Partizip abweicht: nach have/has/had/having falsch („had wrote“). */
const PAST_NE = new Set(
  'wrote took saw went gave began chose spoke forgot ate knew grew threw stole woke froze forgave did drove rode rose fell broke swam sang rang flew hid bit shook wore tore swore drew was were became came ran'.split(' '),
);
/** Grundformen, deren Partizip anders heißt: nach have/has/had/having falsch („had send“). Ohne Wörter, die auch Nomen sind (drink, ride, swim, ring, drive, draw, break, rise, fall). */
const BASE_NE = new Set('write send give take see go begin choose speak forget eat know grow throw steal wake freeze forgive undertake overtake do become come'.split(' '));
// Zusammensetzungen und feste Nomen, in denen die Grundform erlaubt ist („write access“, „go-to“, „know-how“, „have a go“).
// Gilt nach allen Formen von have (has write access, had write permissions, having write access).
const COMPOUND_NEXT = /^(?:access|permission|permissions|privileges?|rights|capabilit(?:y|ies)|mode|only|protection|operations?|back|ups?|how|to|live)$/;

/** Wörter auf -ed, die keine Vergangenheitsform sind (Grundformen, Nomen, Adjektive). */
const NOT_ED = new Set('need feed speed seed proceed succeed exceed bleed breed heed embed shed red bed wed sled hundred kindred naked wicked sacred beloved rugged ragged crooked'.split(' '));
// Nomen auf -ing: nach einem Modalverb kein Verb („We will have pricing ready“, „Will onboarding take long?“).
const NOT_ING = new Set('sing bring ring swing spring sting cling fling wring string king thing ping bing wing anything something everything nothing during morning evening pricing funding training onboarding billing licensing marketing meeting building ceiling'.split(' '));

type Tok = { raw: string; w: string; start: number; end: number; neg: boolean };

function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  for (const m of text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)) {
    const raw = m[0];
    let w = raw.toLowerCase().replace(/’/g, "'");
    let neg = false;
    if (w.endsWith("n't")) {
      neg = true;
      w = w.slice(0, -3);
      if (w === 'wo') w = 'will';
      else if (w === 'ca') w = 'can';
      else if (w === 'sha') w = 'shall';
    }
    out.push({ raw, w, start: m.index ?? 0, end: (m.index ?? 0) + raw.length, neg });
  }
  return out;
}

const isRegularPast = (w: string): boolean => /^[a-z]{3,}ed$/.test(w) && !NOT_ED.has(w) && !NOT_ED.has(w.slice(0, -1));
const isIng = (w: string): boolean => /^[a-z]{3,}ing$/.test(w) && !NOT_ING.has(w);

/** Nächstes Wort nach `i` ohne Füll-Adverbien; `-1` am Ende. */
function nextIdx(toks: readonly Tok[], i: number): number {
  let j = i + 1;
  while (j < toks.length && SKIP_ADV.has(toks[j]?.w ?? '')) j++;
  return j < toks.length ? j : -1;
}

/** Steht das Wort am Satzanfang (nach Satzende, Anführungszeichen oder Klammer)? */
const atSentenceStart = (text: string, t: Tok): boolean => /(^|[.!?:;]\s*|["“(]\s*)$/.test(text.slice(0, t.start));

/** Folgt auf den Tokenindex ein Bindestrich (Zusammensetzung wie „know-how“)? */
const hyphenAfter = (text: string, t: Tok): boolean => text.charAt(t.end) === '-';

/** Satzzeichen zwischen zwei Wörtern trennt (Hilfsverb und „Verb“ gehören dann nicht zusammen). */
const boundaryBetween = (text: string, a: Tok, b: Tok): boolean => /[.,;:!?()]/.test(text.slice(a.end, b.start));

/**
 * Fehler in der Verbform nach Hilfsverben. `strict`: nur eindeutige Fälle. Ohne `strict` wird zusätzlich geprüft, was die Lösung `right` an derselben Stelle hat
 * (Grundform eines regelmäßigen Verbs nach had, „been worked“ statt „been working“); ein Paar, das auch in `right` steht, ist nie ein Fehler.
 */
export function auxFormErrors(text: string, opts: { strict?: boolean; right?: string } = {}): AuxError[] {
  const strict = opts.strict === true;
  const toks = tokenize(text);
  const rightToks = opts.right ? tokenize(opts.right) : [];
  const rightPairs = new Set<string>();
  const rightWords = new Set(rightToks.map((t) => t.w));
  for (let i = 0; i < rightToks.length; i++) {
    const j = nextIdx(rightToks, i);
    if (j >= 0) rightPairs.add(`${rightToks[i]?.w}|${rightToks[j]?.w}`);
  }
  const out: AuxError[] = [];
  const push = (aux: Tok, verb: Tok, cls: AuxClass) => {
    if (rightPairs.has(`${aux.w}|${verb.w}`)) return;
    out.push({ aux: aux.w, verb: verb.w, text: text.slice(aux.start, verb.end), cls });
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i] as Tok;
    // Übergeneralisierte Formen sind überall falsch (catched, choosen).
    if (OVERREGULARIZED.has(t.w) && !hyphenAfter(text, t)) {
      const prev = i > 0 ? (toks[i - 1] as Tok) : undefined;
      out.push({ aux: prev && (PERFECT.has(prev.w) || prev.w === 'having') ? prev.w : '', verb: t.w, text: prev && (PERFECT.has(prev.w) || prev.w === 'having') ? text.slice(prev.start, t.end) : t.raw, cls: 'form' });
      continue;
    }
    const prevW = i > 0 ? (toks[i - 1] as Tok).w : '';
    const isModal = MODALS.has(t.w) && !(t.w === 'may' && MAY_BEFORE.has(prevW));
    const isPerfect = PERFECT.has(t.w);
    const isBeen = t.w === 'been' || t.w === 'being';
    const isHaving = t.w === 'having';
    if (!isModal && !isPerfect && !isBeen && !isHaving) continue;
    const j = nextIdx(toks, i);
    if (j < 0) continue;
    const v = toks[j] as Tok;
    if (boundaryBetween(text, t, v) || hyphenAfter(text, v)) continue;
    if (isModal) {
      // Frage mit vorangestelltem Modalverb („Can scanned invoices be archived?“, „Will pricing change?“, „What will onboarding cost?“): kein Hilfsverb + Verb.
      // Nur in der strengen Prüfung ganzer Texte; Radar-Antworten sind oft Satzteile („would missed“), dort sagt `right` die Gegenprobe.
      if (strict && (atSentenceStart(text, t) || WH.has(prevW))) continue;
      // Großes „Will“ mitten im Satz ist ein Name („Will was in the call“).
      if (strict && t.raw === 'Will') continue;
      // will worked / would finished / can used / will has / will opening / will have living
      if (v.w === 'has' || v.w === 'had' || v.w === 'was' || v.w === 'were' || isRegularPast(v.w) || PAST_NE.has(v.w) || isIng(v.w)) {
        // „can opening“ u. ä. mit Nomen davor („a can“, „the will“) ist keine Verbindung Hilfsverb + Verb.
        if ((t.w === 'can' || t.w === 'will' || t.w === 'might' || t.w === 'must') && ['a', 'the', 'this', 'that', 'his', 'her', 'their', 'our', 'my', 'your', 'free', 'strong', 'last'].includes(prevW)) continue;
        push(t, v, 'modal');
      } else if (v.w === 'have') {
        const k = nextIdx(toks, j);
        const w2 = k >= 0 ? (toks[k] as Tok) : null;
        // Streng: „Modalverb + have + -ing“ gar nicht prüfen („We should have training ready“, „It would have nothing to do with …“).
        if (w2 && !boundaryBetween(text, v, w2) && !strict && (isIng(w2.w) || (BASE_NE.has(w2.w) && w2.w !== 'be'))) push(t, w2, 'modal');
      }
    } else if (isPerfect || isHaving) {
      const cls: AuxClass = isHaving ? 'having' : 'perfect';
      if (OVERREGULARIZED.has(v.w)) continue; // oben schon gezählt
      if (PAST_NE.has(v.w) && !(v.w === 'was' || v.w === 'were')) push(t, v, cls);
      else if (BASE_NE.has(v.w) && !COMPOUND_NEXT.test(toks[nextIdx(toks, j)]?.w ?? '') && !(v.w === 'become' || v.w === 'come' || v.w === 'do' || v.w === 'go')) push(t, v, cls);
      else if (!strict && (rightWords.has(`${v.w}ed`) || rightWords.has(`${v.w}d`)) && !isRegularPast(v.w)) push(t, v, cls);
      // had been/has been … wird beim Tokenindex von „been“ geprüft.
    } else if (isBeen && !strict) {
      // have been worked statt working: die Lösung hat dort die -ing-Form
      if (!isIng(v.w) && !NOT_ED.has(v.w)) {
        const hasIng = [...rightWords].some((w) => isIng(w) && w.slice(0, 2) === v.w.slice(0, 2));
        if (hasIng && (isRegularPast(v.w) || PAST_NE.has(v.w) || BASE_NE.has(v.w) || /^(?:felt|sent|made|done|written|taken|given|seen|gone|known|grown|thrown|chosen|spoken|forgotten|eaten)$/.test(v.w))) push(t, v, 'been');
      }
    }
  }
  return out;
}

/** Ist das ein Fehler „Verbform nach Hilfsverb“? Für das Radar: `g` = falsch gegebene Antwort (oder Satz), `a` = richtige Lösung. */
export function auxFormEvent(g: string, a: string): AuxError | null {
  if (!g.trim()) return null;
  return auxFormErrors(g, { right: a })[0] ?? null;
}
