import { APAClient } from "./apa/client";
import { Player } from "./types";

export const handlePlayerSearch = async (playerName: string, apaClient: APAClient): Promise<any | null> => {
  const player =  await apaClient.searchForPlayer(playerName);

  if (!player) {
    return null;
  }

  const teams = await apaClient.getTeamsForPlayer(player.memberNumber);

  return {
    ...player,
    teams
  }
};
