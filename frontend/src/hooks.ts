import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  fetchDeals,
  getMe,
  getScrapeJob,
  hasSessionHint,
  login,
  logout,
  register,
  runCraigslistScrape,
  type ScrapeJobAccepted,
  type ScrapeJobStatus,
  type UserOut,
} from "./api";
import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";

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

// Register now also logs the user in (the backend sets the session cookie on
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
      // Drop scrape/deal caches — they belonged to the previous user.
      qc.removeQueries({ queryKey: queryKeys.deals.all });
      qc.removeQueries({ queryKey: queryKeys.scrape.all });
    },
  });
}

// ── Deals ─────────────────────────────────────────────────────────────────

export function useDeals(minUndervaluePercent: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.deals.list(minUndervaluePercent),
    queryFn: () => fetchDeals(minUndervaluePercent),
    enabled,
    staleTime: 30_000,
  });
}

// ── Scrape ────────────────────────────────────────────────────────────────

export function useScrapeMutation() {
  return useMutation<
    ScrapeJobAccepted,
    Error,
    { city: string; query: string; maxResults: number }
  >({
    mutationFn: ({ city, query, maxResults }) =>
      runCraigslistScrape(city, query, maxResults),
  });
}

const TERMINAL_STATES = new Set(["SUCCESS", "FAILURE"]);

export function useScrapeJob(jobId: string | null) {
  const qc = useQueryClient();

  const result = useQuery<ScrapeJobStatus>({
    queryKey: queryKeys.scrape.job(jobId ?? ""),
    queryFn: () => getScrapeJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && TERMINAL_STATES.has(data.state)) return false;
      return 1500;
    },
    staleTime: 0,
    gcTime: 5 * 60_000,
  });

  // When a job finishes successfully, invalidate every deals list so the UI
  // re-fetches with the new rows the worker just inserted. Done here rather
  // than at the call site so any future consumer of useScrapeJob gets it for
  // free.
  useEffect(() => {
    if (result.data?.state === "SUCCESS") {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all });
    }
  }, [result.data?.state, qc]);

  return result;
}

// Re-export the singleton so non-component code (e.g. the LoginPage submit
// handler that wants to imperatively read a query) has a clean import path.
export { queryClient };
