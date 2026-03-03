import type { Match, MatchDetails, Player, PlayerTeam } from "./types";

/**
 * Shared interface for APAClient and CachedAPAClient.
 * This allows handlers to accept either implementation.
 */
export interface IAPAClient {
  searchForPlayer(playerName: string): Promise<Player | null>;
  getTeamsForPlayer(memberId: string): Promise<PlayerTeam[]>;
  getMatchesForTeam(teamId: string): Promise<Match[]>;
  getMatchDetails(scheduleId: string): Promise<MatchDetails>;
}
