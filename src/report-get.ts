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
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

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

function writeReportToCSV(report: PlayerReport, playerName: string): void {
  // Create reports directory if it doesn't exist
  const reportsDir = join(process.cwd(), "reports");
  try {
    mkdirSync(reportsDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, that's fine
  }

  const filename = `${playerName.replace(/[^a-zA-Z0-9]/g, '_')}_report.csv`;
  const filepath = join(reportsDir, filename);

  const csvLines: string[] = [];
  
  // Overall Stats
  csvLines.push("Overall Statistics");
  csvLines.push("Wins,Losses,Win Percentage,Total Matches");
  const winPercentage = report.totalMatches > 0 ? ((report.overallWins / report.totalMatches) * 100).toFixed(1) : "0.0";
  csvLines.push(`${report.overallWins},${report.overallLosses},${winPercentage}%,${report.totalMatches}`);
  csvLines.push(""); // Empty line for spacing

  // By Session
  csvLines.push("Performance by Session");
  csvLines.push("Session,Wins,Losses,Win Percentage");
  Object.entries(report.bySession).forEach(([session, stats]) => {
    const total = stats.wins + stats.losses;
    const winPct = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
    csvLines.push(`"${session}",${stats.wins},${stats.losses},${winPct}%`);
  });
  csvLines.push("");

  // Head to Head
  csvLines.push("Head to Head Records");
  csvLines.push("Opponent,Wins,Losses,Win Percentage");
  Object.entries(report.headToHead).forEach(([opponent, stats]) => {
    const total = stats.wins + stats.losses;
    const winPct = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
    csvLines.push(`"${opponent}",${stats.wins},${stats.losses},${winPct}%`);
  });
  csvLines.push("");

  // By Position
  csvLines.push("Performance by Match Position");
  csvLines.push("Position,Wins,Losses,Win Percentage");
  Object.entries(report.byPosition).forEach(([position, stats]) => {
    const total = stats.wins + stats.losses;
    const winPct = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
    csvLines.push(`Position ${position},${stats.wins},${stats.losses},${winPct}%`);
  });
  csvLines.push("");

  // By Location
  csvLines.push("Performance by Location");
  csvLines.push("Location,Wins,Losses,Win Percentage");
  Object.entries(report.byLocation).forEach(([location, stats]) => {
    const total = stats.wins + stats.losses;
    const winPct = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
    csvLines.push(`"${location}",${stats.wins},${stats.losses},${winPct}%`);
  });
  csvLines.push("");

  // Score Distribution
  csvLines.push("Score Distribution");
  csvLines.push("Score,Count");
  Object.entries(report.scoreDistribution).forEach(([score, count]) => {
    csvLines.push(`"${score}",${count}`);
  });
  csvLines.push("");

  // By Skill Difference
  csvLines.push("Performance by Skill Difference (Your Skill - Opponent Skill)");
  csvLines.push("Skill Difference,Wins,Losses,Win Percentage");
  Object.entries(report.bySkillDifference).forEach(([diff, stats]) => {
    const total = stats.wins + stats.losses;
    const winPct = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
    csvLines.push(`${diff},${stats.wins},${stats.losses},${winPct}%`);
  });
  csvLines.push("");

  // By Opponent Skill
  csvLines.push("Performance by Opponent Skill Level");
  csvLines.push("Opponent Skill Level,Wins,Losses,Win Percentage");
  Object.entries(report.byOpponentSkill).forEach(([skill, stats]) => {
    const total = stats.wins + stats.losses;
    const winPct = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
    csvLines.push(`Skill ${skill},${stats.wins},${stats.losses},${winPct}%`);
  });
  csvLines.push("");

  // By My Skill
  csvLines.push("Performance by Your Skill Level");
  csvLines.push("Your Skill Level,Wins,Losses,Win Percentage");
  Object.entries(report.byMySkill).forEach(([skill, stats]) => {
    const total = stats.wins + stats.losses;
    const winPct = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
    csvLines.push(`Skill ${skill},${stats.wins},${stats.losses},${winPct}%`);
  });
  csvLines.push("");

  // By Innings
  csvLines.push("Performance by Innings Played");
  csvLines.push("Innings Range,Wins,Losses,Win Percentage");
  Object.entries(report.byInnings).forEach(([innings, stats]) => {
    const total = stats.wins + stats.losses;
    const winPct = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
    csvLines.push(`"${innings}",${stats.wins},${stats.losses},${winPct}%`);
  });
  csvLines.push("");

  // By Team Situation
  csvLines.push("Performance by Team Situation");
  csvLines.push("Team Situation,Wins,Losses,Win Percentage");
  Object.entries(report.byTeamSituation).forEach(([situation, stats]) => {
    const total = stats.wins + stats.losses;
    const winPct = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
    const situationName = situation === "team_winning" ? "Team Winning" : 
                         situation === "team_losing" ? "Team Losing" : "Team Tied";
    csvLines.push(`"${situationName}",${stats.wins},${stats.losses},${winPct}%`);
  });
  csvLines.push("");

  // Report metadata
  csvLines.push("Report Information");
  csvLines.push("Generated At,Total Teams");
  csvLines.push(`${report.generatedAt.toISOString()},${report.totalTeams}`);

  // Write to file
  writeFileSync(filepath, csvLines.join('\n'), 'utf8');
  console.log(`Report written to: ${filepath}`);
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

  // Get player name for CSV file
  let playerName = "Unknown_Player";
  try {
    // Try to get player name from the first team's player data
    if (apaTeams.length > 0) {
      const firstTeam = apaTeams[0];
      if (firstTeam.nickName && firstTeam.nickName.trim()) {
        playerName = firstTeam.nickName.trim();
      } else {
        // Fallback to member ID if no nickname
        playerName = `Player_${memberId}`;
      }
    } else {
      playerName = `Player_${memberId}`;
    }
  } catch (error) {
    console.error("Error getting player name:", error);
    playerName = `Player_${memberId}`;
  }

  // // Write report to CSV file
  // writeReportToCSV(report, playerName);

  return {
    teams,
    matchesByTeam,
    report,
  };
};
