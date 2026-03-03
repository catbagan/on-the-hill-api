import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { APAClient } from "./apa/client";
import type { TokenStore } from "./apa/token-store";
import { SupabaseDataReader } from "./data/supabase-reader";
import {
  authMiddleware,
  getSupabase,
  supabaseMiddleware,
} from "./middleware/auth.middleware";
import {
  createRateLimitMiddleware,
  InMemoryRateLimitStore,
  type RateLimitStore,
} from "./middleware/rate-limit";
import { handlePlayerSearch } from "./player-search";
import { handleReportGet } from "./report-get";
import { INDEX_HTML, PRIVACY_POLICY_HTML } from "./static-pages";
import {
  handleWrappedGet,
  handleWrappedSeasonGet,
  handleWrappedYearGet,
} from "./wrapped-get";

// Enhanced error logging
function logError(
  err: Error,
  context: {
    endpoint?: string;
    userId?: string;
    memberId?: string;
    requestId?: string;
    [key: string]: any;
  },
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: "ERROR",
    error: {
      message: err.message,
      name: err.name,
    },
    context,
  };
  console.error(JSON.stringify(logEntry));
}

// Enhanced request logging
function logRequest(
  event: string,
  context: {
    endpoint?: string;
    userId?: string;
    memberId?: string;
    requestId?: string;
    [key: string]: any;
  },
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: "INFO",
    event,
    context,
  };
  console.log(JSON.stringify(logEntry));
}

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  apaUsername: string;
  apaPassword: string;
  nodeEnv?: string;
  rateLimitStore?: RateLimitStore;
  tokenStore?: TokenStore;
}

export function createApp(config: AppConfig) {
  const rateLimitStore = config.rateLimitStore || new InMemoryRateLimitStore();
  const nodeEnv = config.nodeEnv || "development";

  const apaClient = new APAClient(
    config.apaUsername,
    config.apaPassword,
    config.tokenStore,
  );

  // Supabase service role client for reading scraped data
  const serviceSupabase = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
  );
  const dataReader = new SupabaseDataReader(serviceSupabase, apaClient);

  // Website app (serves static HTML pages)
  const websiteApp = new Hono();

  websiteApp.get("/", (c) => {
    return c.html(INDEX_HTML);
  });

  websiteApp.get("/privacy-policy", (c) => {
    return c.html(PRIVACY_POLICY_HTML);
  });

  // API app (routes will be mounted at /api)
  const app = new Hono();

  app.use("*", logger());

  // Security headers middleware
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "1; mode=block");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    if (nodeEnv === "production") {
      c.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }
  });

  // Request ID middleware for tracing
  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.header("X-Request-ID", requestId);
    c.set("requestId", requestId);
    await next();
  });

  app.use("*", createRateLimitMiddleware(rateLimitStore));
  app.use(
    "*",
    cors({
      origin: (origin, _) => {
        const allowedOrigins =
          nodeEnv === "production"
            ? ["https://onthehill.app"]
            : ["http://localhost:3000", "http://localhost:5173"];

        // Allow requests with no origin (same-origin, Postman, etc.)
        if (!origin) {
          return origin;
        }

        // Only allow explicitly listed origins
        if (allowedOrigins.includes(origin)) {
          return origin;
        }

        // Reject unauthorized origins by returning null
        return null;
      },
      credentials: true,
    }),
  );
  app.use("*", supabaseMiddleware());

  app.onError((err, c) => {
    const userId = c.get("userId") as string | undefined;
    const requestId = c.get("requestId") as string | undefined;
    const memberId = c.req.header("x-member-id") || undefined;

    logError(err, {
      endpoint: c.req.path,
      method: c.req.method,
      userId,
      memberId,
      requestId,
    });

    return c.json(
      {
        error: nodeEnv === "production" ? "Internal server error" : err.message,
      },
      500,
    );
  });

  app.get("/", (c) => {
    return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>On The Hill API</title>
</head>
<body>
    <h1>On The Hill API</h1>
</body>
</html>
  `);
  });

  app.get("/health", (c) => {
    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "0.0.1",
      runtime: typeof globalThis.process !== "undefined" ? "node" : "worker",
    });
  });

  // Analytics endpoint for frontend events
  app.post("/analytics/track", authMiddleware(), async (c) => {
    const userId = c.get("userId");
    const requestId = c.get("requestId") as string | undefined;

    try {
      const body = await c.req.json();

      // Validate required fields
      if (!body.event) {
        return c.json(
          {
            error:
              "event is required (e.g., 'page_view', 'button_click', 'feature_used')",
          },
          400,
        );
      }

      if (typeof body.event !== "string" || body.event.trim().length === 0) {
        return c.json(
          {
            error: "event must be a non-empty string",
          },
          400,
        );
      }

      // Extract event data
      const eventName = body.event.trim();
      const properties = body.properties || {};
      const timestamp = body.timestamp || new Date().toISOString();

      // Log analytics event
      logRequest("analytics_event", {
        endpoint: "/analytics/track",
        userId,
        requestId,
        event: eventName,
        properties,
        timestamp,
      });

      return c.json({
        success: true,
        event: eventName,
      });
    } catch (error) {
      if (error instanceof Error) {
        logError(error, {
          endpoint: "/analytics/track",
          userId,
          requestId,
        });
        return c.json({ error: error.message }, 400);
      }
      logError(new Error("Unknown error"), {
        endpoint: "/analytics/track",
        userId,
        requestId,
      });
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.post("/auth/signup", async (c) => {
    try {
      const body = await c.req.json();
      const { email, password, givenName, familyName } = body;

      if (!email || !password || !givenName || !familyName) {
        return c.json(
          {
            error: "email, password, givenName, and familyName are required",
          },
          400,
        );
      }

      if (email.length < 3 || password.length < 6) {
        return c.json(
          {
            error:
              "Username must be at least 3 characters and password at least 6 characters",
          },
          400,
        );
      }

      const supabase = getSupabase(c);

      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            given_name: givenName,
            family_name: familyName,
          },
        },
      });

      if (error) {
        return c.json(
          {
            error: error.message,
          },
          400,
        );
      }

      return c.json({
        message: "User registered successfully",
        user: {
          id: data.user?.id,
          email: email,
          givenName: givenName,
          familyName: familyName,
        },
      });
    } catch (error) {
      console.error("Signup error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.post("/auth/signin", async (c) => {
    try {
      const body = await c.req.json();
      const { email, password } = body;

      if (!email || !password) {
        return c.json(
          {
            error: "email and password are required",
          },
          400,
        );
      }

      const supabase = getSupabase(c);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        return c.json(
          {
            error: "Invalid username or password",
          },
          401,
        );
      }

      return c.json({
        message: "Signed in successfully",
        user: {
          id: data.user?.id,
          email: email,
          givenName: data.session?.user.user_metadata.given_name,
          familyName: data.user?.user_metadata.family_name,
        },
      });
    } catch (error) {
      console.error("Signin error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.post("/auth/signout", async (c) => {
    try {
      const supabase = getSupabase(c);

      const { error } = await supabase.auth.signOut();

      if (error) {
        return c.json(
          {
            error: error.message,
          },
          500,
        );
      }

      return c.json({
        message: "Signed out successfully",
      });
    } catch (error) {
      console.error("Signout error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.post("/auth/delete", authMiddleware(), async (c) => {
    try {
      const supabase = getSupabase(c);

      // Get the current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return c.json(
          {
            error: "User not found",
          },
          404,
        );
      }

      // Create a service role client for admin operations
      const supabaseAdminAuth = createServerClient(
        config.supabaseUrl,
        config.supabaseServiceRoleKey,
        {
          cookies: {
            getAll() {
              return [];
            },
            setAll() {
              // No-op for server-side operations
            },
          },
        },
      );

      // Delete the user account using the service role client
      const { error: deleteError } =
        await supabaseAdminAuth.auth.admin.deleteUser(user.id);

      if (deleteError) {
        console.error("Delete account error:", deleteError);
        return c.json(
          {
            error: "Failed to delete account. Please contact support.",
          },
          500,
        );
      }

      return c.json({
        message: "Account deleted successfully",
      });
    } catch (error) {
      console.error("Delete account error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.get("/auth/account", authMiddleware(), async (c) => {
    try {
      const supabase = getSupabase(c);

      // Get the current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return c.json(
          {
            error: "User not found",
          },
          404,
        );
      }

      return c.json({
        user: {
          id: user.id,
          email: user.email,
          givenName: user.user_metadata?.given_name,
          familyName: user.user_metadata?.family_name,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      });
    } catch (error) {
      console.error("Get account error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.post("/player/search", authMiddleware(), async (c) => {
    try {
      const body = await c.req.json();
      if (!body.name) {
        return c.json(
          {
            error: "name is required in request body",
          },
          400,
        );
      }

      if (typeof body.name !== "string" || body.name.trim().length < 2) {
        return c.json(
          {
            error: "name must be a string with at least 2 characters",
          },
          400,
        );
      }

      const player = await handlePlayerSearch(body.name.trim(), dataReader);

      if (!player) {
        return c.json(
          {
            error: "No player found",
          },
          404,
        );
      }

      return c.json(player);
    } catch (error) {
      console.error("Player search error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.post("/report/get", authMiddleware(), async (c) => {
    const startTime = Date.now();
    const userId = c.get("userId");
    const requestId = c.get("requestId") as string | undefined;
    let memberId: string | undefined;

    try {
      const body = await c.req.json();
      memberId = body.memberId?.trim();

      if (!memberId) {
        return c.json(
          {
            error: "memberId is required in request body",
          },
          400,
        );
      }

      if (typeof memberId !== "string" || memberId.length === 0) {
        return c.json(
          {
            error: "memberId must be a non-empty string",
          },
          400,
        );
      }

      // Validate seasons if provided
      let seasons: string[] | undefined;
      if (body.seasons !== undefined) {
        if (!Array.isArray(body.seasons)) {
          return c.json(
            {
              error:
                "seasons must be an array of strings (e.g., ['Spring 2025', 'Fall 2025'])",
            },
            400,
          );
        }
        if (body.seasons.length > 0) {
          const invalidSeasons = body.seasons.filter(
            (s: any) => typeof s !== "string" || !s.match(/^\w+\s+\d+$/),
          );
          if (invalidSeasons.length > 0) {
            return c.json(
              {
                error: `Invalid season format. Seasons must be in format 'Season Year' (e.g., 'Spring 2025'). Invalid: ${invalidSeasons.join(", ")}`,
              },
              400,
            );
          }
          seasons = body.seasons;
        }
      }

      // Validate gameType if provided
      const gameType = body.gameType;
      if (gameType && gameType !== "EIGHT_BALL" && gameType !== "NINE_BALL") {
        return c.json(
          {
            error:
              "gameType must be 'EIGHT_BALL' or 'NINE_BALL'",
          },
          400,
        );
      }

      logRequest("report_get_start", {
        endpoint: "/report/get",
        userId,
        memberId,
        requestId,
        seasons,
        gameType,
      });

      const report = await handleReportGet(
        memberId,
        dataReader,
        seasons,
        gameType,
      );

      const processingTime = Date.now() - startTime;
      logRequest("report_get_success", {
        endpoint: "/report/get",
        userId,
        memberId,
        requestId,
        processingTimeMs: processingTime,
        totalMatches: report.totalMatches,
      });

      return c.json(report);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      if (error instanceof Error) {
        logError(error, {
          endpoint: "/report/get",
          userId,
          memberId,
          requestId,
          processingTimeMs: processingTime,
        });
        return c.json({ error: error.message }, 400);
      }
      logError(new Error("Unknown error"), {
        endpoint: "/report/get",
        userId,
        memberId,
        requestId,
        processingTimeMs: processingTime,
      });
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.post("/wrapped/get", authMiddleware(), async (c) => {
    const startTime = Date.now();
    const userId = c.get("userId");
    const requestId = c.get("requestId") as string | undefined;
    let memberId: string | undefined;

    try {
      const body = await c.req.json();
      memberId = body.memberId?.trim();

      if (!memberId) {
        return c.json(
          {
            error: "memberId is required in request body",
          },
          400,
        );
      }

      if (typeof memberId !== "string" || memberId.length === 0) {
        return c.json(
          {
            error: "memberId must be a non-empty string",
          },
          400,
        );
      }

      logRequest("wrapped_get_start", {
        endpoint: "/wrapped/get",
        userId,
        memberId,
        requestId,
      });

      const wrapped = await handleWrappedGet(memberId, dataReader);

      const processingTime = Date.now() - startTime;
      logRequest("wrapped_get_success", {
        endpoint: "/wrapped/get",
        userId,
        memberId,
        requestId,
        processingTimeMs: processingTime,
        matchCount:
          wrapped.slides[0]?.type === "welcome"
            ? wrapped.slides[0].totalGames
            : undefined,
      });

      return c.json(wrapped);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      if (error instanceof Error) {
        logError(error, {
          endpoint: "/wrapped/get",
          userId,
          memberId,
          requestId,
          processingTimeMs: processingTime,
        });
        return c.json({ error: error.message }, 400);
      }
      logError(new Error("Unknown error"), {
        endpoint: "/wrapped/get",
        userId,
        memberId,
        requestId,
        processingTimeMs: processingTime,
      });
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.post("/wrapped/season/get", authMiddleware(), async (c) => {
    const startTime = Date.now();
    const userId = c.get("userId");
    const requestId = c.get("requestId") as string | undefined;
    let memberId: string | undefined;
    let season: string | undefined;

    try {
      const body = await c.req.json();
      memberId = body.memberId?.trim();
      season = body.season?.trim();

      if (!memberId) {
        return c.json(
          {
            error: "memberId is required in request body",
          },
          400,
        );
      }

      if (!season) {
        return c.json(
          {
            error: "season is required in request body (e.g., 'Fall 2025')",
          },
          400,
        );
      }

      if (typeof memberId !== "string" || memberId.length === 0) {
        return c.json(
          {
            error: "memberId must be a non-empty string",
          },
          400,
        );
      }

      if (typeof season !== "string" || season.length === 0) {
        return c.json(
          {
            error: "season must be a non-empty string (e.g., 'Fall 2025')",
          },
          400,
        );
      }

      logRequest("wrapped_season_get_start", {
        endpoint: "/wrapped/season/get",
        userId,
        memberId,
        requestId,
        season,
      });

      const wrapped = await handleWrappedSeasonGet(
        memberId,
        dataReader,
        season,
      );

      const processingTime = Date.now() - startTime;
      logRequest("wrapped_season_get_success", {
        endpoint: "/wrapped/season/get",
        userId,
        memberId,
        requestId,
        season,
        processingTimeMs: processingTime,
        matchCount:
          wrapped.slides[0]?.type === "welcome"
            ? wrapped.slides[0].totalGames
            : undefined,
      });

      return c.json(wrapped);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      if (error instanceof Error) {
        logError(error, {
          endpoint: "/wrapped/season/get",
          userId,
          memberId,
          requestId,
          season,
          processingTimeMs: processingTime,
        });
        return c.json({ error: error.message }, 400);
      }
      logError(new Error("Unknown error"), {
        endpoint: "/wrapped/season/get",
        userId,
        memberId,
        requestId,
        season,
        processingTimeMs: processingTime,
      });
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.post("/wrapped/year/get", authMiddleware(), async (c) => {
    const startTime = Date.now();
    const userId = c.get("userId");
    const requestId = c.get("requestId") as string | undefined;
    let memberId: string | undefined;
    let year: number | undefined;

    try {
      const body = await c.req.json();
      memberId = body.memberId?.trim();

      if (!memberId) {
        return c.json(
          {
            error: "memberId is required in request body",
          },
          400,
        );
      }

      if (!body.year) {
        return c.json(
          {
            error: "year is required in request body (e.g., 2025)",
          },
          400,
        );
      }

      if (typeof memberId !== "string" || memberId.length === 0) {
        return c.json(
          {
            error: "memberId must be a non-empty string",
          },
          400,
        );
      }

      const parsedYear =
        typeof body.year === "number" ? body.year : parseInt(body.year, 10);
      if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        return c.json(
          {
            error: "year must be a valid year (e.g., 2025)",
          },
          400,
        );
      }
      year = parsedYear;

      logRequest("wrapped_year_get_start", {
        endpoint: "/wrapped/year/get",
        userId,
        memberId,
        requestId,
        year: parsedYear,
      });

      const wrapped = await handleWrappedYearGet(
        memberId,
        dataReader,
        parsedYear,
      );

      const processingTime = Date.now() - startTime;
      logRequest("wrapped_year_get_success", {
        endpoint: "/wrapped/year/get",
        userId,
        memberId,
        requestId,
        year,
        processingTimeMs: processingTime,
        matchCount:
          wrapped.slides[0]?.type === "welcome"
            ? wrapped.slides[0].totalGames
            : undefined,
      });

      return c.json(wrapped);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      if (error instanceof Error) {
        logError(error, {
          endpoint: "/wrapped/year/get",
          userId,
          memberId,
          requestId,
          year,
          processingTimeMs: processingTime,
        });
        return c.json({ error: error.message }, 400);
      }
      logError(new Error("Unknown error"), {
        endpoint: "/wrapped/year/get",
        userId,
        memberId,
        requestId,
        year,
        processingTimeMs: processingTime,
      });
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // Main app that routes to website or API
  const mainApp = new Hono();
  mainApp.route("/", websiteApp);
  // Mount API app at /api - basePath is already applied to routes
  mainApp.route("/api", app);

  return mainApp;
} // end createApp
