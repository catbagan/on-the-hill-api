export interface Player {
  id: string; // UUID for our system
  apaId: string; // APA's member ID
  memberNumber: string; // APA member number
  firstName: string;
  lastName: string;
  city: string;
  state: string;
}

export interface TeamSeason {
  id: string; // UUID for our system
  apaId: string; // APA team ID
  name: string;
  type: TeamType;
  season: string;
  seasonYear: number;
  matchIds: string[];
}

export interface Match {
  id: string;
  date: Date;
  location: string;
  homeTeamId: string; // FK to TeamSeason
  awayTeamId: string; // FK to TeamSeason
  homeTeamScore: number;
  awayTeamScore: number;
  playerMatchIds: Array<string>;
}

export type PlayerMatchStats = {
  id: string;
  name: string;
  skillLevel: number;
  score: number;
  innings: number;
  defensiveShots: number;
  gamesWon: number;
};

export interface PlayerMatch {
  id: string;
  throw: string; // 'home' or 'away'
  matchOrder: number;
  matchId: string; // FK to Match
  awayPlayerStats: PlayerMatchStats;
  homePlayerStats: PlayerMatchStats;
}

export interface PlayerReport {
  id: string;
  overallWins: number;
  overallLosses: number;
  bySession: Record<string, { wins: number; losses: number }>;
  headToHead: Record<string, { wins: number; losses: number }>;
  byPosition: Record<number, { wins: number; losses: number }>;
  byLocation: Record<string, { wins: number; losses: number }>;
  scoreDistribution: Record<string, number>; // "3-0", "2-1", etc.
  bySkillDifference: Record<number, { wins: number; losses: number }>;
  byOpponentSkill: Record<number, { wins: number; losses: number }>;
  byMySkill: Record<number, { wins: number; losses: number }>;
  byInnings: Record<string, { wins: number; losses: number }>; // "0-10", "11-20", "21-30", "30+"
  byTeamSituation: Record<string, { wins: number; losses: number }>; // "team_winning", "team_tied", "team_losing"
  totalMatches: number;
  totalTeams: number;
  generatedAt: Date;
}

export function apaPlayerToPlayer(apaPlayer: any): Player {
  const aliases = apaPlayer.aliases || [];
  let memberNumber = "";
  if (aliases.length === 1) {
    memberNumber = aliases[0].id.toString();
  }

  return {
    id: crypto.randomUUID(),
    apaId: apaPlayer.id?.toString() || "",
    memberNumber,
    firstName: apaPlayer.firstName || "",
    lastName: apaPlayer.lastName || "",
    city: apaPlayer.city || "",
    state: apaPlayer.stateProvince?.name || "",
  };
}
export enum TeamType {
  EIGHT_BALL = "EIGHT_BALL",
  NINE_BALL = "NINE_BALL",
}

export function apaSeasonToSeason(apaSeason: any): {
  season: string;
  seasonYear: number;
} {
  // ex: Summer 2025 -> { season: "Summer", seasonYear: 2025 }
  const [_, season, year] = apaSeason.name.match(/(\w+) (\d+)/);
  return {
    season,
    seasonYear: parseInt(year),
  };
}

export function apaTeamToTeam(apaTeam: any): TeamSeason {
  return {
    id: crypto.randomUUID(),
    apaId: apaTeam.team?.id?.toString() || "",
    name: apaTeam.team?.name || "",
    type:
      apaTeam.__typename === "EightBallPlayer"
        ? TeamType.EIGHT_BALL
        : TeamType.NINE_BALL,
    ...apaSeasonToSeason(apaTeam.session),
    matchIds: [],
  };
}

export function apaMatchToMatch(apaMatch: any): Match {
  const results = apaMatch.results;
  const homeScore = results.find((r: any) => r.homeAway === "HOME")?.points
    ?.total;
  const awayScore = results.find((r: any) => r.homeAway === "AWAY")?.points
    ?.total;

  return {
    id: crypto.randomUUID(),
    date: new Date(apaMatch.startTime),
    location: apaMatch.location.name,
    homeTeamId: apaMatch.home.id,
    awayTeamId: apaMatch.away.id,
    homeTeamScore: homeScore,
    awayTeamScore: awayScore,
    playerMatchIds: [],
  };
}

export function apaMatchToPlayerMatches(apaMatch: any): Array<PlayerMatch> {
  const results = apaMatch.results;
  const homeMatchScores = results.find(
    (r: any) => r.homeAway === "HOME",
  )?.scores;
  const awayMatchScores = results.find(
    (r: any) => r.homeAway === "AWAY",
  )?.scores;

  if (!homeMatchScores) {
    return [];
  }

  const matches: Array<PlayerMatch> = [];
  for (const homeMatchScore of homeMatchScores) {
    const matchId = homeMatchScore.id;
    const matchOrder = homeMatchScore.matchPositionNumber;

    const awayMatchScore = awayMatchScores.find(
      (s: any) => s.matchPositionNumber === matchOrder,
    );

    const homePlayerStats: PlayerMatchStats = {
      id: homeMatchScore.player?.id,
      name: homeMatchScore.player?.displayName,
      skillLevel:
        homeMatchScore.skillLevel === 0 ? 3 : homeMatchScore.skillLevel,
      score: homeMatchScore.eightBallMatchPointsEarned,
      innings: homeMatchScore.innings,
      defensiveShots: homeMatchScore.defensiveShots,
      gamesWon: homeMatchScore.eightBallWins,
    };

    const awayPlayerStats: PlayerMatchStats = {
      id: awayMatchScore.player?.id,
      name: awayMatchScore.player?.displayName,
      skillLevel:
        awayMatchScore.skillLevel === 0 ? 3 : awayMatchScore.skillLevel,
      score: awayMatchScore.eightBallMatchPointsEarned,
      innings: awayMatchScore.innings,
      defensiveShots: awayMatchScore.defensiveShots,
      gamesWon: awayMatchScore.eightBallWins,
    };

    const match: PlayerMatch = {
      id: crypto.randomUUID(),
      throw: "home",
      matchOrder,
      matchId,
      awayPlayerStats,
      homePlayerStats,
    };

    matches.push(match);
  }

  return matches.sort((a, b) => a.matchOrder - b.matchOrder);
}
