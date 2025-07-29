import { APAClient } from "./apa/client";
import { apaPlayerToPlayer, apaTeamToTeam, Player } from "./types";

export const handlePlayerRaw = async (playerName: string, apaClient: APAClient): Promise<any | null> => {
  const apaPlayer =  await apaClient.searchForPlayer(playerName);
  const player = apaPlayerToPlayer(apaPlayer);

  if (!player) {
    return null;
  }

  const apaTeams = await apaClient.getTeamsForPlayer(player.memberNumber);
  const teams = apaTeams.map(apaTeamToTeam);

  const apaMatches = []
  for (const team of teams) {
    const teamMatches = await apaClient.getMatchesForTeam(team.apaId);

    const matchIds = teamMatches.map(m => m.id);
    team.matchIds = matchIds;
    apaMatches.push(...teamMatches);
  }

  const apaMatchDetails = []
  for (const match of apaMatches) {
    const matchDetails = await apaClient.getMatchDetails(match.id);
    apaMatchDetails.push(matchDetails);
  }

  return {
    player: apaPlayer,
    teams: apaTeams,
    a: teams,
    matches: apaMatches,
    matchDetails: apaMatchDetails,
  }
};
