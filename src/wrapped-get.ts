import type { APAClient } from "./apa/client";
import { sortTeamsBySeasonDesc } from "./helpers";
import {
  apaMatchToMatch,
  apaMatchToPlayerMatches,
  apaTeamToTeam,
  type Match,
  type PlayerMatch,
  type TeamSeason,
} from "./types";

interface WrappedSlide0 {
  type: "welcome";
  totalGames: number;
}

interface WrappedSlide1 {
  type: "howdYouDo";
  wins: number;
  losses: number;
  winPercentage: number;
  startingSkill: number;
  endingSkill: number;
  highestSkill: number;
  longestWinStreak: number;
}

interface TeamRecord {
  teamName: string;
  teamType: "EIGHT_BALL" | "NINE_BALL";
  season: string;
  seasonYear: number;
  wins: number;
  losses: number;
  winPercentage: number;
}

interface WrappedSlide2 {
  type: "yourTeams";
  teams: TeamRecord[];
  bestTeam: TeamRecord;
}

interface LocationStats {
  location: string;
  wins: number;
  losses: number;
  winPercentage: number;
  totalMatches: number;
}

interface PositionStats {
  position: number;
  wins: number;
  losses: number;
  winPercentage: number;
}

interface WrappedSlide3 {
  type: "happyPlace";
  bestLocations: LocationStats[]; // top 3
  worstLocations: LocationStats[]; // bottom 3
  bestPosition: PositionStats;
  worstPosition: PositionStats;
}

interface OpponentRecord {
  opponentName: string;
  wins: number;
  losses: number;
  winPercentage: number;
  totalMatches: number;
}

interface OpponentWithSkill extends OpponentRecord {
  opponentSkill: number;
  date: Date;
  isWin: boolean;
}

interface WrappedSlide4 {
  type: "rivals";
  mostPlayed: OpponentRecord[]; // top 3
  seasonOpener: OpponentWithSkill; // first opponent of the season
  seasonCloser: OpponentWithSkill; // last opponent of the season
  lowestSkillOpp: OpponentWithSkill[]; // top 3 opponents with lowest skill levels
  highestSkillOpp: OpponentWithSkill[]; // top 3 opponents with highest skill levels
}

interface ArchetypeScore {
  name: string;
  description: string;
  score: number;
  explanation: string; // One to two sentences with data/metrics used
}

interface WrappedSlide5 {
  type: "archetype";
  top5: ArchetypeScore[];
}

interface WrappedSlide6 {
  type: "summary";
  top3Highlights: string[];
  funStat: string;
  shareableImageUrl: string; // placeholder for now
}

export type WrappedData = {
  slides: Array<
    | WrappedSlide0
    | WrappedSlide1
    | WrappedSlide2
    | WrappedSlide3
    | WrappedSlide4
    | WrappedSlide5
    | WrappedSlide6
  >;
};

function calculateArchetypeScores(
  matches: Array<{
    isWin: boolean;
    playerSkill: number;
    opponentSkill: number;
    skillDifference: number;
    position: number;
    location: string;
    teamSituation: string;
    isHome: boolean;
    playerScore: number;
    opponentScore: number;
  }>,
): ArchetypeScore[] {
  const archetypes: ArchetypeScore[] = [];

  // The Closer - best record when team is winning
  const closerMatches = matches.filter((m) => m.teamSituation === "team_winning");
  if (closerMatches.length > 0) {
    const closerWins = closerMatches.filter((m) => m.isWin).length;
    const closerWinRate = closerWins / closerMatches.length;
    archetypes.push({
      name: "The Closer",
      description: "Seals the deal when your team is ahead",
      score: closerWinRate * 100,
      explanation: `Won ${closerWins} out of ${closerMatches.length} matches when your team was winning (${Math.round(closerWinRate * 100)}% win rate). You're the closer who finishes matches when your team has the lead.`,
    });
  }

  // The Comeback Kid - best record when team is losing
  const comebackMatches = matches.filter((m) => m.teamSituation === "team_losing");
  if (comebackMatches.length > 0) {
    const comebackWins = comebackMatches.filter((m) => m.isWin).length;
    const comebackWinRate = comebackWins / comebackMatches.length;
    archetypes.push({
      name: "The Comeback Kid",
      description: "Thrives when the team is behind",
      score: comebackWinRate * 100,
      explanation: `Won ${comebackWins} out of ${comebackMatches.length} matches when your team was losing (${Math.round(comebackWinRate * 100)}% win rate). You step up when the team needs you most.`,
    });
  }

  // The Anchor - best record in later positions (4-5)
  const anchorMatches = matches.filter((m) => m.position >= 4);
  if (anchorMatches.length > 0) {
    const anchorWins = anchorMatches.filter((m) => m.isWin).length;
    const anchorWinRate = anchorWins / anchorMatches.length;
    archetypes.push({
      name: "The Anchor",
      description: "Reliable in the closing positions",
      score: anchorWinRate * 100,
      explanation: `Won ${anchorWins} out of ${anchorMatches.length} matches in positions 4-5 (${Math.round(anchorWinRate * 100)}% win rate). You're the reliable closer your team can count on.`,
    });
  }

  // The Opener - best record in early positions (1-2)
  const openerMatches = matches.filter((m) => m.position <= 2);
  if (openerMatches.length > 0) {
    const openerWins = openerMatches.filter((m) => m.isWin).length;
    const openerWinRate = openerWins / openerMatches.length;
    archetypes.push({
      name: "The Opener",
      description: "Sets the tone early in matches",
      score: openerWinRate * 100,
      explanation: `Won ${openerWins} out of ${openerMatches.length} matches in positions 1-2 (${Math.round(openerWinRate * 100)}% win rate). You set the tone and get your team off to a strong start.`,
    });
  }

  // The Road Warrior - best away record
  const awayMatches = matches.filter((m) => !m.isHome);
  if (awayMatches.length > 0) {
    const awayWins = awayMatches.filter((m) => m.isWin).length;
    const awayWinRate = awayWins / awayMatches.length;
    archetypes.push({
      name: "The Road Warrior",
      description: "Performs best on the road",
      score: awayWinRate * 100,
      explanation: `Won ${awayWins} out of ${awayMatches.length} away matches (${Math.round(awayWinRate * 100)}% win rate). You perform your best when playing on the opponent's home turf.`,
    });
  }

  // The Home Hero - best home record
  const homeMatches = matches.filter((m) => m.isHome);
  if (homeMatches.length > 0) {
    const homeWins = homeMatches.filter((m) => m.isWin).length;
    const homeWinRate = homeWins / homeMatches.length;
    archetypes.push({
      name: "The Home Hero",
      description: "Dominates at home locations",
      score: homeWinRate * 100,
      explanation: `Won ${homeWins} out of ${homeMatches.length} home matches (${Math.round(homeWinRate * 100)}% win rate). You dominate when playing at your home location.`,
    });
  }

  // The Skill Climber - biggest skill level increase
  if (matches.length > 0) {
    const skills = matches.map((m) => m.playerSkill);
    const startingSkill = skills[0];
    const endingSkill = skills[skills.length - 1];
    const skillIncrease = endingSkill - startingSkill;
    archetypes.push({
      name: "The Skill Climber",
      description: "Improved skill level throughout the season",
      score: Math.max(0, skillIncrease * 20), // Scale: 1 skill level = 20 points
      explanation: `Your skill level improved from ${startingSkill} to ${endingSkill} over the course of the season. You've shown consistent growth and improvement.`,
    });
  }

  // The Underdog - best record when skill difference is negative
  const underdogMatches = matches.filter((m) => m.skillDifference < 0);
  if (underdogMatches.length > 0) {
    const underdogWins = underdogMatches.filter((m) => m.isWin).length;
    const underdogWinRate = underdogWins / underdogMatches.length;
    archetypes.push({
      name: "The Underdog",
      description: "Wins despite being the lower-skilled player",
      score: underdogWinRate * 100,
      explanation: `Won ${underdogWins} out of ${underdogMatches.length} matches against higher-skilled opponents (${Math.round(underdogWinRate * 100)}% win rate). You consistently beat players with higher skill levels.`,
    });
  }

  // The Streak Master - longest win streak
  let currentStreak = 0;
  let longestStreak = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i].isWin) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  archetypes.push({
    name: "The Streak Master",
    description: "Maintains impressive winning streaks",
    score: Math.min(100, longestStreak * 10), // Scale: 10 points per win in streak
    explanation: `Your longest winning streak was ${longestStreak} games in a row. You know how to maintain momentum and keep the wins coming.`,
  });

  // The Close Call - more 2-1 wins than 2-0 or 3-0 combined
  if (matches.length > 0) {
    let closeWins = 0; // 2-1 wins
    let decisiveWins = 0; // 2-0 or 3-0 wins
    matches.forEach((m) => {
      if (m.isWin) {
        if (m.playerScore === 2 && m.opponentScore === 1) {
          closeWins++;
        } else if (
          (m.playerScore === 2 && m.opponentScore === 0) ||
          (m.playerScore === 3 && m.opponentScore === 0)
        ) {
          decisiveWins++;
        }
      }
    });
    if (closeWins > decisiveWins && closeWins > 0) {
      const score = (closeWins / (closeWins + decisiveWins)) * 100;
      archetypes.push({
        name: "The Close Call",
        description: "More 2-1 wins than 2-0 or 3-0 combined",
        score: score,
        explanation: `You had ${closeWins} close 2-1 wins compared to ${decisiveWins} decisive wins (2-0 or 3-0). You win the tight matches that come down to the wire.`,
      });
    }
  }

  // The Close But No Cigar - more 1-2 losses than 0-2 or 0-3 combined
  if (matches.length > 0) {
    let closeLosses = 0; // 1-2 losses
    let decisiveLosses = 0; // 0-2 or 0-3 losses
    matches.forEach((m) => {
      if (!m.isWin) {
        if (m.playerScore === 1 && m.opponentScore === 2) {
          closeLosses++;
        } else if (
          (m.playerScore === 0 && m.opponentScore === 2) ||
          (m.playerScore === 0 && m.opponentScore === 3)
        ) {
          decisiveLosses++;
        }
      }
    });
    if (closeLosses > decisiveLosses && closeLosses > 0) {
      const score = (closeLosses / (closeLosses + decisiveLosses)) * 100;
      archetypes.push({
        name: "The Close But No Cigar",
        description: "More 1-2 losses than 0-2 or 0-3 combined",
        score: score,
        explanation: `You had ${closeLosses} close 1-2 losses compared to ${decisiveLosses} decisive losses (0-2 or 0-3). You fight hard in every match, even when you come up just short.`,
      });
    }
  }

  // The All Gas No Breaks - most sweeps (3-0 or 0-3) vs other score distributions
  if (matches.length > 0) {
    let sweepCount = 0;
    matches.forEach((m) => {
      // Sweep is 3-0 (win) or 0-3 (loss)
      const isSweep =
        (m.isWin && m.playerScore === 3 && m.opponentScore === 0) ||
        (!m.isWin && m.playerScore === 0 && m.opponentScore === 3);
      if (isSweep) {
        sweepCount++;
      }
    });
    const sweepPercentage = (sweepCount / matches.length) * 100;
    archetypes.push({
      name: "The All Gas No Breaks",
      description: "Most sweeps for or against than other score distributions",
      score: sweepPercentage,
      explanation: `${sweepCount} out of ${matches.length} matches were sweeps (3-0 or 0-3), representing ${Math.round(sweepPercentage)}% of your games. You either dominate decisively or get swept - no in between.`,
    });
  }

  // The Grinder - most matches that go to 3 games (2-1 or 1-2)
  if (matches.length > 0) {
    let grinderMatches = 0;
    matches.forEach((m) => {
      // Grinder matches are 2-1 (win) or 1-2 (loss)
      const isGrinder =
        (m.isWin && m.playerScore === 2 && m.opponentScore === 1) ||
        (!m.isWin && m.playerScore === 1 && m.opponentScore === 2);
      if (isGrinder) {
        grinderMatches++;
      }
    });
    const grinderPercentage = (grinderMatches / matches.length) * 100;
    if (grinderMatches > 0) {
      archetypes.push({
        name: "The Grinder",
        description: "Most matches that go to 3 games",
        score: grinderPercentage,
        explanation: `${grinderMatches} out of ${matches.length} matches went to 3 games (2-1 or 1-2), representing ${Math.round(grinderPercentage)}% of your games. You fight hard and make every match competitive.`,
      });
    }
  }

  // Sort by score descending and return top 5
  return archetypes.sort((a, b) => b.score - a.score).slice(0, 5);
}

export const handleWrappedGet = async (
  memberId: string,
  apaClient: APAClient,
  seasonFilter?: (team: TeamSeason) => boolean,
): Promise<WrappedData> => {
  const apaTeams = await apaClient.getTeamsForPlayer(memberId);
  const allTeams = sortTeamsBySeasonDesc(apaTeams.map(apaTeamToTeam));

  // Apply season filter if provided, otherwise default to Fall 2025
  const filterFn =
    seasonFilter ||
    ((team: TeamSeason) => team.season === "Fall" && team.seasonYear === 2025);
  const filteredTeams = allTeams.filter(filterFn);

  if (filteredTeams.length === 0) {
    throw new Error("No teams found for the specified season(s)");
  }

  const playerIdByTeam: Record<string, string> = {};
  for (const t of apaTeams) {
    const normalizedTeamId = filteredTeams.find(
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

  // Collect all player matches with metadata
  const allPlayerMatches: Array<{
    isWin: boolean;
    date: Date;
    playerSkill: number;
    opponentSkill: number;
    skillDifference: number;
    position: number;
    location: string;
    teamSituation: string;
    isHome: boolean;
    teamId: string;
    teamName: string;
    teamType: "EIGHT_BALL" | "NINE_BALL";
    opponentName: string;
    playerScore: number;
    opponentScore: number;
  }> = [];

  let totalGames = 0;
  const skillLevels: number[] = [];
  const teamStats: Record<
    string,
    {
      name: string;
      type: "EIGHT_BALL" | "NINE_BALL";
      season: string;
      seasonYear: number;
      wins: number;
      losses: number;
    }
  > = {};
  const locationStats: Record<string, { wins: number; losses: number }> = {};
  const positionStats: Record<number, { wins: number; losses: number }> = {};
  const opponentRecords: Record<string, { wins: number; losses: number }> = {};
  // Track individual opponent matchups with skill and date info
  const opponentMatchups: Array<{
    opponentName: string;
    opponentSkill: number;
    date: Date;
    isWin: boolean;
  }> = [];

  for (const team of filteredTeams) {
    if (!teamStats[team.id]) {
      teamStats[team.id] = {
        name: team.name,
        type: team.type,
        season: team.season,
        seasonYear: team.seasonYear,
        wins: 0,
        losses: 0,
      };
    }

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

        // Process player matches
        let homeTeamScoreUpToNow = 0;
        let awayTeamScoreUpToNow = 0;

        for (const playerMatch of playerMatches) {
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

          const playerScore = playerStats.score || 0;
          const opponentScore = opponentStats.score || 0;
          const isWin = playerScore > opponentScore;
          const isLoss = playerScore < opponentScore;

          totalGames++;
          const playerSkill = playerStats.skillLevel || 3;
          const opponentSkill = opponentStats.skillLevel || 3;
          skillLevels.push(playerSkill);

          // Update team stats
          if (isWin) teamStats[team.id].wins++;
          if (isLoss) teamStats[team.id].losses++;

          // Update location stats
          const location = match.location || "Unknown";
          if (!locationStats[location]) {
            locationStats[location] = { wins: 0, losses: 0 };
          }
          if (isWin) locationStats[location].wins++;
          if (isLoss) locationStats[location].losses++;

          // Update position stats
          const position = playerMatch.matchOrder;
          if (!positionStats[position]) {
            positionStats[position] = { wins: 0, losses: 0 };
          }
          if (isWin) positionStats[position].wins++;
          if (isLoss) positionStats[position].losses++;

          // Update opponent stats
          const opponentName = opponentStats.name || "Unknown";
          if (!opponentRecords[opponentName]) {
            opponentRecords[opponentName] = { wins: 0, losses: 0 };
          }
          if (isWin) opponentRecords[opponentName].wins++;
          if (isLoss) opponentRecords[opponentName].losses++;

          // Track individual matchup for rivals slide
          opponentMatchups.push({
            opponentName,
            opponentSkill,
            date: match.date,
            isWin,
          });

          // Determine team situation
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

          allPlayerMatches.push({
            isWin,
            date: match.date,
            playerSkill,
            opponentSkill,
            skillDifference: playerSkill - opponentSkill,
            position,
            location,
            teamSituation,
            isHome: isPlayerHome,
            teamId: team.id,
            teamName: team.name,
            teamType: team.type,
            opponentName,
            playerScore,
            opponentScore,
          });

          if (isWin) {
            if (isPlayerHome) homeTeamScoreUpToNow++;
            else awayTeamScoreUpToNow++;
          } else {
            if (isPlayerHome) awayTeamScoreUpToNow++;
            else homeTeamScoreUpToNow++;
          }
        }
      } catch (error) {
        console.error(`Error processing match ${teamMatch.id}:`, error);
      }
    }
  }

  // Check minimum match threshold
  if (totalGames < 5) {
    throw new Error(
      `Minimum 5 matches required. You played ${totalGames} matches in Fall 2025.`,
    );
  }

  // Sort matches by date for skill progression
  allPlayerMatches.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate overall stats
  const wins = allPlayerMatches.filter((m) => m.isWin).length;
  const losses = allPlayerMatches.filter((m) => !m.isWin).length;
  const winPercentage = totalGames > 0 ? (wins / totalGames) * 100 : 0;

  // Skill progression
  const startingSkill = skillLevels[0] || 3;
  const endingSkill = skillLevels[skillLevels.length - 1] || 3;
  const highestSkill = Math.max(...skillLevels, 3);

  // Longest win streak
  let longestWinStreak = 0;
  let currentStreak = 0;
  for (let i = allPlayerMatches.length - 1; i >= 0; i--) {
    if (allPlayerMatches[i].isWin) {
      currentStreak++;
      longestWinStreak = Math.max(longestWinStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  // Slide 0: Welcome
  const slide0: WrappedSlide0 = {
    type: "welcome",
    totalGames,
  };

  // Slide 1: How'd You Do?
  const slide1: WrappedSlide1 = {
    type: "howdYouDo",
    wins,
    losses,
    winPercentage: Math.round(winPercentage * 10) / 10,
    startingSkill,
    endingSkill,
    highestSkill,
    longestWinStreak,
  };

  // Slide 2: Your Teams (if multiple teams)
  let slide2: WrappedSlide2 | null = null;
  if (filteredTeams.length > 1) {
    const teamRecords: TeamRecord[] = Object.entries(teamStats).map(
      ([teamId, stats]) => {
        const total = stats.wins + stats.losses;
        return {
          teamName: stats.name,
          teamType: stats.type,
          season: stats.season,
          seasonYear: stats.seasonYear,
          wins: stats.wins,
          losses: stats.losses,
          winPercentage:
            total > 0 ? Math.round((stats.wins / total) * 1000) / 10 : 0,
        };
      },
    );

    const bestTeam = teamRecords.reduce((best, current) =>
      current.winPercentage > best.winPercentage ? current : best,
    );

    slide2 = {
      type: "yourTeams",
      teams: teamRecords,
      bestTeam,
    };
  }

  // Slide 3: Happy Place
  const locationRecords: LocationStats[] = Object.entries(locationStats).map(
    ([location, stats]) => {
      const total = stats.wins + stats.losses;
      return {
        location,
        wins: stats.wins,
        losses: stats.losses,
        winPercentage:
          total > 0 ? Math.round((stats.wins / total) * 1000) / 10 : 0,
        totalMatches: total,
      };
    },
  );

  // Sort by win percentage (descending), then by total matches (descending) as tiebreaker
  const sortedLocations = [...locationRecords].sort((a, b) => {
    if (a.winPercentage !== b.winPercentage) {
      return b.winPercentage - a.winPercentage;
    }
    return b.totalMatches - a.totalMatches;
  });

  // Top 3 best locations
  const bestLocations = sortedLocations.slice(0, Math.min(3, sortedLocations.length));
  // Bottom 3 worst locations
  const worstLocations = sortedLocations
    .slice(-Math.min(3, sortedLocations.length))
    .reverse(); // Reverse to show worst first

  const positionRecords: PositionStats[] = Object.entries(positionStats).map(
    ([position, stats]) => {
      const total = stats.wins + stats.losses;
      return {
        position: parseInt(position),
        wins: stats.wins,
        losses: stats.losses,
        winPercentage:
          total > 0 ? Math.round((stats.wins / total) * 1000) / 10 : 0,
      };
    },
  );

  // Only show best/worst if there are multiple positions
  const bestPosition =
    positionRecords.length > 1
      ? positionRecords.reduce((best, current) =>
          current.winPercentage > best.winPercentage ? current : best,
        )
      : positionRecords[0];
  const worstPosition =
    positionRecords.length > 1
      ? positionRecords.reduce((worst, current) =>
          current.winPercentage < worst.winPercentage ? current : worst,
        )
      : positionRecords[0];

  const slide3: WrappedSlide3 = {
    type: "happyPlace",
    bestLocations,
    worstLocations,
    bestPosition,
    worstPosition,
  };

  // Slide 4: Rivals
  const opponentRecordList: OpponentRecord[] = Object.entries(opponentRecords).map(
    ([opponentName, stats]) => {
      const total = stats.wins + stats.losses;
      return {
        opponentName,
        wins: stats.wins,
        losses: stats.losses,
        winPercentage:
          total > 0 ? Math.round((stats.wins / total) * 1000) / 10 : 0,
        totalMatches: total,
      };
    },
  );

  // Sort by total matches (descending), then by win percentage (descending) as tiebreaker
  const sortedOpponents = [...opponentRecordList].sort((a, b) => {
    if (a.totalMatches !== b.totalMatches) {
      return b.totalMatches - a.totalMatches;
    }
    return b.winPercentage - a.winPercentage;
  });

  // Top 3 most played opponents
  const mostPlayed = sortedOpponents.slice(0, Math.min(3, sortedOpponents.length));

  // Sort opponent matchups by date to find opener and closer
  const sortedMatchups = [...opponentMatchups].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  // Season Opener: first opponent of the season
  const firstMatchup = sortedMatchups[0];
  const seasonOpenerOpponent = opponentRecordList.find(
    (o) => o.opponentName === firstMatchup.opponentName,
  )!;
  const seasonOpener: OpponentWithSkill = {
    ...seasonOpenerOpponent,
    opponentSkill: firstMatchup.opponentSkill,
    date: firstMatchup.date,
    isWin: firstMatchup.isWin,
  };

  // Season Closer: last opponent of the season
  const lastMatchup = sortedMatchups[sortedMatchups.length - 1];
  const seasonCloserOpponent = opponentRecordList.find(
    (o) => o.opponentName === lastMatchup.opponentName,
  )!;
  const seasonCloser: OpponentWithSkill = {
    ...seasonCloserOpponent,
    opponentSkill: lastMatchup.opponentSkill,
    date: lastMatchup.date,
    isWin: lastMatchup.isWin,
  };

  // Lowest Skill Opponents: top 3 opponents with lowest skill levels
  // Group by unique opponent name and skill level, then sort
  const uniqueLowestSkillOpponents = new Map<string, typeof opponentMatchups[0]>();
  opponentMatchups.forEach((m) => {
    const key = `${m.opponentName}_${m.opponentSkill}`;
    if (!uniqueLowestSkillOpponents.has(key)) {
      uniqueLowestSkillOpponents.set(key, m);
    }
  });
  const sortedLowestSkill = Array.from(uniqueLowestSkillOpponents.values())
    .sort((a, b) => a.opponentSkill - b.opponentSkill)
    .slice(0, 3);
  
  const lowestSkillOpp: OpponentWithSkill[] = sortedLowestSkill.map((matchup) => {
    const opponent = opponentRecordList.find(
      (o) => o.opponentName === matchup.opponentName,
    )!;
    return {
      ...opponent,
      opponentSkill: matchup.opponentSkill,
      date: matchup.date,
      isWin: matchup.isWin,
    };
  });

  // Highest Skill Opponents: top 3 opponents with highest skill levels
  const uniqueHighestSkillOpponents = new Map<string, typeof opponentMatchups[0]>();
  opponentMatchups.forEach((m) => {
    const key = `${m.opponentName}_${m.opponentSkill}`;
    if (!uniqueHighestSkillOpponents.has(key)) {
      uniqueHighestSkillOpponents.set(key, m);
    }
  });
  const sortedHighestSkill = Array.from(uniqueHighestSkillOpponents.values())
    .sort((a, b) => b.opponentSkill - a.opponentSkill)
    .slice(0, 3);
  
  const highestSkillOpp: OpponentWithSkill[] = sortedHighestSkill.map((matchup) => {
    const opponent = opponentRecordList.find(
      (o) => o.opponentName === matchup.opponentName,
    )!;
    return {
      ...opponent,
      opponentSkill: matchup.opponentSkill,
      date: matchup.date,
      isWin: matchup.isWin,
    };
  });

  const slide4: WrappedSlide4 = {
    type: "rivals",
    mostPlayed,
    seasonOpener,
    seasonCloser,
    lowestSkillOpp,
    highestSkillOpp,
  };

  // Slide 5: Archetype
  const archetypeScores = calculateArchetypeScores(allPlayerMatches);
  // Round scores to 1 decimal place for cleaner display
  const roundedArchetypes = archetypeScores.map((arch) => ({
    ...arch,
    score: Math.round(arch.score * 10) / 10,
  }));
  const slide5: WrappedSlide5 = {
    type: "archetype",
    top5: roundedArchetypes,
  };

  // Slide 6: Summary
  const top3Highlights: string[] = [];
  
  // Priority highlights (most impressive first)
  if (longestWinStreak >= 3) {
    top3Highlights.push(`Had a ${longestWinStreak}-game winning streak`);
  }
  if (endingSkill > startingSkill) {
    top3Highlights.push(
      `Improved from skill level ${startingSkill} to ${endingSkill}`,
    );
  }
  if (winPercentage >= 70 && totalGames >= 5) {
    top3Highlights.push(`Won ${Math.round(winPercentage)}% of your matches`);
  } else if (wins > 0) {
    top3Highlights.push(`Won ${wins} match${wins !== 1 ? "es" : ""}`);
  }
  
  // Additional highlights if we need more
  if (top3Highlights.length < 3) {
    // Find best record against an opponent (if any with wins > losses)
    const bestOpponentRecord = opponentRecordList
      .filter((o) => o.totalMatches >= 1 && o.wins > o.losses)
      .sort((a, b) => b.winPercentage - a.winPercentage)[0];
    if (bestOpponentRecord && bestOpponentRecord.wins >= 2) {
      top3Highlights.push(
        `Beat ${bestOpponentRecord.opponentName} ${bestOpponentRecord.wins}-${bestOpponentRecord.losses}`,
      );
    }
  }
  if (top3Highlights.length < 3 && bestPosition.winPercentage === 100 && bestPosition.wins >= 2) {
    top3Highlights.push(
      `Perfect ${bestPosition.wins}-0 record at position ${bestPosition.position}`,
    );
  }
  if (top3Highlights.length < 3 && bestLocations.length > 0) {
    const bestLoc = bestLocations[0];
    if (bestLoc.winPercentage >= 80 && bestLoc.wins >= 3) {
      top3Highlights.push(
        `Dominant ${Math.round(bestLoc.winPercentage)}% win rate at ${bestLoc.location}`,
      );
    }
  }
  if (top3Highlights.length < 3 && totalGames >= 10) {
    top3Highlights.push(`Played ${totalGames} total games`);
  }

  const uniqueLocations = new Set(allPlayerMatches.map((m) => m.location)).size;
  const uniqueOpponents = new Set(
    allPlayerMatches.map((m) => m.opponentName),
  ).size;
  const funStat =
    uniqueLocations > 1
      ? `Played at ${uniqueLocations} different locations`
      : `Faced ${uniqueOpponents} different opponent${uniqueOpponents !== 1 ? "s" : ""}`;

  const slide6: WrappedSlide6 = {
    type: "summary",
    top3Highlights: top3Highlights.slice(0, 3),
    funStat,
    shareableImageUrl: "https://placeholder.com/wrapped-image", // placeholder
  };

  // Build slides array
  const slides: WrappedData["slides"] = [slide0, slide1];
  if (slide2) {
    slides.push(slide2);
  }
  slides.push(slide3, slide4, slide5, slide6);

  return { slides };
};

// Wrapper for season-specific wrapped (e.g., "Fall 2025")
export const handleWrappedSeasonGet = async (
  memberId: string,
  apaClient: APAClient,
  season: string, // Format: "Fall 2025"
): Promise<WrappedData> => {
  // Parse season string
  const match = season.match(/(\w+)\s+(\d+)/);
  if (!match) {
    throw new Error(
      `Invalid season format. Must be in format 'Season Year' (e.g., 'Fall 2025')`,
    );
  }
  const seasonName = match[1];
  const seasonYear = parseInt(match[2], 10);

  return handleWrappedGet(memberId, apaClient, (team) => {
    return team.season === seasonName && team.seasonYear === seasonYear;
  });
};

// Wrapper for year-specific wrapped (Spring/Summer/Fall of a given year)
export const handleWrappedYearGet = async (
  memberId: string,
  apaClient: APAClient,
  year: number,
): Promise<WrappedData> => {
  return handleWrappedGet(memberId, apaClient, (team) => {
    return (
      team.seasonYear === year &&
      (team.season === "Spring" ||
        team.season === "Summer" ||
        team.season === "Fall")
    );
  });
};

