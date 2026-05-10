import {
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";

import { UnauthorizedError } from "./api";
import { queryKeys } from "./queryKeys";

// Single QueryClient instance shared across the app. The caches' onError
// handlers centralize 401 handling — when a query or mutation throws
// UnauthorizedError (after apiFetch already cleared the token), we null out
// `auth.me` so App.tsx re-renders into the unauthed branch.
//
// Built with `let` so the cache callbacks can reference `queryClient` after
// it's assigned; React Query lifecycles run after construction so this is
// safe.
let queryClient: QueryClient;

function on401<T>(err: T) {
  if (err instanceof UnauthorizedError) {
    queryClient.setQueryData(queryKeys.auth.me, null);
  }
}

queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: on401,
  }),
  mutationCache: new MutationCache({
    onError: on401,
  }),
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});

export { queryClient };
