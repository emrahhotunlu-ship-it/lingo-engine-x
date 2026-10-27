// Build-Plugin (U2, Start-Bild): Im Einzeldatei-Build legt vite-plugin-singlefile das ganze App-Skript (≈ 6 MB Text) in den <head>.
// Der Browser kann dann erst etwas zeigen, wenn er diese 6 MB gelesen hat (gemessen: erstes Bild 0,4 s nach Seitenstart ungebremst,
// 1,5 s bei 4-facher CPU-Bremse). Dieses Plugin schiebt das eingebettete Modul-Skript ans Ende von <body>: Das Start-Bild aus
// index.html (`#lx-boot`, reines HTML + CSS) steht dann VOR dem großen Skript und wird sofort gezeichnet.
// Am Verhalten ändert das nichts: Modul-Skripte laufen ohnehin erst, wenn das Dokument gelesen ist („defer“).
// Mehr-Datei-Build: das Skript ist dort eine eigene Datei (`<script src>` im Kopf, lädt parallel) – unverändert gelassen.

const INLINE_MODULE = /<script type="module"(?: crossorigin)?>[\s\S]*?<\/script>\s*/;

/** Verschiebt das erste eingebettete Modul-Skript aus <head> direkt vor </body>. Rein, für den Test exportiert. */
export function moveInlineModuleToBody(html) {
  const headEnd = html.indexOf('</head>');
  const m = INLINE_MODULE.exec(html);
  if (!m || headEnd < 0 || m.index > headEnd) return html;
  const script = m[0].trimEnd();
  const without = html.slice(0, m.index) + html.slice(m.index + m[0].length);
  const bodyEnd = without.lastIndexOf('</body>');
  if (bodyEnd < 0) return html;
  return `${without.slice(0, bodyEnd)}  ${script}\n  ${without.slice(bodyEnd)}`;
}

export function bootFirst() {
  return {
    name: 'lx-boot-first',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset' || typeof html.source !== 'string') return;
      html.source = moveInlineModuleToBody(html.source);
    },
  };
}
