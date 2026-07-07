const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const GUEST_KEY = "wic_guest";

// The session JWT lives in a Secure, httpOnly cookie the browser sends
// automatically — JS (and therefore XSS) cannot read it. We only read two
// NON-sensitive cookies here: the CSRF token (to echo back as a header) and a
// session "hint" (to decide whether to bother calling /auth/me).
const CSRF_COOKIE = "wic_csrf";
const HINT_COOKIE = "wic_authed";
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
// the auth-only endpoints (tracking, watches) stay naturally locked while the
// public deals feed still works.

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

// Both register and login set the session cookie server-side and return the
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

// ── Donations ───────────────────────────────────────────────────────────────

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

// ── Products (tracked prices) ────────────────────────────────────────────────

export type ProductStats = {
  discount_vs_median_pct: number | null;
  rarity: number | null;
  stability: number | null;
  drop_freshness: number | null;
  n_points: number;
  coverage_days: number;
  min_90d: string | null;
  max_90d: string | null;
};

export type Product = {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  image_url: string | null;
  currency: string | null;
  status: string;
  latest_price: number | null;
  latest_price_at: string | null;
  median_90d: number | null;
  min_ever: number | null;
  is_lowest_ever: boolean;
  deal_score: number | null;
  stats: ProductStats | null;
  last_checked_at: string | null;
  created_at: string;
};

export type HistoryPoint = {
  t: string;
  price: number;
  in_stock: boolean;
};

export type HistoryOut = {
  currency: string;
  points: HistoryPoint[];
  median_90d: number | null;
  min_ever: number | null;
};

export type VerdictState = "ready" | "pending" | "unavailable";
export type Verdict = "buy" | "wait" | "watch";

export type VerdictOut = {
  state: VerdictState;
  verdict: Verdict | null;
  rationale: string | null;
  confidence: "low" | "medium" | "high" | null;
  computed_at: string | null;
};

export type TrackJobAccepted = {
  job_id: string;
  status: string;
};

export type TrackJobState =
  | "PENDING"
  | "STARTED"
  | "PROGRESS"
  | "RETRY"
  | "SUCCESS"
  | "FAILURE";

export type TrackJobStatus = {
  job_id: string;
  state: TrackJobState;
  progress: { stage?: string; [k: string]: unknown } | null;
  result: { product_id: string; created: boolean } | null;
  error: string | null;
};

export async function trackUrl(url: string): Promise<TrackJobAccepted> {
  const res = await apiFetch(
    "/products/track",
    { method: "POST", body: JSON.stringify({ url }) },
    { auth: true }
  );
  await ensureOk(res);
  return res.json();
}

export async function getTrackJob(jobId: string): Promise<TrackJobStatus> {
  const res = await apiFetch(`/products/track/${jobId}`, {}, { auth: true });
  await ensureOk(res);
  return res.json();
}

export async function fetchProducts(params: {
  sort?: "deal_score" | "newest";
  minScore?: number;
  q?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Product[]> {
  const qs = new URLSearchParams();
  if (params.sort) qs.set("sort", params.sort);
  if (params.minScore != null) qs.set("min_score", String(params.minScore));
  if (params.q) qs.set("q", params.q);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  const res = await apiFetch(`/products?${qs}`);
  await ensureOk(res);
  return res.json();
}

// 404 → null so the page can show a clean "not found" instead of throwing.
export async function fetchProduct(id: string): Promise<Product | null> {
  const res = await apiFetch(`/products/${id}`);
  if (res.status === 404) return null;
  await ensureOk(res);
  return res.json();
}

export async function fetchHistory(
  id: string,
  window: "90" | "180" | "all" = "90"
): Promise<HistoryOut> {
  const res = await apiFetch(`/products/${id}/history?window=${window}`);
  await ensureOk(res);
  return res.json();
}

export async function fetchVerdict(id: string): Promise<VerdictOut> {
  const res = await apiFetch(`/products/${id}/verdict`, {}, { auth: true });
  await ensureOk(res);
  return res.json();
}

// ── Watches ──────────────────────────────────────────────────────────────────

export type RuleType = "any_drop" | "percent_drop" | "target_price";

export type Watch = {
  id: string;
  product_id: string;
  rule_type: RuleType;
  threshold: number | null;
  is_active: boolean;
  last_notified_at: string | null;
  created_at: string;
};

export type WatchWithProduct = Watch & { product: Product };

export async function fetchWatches(): Promise<WatchWithProduct[]> {
  const res = await apiFetch("/watches", {}, { auth: true });
  await ensureOk(res);
  return res.json();
}

export async function createWatch(body: {
  product_id: string;
  rule_type?: RuleType;
  threshold?: number | null;
}): Promise<Watch> {
  const res = await apiFetch(
    "/watches",
    { method: "POST", body: JSON.stringify(body) },
    { auth: true }
  );
  await ensureOk(res);
  return res.json();
}

export async function updateWatch(
  id: string,
  body: { rule_type?: RuleType; threshold?: number | null; is_active?: boolean }
): Promise<Watch> {
  const res = await apiFetch(
    `/watches/${id}`,
    { method: "PATCH", body: JSON.stringify(body) },
    { auth: true }
  );
  await ensureOk(res);
  return res.json();
}

export async function deleteWatch(id: string): Promise<void> {
  const res = await apiFetch(`/watches/${id}`, { method: "DELETE" }, { auth: true });
  await ensureOk(res);
}

// ── Alerts ───────────────────────────────────────────────────────────────────

export type AlertEvent = {
  id: string;
  product_id: string;
  rule_type: RuleType;
  previous_price: number | null;
  new_price: number;
  status: "pending" | "sent" | "failed";
  created_at: string;
};

export async function fetchAlerts(): Promise<AlertEvent[]> {
  const res = await apiFetch("/alerts", {}, { auth: true });
  await ensureOk(res);
  return res.json();
}
