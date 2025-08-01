import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { APAClient } from "./apa/client";
import {
  authMiddleware,
  getSupabase,
  supabaseMiddleware,
} from "./middleware/auth.middleware";
import { handlePlayerSearch } from "./player-search";
import { handleReportGet } from "./report-get";

import "dotenv/config";

function validateEnvironmentVariables() {
  const requiredEnvVars = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "APA_USERNAME",
    "APA_PASSWORD",
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`,
    );
  }
}
validateEnvironmentVariables();

const apaClient = new APAClient(
  process.env.APA_USERNAME || "",
  process.env.APA_PASSWORD || "",
);

const app = new Hono().basePath("/api");

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin, _) => {
      const nodeEnv = process.env.NODE_ENV || "development";
      const allowedOrigins =
        nodeEnv === "production"
          ? ["https://your-frontend-domain.com"]
          : ["http://localhost:3000", "http://localhost:5173"];

      if (!origin || allowedOrigins.includes(origin)) {
        return origin;
      }
      return allowedOrigins[0];
    },
    credentials: true,
  }),
);
app.use("*", supabaseMiddleware());

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  const nodeEnv = process.env.NODE_ENV || "development";
  return c.json(
    {
      error: nodeEnv === "production" ? "Internal server error" : err.message,
    },
    500,
  );
});

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.0.1",
  });
});

app.post("/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json(
        {
          error: "username and password are required",
        },
        400,
      );
    }

    if (username.length < 3 || password.length < 6) {
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
      email: `${username}@onthehill.app`,
      password: password,
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
        username: username,
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
    const { username, password } = body;

    if (!username || !password) {
      return c.json(
        {
          error: "username and password are required",
        },
        400,
      );
    }

    const supabase = getSupabase(c);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${username}@onthehill.app`,
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
        username: username,
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

    const player = await handlePlayerSearch(body.name.trim(), apaClient);

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
  try {
    const body = await c.req.json();
    if (!body.memberId) {
      return c.json(
        {
          error: "memberId is required in request body",
        },
        400,
      );
    }

    if (
      typeof body.memberId !== "string" ||
      body.memberId.trim().length === 0
    ) {
      return c.json(
        {
          error: "memberId must be a non-empty string",
        },
        400,
      );
    }

    const report = await handleReportGet(body.memberId.trim(), apaClient);

    return c.json(report);
  } catch (error) {
    console.error("Report get error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

const port = parseInt(process.env.PORT || "3000");
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
