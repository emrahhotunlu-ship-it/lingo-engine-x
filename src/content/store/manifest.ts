// Manifest der gepackten Bündel: Zahl der Einträge, Rohbytes, gepackte Bytes (zur Anzeige, für Tests und budget.md).
import manifest from 'virtual:content/manifest';

export type BundleInfo = { count: number; rawBytes: number; packedBytes: number };

export const contentManifest: Readonly<Record<string, BundleInfo>> = manifest;
