import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { APAClient } from "../../src/apa/client";

/**
 * Records live APA responses for a given member ID into tests/fixtures/<slug>/.
 * Usage: npm run test:record -- <memberId> <slug>
 * Example: npm run test:record -- 3209723 daniel-catbagan
 *
 * Requires APA_USERNAME + APA_PASSWORD in .env.
 */
async function main() {
  const [, , memberId, slug] = process.argv;

  if (!memberId || !slug) {
    console.error("Usage: npm run test:record -- <memberId> <slug>");
    console.error("Example: npm run test:record -- 3209723 daniel-catbagan");
    process.exit(1);
  }

  const username = process.env.APA_USERNAME;
  const password = process.env.APA_PASSWORD;
  if (!username || !password) {
    console.error("Missing APA_USERNAME or APA_PASSWORD in .env");
    process.exit(1);
  }

  const client = new APAClient(username, password);
  const outDir = join(process.cwd(), "tests", "fixtures", slug);
  mkdirSync(outDir, { recursive: true });

  console.log(`Recording fixtures for memberId=${memberId} into ${outDir}`);

  console.log(`  getTeamsForPlayer(${memberId})...`);
  const teams = await client.getTeamsForPlayer(memberId);
  write(outDir, `getTeamsForPlayer_${memberId}.json`, teams);
  console.log(`    ${teams.length} teams`);

  const teamIds = Array.from(new Set(teams.map((t) => String(t.team.id))));

  for (const teamId of teamIds) {
    console.log(`  getMatchesForTeam(${teamId})...`);
    const matches = await client.getMatchesForTeam(teamId);
    write(outDir, `getMatchesForTeam_${teamId}.json`, matches);
    console.log(`    ${matches.length} matches`);

    for (const match of matches) {
      const matchId = String(match.id);
      try {
        const details = await client.getMatchDetails(matchId);
        write(outDir, `getMatchDetails_${matchId}.json`, details);
      } catch (err) {
        console.warn(`    getMatchDetails(${matchId}) failed:`, err);
      }
    }
  }

  console.log(`Done. Fixtures written under ${outDir}`);
}

function write(dir: string, name: string, data: unknown) {
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2), "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
