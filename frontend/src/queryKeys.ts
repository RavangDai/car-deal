// Central key factory — every useQuery/useMutation reads keys from here so we
// never typo a string key and invalidations stay precise.

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: ["auth", "me"] as const,
  },
  deals: {
    all: ["deals"] as const,
    list: (minUndervaluePercent: number) =>
      ["deals", "list", { minUndervaluePercent }] as const,
  },
  scrape: {
    all: ["scrape"] as const,
    job: (jobId: string) => ["scrape", "job", jobId] as const,
  },
} as const;
