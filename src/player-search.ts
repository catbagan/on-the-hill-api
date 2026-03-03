import type { IAPAClient } from "./apa/apa-client.interface";
import { sortTeamsBySeasonDesc } from "./helpers";
import { apaPlayerToPlayer, apaTeamToTeam } from "./types";

export const handlePlayerSearch = async (
  playerName: string,
  apaClient: IAPAClient,
): Promise<any | null> => {
  const apaPlayer = await apaClient.searchForPlayer(playerName);
  const player = apaPlayerToPlayer(apaPlayer);

  if (!player) {
    return null;
  }

  const teams = await apaClient.getTeamsForPlayer(player.memberNumber);

  return {
    player,
    teams: sortTeamsBySeasonDesc(teams.map(apaTeamToTeam)),
  };
};
