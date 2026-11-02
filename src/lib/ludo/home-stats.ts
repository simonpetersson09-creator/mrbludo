import type { Stats } from "./storage";

export interface OnlineRanks {
  played: number; wins: number; captures: number;
  country: string | null; worldRank: number | null; countryRank: number | null;
}

/**
 * Yatzy principle: forfeited matches never count as played. Local bot matches
 * and server-verified online matches are summed; placements come only from the server.
 */
export function combineHomeStats(local: Stats, online: OnlineRanks | null) {
  return {
    played: Math.max(0, local.played - local.forfeits) + (online?.played ?? 0),
    wins: local.wins + (online?.wins ?? 0),
    captures: local.captures + (online?.captures ?? 0),
    country: online?.country ?? null,
    worldRank: online?.worldRank ?? null,
    countryRank: online?.countryRank ?? null,
  };
}
