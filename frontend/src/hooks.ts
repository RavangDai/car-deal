import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createWatch,
  deleteWatch,
  fetchAlerts,
  fetchConfig,
  fetchHistory,
  fetchProduct,
  fetchPreferences,
  fetchProducts,
  fetchVerdict,
  fetchWatches,
  getMe,
  getTrackJob,
  hasSessionHint,
  login,
  logout,
  register,
  saveOnboarding,
  trackUrl,
  updateWatch,
  type RuleType,
  type ClientConfig,
  type TrackJobAccepted,
  type TrackJobStatus,
  type OnboardingPrefs,
  type PreferencesOut,
  type UserOut,
  type VerdictOut,
  type Watch,
} from "./api";
import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";

// ── Deployment capabilities ───────────────────────────────────────────────

// Process-static on the server, so this is fetched once and never refetched.
// Failure is treated as "nothing optional is configured" rather than an error
// state: the app is fully usable without donations, AI, or social login.
export function useConfig() {
  return useQuery<ClientConfig>({
    queryKey: queryKeys.config.all,
    queryFn: fetchConfig,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────

export function useMe() {
  return useQuery<UserOut>({
    queryKey: queryKeys.auth.me,
    queryFn: getMe,
    enabled: hasSessionHint(),
    staleTime: 5 * 60_000,
  });
}

export function useLoginMutation() {
  const qc = useQueryClient();
  return useMutation<UserOut, Error, { email: string; password: string }>({
    mutationFn: ({ email, password }) => login(email, password),
    onSuccess: (user) => {
      // Seed the cache so the app flips to the dashboard without a round-trip.
      qc.setQueryData(queryKeys.auth.me, user);
      qc.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}

// Register also logs the user in (the backend sets the session cookie on
// register), so the LoginPage register form drops straight into the dashboard.
export function useRegisterAndLoginMutation() {
  const qc = useQueryClient();
  return useMutation<UserOut, Error, { email: string; password: string }>({
    mutationFn: ({ email, password }) => register(email, password),
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.auth.me, user);
      qc.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}

export function useLogoutMutation() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await logout();
    },
    onSuccess: () => {
      qc.setQueryData(queryKeys.auth.me, null);
      // Drop everything scoped to the previous user.
      qc.removeQueries({ queryKey: queryKeys.watches.all });
      qc.removeQueries({ queryKey: queryKeys.alerts.all });
      qc.removeQueries({ queryKey: queryKeys.track.job("") });
    },
  });
}

// ── Track a URL ─────────────────────────────────────────────────────────

export function useTrackUrl() {
  return useMutation<TrackJobAccepted, Error, string>({
    mutationFn: (url) => trackUrl(url),
  });
}

const TERMINAL_STATES = new Set(["SUCCESS", "FAILURE"]);

export function useTrackJob(jobId: string | null) {
  const qc = useQueryClient();

  const result = useQuery<TrackJobStatus>({
    queryKey: queryKeys.track.job(jobId ?? ""),
    queryFn: () => getTrackJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && TERMINAL_STATES.has(data.state)) return false;
      return 1500;
    },
    staleTime: 0,
    gcTime: 5 * 60_000,
  });

  // When tracking finishes, invalidate the products feed and watchlist so
  // the newly-tracked product appears without a manual refresh.
  useEffect(() => {
    if (result.data?.state === "SUCCESS") {
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      qc.invalidateQueries({ queryKey: queryKeys.watches.all });
    }
  }, [result.data?.state, qc]);

  return result;
}

// ── Products ────────────────────────────────────────────────────────────

export function useProducts(
  params: {
    sort?: "deal_score" | "newest";
    minScore?: number;
    q?: string;
    category?: string;
    personalized?: boolean;
    limit?: number;
  } = {},
  // Callers that only want the feed under some condition (e.g. suggestions
  // once a user has onboarded) pass false rather than a limit of 0 — the API
  // clamps limit to a minimum of 1, so a "disabled" query would still fetch.
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: () => fetchProducts(params),
    enabled,
    staleTime: 30_000,
  });
}

// ── Onboarding preferences ────────────────────────────────────────────────

export function usePreferences(enabled: boolean) {
  return useQuery<PreferencesOut>({
    queryKey: queryKeys.preferences.all,
    queryFn: fetchPreferences,
    // Guests and logged-out visitors have no row to read; calling this while
    // unauthenticated would just 401 on every mount.
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useSaveOnboarding() {
  const qc = useQueryClient();
  return useMutation<PreferencesOut, Error, OnboardingPrefs>({
    mutationFn: saveOnboarding,
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.preferences.all, data);
      // The feed's ordering depends on these answers, so every cached
      // product list is now stale.
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: queryKeys.products.detail(id ?? ""),
    queryFn: () => fetchProduct(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function usePriceHistory(id: string | null, window: "90" | "180" | "all" = "90") {
  return useQuery({
    queryKey: queryKeys.products.history(id ?? "", window),
    queryFn: () => fetchHistory(id!, window),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useVerdict(id: string | null, enabled = true) {
  return useQuery<VerdictOut>({
    queryKey: queryKeys.products.verdict(id ?? ""),
    queryFn: () => fetchVerdict(id!),
    enabled: !!id && enabled,
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.data?.state === "pending" ? 2000 : false),
  });
}

// ── Watches ─────────────────────────────────────────────────────────────

export function useWatches(enabled = true) {
  return useQuery({
    queryKey: queryKeys.watches.all,
    queryFn: fetchWatches,
    enabled,
    staleTime: 15_000,
  });
}

export function useCreateWatch() {
  const qc = useQueryClient();
  return useMutation<
    Watch,
    Error,
    { product_id: string; rule_type?: RuleType; threshold?: number | null }
  >({
    mutationFn: createWatch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.watches.all });
    },
  });
}

export function useUpdateWatch() {
  const qc = useQueryClient();
  return useMutation<
    Watch,
    Error,
    { id: string; rule_type?: RuleType; threshold?: number | null; is_active?: boolean }
  >({
    mutationFn: ({ id, ...body }) => updateWatch(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.watches.all });
    },
  });
}

export function useDeleteWatch() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteWatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.watches.all });
    },
  });
}

// ── Alerts ──────────────────────────────────────────────────────────────

export function useAlerts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.alerts.all,
    queryFn: fetchAlerts,
    enabled,
    staleTime: 15_000,
  });
}

// Re-export the singleton so non-component code (e.g. the LoginPage submit
// handler that wants to imperatively read a query) has a clean import path.
export { queryClient };
