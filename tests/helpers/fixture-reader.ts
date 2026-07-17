import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { IAPAClient } from "../../src/apa/apa-client.interface";
import type {
  Match,
  MatchDetails,
  Player,
  PlayerTeam,
} from "../../src/apa/types";

/**
 * IAPAClient that replays fixtures recorded by scripts/record-fixtures.ts.
 * Files live under tests/fixtures/<slug>/ and are keyed by call args.
 */
export class FixtureAPAClient implements IAPAClient {
  constructor(private fixtureDir: string) {}

  async searchForPlayer(playerName: string): Promise<Player | null> {
    const path = join(
      this.fixtureDir,
      `searchForPlayer_${slug(playerName)}.json`,
    );
    return readJson<Player | null>(path);
  }

  async getTeamsForPlayer(memberId: string): Promise<PlayerTeam[]> {
    const path = join(this.fixtureDir, `getTeamsForPlayer_${memberId}.json`);
    return readJson<PlayerTeam[]>(path);
  }

  async getMatchesForTeam(teamId: string): Promise<Match[]> {
    const path = join(this.fixtureDir, `getMatchesForTeam_${teamId}.json`);
    return readJson<Match[]>(path);
  }

  async getMatchDetails(scheduleId: string): Promise<MatchDetails> {
    const path = join(this.fixtureDir, `getMatchDetails_${scheduleId}.json`);
    return readJson<MatchDetails>(path);
  }
}

function readJson<T>(path: string): T {
  if (!existsSync(path)) {
    throw new Error(
      `Fixture missing: ${path}\nRun: npm run test:record -- <memberId> <slug>`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function slug(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
