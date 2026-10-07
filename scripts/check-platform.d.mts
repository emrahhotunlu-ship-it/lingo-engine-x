export const MAX_BYTES: number;
export const WARN_BYTES: number;
export const FAIL_BYTES: number;
export const devMarkers: string[];
export const removedTemplates: string[];
export function checkHtml(html: string, size: number): { problems: string[]; notes: string[] };
