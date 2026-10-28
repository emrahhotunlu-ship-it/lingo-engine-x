export const V86_COMMIT: string;
export const V86_MARK: string;
export const V86_DIR: string;
export const V86_PATHS: string[];
export function checkoutV86(opts?: { dir?: string; commit?: string }): { dir: string; commit: string; subject: string; fresh: boolean };
