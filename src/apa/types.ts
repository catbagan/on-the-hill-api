export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  city: string;
  aliases: PlayerAlias[];
  stateProvince: StateProvince;
  __typename: "Member";
}

export interface PlayerAlias {
  id: string;
  nickname: string;
  memberNumber: string;
  __typename: string;
}

export interface StateProvince {
  id: string;
  name: string;
  __typename: string;
}

export interface SearchResult {
  suggestions: string[];
  hits: (Player | Team | Division | League | HostLocation)[];
  __typename: string;
}

export interface Team {
  id: string;
  name: string;
  number: string;
  session: Session;
  division: Division;
  league: League;
  __typename: "Team";
}

export interface Session {
  id: string;
  name: string;
  __typename: string;
}

export interface Division {
  id: string;
  name: string;
  type: string;
  format: string;
  isTournament: boolean;
  __typename: string;
}

export interface League {
  id: string;
  name: string;
  slug: string;
  __typename: string;
}

export interface HostLocation {
  id: string;
  name: string;
  league: League;
  __typename: string;
}

export interface EightBallPlayer {
  id: string;
  isActive: boolean;
  role: string;
  rosterPosition: string;
  nickName: string;
  matchesPlayed: number;
  matchesWon: number;
  session: Session;
  skillLevel: number;
  rank: number;
  team: Team;
  __typename: "EightBallPlayer";
}

export interface NineBallPlayer {
  id: string;
  isActive: boolean;
  role: string;
  rosterPosition: string;
  nickName: string;
  matchesPlayed: number;
  matchesWon: number;
  session: Session;
  skillLevel: number;
  rank: number;
  team: Team;
  __typename: "NineBallPlayer";
}

export interface MastersPlayer {
  id: string;
  isActive: boolean;
  role: string;
  rosterPosition: string;
  nickName: string;
  matchesPlayed: number;
  matchesWon: number;
  session: Session;
  team: Team;
  __typename: "MastersPlayer";
}

export type PlayerTeam = EightBallPlayer | NineBallPlayer | MastersPlayer;

export interface Match {
  id: string;
  week: number;
  type: "EIGHT" | "NINE" | "MASTERS";
  startTime: string;
  isBye: boolean;
  status: string;
  scoresheet: string;
  isMine: boolean;
  isPaid: boolean;
  isScored: boolean;
  isFinalized: boolean;
  isPlayoff: boolean;
  description: string;
  location: HostLocation;
  home: Team;
  away: Team;
  __typename: string;
}

export interface MatchDetails {
  id: string;
  startTime: string;
  location: HostLocation;
  home: Team;
  away: Team;
  results: MatchResult[];
  __typename: string;
}

export interface MatchResult {
  homeAway: string;
  matchesWon: number;
  matchesPlayed: number;
  points: {
    total: number;
    __typename: string;
  };
  scores: PlayerScore[];
  __typename: string;
}

export interface PlayerScore {
  id: string;
  player: {
    id: string;
    displayName: string;
    __typename: string;
  };
  matchPositionNumber: number;
  playerPosition: string;
  skillLevel: number;
  innings: number;
  defensiveShots: number;
  eightBallWins: number;
  eightOnBreak: number;
  eightBallBreakAndRun: number;
  nineBallPoints: number;
  nineOnSnap: number;
  nineBallBreakAndRun: number;
  nineBallMatchPointsEarned: number;
  mastersEightBallWins: number;
  mastersNineBallWins: number;
  winLoss: "W" | "L" | "T";
  matchForfeited: boolean;
  doublesMatch: boolean;
  dateTimeStamp: string;
  teamSlot: string;
  eightBallMatchPointsEarned: number;
  incompleteMatch: boolean;
  __typename: string;
}

export interface PlayerStats {
  overall: WinLossRecord;
  eightBall: WinLossRecord;
  nineBall: WinLossRecord;
  bySession: Record<string, WinLossRecord>;
  headToHead: Record<string, WinLossRecord>;
  byOrder: Record<string, WinLossRecord>;
  byLocation: Record<string, WinLossRecord>;
  scoreDistribution: Record<string, number>;
}

export interface WinLossRecord {
  wins: number;
  losses: number;
  percentage?: string;
}

export interface PlayerMatch {
  date: string;
  result: "W" | "L" | "T";
  playerScore: number;
  opponentScore: number;
  opponent: string;
  order: number;
  location: string;
  teamGame: string;
  innings: number;
  defensiveShots: number;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
}

export interface TokenResponse {
  generateAccessToken: {
    accessToken: string;
    __typename: string;
  };
}

export interface SearchResponse {
  search: SearchResult;
}

export interface AliasResponse {
  alias: {
    id: string;
    pastTeams: PlayerTeam[];
    currentTeams: PlayerTeam[];
    __typename: string;
  };
}

export interface TeamScheduleResponse {
  team: {
    id: string;
    sessionBonusPoints: number;
    sessionPoints: number;
    sessionTotalPoints: number;
    division: Division;
    matches: Match[];
    __typename: string;
  };
}

export interface MatchResponse {
  match: MatchDetails;
}

export interface LoginResponse {
  login: {
    __typename: string;
    deviceRefreshToken?: string;
    leagueIds?: string[];
    reason?: string;
  };
}

export interface AuthorizeResponse {
  authorize: {
    refreshToken: string;
    __typename: string;
  };
}
