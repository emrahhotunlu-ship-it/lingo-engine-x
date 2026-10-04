// Metrik-Schicht (Umbau „Fokus Wörter und Grammatik“, Gesamtkonzept Kap. 6): künftig die einzige Stelle,
// an der „fällig / überfällig / Fest / Serie“ berechnet werden. In W1 nur das Gerüst: die beiden
// bestehenden Ableitungen werden hier gebündelt wieder ausgeführt; W3 zieht alle Aufrufer hierher und
// sichert das mit einer ESLint-Regel und den Invarianten-Tests ab.
export { buildTrainCards } from '../srs/cards';
export { computeStreak } from '../streak';
