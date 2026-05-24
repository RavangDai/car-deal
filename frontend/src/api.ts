const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "revveal_access_token";
const GUEST_KEY = "revveal_guest";

// ── Token storage ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// ── Guest mode ──────────────────────────────────────────────────────────────
// A frontend-only "browse without an account" flag. Guests hold no token, so the
// auth-only /scrape endpoints stay naturally locked while public /deals works.

export function isGuest(): boolean {
  return localStorage.getItem(GUEST_KEY) === "1";
}

export function setGuestMode(on: boolean) {
  if (on) localStorage.setItem(GUEST_KEY, "1");
  else localStorage.removeItem(GUEST_KEY);
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
  { auth = false }: { auth?: boolean } = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getToken();
    if (!token) throw new UnauthorizedError("No token");
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (auth && res.status === 401) {
    setToken(null);
    throw new UnauthorizedError(await safeText(res));
  }

  return res;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return res.statusText;
  }
}

async function ensureOk(res: Response): Promise<Response> {
  if (!res.ok) {
    const body = await safeText(res);
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.detail ?? body;
    } catch {
      /* keep raw body */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type UserOut = {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

export type TokenOut = {
  access_token: string;
  token_type: string;
};

export async function register(email: string, password: string): Promise<UserOut> {
  const res = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await ensureOk(res);
  return res.json();
}

export async function login(email: string, password: string): Promise<TokenOut> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await ensureOk(res);
  const token: TokenOut = await res.json();
  setToken(token.access_token);
  return token;
}

export async function getMe(): Promise<UserOut> {
  const res = await apiFetch("/auth/me", {}, { auth: true });
  await ensureOk(res);
  return res.json();
}

export function logout() {
  setToken(null);
  setGuestMode(false);
}

// ── Scrape / deals ────────────────────────────────────────────────────────────

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
  const res = await apiFetch(
    `/scrape/craigslist?${params}`,
    { method: "POST" },
    { auth: true }
  );
  await ensureOk(res);
  return res.json();
}

export async function getScrapeJob(jobId: string): Promise<ScrapeJobStatus> {
  const res = await apiFetch(`/scrape/jobs/${jobId}`, {}, { auth: true });
  await ensureOk(res);
  return res.json();
}

export async function fetchDeals(minUndervaluePercent: number) {
  const params = new URLSearchParams({
    min_undervalue_percent: String(minUndervaluePercent),
  });
  const res = await apiFetch(`/deals?${params}`);
  await ensureOk(res);
  return res.json();
}
