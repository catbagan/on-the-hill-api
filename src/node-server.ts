import "dotenv/config";
import { serve } from "@hono/node-server";
import { InMemoryRateLimitStore } from "./middleware/rate-limit";
import { createApp } from "./server";

const port = Number(process.env.PORT) || 3000;

const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APA_USERNAME",
  "APA_PASSWORD",
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = createApp({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  apaUsername: process.env.APA_USERNAME!,
  apaPassword: process.env.APA_PASSWORD!,
  nodeEnv: process.env.NODE_ENV || "development",
  rateLimitStore: new InMemoryRateLimitStore(),
});

console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
