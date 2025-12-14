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
}

interface PositionStats {
  position: number;
  wins: number;
  losses: number;
  winPercentage: number;
}

interface WrappedSlide3 {
  type: "happyPlace";
  bestLocation: LocationStats;
  worstLocation: LocationStats;
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
  mostPlayed: OpponentRecord;
  seasonOpener: OpponentWithSkill; // first opponent of the season
  seasonCloser: OpponentWithSkill; // last opponent of the season
  lowestSkillOpp: OpponentWithSkill; // opponent with lowest skill level
  highestSkillOpp: OpponentWithSkill; // opponent with highest skill level
}

interface ArchetypeScore {
  name: string;
  description: string;
  score: number;
}

interface WrappedSlide5 {
  type: "archetype";
  top3: ArchetypeScore[];
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

  // The Clutch Player - best record in team_winning/team_losing situations
  const clutchMatches = matches.filter(
    (m) => m.teamSituation === "team_winning" || m.teamSituation === "team_losing",
  );
  if (clutchMatches.length > 0) {
    const clutchWins = clutchMatches.filter((m) => m.isWin).length;
    const clutchWinRate = clutchWins / clutchMatches.length;
    archetypes.push({
      name: "The Clutch Player",
      description: "Performs best under pressure",
      score: clutchWinRate * 100,
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
    });
  }

  // The Giant Slayer - best record against higher skill opponents
  const giantSlayerMatches = matches.filter((m) => m.skillDifference < 0);
  if (giantSlayerMatches.length > 0) {
    const giantSlayerWins = giantSlayerMatches.filter((m) => m.isWin).length;
    const giantSlayerWinRate = giantSlayerWins / giantSlayerMatches.length;
    archetypes.push({
      name: "The Giant Slayer",
      description: "Beats opponents with higher skill levels",
      score: giantSlayerWinRate * 100,
    });
  }

  // The Consistent - most stable performance (low variance)
  const winRates: number[] = [];
  const locationGroups = new Map<string, number[]>();
  matches.forEach((m) => {
    if (!locationGroups.has(m.location)) {
      locationGroups.set(m.location, []);
    }
    locationGroups.get(m.location)!.push(m.isWin ? 1 : 0);
  });
  locationGroups.forEach((results) => {
    const winRate = results.reduce((a, b) => a + b, 0) / results.length;
    winRates.push(winRate);
  });
  if (winRates.length > 1) {
    const mean = winRates.reduce((a, b) => a + b, 0) / winRates.length;
    const variance =
      winRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) /
      winRates.length;
    const consistency = Math.max(0, 100 - variance * 100);
    archetypes.push({
      name: "The Consistent",
      description: "Steady performance across all locations",
      score: consistency,
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
  });

  // All or Nothing - most sweeps (3-0 or 0-3) vs other score distributions
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
      name: "All or Nothing",
      description: "Most sweeps for or against than other score distributions",
      score: sweepPercentage,
    });
  }

  // Sort by score descending and return top 3
  return archetypes.sort((a, b) => b.score - a.score).slice(0, 3);
}

export const handleWrappedGet = async (
  memberId: string,
  apaClient: APAClient,
): Promise<WrappedData> => {
  const apaTeams = await apaClient.getTeamsForPlayer(memberId);
  const allTeams = sortTeamsBySeasonDesc(apaTeams.map(apaTeamToTeam));

  // Filter for FALL 2025 only
  const fall2025Teams = allTeams.filter(
    (team) => team.season === "Fall" && team.seasonYear === 2025,
  );

  if (fall2025Teams.length === 0) {
    throw new Error("No teams found for Fall 2025 season");
  }

  const playerIdByTeam: Record<string, string> = {};
  for (const t of apaTeams) {
    const normalizedTeamId = fall2025Teams.find(
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
    { name: string; type: "EIGHT_BALL" | "NINE_BALL"; wins: number; losses: number }
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

  for (const team of fall2025Teams) {
    if (!teamStats[team.id]) {
      teamStats[team.id] = {
        name: team.name,
        type: team.type,
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
  if (fall2025Teams.length > 1) {
    const teamRecords: TeamRecord[] = Object.entries(teamStats).map(
      ([teamId, stats]) => {
        const total = stats.wins + stats.losses;
        return {
          teamName: stats.name,
          teamType: stats.type,
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
      };
    },
  );

  // Only show best/worst if there are multiple locations
  const bestLocation =
    locationRecords.length > 1
      ? locationRecords.reduce((best, current) =>
          current.winPercentage > best.winPercentage ? current : best,
        )
      : locationRecords[0];
  const worstLocation =
    locationRecords.length > 1
      ? locationRecords.reduce((worst, current) =>
          current.winPercentage < worst.winPercentage ? current : worst,
        )
      : locationRecords[0];

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
    bestLocation,
    worstLocation,
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

  const mostPlayed = opponentRecordList.reduce((most, current) =>
    current.totalMatches > most.totalMatches ? current : most,
  );

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

  // Lowest Skill Opponent: opponent with lowest skill level
  const lowestSkillMatchup = opponentMatchups.reduce((lowest, current) =>
    current.opponentSkill < lowest.opponentSkill ? current : lowest,
  );
  const lowestSkillOpponent = opponentRecordList.find(
    (o) => o.opponentName === lowestSkillMatchup.opponentName,
  )!;
  const lowestSkillOpp: OpponentWithSkill = {
    ...lowestSkillOpponent,
    opponentSkill: lowestSkillMatchup.opponentSkill,
    date: lowestSkillMatchup.date,
    isWin: lowestSkillMatchup.isWin,
  };

  // Highest Skill Opponent: opponent with highest skill level
  const highestSkillMatchup = opponentMatchups.reduce((highest, current) =>
    current.opponentSkill > highest.opponentSkill ? current : highest,
  );
  const highestSkillOpponent = opponentRecordList.find(
    (o) => o.opponentName === highestSkillMatchup.opponentName,
  )!;
  const highestSkillOpp: OpponentWithSkill = {
    ...highestSkillOpponent,
    opponentSkill: highestSkillMatchup.opponentSkill,
    date: highestSkillMatchup.date,
    isWin: highestSkillMatchup.isWin,
  };

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
    top3: roundedArchetypes,
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
  if (top3Highlights.length < 3 && bestLocation.winPercentage >= 80 && bestLocation.wins >= 3) {
    top3Highlights.push(
      `Dominant ${Math.round(bestLocation.winPercentage)}% win rate at ${bestLocation.location}`,
    );
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

