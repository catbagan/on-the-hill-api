import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { APAClient } from "./apa/client";
import {
  apaMatchToMatch,
  apaMatchToPlayerMatches,
  apaTeamToTeam,
} from "./types";

const DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apaUsername = process.env.APA_USERNAME;
  const apaPassword = process.env.APA_PASSWORD;

  if (!supabaseUrl || !supabaseKey || !apaUsername || !apaPassword) {
    console.error(
      "Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APA_USERNAME, APA_PASSWORD",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const apaClient = new APAClient(apaUsername, apaPassword);

  const { data: players, error: fetchError } = await supabase
    .from("tracked_players")
    .select("*")
    .eq("scrape_enabled", true);

  if (fetchError) {
    console.error("Error fetching tracked players:", fetchError);
    process.exit(1);
  }

  if (!players || players.length === 0) {
    console.log("No tracked players to scrape.");
    process.exit(0);
  }

  console.log(`Scraping ${players.length} tracked player(s)...`);

  for (const player of players) {
    try {
      console.log(`Scraping player ${player.member_id}...`);

      const apaTeams = await apaClient.getTeamsForPlayer(player.member_id);
      await sleep(DELAY_MS);

      for (const apaTeam of apaTeams) {
        const team = apaTeamToTeam(apaTeam);

        const { data: teamSeason, error: teamError } = await supabase
          .from("player_team_seasons")
          .upsert(
            {
              tracked_player_id: player.id,
              apa_team_id: team.apaId,
              apa_player_id: apaTeam.id,
              team_name: team.name,
              game_type: team.type,
              season: team.season,
              season_year: team.seasonYear,
              skill_level: "skillLevel" in apaTeam ? apaTeam.skillLevel : null,
            },
            { onConflict: "tracked_player_id,apa_team_id" },
          )
          .select()
          .single();

        if (teamError || !teamSeason) {
          console.error(`Error upserting team ${team.apaId}:`, teamError);
          continue;
        }

        const matches = await apaClient.getMatchesForTeam(team.apaId);
        await sleep(DELAY_MS);

        for (const match of matches) {
          const details = await apaClient.getMatchDetails(match.id);
          await sleep(DELAY_MS);

          const parsedMatch = apaMatchToMatch(details);

          const { data: teamMatch, error: matchError } = await supabase
            .from("team_matches")
            .upsert(
              {
                apa_match_id: match.id,
                team_season_id: teamSeason.id,
                match_date: parsedMatch.date.toISOString(),
                location: parsedMatch.location,
                home_team_id: parsedMatch.homeTeamId,
                home_team_name: details.home?.name,
                away_team_id: parsedMatch.awayTeamId,
                away_team_name: details.away?.name,
                home_team_score: parsedMatch.homeTeamScore,
                away_team_score: parsedMatch.awayTeamScore,
              },
              { onConflict: "apa_match_id" },
            )
            .select()
            .single();

          if (matchError || !teamMatch) {
            console.error(`Error upserting match ${match.id}:`, matchError);
            continue;
          }

          const playerMatches = apaMatchToPlayerMatches(details, team.type);

          for (const pm of playerMatches) {
            const { error: pmError } = await supabase
              .from("player_matches")
              .upsert(
                {
                  team_match_id: teamMatch.id,
                  match_order: pm.matchOrder,
                  home_player_id: pm.homePlayerStats.id,
                  home_player_name: pm.homePlayerStats.name,
                  home_skill_level: pm.homePlayerStats.skillLevel,
                  home_score: pm.homePlayerStats.score,
                  home_innings: pm.homePlayerStats.innings,
                  home_defensive_shots: pm.homePlayerStats.defensiveShots,
                  home_games_won: pm.homePlayerStats.gamesWon,
                  away_player_id: pm.awayPlayerStats.id,
                  away_player_name: pm.awayPlayerStats.name,
                  away_skill_level: pm.awayPlayerStats.skillLevel,
                  away_score: pm.awayPlayerStats.score,
                  away_innings: pm.awayPlayerStats.innings,
                  away_defensive_shots: pm.awayPlayerStats.defensiveShots,
                  away_games_won: pm.awayPlayerStats.gamesWon,
                },
                { onConflict: "team_match_id,match_order" },
              );

            if (pmError) {
              console.error(`Error upserting player match:`, pmError);
            }
          }
        }
      }

      await supabase
        .from("tracked_players")
        .update({ last_scraped_at: new Date().toISOString() })
        .eq("id", player.id);

      console.log(`Done scraping player ${player.member_id}`);
    } catch (error) {
      console.error(`Error scraping player ${player.member_id}:`, error);
    }
  }

  console.log("Scraper complete.");
  process.exit(0);
}

main();
