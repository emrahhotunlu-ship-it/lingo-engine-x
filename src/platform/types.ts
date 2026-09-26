// Die Laufzeit-Typen stehen global in contract/*.d.ts (Version 0.2.49, maßgeblich).
// Hier bekommen sie App-Namen, damit der Rest des Codes nicht an globalen Namen hängt.

export type Db = DB;
export type DocRef = DocumentReference;
export type DocSnap = DocumentSnapshot;
export type QuerySnap = QuerySnapshot;
export type DbErr = DbError;
export type DbErrCode = DbErrorCode;
export type Unsub = Unsubscribe;

export type SampleFn = ClaudeCapabilityMap['sample'];
export type SampleOptions = Claude.sample.SampleOptions;
export type SampleResult = Claude.sample.SampleResult;
export type SampleError = Claude.sample.SampleError;
export type SampleErrorCode = Claude.sample.SampleErrorCode;

export type Downloads = ClaudeCapabilityMap['downloads'];
export type DownloadsErrorCode = Claude.downloads.DownloadsErrorCode;
export type Permissions = ClaudeCapabilityMap['permissions'];

export type CapabilityName = Extract<keyof ClaudeCapabilityMap, string>;
export type ClaudeHost = Claude;
