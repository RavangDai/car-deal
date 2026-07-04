// Central key factory — every useQuery/useMutation reads keys from here so we
// never typo a string key and invalidations stay precise.

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: ["auth", "me"] as const,
  },
  products: {
    all: ["products"] as const,
    list: (params: { sort?: string; minScore?: number; q?: string } = {}) =>
      ["products", "list", params] as const,
    detail: (id: string) => ["products", "detail", id] as const,
    history: (id: string, window: string) => ["products", "history", id, window] as const,
    verdict: (id: string) => ["products", "verdict", id] as const,
  },
  track: {
    job: (jobId: string) => ["track", "job", jobId] as const,
  },
  watches: {
    all: ["watches"] as const,
  },
  alerts: {
    all: ["alerts"] as const,
  },
} as const;
