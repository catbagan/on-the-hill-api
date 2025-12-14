import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createServerClient } from "@supabase/ssr";
import { APAClient } from "./apa/client";
import {
  authMiddleware,
  getSupabase,
  supabaseMiddleware,
} from "./middleware/auth.middleware";
import { handlePlayerSearch } from "./player-search";
import { handleReportGet } from "./report-get";
import { handleWrappedGet } from "./wrapped-get";

import "dotenv/config";

function validateEnvironmentVariables() {
  const requiredEnvVars = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
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
  });
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return c.json(
        {
          error: "User not found",
        },
        404,
      );
    }

    // Create a service role client for admin operations
    const supabaseAdmin = createServerClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // No-op for server-side operations
          },
        },
      }
    );

    // Delete the user account using the service role client
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
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

app.post("/wrapped/get", authMiddleware(), async (c) => {
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

    const wrapped = await handleWrappedGet(body.memberId.trim(), apaClient);

    return c.json(wrapped);
  } catch (error) {
    console.error("Wrapped get error:", error);
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

const port = parseInt(process.env.PORT || "3000");
console.log(`Server is running on port ${port}`);
// Use 0.0.0.0 to bind to both IPv4 and IPv6, allowing connections from both 127.0.0.1 and ::1
let hostname = "0.0.0.0";

serve({
  fetch: app.fetch,
  port,
  hostname,
});
