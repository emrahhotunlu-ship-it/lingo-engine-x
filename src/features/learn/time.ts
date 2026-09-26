// Monotone Zeit für Antwortzeiten (nur in Handlern und Effekten aufrufen, nie beim Rendern).
export const perfNow = (): number => performance.now();
