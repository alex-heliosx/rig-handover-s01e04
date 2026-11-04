// The night's run log, read into one row per job. The contract for the digest page, JSON and board.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One parsed line of runs/<night>.jsonl.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

export type DigestRow = {
  job: string;
  owner: string | null; // null stays null here; the view shows it as —
  runs: number; // lines for this job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus;
  lastError: string | null; // error of the last line that carried one
  firstAt: string; // as logged, offset kept
  lastAt: string;
};

export type NightDigest = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that didn't parse; counted, never thrown
};

// null when runs/<night>.jsonl does not exist; an empty file gives zero rows.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
