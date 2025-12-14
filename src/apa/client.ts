import type {
  AliasResponse,
  AuthorizeResponse,
  GraphQLError,
  GraphQLResponse,
  LoginResponse,
  Match,
  MatchDetails,
  MatchResponse,
  Player,
  PlayerTeam,
  SearchResponse,
  TeamScheduleResponse,
  TokenResponse,
} from "./types";

export class APAClient {
  private username: string;
  private password: string;

  private currentAuthToken: string | null = null;
  private deviceRefreshToken: string | null = null;

  private isTokenExpiredError(error: GraphQLError): boolean {
    return (
      error.message === "Login session has expired" ||
      error.extensions?.code === "TOKEN_EXPIRED"
    );
  }

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  async login(username: string, password: string): Promise<string> {
    const loginQuery = `mutation login($username: String!, $password: String!) {
  login(input: {username: $username, password: $password}) {
    __typename
    ... on SuccessLoginPayload {
      deviceRefreshToken
      __typename
    }
    ... on PartialSuspendedLoginPayload {
      leagueIds
      deviceRefreshToken
      __typename
    }
    ... on DeniedLoginPayload {
      reason
      __typename
    }
  }
}`;

    const loginResponse = await fetch("https://gql.poolplayers.com/graphql", {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "apollographql-client-name": "MemberServices",
        "apollographql-client-version": "3.18.37-3511",
        "content-type": "application/json",
        priority: "u=1, i",
        "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        referer: "https://league.poolplayers.com/",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        dnt: "1",
        origin: "https://league.poolplayers.com/",
      },
      body: JSON.stringify({
        operationName: "login",
        variables: { username, password },
        query: loginQuery,
      }),
    });

    const loginData =
      (await loginResponse.json()) as GraphQLResponse<LoginResponse>;

    if (loginData.errors) {
      console.error("Login errors:", loginData.errors);
      throw new Error(`Login error: ${loginData.errors[0].message}`);
    }

    if (!loginData.data || !loginData.data.login) {
      throw new Error("No login data returned");
    }

    const loginResult = loginData.data.login;

    if (loginResult.__typename === "DeniedLoginPayload") {
      throw new Error(`Login denied: ${loginResult.reason}`);
    }

    if (!loginResult.deviceRefreshToken) {
      throw new Error("No device refresh token returned from login");
    }

    const authorizeQuery = `mutation authorize($deviceRefreshToken: String!) {
  authorize(deviceRefreshToken: $deviceRefreshToken) {
    refreshToken
    __typename
  }
}`;

    const authorizeResponse = await fetch(
      "https://gql.poolplayers.com/graphql",
      {
        method: "POST",
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9",
          "apollographql-client-name": "MemberServices",
          "apollographql-client-version": "3.18.37-3511",
          "content-type": "application/json",
          priority: "u=1, i",
          "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          referer: "https://league.poolplayers.com/",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
          dnt: "1",
          origin: "https://league.poolplayers.com/",
        },
        body: JSON.stringify({
          operationName: "authorize",
          variables: { deviceRefreshToken: loginResult.deviceRefreshToken },
          query: authorizeQuery,
        }),
      },
    );

    const authorizeData =
      (await authorizeResponse.json()) as GraphQLResponse<AuthorizeResponse>;

    if (authorizeData.errors) {
      console.error("Authorize errors:", authorizeData.errors);
      throw new Error(`Authorize error: ${authorizeData.errors[0].message}`);
    }

    if (!authorizeData.data || !authorizeData.data.authorize) {
      throw new Error("No authorize data returned");
    }

    this.deviceRefreshToken = authorizeData.data.authorize.refreshToken;
    const accessToken = await this.generateAccessToken();

    return accessToken;
  }

  private async generateAccessToken(): Promise<string> {
    if (!this.deviceRefreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await fetch("https://gql.poolplayers.com/graphql", {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "apollographql-client-name": "MemberServices",
        "apollographql-client-version": "3.18.37-3511",
        "content-type": "application/json",
        priority: "u=1, i",
        "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        referer: "https://league.poolplayers.com/",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        dnt: "1",
        origin: "https://league.poolplayers.com/",
      },
      body: JSON.stringify([
        {
          operationName: "GenerateAccessTokenMutation",
          variables: {
            refreshToken: this.deviceRefreshToken,
          },
          query:
            "mutation GenerateAccessTokenMutation($refreshToken: String!) {\n  generateAccessToken(refreshToken: $refreshToken) {\n    accessToken\n    __typename\n  }\n}\n",
        },
      ]),
    });

    const data = (await response.json()) as GraphQLResponse<TokenResponse>[];

    if (data[0].errors) {
      console.error("Token generation errors:", data[0].errors);

      // Check if refresh token is also expired
      const isTokenExpired = data[0].errors.some((error) =>
        this.isTokenExpiredError(error),
      );

      if (isTokenExpired) {
        console.log("Refresh token expired, need to re-login");
        // Clear tokens to force re-login
        this.currentAuthToken = null;
        this.deviceRefreshToken = null;
        throw new Error("Refresh token expired");
      }

      throw new Error(`Token generation error: ${data[0].errors[0].message}`);
    }

    if (!data[0].data || !data[0].data.generateAccessToken) {
      throw new Error("No access token returned from GraphQL query");
    }

    this.currentAuthToken = data[0].data.generateAccessToken.accessToken;
    return this.currentAuthToken;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.currentAuthToken) {
      try {
        await this.generateAccessToken();
      } catch (error) {
        console.warn("Error generating access token:", error);
        try {
          console.log("Attempting to login again");
          await this.login(this.username, this.password);
        } catch (error) {
          console.error("Error logging in:", error);
          throw new Error("Error logging in");
        }
      }
    }

    if (!this.currentAuthToken) {
      throw new Error("No auth token available");
    }

    return {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "apollographql-client-name": "MemberServices",
      "apollographql-client-version": "3.18.37-3511",
      authorization: this.currentAuthToken,
      "content-type": "application/json",
      priority: "u=1, i",
      "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      referer: "https://league.poolplayers.com/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      dnt: "1",
      origin: "https://league.poolplayers.com/",
    };
  }

  private async makeGraphQLRequest<T>(
    query: string,
    variables: any,
    operationName?: string,
    retryCount: number = 0,
  ): Promise<T> {
    const headers = await this.getAuthHeaders();

    const requestBody = [
      {
        operationName:
          operationName || query.split("(")[0].split(" ").pop() || "Query",
        variables,
        query,
      },
    ];

    const response = await fetch("https://gql.poolplayers.com/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    const data = (await response.json()) as GraphQLResponse<T>[];

    if (data[0].errors) {
      console.error("GraphQL errors:", data[0].errors);

      // Check if this is a token expiration error
      const isTokenExpired = data[0].errors.some((error) =>
        this.isTokenExpiredError(error),
      );

      if (isTokenExpired && retryCount === 0) {
        console.log("Token expired, attempting to re-login...");

        // Clear current tokens
        this.currentAuthToken = null;
        this.deviceRefreshToken = null;

        // Re-login
        try {
          await this.login(this.username, this.password);
          console.log("Re-login successful, retrying request...");

          // Retry the request once
          return this.makeGraphQLRequest(
            query,
            variables,
            operationName,
            retryCount + 1,
          );
        } catch (loginError) {
          console.error("Re-login failed:", loginError);
          throw new Error(
            `Re-login failed: ${loginError instanceof Error ? loginError.message : "Unknown error"}`,
          );
        }
              }

      throw new Error(`GraphQL error: ${data[0].errors[0].message}`);
    }

    if (!data[0].data) {
      throw new Error("No data returned from GraphQL query");
    }

    return data[0].data;
  }

  async searchForPlayer(playerName: string): Promise<Player | null> {
    const query = `query Search($query: String!) {
  search(query: $query) {
    suggestions
    hits {
      __typename
      ... on Team {
        id
        name
        number
        session {
          id
          name
          __typename
        }
        division {
          id
          name
          type
          format
          __typename
        }
        league {
          id
          name
          slug
          __typename
        }
        __typename
      }
      ... on Member {
        id
        firstName
        lastName
        city
        aliases {
          id
          nickname
          memberNumber
          __typename
        }
        stateProvince {
          id
          name
          __typename
        }
        __typename
      }
      ... on Division {
        id
        name
        number
        type
        format
        isMine
        session {
          id
          name
          __typename
        }
        league {
          id
          name
          slug
          __typename
        }
        __typename
      }
      ... on League {
        id
        slug
        name
        metroArea
        contacts(role: LO, status: ACTIVE) {
          displayName
          __typename
        }
        __typename
      }
      ... on HostLocation {
        id
        name
        league {
          id
          name
          __typename
        }
        __typename
      }
    }
    __typename
  }
}`;

    const variables = { query: playerName };
    const data = await this.makeGraphQLRequest<SearchResponse>(
      query,
      variables,
      "Search",
    );

    const searchResults = data.search.hits;
    if (searchResults.length === 0) {
      return null;
    }
    if (searchResults.length > 1) {
      return null;
    }

    const apaPlayer = searchResults[0];
    if (apaPlayer.__typename !== "Member") {
      return null;
    }

    return apaPlayer as Player;
  }

  async getTeamsForPlayer(memberId: string): Promise<PlayerTeam[]> {
    console.log(`[getTeamsForPlayer] Starting for memberId: ${memberId}`);
    const allTeams: PlayerTeam[] = [];
    let offset = 0;
    const limit = 10;
    let hasMoreTeams = true;
    let iteration = 0;
    let isFirstIteration = true;

    while (hasMoreTeams) {
      iteration++;
      console.log(
        `[getTeamsForPlayer] Iteration ${iteration}: offset=${offset}, limit=${limit}`,
      );
      const query = `query TeamStat($id: Int!, $limit: Int!, $offset: Int!) {
          alias(id: $id) {
            id
            pastTeams: players(current: false, active: null, limit: $limit, offset: $offset) {
              id
              ...EightBallTeam
              ...NineBallTeam
              ...MastersTeam
              __typename
            }
            currentTeams: players(current: true, active: null) {
              id
              ...EightBallTeam
              ...NineBallTeam
              ...MastersTeam
              __typename
            }
            __typename
          }
        }
        
        fragment NineBallTeam on NineBallPlayer {
          id
          isActive
          role
          rosterPosition
          nickName
          matchesPlayed
          matchesWon
          session {
            id
            name
            __typename
          }
          skillLevel
          rank
          team {
            id
            name
            division {
              id
              isTournament
              __typename
            }
            __typename
          }
          __typename
        }
        
        fragment EightBallTeam on EightBallPlayer {
          id
          isActive
          role
          rosterPosition
          nickName
          matchesPlayed
          matchesWon
          session {
            id
            name
            __typename
          }
          skillLevel
          rank
          team {
            id
            name
            division {
              id
              isTournament
              __typename
            }
            __typename
          }
          __typename
        }
        
        fragment MastersTeam on MastersPlayer {
          id
          isActive
          role
          rosterPosition
          nickName
          matchesPlayed
          matchesWon
          session {
            id
            name
            __typename
          }
          team {
            id
            name
            division {
              id
              isTournament
              __typename
            }
            __typename
          }
          __typename
        }`;

      const data = await this.makeGraphQLRequest<AliasResponse>(
        query,
        {
          id: parseInt(memberId),
          limit,
          offset,
        },
        "TeamStat",
      );

      const pastTeams = data.alias.pastTeams;
      const currentTeams = data.alias.currentTeams;

      console.log(
        `[getTeamsForPlayer] Iteration ${iteration} response: pastTeams=${pastTeams.length}, currentTeams=${currentTeams.length}`,
      );

      // Log past teams details
      pastTeams.forEach((team) => {
        const teamName = team.team?.name || "Unknown";
        const season = team.session?.name || "Unknown";
        const typename = team.__typename || "Unknown";
        console.log(
          `[getTeamsForPlayer] Past team: "${teamName}" - Season: ${season} - Type: ${typename}`,
        );
      });

      allTeams.push(...pastTeams);

      // Add current teams only on the first iteration (they're fetched every time but only needed once)
      if (isFirstIteration) {
        console.log(
          `[getTeamsForPlayer] First iteration: adding ${currentTeams.length} current teams`,
        );
        // Log current teams details
        currentTeams.forEach((team) => {
          const teamName = team.team?.name || "Unknown";
          const season = team.session?.name || "Unknown";
          const typename = team.__typename || "Unknown";
          console.log(
            `[getTeamsForPlayer] Current team: "${teamName}" - Season: ${season} - Type: ${typename}`,
          );
        });
        allTeams.push(...currentTeams);
        isFirstIteration = false;
      }

      if (pastTeams.length < limit) {
        console.log(
          `[getTeamsForPlayer] Iteration ${iteration}: pastTeams.length (${pastTeams.length}) < limit (${limit}), stopping pagination`,
        );
        hasMoreTeams = false;
      } else {
        console.log(
          `[getTeamsForPlayer] Iteration ${iteration}: pastTeams.length (${pastTeams.length}) >= limit (${limit}), continuing pagination`,
        );
        offset += limit;
      }
    }

    const filteredTeams = allTeams.filter(
      (t) => t.__typename === "EightBallPlayer",
    );
    console.log(
      `[getTeamsForPlayer] Complete: total teams collected=${allTeams.length}, filtered to EightBallPlayer=${filteredTeams.length}`,
    );
    return filteredTeams;
  }

  async getMatchesForTeam(teamId: string): Promise<Match[]> {
    const query = `query teamSchedule($id: Int!) {
        team(id: $id) {
          id
          sessionBonusPoints
          sessionPoints
          sessionTotalPoints
          division {
            id
            isTournament
            __typename
          }
          matches(unscheduled: true) {
            id
            week
            type
            startTime
            isBye
            status
            scoresheet
            isMine
            isPaid
            isScored
            isFinalized
            isPlayoff
            description
            location {
              id
              name
              __typename
            }
            home {
              id
              name
              number
              isMine
              __typename
            }
            away {
              id
              name
              number
              isMine
              __typename
            }
            __typename
          }
          __typename
        }
      }`;

    const data = await this.makeGraphQLRequest<TeamScheduleResponse>(
      query,
      { id: parseInt(teamId) },
      "teamSchedule",
    );

    // bye weeks have no id
    // unplayed matches have UNPLAYED status
    return data.team.matches
      .filter((m) => m.id != null)
      .filter((m) => m.status !== "UNPLAYED");
  }

  async getMatchDetails(scheduleId: string): Promise<MatchDetails> {
    const query = `query MatchPage($id: Int!) {
        match(id: $id) {
          id
          startTime
          location {
            id
            name
            __typename
          }
          home {
            id
            name
            __typename
          }
          away {
            id
            name
            __typename
          }
          results {
            homeAway
            matchesWon
            matchesPlayed
            points {
              total
              __typename
            }
            scores {
              id
              player {
                id
                displayName
                __typename
              }
              matchPositionNumber
              playerPosition
              skillLevel
              innings
              defensiveShots
              eightBallWins
              eightOnBreak
              eightBallBreakAndRun
              nineBallPoints
              nineOnSnap
              nineBallBreakAndRun
              nineBallMatchPointsEarned
              mastersEightBallWins
              mastersNineBallWins
              winLoss
              matchForfeited
              doublesMatch
              dateTimeStamp
              teamSlot
              eightBallMatchPointsEarned
              incompleteMatch
              __typename
            }
            __typename
          }
          __typename
        }
      }`;

    const data = await this.makeGraphQLRequest<MatchResponse>(
      query,
      { id: parseInt(scheduleId) },
      "MatchPage",
    );
    return data.match;
  }
}
