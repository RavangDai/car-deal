const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const GUEST_KEY = "revveal_guest";

// The session JWT now lives in a Secure, httpOnly cookie the browser sends
// automatically — JS (and therefore XSS) cannot read it. We only read two
// NON-sensitive cookies here: the CSRF token (to echo back as a header) and a
// session "hint" (to decide whether to bother calling /auth/me).
const CSRF_COOKIE = "revveal_csrf";
const HINT_COOKIE = "revveal_authed";
const CSRF_HEADER = "X-CSRF-Token";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// True when a session probably exists (set by the backend alongside the
// httpOnly JWT). Replaces the old localStorage token check.
export function hasSessionHint(): boolean {
  return readCookie(HINT_COOKIE) === "1";
}

// ── Guest mode ──────────────────────────────────────────────────────────────
// A frontend-only "browse without an account" flag. Guests hold no session, so
// the auth-only /scrape endpoints stay naturally locked while public /deals works.

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

  // Double-submit CSRF: echo the readable CSRF cookie back as a header on
  // state-changing requests. A cross-site attacker can't read the cookie, so
  // can't forge the header.
  const method = (init.method ?? "GET").toUpperCase();
  if (UNSAFE_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers.set(CSRF_HEADER, csrf);
  }

  // credentials:"include" sends the httpOnly session cookie cross-origin.
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (auth && res.status === 401) {
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
  full_name?: string | null;
  avatar_url?: string | null;
};

// Both register and login now set the session cookie server-side and return the
// authenticated user; there is no token to store on the client.

export async function register(email: string, password: string): Promise<UserOut> {
  const res = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await ensureOk(res);
  return res.json();
}

export async function login(email: string, password: string): Promise<UserOut> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await ensureOk(res);
  return res.json();
}

export async function getMe(): Promise<UserOut> {
  const res = await apiFetch("/auth/me", {}, { auth: true });
  await ensureOk(res);
  return res.json();
}

// Kick off a provider redirect. The backend handles the whole OAuth dance and
// redirects back to the SPA with the session cookie set.
export type OAuthProvider = "google" | "github";

export function oauthLogin(provider: OAuthProvider) {
  window.location.href = `${API_BASE}/auth/oauth/${provider}/login`;
}

export async function logout() {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    /* best-effort; clear local state regardless */
  }
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

// ── Donations ───────────────────────────────────────────────────────────────

// Creates a Stripe Checkout Session and returns its hosted URL. Public — no auth.
// The caller redirects the browser to `url`. A 503 means donations aren't
// configured on the backend (no Stripe key set).
export async function createDonationCheckout(
  amountCents: number
): Promise<{ url: string }> {
  const res = await apiFetch("/donate", {
    method: "POST",
    body: JSON.stringify({ amount_cents: amountCents }),
  });
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
