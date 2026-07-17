import { existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { handleReportGet } from "../src/report-get";
import { FixtureAPAClient } from "./helpers/fixture-reader";

const FIXTURE_DIR = join(__dirname, "fixtures", "daniel-catbagan");
const MEMBER_ID = "3209723";

const fixturesRecorded = existsSync(
  join(FIXTURE_DIR, `getTeamsForPlayer_${MEMBER_ID}.json`),
);

const describeIfRecorded = fixturesRecorded ? describe : describe.skip;

describeIfRecorded("handleReportGet — Daniel Catbagan", () => {
  const client = new FixtureAPAClient(FIXTURE_DIR);

  it("returns a report for 8-ball", async () => {
    const { report, teams } = await handleReportGet(
      MEMBER_ID,
      client,
      undefined,
      "EIGHT_BALL",
    );

    expect(teams.length).toBeGreaterThan(0);
    expect(teams.every((t: any) => t.type === "EIGHT_BALL")).toBe(true);
    assertReportShape(report);
    expect(report.totalMatches).toBeGreaterThan(0);
  });

  it("returns a report for 9-ball (regression: ID coercion)", async () => {
    // Before the String() coercion fix, 9-ball matches were silently
    // dropped because playerMatch.homePlayerStats.id was sometimes numeric
    // and playerIdByTeam[team.id] was sometimes a string. This test locks
    // that in: 9-ball must return a non-zero report.
    const { report, teams } = await handleReportGet(
      MEMBER_ID,
      client,
      undefined,
      "NINE_BALL",
    );

    expect(teams.length).toBeGreaterThan(0);
    expect(teams.every((t: any) => t.type === "NINE_BALL")).toBe(true);
    assertReportShape(report);
    expect(report.totalMatches).toBeGreaterThan(0);
  });

  it("no-filter total equals 8-ball total + 9-ball total", async () => {
    // Sanity: game-type filter partitions matches — nothing should be
    // silently dropped or double-counted between EIGHT_BALL and NINE_BALL.
    // Only holds if the player has no other game types (Masters, etc.).
    // If this ever fails, either that assumption changed or the filter
    // is broken again.
    const [all, eight, nine] = await Promise.all([
      handleReportGet(MEMBER_ID, client),
      handleReportGet(MEMBER_ID, client, undefined, "EIGHT_BALL"),
      handleReportGet(MEMBER_ID, client, undefined, "NINE_BALL"),
    ]);

    expect(all.report.totalMatches).toBe(
      eight.report.totalMatches + nine.report.totalMatches,
    );
    expect(all.report.overallWins).toBe(
      eight.report.overallWins + nine.report.overallWins,
    );
    expect(all.report.overallLosses).toBe(
      eight.report.overallLosses + nine.report.overallLosses,
    );
  });
});

function assertReportShape(report: any) {
  expect(report).toMatchObject({
    id: expect.any(String),
    overallWins: expect.any(Number),
    overallLosses: expect.any(Number),
    totalMatches: expect.any(Number),
    totalTeams: expect.any(Number),
    bySession: expect.any(Object),
    headToHead: expect.any(Object),
    byPosition: expect.any(Object),
    byLocation: expect.any(Object),
    scoreDistribution: expect.any(Object),
    bySkillDifference: expect.any(Object),
    byOpponentSkill: expect.any(Object),
    byMySkill: expect.any(Object),
    byInnings: expect.any(Object),
    byTeamSituation: expect.any(Object),
    currentStreak: expect.any(Number),
    longestWinStreak: expect.objectContaining({
      count: expect.any(Number),
      season: expect.any(String),
    }),
    longestLossStreak: expect.objectContaining({
      count: expect.any(Number),
      season: expect.any(String),
    }),
    last3Matches: expect.objectContaining({
      wins: expect.any(Number),
      losses: expect.any(Number),
    }),
    last5Matches: expect.objectContaining({
      wins: expect.any(Number),
      losses: expect.any(Number),
    }),
    last10Matches: expect.objectContaining({
      wins: expect.any(Number),
      losses: expect.any(Number),
    }),
    trending: expect.any(String),
  });

  // Wins + losses can't exceed total (ties/incompletes possible).
  expect(report.overallWins + report.overallLosses).toBeLessThanOrEqual(
    report.totalMatches,
  );

  // Score distribution keys should look like "N-M" with numbers.
  for (const key of Object.keys(report.scoreDistribution)) {
    expect(key).toMatch(/^\d+-\d+$/);
  }

  // The sum of counts in scoreDistribution should equal totalMatches
  // (every match contributes exactly one score).
  const scoreDistTotal = Object.values(report.scoreDistribution).reduce(
    (sum: number, count) => sum + (count as number),
    0,
  );
  expect(scoreDistTotal).toBe(report.totalMatches);

  // byPosition keys are numeric strings (JS object key coercion).
  for (const key of Object.keys(report.byPosition)) {
    expect(Number.isFinite(Number(key))).toBe(true);
  }
}

describe("handleReportGet — fixture check", () => {
  it("has recorded fixtures (run: npm run test:record -- 3209723 daniel-catbagan)", () => {
    expect(fixturesRecorded).toBe(true);
  });
});
