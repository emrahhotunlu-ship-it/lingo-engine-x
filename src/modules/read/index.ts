// Lesen-Modul, Tür 1 (docs/umbau/lesen-plan.md §5.1). Bis zum Paket L3 gibt es hier weder Reiter noch Oberfläche;
// `readArea` (defineArea) kommt mit L3 und wird dann nur von src/areas/index.ts importiert.

export const READ_MODULE = { id: 'read', version: 1 } as const;
