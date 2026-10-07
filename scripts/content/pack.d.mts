export function packBundle(
  spec: { dirs: string[]; kind?: string },
  io?: { read?: (path: string) => string; files?: string[] },
): { json: string; b64: string; count: number; rawBytes: number; packedBytes: number; files: string[] };
