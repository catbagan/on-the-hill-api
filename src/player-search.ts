import { APAClient } from "./apa/client";
import { apaPlayerToPlayer, apaTeamToTeam, Player } from "./types";

export const handlePlayerSearch = async (playerName: string, apaClient: APAClient): Promise<any | null> => {
  const apaPlayer =  await apaClient.searchForPlayer(playerName);
  const player = apaPlayerToPlayer(apaPlayer);

  if (!player) {
    return null;
  }

  const teams = await apaClient.getTeamsForPlayer(player.memberNumber);

  return {
    player,
    teams: teams.map(apaTeamToTeam)
  }
};
