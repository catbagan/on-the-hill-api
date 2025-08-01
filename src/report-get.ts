import type { APAClient } from "./apa/client";
import {
  apaMatchToMatch,
  apaMatchToPlayerMatches,
  apaTeamToTeam,
  type Match,
  type PlayerMatch,
  type PlayerReport,
  type TeamSeason,
} from "./types";

export function generateReport(
  teams: TeamSeason[],
  matchesByTeam: Record<
    string,
    Array<Match & { playerMatches: Array<PlayerMatch> }>
  >,
  playerIdByTeam: Record<string, string>,
): PlayerReport {
  const stats = {
    overallWins: 0,
    overallLosses: 0,
    bySession: {} as Record<string, { wins: number; losses: number }>,
    headToHead: {} as Record<string, { wins: number; losses: number }>,
    byPosition: {} as Record<number, { wins: number; losses: number }>,
    byLocation: {} as Record<string, { wins: number; losses: number }>,
    scoreDistribution: {} as Record<string, number>,
    bySkillDifference: {} as Record<number, { wins: number; losses: number }>,
    byOpponentSkill: {} as Record<number, { wins: number; losses: number }>,
    byMySkill: {} as Record<number, { wins: number; losses: number }>,
    byInnings: {} as Record<string, { wins: number; losses: number }>,
    byTeamSituation: {} as Record<string, { wins: number; losses: number }>,
  };

  let totalMatches = 0;

  for (const team of teams) {
    const teamMatches = matchesByTeam[team.id] || [];

    for (const match of teamMatches) {
      let homeTeamScoreUpToNow = 0;
      let awayTeamScoreUpToNow = 0;

      for (const playerMatch of match.playerMatches) {
        const isPlayerHome =
          playerMatch.homePlayerStats.id === playerIdByTeam[team.id];
        const isPlayerAway =
          playerMatch.awayPlayerStats.id === playerIdByTeam[team.id];

        if (!isPlayerHome && !isPlayerAway) {
          const homePlayerWon =
            playerMatch.homePlayerStats.score >
            playerMatch.awayPlayerStats.score;
          if (homePlayerWon) {
            homeTeamScoreUpToNow++;
          } else {
            awayTeamScoreUpToNow++;
          }
          continue;
        }

        const playerStats = isPlayerHome
          ? playerMatch.homePlayerStats
          : playerMatch.awayPlayerStats;
        const opponentStats = isPlayerHome
          ? playerMatch.awayPlayerStats
          : playerMatch.homePlayerStats;
        totalMatches++;

        const playerScore = playerStats.score || 0;
        const opponentScore = opponentStats.score || 0;
        const isWin = playerScore > opponentScore;
        const isLoss = playerScore < opponentScore;

        if (isWin) stats.overallWins++;
        if (isLoss) stats.overallLosses++;

        const sessionKey = `${team.season} ${team.seasonYear}`;
        if (!stats.bySession[sessionKey]) {
          stats.bySession[sessionKey] = { wins: 0, losses: 0 };
        }
        if (isWin) stats.bySession[sessionKey].wins++;
        if (isLoss) stats.bySession[sessionKey].losses++;

        const opponentName = opponentStats.name || "Unknown";
        if (!stats.headToHead[opponentName]) {
          stats.headToHead[opponentName] = { wins: 0, losses: 0 };
        }
        if (isWin) stats.headToHead[opponentName].wins++;
        if (isLoss) stats.headToHead[opponentName].losses++;

        const position = playerMatch.matchOrder;
        if (!stats.byPosition[position]) {
          stats.byPosition[position] = { wins: 0, losses: 0 };
        }
        if (isWin) stats.byPosition[position].wins++;
        if (isLoss) stats.byPosition[position].losses++;

        const location = match.location || "Unknown";
        if (!stats.byLocation[location]) {
          stats.byLocation[location] = { wins: 0, losses: 0 };
        }
        if (isWin) stats.byLocation[location].wins++;
        if (isLoss) stats.byLocation[location].losses++;

        const scoreKey = `${playerScore}-${opponentScore}`;
        if (!stats.scoreDistribution[scoreKey]) {
          stats.scoreDistribution[scoreKey] = 0;
        }
        stats.scoreDistribution[scoreKey]++;

        const playerSkill = playerStats.skillLevel || 0;
        const opponentSkill = opponentStats.skillLevel || 0;
        const skillDifference = playerSkill - opponentSkill;
        if (!stats.bySkillDifference[skillDifference]) {
          stats.bySkillDifference[skillDifference] = { wins: 0, losses: 0 };
        }
        if (isWin) stats.bySkillDifference[skillDifference].wins++;
        if (isLoss) stats.bySkillDifference[skillDifference].losses++;

        if (!stats.byOpponentSkill[opponentSkill]) {
          stats.byOpponentSkill[opponentSkill] = { wins: 0, losses: 0 };
        }
        if (isWin) stats.byOpponentSkill[opponentSkill].wins++;
        if (isLoss) stats.byOpponentSkill[opponentSkill].losses++;

        if (!stats.byMySkill[playerSkill]) {
          stats.byMySkill[playerSkill] = { wins: 0, losses: 0 };
        }
        if (isWin) stats.byMySkill[playerSkill].wins++;
        if (isLoss) stats.byMySkill[playerSkill].losses++;

        const innings = playerStats.innings || 0;
        let inningsBucket = "30+";
        if (innings <= 10) inningsBucket = "0-10";
        else if (innings <= 20) inningsBucket = "11-20";
        else if (innings <= 30) inningsBucket = "21-30";

        if (!stats.byInnings[inningsBucket]) {
          stats.byInnings[inningsBucket] = { wins: 0, losses: 0 };
        }
        if (isWin) stats.byInnings[inningsBucket].wins++;
        if (isLoss) stats.byInnings[inningsBucket].losses++;

        let teamSituation = "team_tied";
        if (isPlayerHome) {
          if (homeTeamScoreUpToNow > awayTeamScoreUpToNow)
            teamSituation = "team_winning";
          else if (homeTeamScoreUpToNow < awayTeamScoreUpToNow)
            teamSituation = "team_losing";
        } else {
          if (awayTeamScoreUpToNow > homeTeamScoreUpToNow)
            teamSituation = "team_winning";
          else if (awayTeamScoreUpToNow < homeTeamScoreUpToNow)
            teamSituation = "team_losing";
        }

        if (!stats.byTeamSituation[teamSituation]) {
          stats.byTeamSituation[teamSituation] = { wins: 0, losses: 0 };
        }
        if (isWin) stats.byTeamSituation[teamSituation].wins++;
        if (isLoss) stats.byTeamSituation[teamSituation].losses++;

        if (isWin) {
          if (isPlayerHome) homeTeamScoreUpToNow++;
          else awayTeamScoreUpToNow++;
        } else {
          if (isPlayerHome) awayTeamScoreUpToNow++;
          else homeTeamScoreUpToNow++;
        }
      }
    }
  }

  return {
    id: crypto.randomUUID(),
    overallWins: stats.overallWins,
    overallLosses: stats.overallLosses,
    bySession: stats.bySession,
    headToHead: stats.headToHead,
    byPosition: stats.byPosition,
    byLocation: stats.byLocation,
    scoreDistribution: stats.scoreDistribution,
    bySkillDifference: stats.bySkillDifference,
    byOpponentSkill: stats.byOpponentSkill,
    byMySkill: stats.byMySkill,
    byInnings: stats.byInnings,
    byTeamSituation: stats.byTeamSituation,
    totalMatches,
    totalTeams: teams.length,
    generatedAt: new Date(),
  };
}

export const handleReportGet = async (
  memberId: string,
  apaClient: APAClient,
): Promise<any> => {
  const apaTeams = await apaClient.getTeamsForPlayer(memberId);
  const teams = apaTeams.map(apaTeamToTeam);

  const playerIdByTeam: Record<string, string> = {};
  for (const t of apaTeams) {
    const normalizedTeamId = teams.find(
      (team) => team.apaId === t.team.id.toString(),
    )?.id;
    if (!normalizedTeamId) {
      continue;
    }

    playerIdByTeam[normalizedTeamId] = t.id;
  }

  const matchesByTeam: Record<
    string,
    Array<Match & { playerMatches: Array<PlayerMatch> }>
  > = {};

  for (const team of teams) {
    const teamMatches = await apaClient.getMatchesForTeam(team.apaId);
    const matchIds = teamMatches.map((m) => m.id);
    team.matchIds = matchIds;

    for (const teamMatch of teamMatches) {
      try {
        const apaMatch = await apaClient.getMatchDetails(teamMatch.id);
        const match = apaMatchToMatch(apaMatch);
        if (!matchesByTeam[team.id]) {
          matchesByTeam[team.id] = [];
        }

        const playerMatches = apaMatchToPlayerMatches(apaMatch);
        matchesByTeam[team.id].push({
          ...match,
          playerMatches,
        });
      } catch (error) {
        console.error(`Error processing match ${teamMatch.id}:`, error);
      }
    }
  }

  const report = generateReport(teams, matchesByTeam, playerIdByTeam);

  return {
    teams,
    matchesByTeam,
    report,
  };
};
