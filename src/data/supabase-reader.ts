import type { SupabaseClient } from "@supabase/supabase-js";
import type { IAPAClient } from "../apa/apa-client.interface";
import type { Player } from "../apa/types";

/**
 * Reads scraped APA data from Supabase instead of hitting the APA API live.
 * Falls back to a live IAPAClient for players not yet scraped.
 */
export class SupabaseDataReader implements IAPAClient {
  constructor(
    private supabase: SupabaseClient,
    private fallback: IAPAClient,
  ) {}

  async searchForPlayer(playerName: string): Promise<Player | null> {
    // Search is always live — we can't replicate APA's search index
    const player = await this.fallback.searchForPlayer(playerName);

    // Auto-track the player if found
    if (player) {
      const memberId =
        player.aliases?.[0]?.id?.toString() || player.id?.toString();
      if (memberId) {
        await this.upsertTrackedPlayer(memberId, player);
      }
    }

    return player;
  }

  async getTeamsForPlayer(memberId: string) {
    const { data: trackedPlayer } = await this.supabase
      .from("tracked_players")
      .select("id, last_scraped_at")
      .eq("member_id", memberId)
      .single();

    if (!trackedPlayer?.last_scraped_at) {
      // Not scraped yet — fall back to live, register for tracking
      await this.upsertTrackedPlayer(memberId);
      return this.fallback.getTeamsForPlayer(memberId);
    }

    const { data: teamSeasons } = await this.supabase
      .from("player_team_seasons")
      .select("*")
      .eq("tracked_player_id", trackedPlayer.id);

    if (!teamSeasons || teamSeasons.length === 0) {
      return this.fallback.getTeamsForPlayer(memberId);
    }

    return teamSeasons.map((ts: any) => this.dbRowToPlayerTeam(ts));
  }

  async getMatchesForTeam(teamId: string) {
    // Find the team season by APA team ID
    const { data: teamSeason } = await this.supabase
      .from("player_team_seasons")
      .select("id")
      .eq("apa_team_id", teamId)
      .limit(1)
      .single();

    if (!teamSeason) {
      return this.fallback.getMatchesForTeam(teamId);
    }

    const { data: matches } = await this.supabase
      .from("team_matches")
      .select("*")
      .eq("team_season_id", teamSeason.id);

    if (!matches || matches.length === 0) {
      return this.fallback.getMatchesForTeam(teamId);
    }

    return matches.map((m: any) => this.dbRowToMatch(m));
  }

  async getMatchDetails(scheduleId: string) {
    const { data: match } = await this.supabase
      .from("team_matches")
      .select("*, player_matches(*)")
      .eq("apa_match_id", scheduleId)
      .single();

    if (!match) {
      return this.fallback.getMatchDetails(scheduleId);
    }

    return this.dbRowToMatchDetails(match);
  }

  private async upsertTrackedPlayer(
    memberId: string,
    player?: any,
  ): Promise<void> {
    const row: any = { member_id: memberId };
    if (player) {
      row.first_name = player.firstName;
      row.last_name = player.lastName;
      row.city = player.city;
      row.state = player.stateProvince?.name;
      row.apa_id = player.id?.toString();
    }

    await this.supabase
      .from("tracked_players")
      .upsert(row, { onConflict: "member_id" });
  }

  /**
   * Reconstruct a PlayerTeam (EightBallPlayer/NineBallPlayer shape)
   * from a player_team_seasons DB row.
   */
  private dbRowToPlayerTeam(row: any): any {
    const typename =
      row.game_type === "NINE_BALL" ? "NineBallPlayer" : "EightBallPlayer";
    return {
      id: row.apa_player_id,
      isActive: true,
      role: "",
      rosterPosition: "",
      nickName: "",
      matchesPlayed: 0,
      matchesWon: 0,
      session: {
        id: "",
        name: `${row.season} ${row.season_year}`,
        __typename: "Session",
      },
      skillLevel: row.skill_level || 0,
      rank: 0,
      team: {
        id: parseInt(row.apa_team_id) || 0,
        name: row.team_name,
        division: { id: 0, isTournament: false, __typename: "Division" },
        __typename: "Team",
      },
      __typename: typename,
    };
  }

  /**
   * Reconstruct an APA Match from a team_matches DB row.
   */
  private dbRowToMatch(row: any): any {
    return {
      id: row.apa_match_id,
      week: 0,
      type: "EIGHT",
      startTime: row.match_date || "",
      isBye: false,
      status: "SCORED",
      scoresheet: "",
      isMine: false,
      isPaid: false,
      isScored: true,
      isFinalized: true,
      isPlayoff: false,
      description: "",
      location: {
        id: "",
        name: row.location || "",
        league: { id: 0, slug: "", name: "", __typename: "League" },
        __typename: "HostLocation",
      },
      home: {
        id: parseInt(row.home_team_id) || 0,
        name: row.home_team_name || "",
        division: { id: 0, isTournament: false, __typename: "Division" },
        __typename: "Team",
      },
      away: {
        id: parseInt(row.away_team_id) || 0,
        name: row.away_team_name || "",
        division: { id: 0, isTournament: false, __typename: "Division" },
        __typename: "Team",
      },
      __typename: "Match",
    };
  }

  /**
   * Reconstruct a MatchDetails from a team_matches row + player_matches rows.
   * The shape must match what apaMatchToMatch() and apaMatchToPlayerMatches() expect.
   */
  private dbRowToMatchDetails(row: any): any {
    const playerMatches: any[] = row.player_matches || [];

    // Sort by match_order
    playerMatches.sort((a: any, b: any) => a.match_order - b.match_order);

    // Build HOME and AWAY score arrays
    const homeScores = playerMatches.map((pm: any) => ({
      id: `${row.apa_match_id}-${pm.match_order}`,
      player: {
        id: pm.home_player_id,
        displayName: pm.home_player_name,
        __typename: "Player",
      },
      matchPositionNumber: pm.match_order,
      playerPosition: "",
      skillLevel: pm.home_skill_level || 0,
      innings: pm.home_innings || 0,
      defensiveShots: pm.home_defensive_shots || 0,
      eightBallWins: pm.home_games_won || 0,
      eightOnBreak: 0,
      eightBallBreakAndRun: 0,
      nineBallPoints: pm.home_games_won || 0,
      nineOnSnap: 0,
      nineBallBreakAndRun: 0,
      nineBallMatchPointsEarned: pm.home_score || 0,
      mastersEightBallWins: 0,
      mastersNineBallWins: 0,
      winLoss: (pm.home_score || 0) > (pm.away_score || 0) ? "W" : "L",
      matchForfeited: false,
      doublesMatch: false,
      dateTimeStamp: row.match_date || "",
      teamSlot: "",
      eightBallMatchPointsEarned: pm.home_score || 0,
      incompleteMatch: false,
      __typename: "PlayerScore",
    }));

    const awayScores = playerMatches.map((pm: any) => ({
      id: `${row.apa_match_id}-${pm.match_order}-away`,
      player: {
        id: pm.away_player_id,
        displayName: pm.away_player_name,
        __typename: "Player",
      },
      matchPositionNumber: pm.match_order,
      playerPosition: "",
      skillLevel: pm.away_skill_level || 0,
      innings: pm.away_innings || 0,
      defensiveShots: pm.away_defensive_shots || 0,
      eightBallWins: pm.away_games_won || 0,
      eightOnBreak: 0,
      eightBallBreakAndRun: 0,
      nineBallPoints: pm.away_games_won || 0,
      nineOnSnap: 0,
      nineBallBreakAndRun: 0,
      nineBallMatchPointsEarned: pm.away_score || 0,
      mastersEightBallWins: 0,
      mastersNineBallWins: 0,
      winLoss: (pm.away_score || 0) > (pm.home_score || 0) ? "W" : "L",
      matchForfeited: false,
      doublesMatch: false,
      dateTimeStamp: row.match_date || "",
      teamSlot: "",
      eightBallMatchPointsEarned: pm.away_score || 0,
      incompleteMatch: false,
      __typename: "PlayerScore",
    }));

    // Compute team totals
    const homeTotalPoints = homeScores.reduce(
      (sum: number, s: any) => sum + (s.eightBallMatchPointsEarned || 0),
      0,
    );
    const awayTotalPoints = awayScores.reduce(
      (sum: number, s: any) => sum + (s.eightBallMatchPointsEarned || 0),
      0,
    );

    return {
      id: row.apa_match_id,
      startTime: row.match_date || "",
      location: {
        id: "",
        name: row.location || "",
        league: { id: 0, slug: "", name: "", __typename: "League" },
        __typename: "HostLocation",
      },
      home: {
        id: parseInt(row.home_team_id) || 0,
        name: row.home_team_name || "",
        division: { id: 0, isTournament: false, __typename: "Division" },
        __typename: "Team",
      },
      away: {
        id: parseInt(row.away_team_id) || 0,
        name: row.away_team_name || "",
        division: { id: 0, isTournament: false, __typename: "Division" },
        __typename: "Team",
      },
      results: [
        {
          homeAway: "HOME",
          matchesWon: row.home_team_score || 0,
          matchesPlayed: playerMatches.length,
          points: { total: homeTotalPoints, __typename: "Points" },
          scores: homeScores,
          __typename: "MatchResult",
        },
        {
          homeAway: "AWAY",
          matchesWon: row.away_team_score || 0,
          matchesPlayed: playerMatches.length,
          points: { total: awayTotalPoints, __typename: "Points" },
          scores: awayScores,
          __typename: "MatchResult",
        },
      ],
      __typename: "MatchDetails",
    };
  }
}
