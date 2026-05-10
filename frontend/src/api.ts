const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type ScrapeJobAccepted = {
  job_id: string;
  status: string;
  city: string;
  query: string;
  max_results: number;
};

export type ScrapeJobState =
  | "PENDING"
  | "STARTED"
  | "PROGRESS"
  | "RETRY"
  | "SUCCESS"
  | "FAILURE";

export type ScrapeJobStatus = {
  job_id: string;
  state: ScrapeJobState;
  progress: { stage?: string; [k: string]: unknown } | null;
  result: {
    city: string;
    query: string;
    fetched: number;
    inserted: number;
    skipped: number;
  } | null;
  error: string | null;
};

export async function runCraigslistScrape(
  city: string,
  query: string,
  maxResults: number
): Promise<ScrapeJobAccepted> {
  const params = new URLSearchParams({
    city,
    query,
    max_results: String(maxResults),
  });

  const res = await fetch(`${API_BASE}/scrape/craigslist?${params}`, {
    method: "POST",
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getScrapeJob(jobId: string): Promise<ScrapeJobStatus> {
  const res = await fetch(`${API_BASE}/scrape/jobs/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type WaitOptions = {
  pollIntervalMs?: number;
  timeoutMs?: number;
  onUpdate?: (status: ScrapeJobStatus) => void;
  signal?: AbortSignal;
};

export async function waitForScrapeJob(
  jobId: string,
  options: WaitOptions = {}
): Promise<ScrapeJobStatus> {
  const {
    pollIntervalMs = 1500,
    timeoutMs = 60_000,
    onUpdate,
    signal,
  } = options;

  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const status = await getScrapeJob(jobId);
    onUpdate?.(status);

    if (status.state === "SUCCESS" || status.state === "FAILURE") {
      return status;
    }

    if (Date.now() > deadline) {
      throw new Error(`Scrape job ${jobId} timed out after ${timeoutMs}ms`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}

export async function fetchDeals(minUndervaluePercent: number) {
  const params = new URLSearchParams({
    min_undervalue_percent: String(minUndervaluePercent),
  });

  const res = await fetch(`${API_BASE}/deals?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
