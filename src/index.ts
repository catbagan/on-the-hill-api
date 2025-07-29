import { Hono } from "hono";
import { getSupabase, supabaseMiddleware } from "./middleware/auth.middleware";
import { APAClient } from "./apa/client";
import { handlePlayerSearch } from "./player-search";
import { handleReportGet } from "./report-get";
import { handlePlayerRaw } from "./player-raw";

const app = new Hono().basePath("/api");
app.use("*", supabaseMiddleware());

const token = "lol"
const apaClient = new APAClient(token);

app.get("/", (c) => {
  return c.json({
    message: "On The Hill API",
    version: "0.0.1",
  });
});

app.post("/player/search", async (c) => {
  const body = await c.req.json();
  if (!body.name) {
    return c.json(
      {
        error: "name is required in request body",
      },
      400
    );
  }

  const player = await handlePlayerSearch(body.name, apaClient);

  if (!player) {
    return c.json(
      {
        error: "No player found",
      },
      404
    );
  }

  return c.json(player);
});

app.post("/player/raw", async (c) => {
  const body = await c.req.json();
  if (!body.name) {
    return c.json(
      {
        error: "name is required in request body",
      },
      400
    );
  }

  const player = await handlePlayerRaw(body.name, apaClient);

  if (!player) {
    return c.json(
      {
        error: "No player found",
      },
      404
    );
  }

  return c.json(player);
});

app.post("/report/get", async (c) => {
  const body = await c.req.json();
  if (!body.memberId) {
    return c.json(
      {
        error: "memberId is required in request body",
      },
      400
    );
  }

  const report = await handleReportGet(body.memberId, apaClient);

  return c.json(report);
});

export default app;
